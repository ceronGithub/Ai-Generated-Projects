// =============================================
// keyword-handler.js — Keyword search logic
//
// Supports three keyword styles (auto-detected):
//
//   COLON    "Invoice #:"  "Created:"  "Business Style:"
//            Colon attached to keyword — value follows directly
//
//   SPACED   "Date :"  "Time :"  "Customer Name   :"  "Entry :"
//            Space(s) or tab + colon after keyword.
//            Common in PH formal/government invoices.
//            PDF.js renders these as separate tokens.
//            Handles \s{1,10} (tabs, multiple spaces).
//
//   BARE     "Description"  "Hours"  "Total"  "VAT"  "Title"
//            No colon — table column headers or standalone labels.
//            Engine skips co-searched sibling headers, then extracts.
//
// Numeric bare keywords split into two sub-types:
//   MONETARY — "Total", "VAT", "Amount", "Sales", "Vatable",
//              "Zero", "Exempt", "Rate", "Fee", "Charge"
//              → extracts decimal/currency values ($1,500.00 / 88.39)
//              → each distinct value becomes its own result card
//   INTEGER  — "Hours", "Count", "Qty", "Quantity", "Pages", "Units"
//              → extracts bare integer values only (e.g. 20)
//
// Key behaviours:
//   ✓ Time "14:42:17" never splits at "42:" — time guard in stop pattern
//   ✓ "VAT" does not match "VATTable" or "VAT-Exempt" — word-boundary guard
//   ✓ "Total" returns $1,500 AND $1,800 as two separate result cards
//   ✓ "Hours" returns 20 (integer), not the $1,500 adjacent in same row
//   ✓ "Exit :" returns "TARLAC CENTRAL TOLL PLAZA" — full compound value
//   ✓ "Customer Name   :" handles 1–10 spaces/tabs before colon
//   ✓ "Business Style: SMC TPLEX Corporation" not cut at "Corporation Tin:"
//   ✓ "Signature: Jordan Riverside" — trailing date/doc noise trimmed
//   ✓ "Title SMCX TPLEX CORPORATION" — bare label with ALL-CAPS value
// =============================================

