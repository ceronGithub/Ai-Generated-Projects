// =============================================
// table-parser.js — SMC Skyway / SMC SLEX
// Transaction History Report table extractor
//
// Input:  pdfData from PDFProcessor.extractAll()
// Output: Array<TransactionRow>
//
// TransactionRow = {
//   filename, page,
//   tagNumber, plateNumber,
//   refType,                  ← 'Ref No.' | 'IER No.'
//   refNo,
//   date, time,               ← from FIRST leg
//   esiNos,                   ← joined string of all leg E-SI numbers
//   zones,                    ← joined string of all unique zones
//   entries,                  ← joined string of all leg entry names
//   exits,                    ← joined string of all leg exit names
//   tollFee,                  ← GROUP TOTAL from "Total : Php X" line
// }
//
// Multi-leg transactions (2+ rows under the same Ref No.) are MERGED:
//   - date/time taken from the first leg
//   - esiNos, zones, entries, exits are joined with  " | "
//   - tollFee is the authoritative group total from the PDF "Total :" line
//
// State machine flow per page:
//   text → splitIntoLines() → line-by-line:
//     TagNumber header  → open new vehicle group
//     Ref/IER No. header → flush previous group, open new transaction group
//     data row (date + ESI + zone + ...) → append leg to pendingLegs
//     Total : Php X     → flush group with that total, reset
//     Total Usage       → flush + reset vehicle group
//     Replenishment /
//     Summary           → stop (non-transaction section)
// =============================================