const KeywordHandler = (() => {

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  /** Strip trailing colon(s) and normalise whitespace */
  function normalizeKw(kw) {
    return kw.replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Classify keyword colon style:
   *   'spaced' — "Date :"  "Entry :"  "Customer Name   :" (whitespace before colon)
   *   'colon'  — "Created:"  "Invoice #:"  (colon attached)
   *   'bare'   — "Total"  "VAT"  "Title"  (no colon)
   */
  function classifyKeyword(kw) {
    if (/\s+:$/.test(kw.trim())) return 'spaced';
    if (/:$/.test(kw.trim()))    return 'colon';
    return 'bare';
  }

  /**
   * Is this a monetary column keyword?
   * Monetary bare kws extract decimal/currency values.
   */
  function isMonetaryKw(kwNorm) {
    return /^(total|vat|amount|sales|vatable|zero|exempt|rate|fee|charge)/i.test(kwNorm);
  }

  /**
   * Is this an integer/count column keyword?
   * Integer bare kws extract whole-number values only.
   */
  function isIntegerKw(kwNorm) {
    return /^(hours|count|qty|quantity|pages?|units?)/i.test(kwNorm);
  }

  /**
   * Build the regex that locates a keyword label in raw PDF text.
   *
   * colonPart strategy:
   *   spaced → \s{1,10}:\s*   (1–10 spaces/tabs, then colon)
   *   colon  → \s*:?\s*       (optional colon gap from PDF.js tokenisation)
   *   bare   → \s*            (no trailing consumption)
   *
   * Both left (?<![\w\-]) and right (?![\w\-]) word-boundary guards
   * prevent mid-word matches ("VAT" never hits "VATTable" or "VAT-Exempt").
   */
  function buildKeywordRegex(kw) {
    const norm    = normalizeKw(kw);
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const type    = classifyKeyword(kw);

    let colonPart;
    if (type === 'spaced' || type === 'colon') {
      // Unified: allow 0–10 spaces/tabs before the colon.
      // Handles all real-world colon styles in one pattern:
      //   attached → "SALES INVOICE NUMBER:"  (0 spaces)
      //   spaced   → "Date :"  "Customer Name   :"  (1–10 spaces)
      //   tab      → "Date\t:"  "Entry\t:"
      // Also means users can type "SALES INVOICE NUMBER :" OR "SALES INVOICE NUMBER:"
      // and both match regardless of how the PDF renders the colon gap.
      colonPart = '\\s{0,10}:\\s*';
    } else {
      colonPart = '\\s*';
    }

    const inner = escaped + '(?![\\w\\-])' + colonPart;
    return new RegExp('(?<![\\w\\-])' + inner, 'gi');
  }

  // ─── STOP POSITION BUILDER ──────────────────────────────────────────────────
  //
  // Builds a sorted array of text positions where a captured value MUST end.
  //
  // Sources:
  //   1. Every searched keyword's own match position (cross-keyword boundary)
  //   2. Generic single-word label: mixed-case word + colon
  //      Requires second character lowercase — filters ALL-CAPS value tokens
  //      ("TPLEX", "CORPORATION", "NRC") while keeping real labels
  //      ("Address:", "Style:", "Number:").
  //   3. Spaced-colon separator \s{1,10}:\s (PH invoice format)
  //   4. Numeric field labels "006-977-514-000 :"
  //   5. Boilerplate hard stops ("THIS SERVES AS", "Accreditation No")

  function findAllStopPositions(text, allKeywords) {
    const posSet = new Set();

    // 1. Every keyword match → hard stop
    for (const kw of allKeywords) {
      const re = buildKeywordRegex(kw);
      let m;
      while ((m = re.exec(text)) !== null) posSet.add(m.index);
    }

    // 2. Generic single-word mixed-case label + colon (NOT time values — (?!\d) guard)
    const labelRe = /(?<![a-z\d])([A-Z][a-z][A-Za-z#\-\.]{0,13})\s{0,3}:(?!\d)/g;
    let m;
    while ((m = labelRe.exec(text)) !== null) posSet.add(m.index);

    // 3. Spaced-colon field separator
    const spacedRe = /\s{1,10}:\s/g;
    while ((m = spacedRe.exec(text)) !== null) posSet.add(m.index);

    // 4. Numeric field labels (TIN / reference numbers acting as field markers)
    const numRe = /\b\d[\d\-]{4,}\s*:/g;
    while ((m = numRe.exec(text)) !== null) posSet.add(m.index);

    // 5. Boilerplate hard stops
    for (const phrase of ['THIS SERVES AS', 'Accreditation No']) {
      let pos = text.indexOf(phrase);
      while (pos !== -1) { posSet.add(pos); pos = text.indexOf(phrase, pos + 1); }
    }

    return Array.from(posSet).sort((a, b) => a - b);
  }

  // ─── TRAILING NOISE TRIMMER ─────────────────────────────────────────────────
  //
  // Strips common PDF-artefact suffixes from extracted values.
  // Example: "Jordan Riverside 2/25/26, 1:45 AM Document" → "Jordan Riverside"
  // Safe: pure date values like "01/07/2026" are NOT trimmed (no leading text).

  function trimTrailingNoise(value) {
    value = value.replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, '').trim();
    value = value.replace(/\s+(Document|Page\s*\d*)\s*$/i, '').trim();
    return value;
  }

  // ─── TITLE CASE FORMATTER ───────────────────────────────────────────────────
  //
  // Ensures every word's first letter is uppercase and every letter immediately
  // following a "." is uppercase. Leaves the rest of each word unchanged so that
  // ALL-CAPS codes ("INV-2026-042", "TPLEX000045430892"), numbers ("88.39",
  // "$1,500.00"), dates ("01/07/2026") and times ("14:42:17") are untouched
  // while plain-text values are consistently formatted.
  //
  // Examples:
  //   "national grid corporation" → "National Grid Corporation"
  //   "ANAO TOLL PLAZA"           → "ANAO TOLL PLAZA"  (already has capital firsts)
  //   "quezon ave. cor. bir road" → "Quezon Ave. Cor. Bir Road"
  //   "88.39"                     → "88.39"            (no alpha → untouched)

  function toTitleCase(val) {
    if (!val) return val;

    // Step 1: transform each space-separated word
    const titled = val.split(' ').map(word => {
      if (!word) return word;

      // Find the index of the first alphabetic character
      let firstAlpha = -1;
      for (let i = 0; i < word.length; i++) {
        if (/[a-zA-Z]/.test(word[i])) { firstAlpha = i; break; }
      }
      if (firstAlpha === -1) return word; // no letters (pure number/symbol) → unchanged

      // If the word contains any digit, it is a code / ID / number token
      // (e.g. "INV-2026-042", "TPLEX000045430892", "11/F", "01/07/2026", "14:42:17")
      // → preserve exactly as-is
      if (/\d/.test(word)) return word;

      // Pure-text word → lowercase all, then uppercase the first alpha character
      const lower = word.toLowerCase();
      return lower.slice(0, firstAlpha) + lower[firstAlpha].toUpperCase() + lower.slice(firstAlpha + 1);
    }).join(' ');

    // Step 2: capitalise first alpha character after each '.'
    // Handles "Ave. cor." → "Ave. Cor." even when the next word wasn't space-separated
    return titled.replace(/\.([^a-zA-Z]*)([a-zA-Z])/g, (_, gap, letter) => {
      return '.' + gap + letter.toUpperCase();
    });
  }

  // ─── VALUE EXTRACTOR ────────────────────────────────────────────────────────
  //
  // Slices text from matchEnd to the first stop AT OR AFTER matchEnd.
  // A stop exactly at matchEnd → null (empty value / adjacent headers).

  function extractValueAt(text, matchEnd, stopPositions, maxLen = 200) {
    const nextStop = stopPositions.find(p => p >= matchEnd);
    if (nextStop === matchEnd) return null;
    const stopAt = nextStop !== undefined
      ? Math.min(nextStop, matchEnd + maxLen)
      : Math.min(text.length, matchEnd + maxLen);

    let value = text.slice(matchEnd, stopAt);
    value = value.replace(/^[\s:–—\-]+/, '').replace(/\s+/g, ' ').trim();
    value = value.replace(/[\s:–—\-,]+$/, '').trim();
    value = trimTrailingNoise(value);
    value = toTitleCase(value);
    return value.length > 0 ? value : null;
  }

  // ─── TABLE COLUMN EXTRACTOR ─────────────────────────────────────────────────
  //
  // For bare keywords (column headers like "Description  Hours  Total"):
  //   1. Skip co-searched sibling headers that immediately follow the match
  //   2. Extract value(s) from the data region after the skip
  //
  // Special case — MONETARY keyword as last column header (e.g. "Total"):
  //   If no sibling headers to skip, still try to extract currency values directly
  //   from the segment right after the match ("Total $1,500.00" → "$1,500.00").
  //
  // Numeric sub-types after skipping:
  //   MONETARY → decimal/currency values  → each as its own result card
  //   INTEGER  → bare whole-number values → each as its own result card
  //   TEXT     → strip trailing numerics, return text content

  function extractTableColumnValues(text, matchEnd, keyword, allKeywords, stopPositions) {
    const kwPatterns = allKeywords.map(kw =>
      normalizeKw(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const skipRe = new RegExp(
      '^\\s*(?:' + kwPatterns.join('|') + ')(?![\\w\\-])\\s{0,4}:?\\s*',
      'i'
    );

    let pos      = matchEnd;
    let skipped  = false;
    let maxSkips = allKeywords.length + 3;
    while (maxSkips-- > 0) {
      const skip = text.slice(pos).match(skipRe);
      if (!skip) break;
      pos     += skip[0].length;
      skipped  = true;
    }

    const kwNorm = normalizeKw(keyword).toLowerCase();
    const isMon  = isMonetaryKw(kwNorm);
    const isInt  = isIntegerKw(kwNorm);

    // ── Monetary keyword with no sibling skips (last column / inline label) ──
    if (!skipped) {
      if (isMon) {
        const nextStop = stopPositions.find(p => p >= matchEnd);
        if (nextStop === matchEnd) return [];
        const boundary = nextStop !== undefined
          ? Math.min(nextStop, matchEnd + 300)
          : matchEnd + 300;
        const seg  = text.slice(matchEnd, boundary);
        const nums = [...seg.matchAll(/(?:Php\s*)?\$?[\d,]+\.\d{2}/g)];
        return [...new Set(nums.map(n => toTitleCase(n[0].trim())))].filter(Boolean);
      }
      return [];
    }

    // ── Post-skip extraction ──────────────────────────────────────────────────
    const nextStop = stopPositions.find(p => p >= pos);
    if (nextStop === pos) return [];
    const boundary = nextStop !== undefined
      ? Math.min(nextStop, pos + 300)
      : pos + 300;
    const segment = text.slice(pos, boundary);

    if (isMon) {
      const decimals = [...segment.matchAll(/(?:Php\s*)?\$?[\d,]+\.\d{2}/g)];
      if (decimals.length > 0) {
        return [...new Set(decimals.map(n => toTitleCase(n[0].trim())))].filter(Boolean);
      }
      // Fallback to bare integers if no decimals found
      const ints = [...segment.matchAll(/(?<![,\$\d\.])(\b\d{1,6}\b)(?![,\.\d])/g)];
      return [...new Set(ints.map(n => toTitleCase(n[1].trim())))].filter(Boolean);
    }

    if (isInt) {
      // Bare integers only — not adjacent to . or , (excludes parts of "$1,500.00")
      const ints = [...segment.matchAll(/(?<![,\$\d\.])(\b\d{1,6}\b)(?![,\.\d])/g)];
      return [...new Set(ints.map(n => toTitleCase(n[1].trim())))].filter(Boolean);
    }

    // Text column — strip trailing number columns (amounts that follow text in row)
    let value = segment.replace(/^[\s:–—\-]+/, '').trim().replace(/\s+/g, ' ');
    value = value.replace(/(\s+(?:\$?[\d,]+(?:\.\d+)?|\d+)){1,5}\s*$/, '').trim();
    value = value.replace(/[\s:–—\-,]+$/, '').trim();
    return value.length > 0 ? [toTitleCase(value)] : [];
  }

  // ─── MAIN SEARCH ────────────────────────────────────────────────────────────

  function search(pdfData, keywords) {
    const results = [];

    for (const { file, pages } of pdfData) {
      const filename = file.name;

      for (const { page, text } of pages) {
        const stopPositions = findAllStopPositions(text, keywords);

        for (const keyword of keywords) {
          const found  = [];
          const seen   = new Set();
          const regex  = buildKeywordRegex(keyword);
          const type   = classifyKeyword(keyword);
          const kwNorm = normalizeKw(keyword).toLowerCase();

          let m;
          while ((m = regex.exec(text)) !== null) {
            const matchEnd = m.index + m[0].length;
            let values = [];

            if (type === 'bare') {
              const tableVals = extractTableColumnValues(
                text, matchEnd, keyword, keywords, stopPositions
              );
              if (tableVals.length > 0) {
                values = tableVals;
              } else {
                const dv = extractValueAt(text, matchEnd, stopPositions);
                if (dv) {
                  const isNum = isMonetaryKw(kwNorm) || isIntegerKw(kwNorm);
                  if (isNum) {
                    // Numeric bare keywords only accept numeric/currency fallbacks
                    if (/^[\$\d]|^Php/i.test(dv)) values = [dv];
                  } else {
                    if (dv.length < 100 || /^[\$\d]/.test(dv)) values = [dv];
                  }
                }
              }
            } else {
              // colon / spaced — direct extraction
              const dv = extractValueAt(text, matchEnd, stopPositions);
              if (dv) values = [dv];
            }

            for (const value of values) {
              const key = value.toLowerCase().replace(/[\s,$]/g, '').slice(0, 60);
              if (!seen.has(key)) { seen.add(key); found.push(value); }
            }

            if (m[0].length === 0) regex.lastIndex++;
          }

          // Each distinct value → its own result card
          for (const ctx of found) {
            results.push({
              page,
              filename,
              keyword,
              contexts:       [ctx],
              closestContext: ctx,
            });
          }
        }
      }
    }

    return results;
  }

  // ─── HIGHLIGHT ──────────────────────────────────────────────────────────────

  function highlight(text, keyword) {
    const norm    = normalizeKw(keyword);
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp('(' + escaped + ':?)', 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // ─── FIND CONTEXTS (single-page utility) ────────────────────────────────────

  function findContexts(text, keyword) {
    const stopPositions = findAllStopPositions(text, [keyword]);
    const results = [];
    const seen    = new Set();
    const regex   = buildKeywordRegex(keyword);
    const type    = classifyKeyword(keyword);
    const kwNorm  = normalizeKw(keyword).toLowerCase();

    let m;
    while ((m = regex.exec(text)) !== null) {
      const matchEnd = m.index + m[0].length;
      let values = [];

      if (type === 'bare') {
        const tv = extractTableColumnValues(text, matchEnd, keyword, [keyword], stopPositions);
        if (tv.length > 0) {
          values = tv;
        } else {
          const dv = extractValueAt(text, matchEnd, stopPositions);
          if (dv) {
            const isNum = isMonetaryKw(kwNorm) || isIntegerKw(kwNorm);
            if (isNum) {
              if (/^[\$\d]|^Php/i.test(dv)) values = [dv];
            } else {
              if (dv.length < 100 || /^[\$\d]/.test(dv)) values = [dv];
            }
          }
        }
      } else {
        const dv = extractValueAt(text, matchEnd, stopPositions);
        if (dv) values = [dv];
      }

      for (const value of values) {
        const key = value.toLowerCase().slice(0, 50);
        if (!seen.has(key)) { seen.add(key); results.push(value); }
      }

      if (m[0].length === 0) regex.lastIndex++;
    }

    return results;
  }

  // ─── EXTRACT FIELDS (for Extract All mode) ──────────────────────────────────

  const LABEL_PATTERN =
    /^(invoice\s*#|created|from|to|description|hours|total|signature|date|due|bill|pay|amount|subtotal|tax|note|terms|po\s*#|ref|attn)/i;

  function tokenize(text) {
    return text.split(/\s+/).filter(t => t.length > 0);
  }

  function extractFields(text) {
    const fields = [];
    const tokens = tokenize(text);
    let i = 0;

    while (i < tokens.length) {
      const token   = tokens[i];
      const isLabel = /:\s*$/.test(token) || LABEL_PATTERN.test(token);

      if (isLabel) {
        const label       = token.replace(/:$/, '').trim();
        const valueTokens = [];
        let j = i + 1;

        while (j < tokens.length && /^[:\-–—]+$/.test(tokens[j])) j++;

        while (j < tokens.length) {
          const t = tokens[j];
          if (/:\s*$/.test(t) || LABEL_PATTERN.test(t)) break;
          valueTokens.push(t);
          if (valueTokens.join(' ').length >= 120) break;
          j++;
        }

        const value = valueTokens.join(' ').trim();
        if (label.length > 0 && value.length > 0) fields.push({ label, value });
        i = j;
      } else {
        i++;
      }
    }

    return fields;
  }

  return { search, highlight, findContexts, extractFields };
})();