const TableParser = (() => {

  // ── Zone codes — prefix of every E-SI number ────────────────────────────
  const ZONE_CODES = new Set([
    'SKYWAY','SLEX','NAIAX','MMSS3','TPLEX','SIDC',
    'MCX','CALAX','CAVITEX','NCSR','NLEX','SCTEX',
  ]);

  // ── Keyword sets for splitting Entry vs Exit in the middle tokens ────────
  // These are words that reliably START an Exit location name in SMC reports.
  const EXIT_STARTERS = new Set([
    'TERMINAL','ENTERTAINMENT','COASTAL','ALABANG','MAKATI',
    'NAGTAHAN','BUENDIA','PLAZA','QUIRINO','NAIAX-COASTAL-PASAY',
    'SOUTH','NORTH','CALAMBA','BATANGAS','TARLAC','CARMEN',
    'MERVILLE','NICHOLS','ABI-GREENFIELD','MAMPLASAN','FILINVEST',
    'CARMONA','SOUTHWOODS','SANTA','SAN','SUSANA','CABUYAO',
    'DEFAULT','STAGE3',
  ]);

  // ── Regexes ──────────────────────────────────────────────────────────────
  const RE_TAG      = /TagNumber\s*:\s*(\S+)\s+Plate\s+Number\s*:\s*(\S+)/i;
  const RE_REF      = /^(Ref\s+No\.|IER\s+No\.)\s*:\s*(\d+)/i;
  // Data line: MM/DD/YYYY  H:MM:SS  <ESI>  <ZONE>  <...rest...>
  const RE_DATALINE = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s+(\S+)\s+(\S+)\s+(.*)/;
  const RE_TOTAL    = /^Total\s*:\s*Php\s*([\d,]+\.?\d*)/i;
  const RE_USAGE    = /^Total\s+Usage\s*:\s*Php/i;
  const RE_REPLEN   = /^Replenishment\b/i;
  const RE_SUMMARY  = /^Summary\s+of\s+Total/i;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function parseAmt(s) {
    return parseFloat((s || '0').replace(/,/g, '')) || 0;
  }

  /**
   * Given the "rest" tokens after [date time esiNo zone] on a data line,
   * split into entry, exit, and tollFee (this leg's individual fee — used
   * only if no group Total line follows; normally we use the group total).
   *
   * Format:  ENTRY_WORDS... EXIT_WORDS... TOLL_FEE
   *
   * Toll fee = last token if it looks numeric.
   * Entry / Exit boundary = first EXIT_STARTERS hit (after ≥1 entry token)
   * or second ZONE_CODE occurrence.
   */
  function splitEntryExit(tokens) {
    if (!tokens.length) return { entry: '', exit: '', legFee: 0 };

    // Peel toll fee from the right
    const last   = tokens[tokens.length - 1];
    const hasFee = /^\d[\d,]*\.?\d*$/.test(last.trim());
    const legFee = hasFee ? parseAmt(last) : 0;
    const mid    = hasFee ? tokens.slice(0, -1) : [...tokens];

    if (!mid.length) return { entry: '', exit: '', legFee };

    // Find split point
    let splitAt = -1;
    for (let i = 1; i < mid.length; i++) {
      const tok = mid[i].toUpperCase();
      if (i > 0 && ZONE_CODES.has(tok))       { splitAt = i; break; }
      if (i >= 1 && EXIT_STARTERS.has(tok))   { splitAt = i; break; }
    }

    let entry, exit;
    if (splitAt > 0) {
      entry = mid.slice(0, splitAt).join(' ');
      exit  = mid.slice(splitAt).join(' ');
    } else {
      // Fallback: split at midpoint
      const half = Math.ceil(mid.length / 2);
      entry = mid.slice(0, half).join(' ');
      exit  = mid.slice(half).join(' ');
    }

    return { entry: entry.trim(), exit: exit.trim(), legFee };
  }

  // ── splitIntoLines ────────────────────────────────────────────────────────
  // PDFProcessor.extractAll() produces one long space-joined string per page.
  // We reinsert logical line breaks before known structural anchors so the
  // state machine can process line-by-line.
  function splitIntoLines(text) {
    const sep = '\x00';
    const s = text
      .replace(/(TagNumber\s*:)/gi,            sep + '$1')
      .replace(/((Ref|IER)\s+No\.\s*:)/gi,     sep + '$1')
      .replace(/(Total\s*:\s*Php)/gi,          sep + '$1')
      .replace(/(Total\s+Usage\s*:)/gi,        sep + '$1')
      .replace(/(Replenishment\b)/gi,          sep + '$1')
      .replace(/(Summary\s+of\s+Total)/gi,     sep + '$1')
      // Break before each date-time stamp
      .replace(/(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/g, sep + '$1');

    return s.split(sep).map(l => l.trim()).filter(Boolean);
  }

  // ── Merge pendingLegs into one TransactionRow and push to rows ────────────
  function flushGroup(pendingLegs, groupTotal, rows) {
    if (!pendingLegs.length) return;

    const first = pendingLegs[0];

    // Collect per-leg values
    const esiNos  = pendingLegs.map(l => l.esiNo).filter(Boolean);
    const zones   = [...new Set(pendingLegs.map(l => l.zone).filter(Boolean))];
    const entries = pendingLegs.map(l => l.entry).filter(Boolean);
    const exits   = pendingLegs.map(l => l.exit).filter(Boolean);

    // Sum individual leg fees as fallback when no Total line was found
    const legSum = pendingLegs.reduce((s, l) => s + l.legFee, 0);

    rows.push({
      filename:    first.filename,
      page:        first.page,
      tagNumber:   first.tagNumber,
      plateNumber: first.plateNumber,
      refType:     first.refType,
      refNo:       first.refNo,
      date:        first.date,
      time:        first.time,
      esiNos:      esiNos.join(' | '),
      zones:       zones.join(' | '),
      entries:     entries.join(' | '),
      exits:       exits.join(' | '),
      // Use the authoritative group total from the PDF's "Total : Php" line.
      // Fall back to the sum of individual leg fees if no Total line appeared.
      tollFee:     groupTotal > 0 ? groupTotal : legSum,
    });
  }

  // ── Main parse ─────────────────────────────────────────────────────────────
  /**
   * @param {Array<{file: File, pages: Array<{page, text}>}>} pdfData
   * @returns {Array<TransactionRow>}
   */
  function parse(pdfData) {
    const rows = [];

    for (const { file, pages } of pdfData) {
      for (const { page, text } of pages) {
        const lines = splitIntoLines(text);

        let tagNumber   = '';
        let plateNumber = '';
        let refNo       = '';
        let refType     = '';
        let pendingLegs = [];
        let groupTotal  = 0;
        let stop        = false;

        for (const line of lines) {
          if (!line || stop) continue;

          // ── Stop sections (non-transaction data) ──────────────────────
          if (RE_REPLEN.test(line) || RE_SUMMARY.test(line)) {
            flushGroup(pendingLegs, groupTotal, rows);
            pendingLegs = []; groupTotal = 0;
            stop = true;
            continue;
          }

          // ── TagNumber : XXXX  Plate Number : YYYY ─────────────────────
          const tagM = RE_TAG.exec(line);
          if (tagM) {
            flushGroup(pendingLegs, groupTotal, rows);
            pendingLegs  = []; groupTotal = 0;
            tagNumber    = tagM[1];
            plateNumber  = tagM[2];
            refNo = ''; refType = '';
            continue;
          }

          // ── Ref No. : XXXXXXXXXX  /  IER No. : XXXXXXXXXX ─────────────
          const refM = RE_REF.exec(line);
          if (refM) {
            // Close the previous transaction group before opening a new one
            flushGroup(pendingLegs, groupTotal, rows);
            pendingLegs = []; groupTotal = 0;
            refType     = refM[1].replace(/\s+/g, ' ').trim();
            refNo       = refM[2];
            continue;
          }

          // ── Total Usage : Php X  (vehicle-group subtotal) ─────────────
          if (RE_USAGE.test(line)) {
            flushGroup(pendingLegs, groupTotal, rows);
            pendingLegs = []; groupTotal = 0;
            continue;
          }

          // ── Total : Php X.XX  (Ref-group total — the authoritative fee) ─
          const totM = RE_TOTAL.exec(line);
          if (totM) {
            groupTotal = parseAmt(totM[1]);
            flushGroup(pendingLegs, groupTotal, rows);
            pendingLegs = []; groupTotal = 0;
            continue;
          }

          // ── Data row ────────────────────────────────────────────────────
          const dm = RE_DATALINE.exec(line);
          if (dm) {
            const date   = dm[1];
            const time   = dm[2];
            const esiNo  = dm[3];
            const zone   = dm[4].toUpperCase();
            const rest   = dm[5].trim();
            const tokens = rest.split(/\s+/);
            const { entry, exit, legFee } = splitEntryExit(tokens);

            pendingLegs.push({
              filename:    file.name,
              page,
              tagNumber,
              plateNumber,
              refType,
              refNo,
              date,
              time,
              esiNo,
              zone,
              entry,
              exit,
              legFee,
            });
            continue;
          }
        }

        // Flush any trailing group at end of page
        flushGroup(pendingLegs, groupTotal, rows);
      }
    }

    return rows;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  // ── Table detection ────────────────────────────────────────────────────────
  /**
   * Scans pdfData and returns true if any page looks like it contains
   * a structured table (transaction history / grid of rows with repeated
   * column-like patterns).
   *
   * Heuristics (ANY match = table detected):
   *  1. TagNumber header line (SMC-style transaction report)
   *  2. 5+ data lines matching the date/ESI/zone pattern on a single page
   *  3. 4+ consecutive lines that each have 4+ tab/multi-space separated tokens
   *     (generic table grid detection)
   *
   * @param {Array<{file, pages}>} pdfData
   * @returns {boolean}
   */
  function detectTable(pdfData) {
    const MULTI_SPACE = /\s{2,}/;           // 2+ spaces = column separator
    const MIN_COLS    = 4;                  // min tokens per line to count as a grid row
    const MIN_GRID    = 4;                  // min consecutive grid rows to flag a table

    for (const { pages } of pdfData) {
      for (const { text } of pages) {
        const lines = splitIntoLines(text);

        // Heuristic 1 — SMC TagNumber header
        if (lines.some(l => RE_TAG.test(l))) return true;

        // Heuristic 2 — 5+ data lines (date + ESI pattern)
        const dataCount = lines.filter(l => RE_DATALINE.test(l)).length;
        if (dataCount >= 5) return true;

        // Heuristic 3 — 4+ consecutive multi-column lines (generic grid)
        let streak = 0;
        for (const line of lines) {
          const cols = line.trim().split(MULTI_SPACE).filter(Boolean);
          if (cols.length >= MIN_COLS) {
            streak++;
            if (streak >= MIN_GRID) return true;
          } else {
            streak = 0;
          }
        }
      }
    }
    return false;
  }

  return { parse, detectTable };

})();