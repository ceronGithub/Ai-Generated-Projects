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
//
// SMC INVOICE FIXES (2-column interleaved PDF layout):
//
//   The SMC invoice form uses a 2-column layout:
//     LEFT  column: Date :  Time :  Customer Name :  TIN :  Business Style :  Address :
//     RIGHT column: (blank) 01/07/2025  15:21:49  NATIONAL GRID...  006-977...
//
//   PDF.js collapses this into ONE string by reading left-col labels first,
//   then right-col values, producing:
//     "Date : Time : 01/07/2025 : 15:21:49 Customer Name : ..."
//
//   Fix A — INTERLEAVED-LABEL RESOLVER (extractValueAt):
//     After matching "Date :", if the text immediately following starts with
//     a sibling label (Time, Customer Name, TIN, Business Style, Address),
//     skip past that sibling label + colon before extracting the value.
//     Result: "Date :" → "01/07/2025" ✓
//
//   Fix B — "Time" as whole-page HH:MM:SS scanner (like "Date"):
//     In the collapsed string, "Time :" is followed by "01/07/2025" (the DATE
//     value placed there by column-order reading). The 2-pass engine would
//     erroneously return the date for "Time".  Instead, "Time" now triggers
//     the same whole-page TIME_ONLY_RE scan it always used — bypassing the
//     2-pass regex entirely. Result: "Time" → "15:21:49" ✓
//
//   Fix C — ENTRY/EXIT stop-pattern anchor:
//     "MAMPLASAN NORTH ENTRY/EXIT" contains the word "ENTRY" but has NO colon
//     after it. The stop pattern now requires \bEntry\s*: or \bExit\s*: so
//     "ENTRY/EXIT" inside a value never triggers a premature stop.
//     Result: "Entry :" → "MAMPLASAN NORTH ENTRY/EXIT" ✓
//
//   Fix D — SALES INVOICE NUMBER special extractor:
//     Detects "Sales Invoice Number" as a keyword alias and extracts the
//     alphanumeric code (e.g. MMSS3000053914465) directly after the colon.
//
//   Fix E — VATABLE SALES / VAT positional extractor:
//     The block "Vatable Sales VAT-Exempt Sales Zero-Rated Sales VAT 93.75
//     0.00 0.00 11.25" jams 4 numbers after 4 sibling headers with no
//     individual label:value pairing.  New positional approach:
//       "Vatable Sales" → 1st decimal in block = 93.75
//       "VAT"           → 4th  (last) decimal before "Total Amount" = 11.25
//     Word-boundary guard already prevents matching "VAT-Exempt" or "VAT Reg TIN".
//
//   Fix F — CUSTOMER NAME stop boundary:
//     "Customer Name :" value must stop before "TIN :" not at next label token.
//     The address field on these invoices can include "COR." abbreviations that
//     previously triggered mixed-case label stops prematurely.
// =============================================

const KeywordHandler = (() => {

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  /** Strip trailing colon(s) and normalise whitespace */
  function normalizeKw(kw) {
    // Strip trailing colon + whitespace, then remove apostrophes/smart quotes
    // (users sometimes type "Sale's" but PDF labels never contain apostrophes)
    return kw
      .replace(/\s*:\s*$/, '')
      .replace(/[\u2018\u2019\u201B'']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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
   * Is this a date keyword?
   * e.g. "date", "date :", "printed date :", "Date:"
   */
  function isDateKw(kwNorm) {
    return /\bdate\b/.test(kwNorm);
  }

  /**
   * Is this a time keyword?
   * e.g. "time", "time :", "Time"
   */
  function isTimeKw(kwNorm) {
    return /\btime\b/.test(kwNorm);
  }

  /**
   * Is this a zone keyword?
   * e.g. "zone", "zone :", "Zone"
   */
  function isZoneKw(kwNorm) {
    return /\bzone\b/.test(kwNorm);
  }

  /**
   * Is this a Ref No. keyword?
   * e.g. "Ref No.:", "Ref No. :"
   */
  function isRefNoKw(kwNorm) {
    return /\bref\s*no\b/i.test(kwNorm);
  }

  /**
   * Is this an IER No. keyword?
   * e.g. "IER No.:", "IER No. :"
   */
  function isIerNoKw(kwNorm) {
    return /\bier\s*no\b/i.test(kwNorm);
  }

  /**
   * Is this an E-SI No. keyword?
   * e.g. "E-SI No.:", "E-SI No. :"
   */
  function isEsiNoKw(kwNorm) {
    return /\be-si\s*no\b/i.test(kwNorm);
  }

  /**
   * Is this a Sales Invoice Number keyword?
   * e.g. "Sales Invoice Number:", "SALES INVOICE NUMBER:", "Sales Invoice No."
   */
  function isSalesInvoiceNoKw(kwNorm) {
    return /sales\s+invoice\s+(number|no)/i.test(kwNorm);
  }

  /**
   * Is this a Vatable Sales keyword? (SMC invoice tax block — 1st decimal)
   * e.g. "Vatable Sales", "Vatable"
   */
  function isVatableSalesKw(kwNorm) {
    return /^vatable/i.test(kwNorm);
  }

  /**
   * Is this a bare VAT-only keyword? (SMC invoice tax block — 4th/last decimal)
   * Matches "VAT" alone, but NOT "VAT-Exempt", "VAT Reg", "Vatable".
   */
  function isVatOnlyKw(kwNorm) {
    return /^vat$/i.test(kwNorm);
  }

  /**
   * Is this a Customer Name keyword?
   * e.g. "Customer Name :", "Customer Name:"
   */
  function isCustomerNameKw(kwNorm) {
    return /^customer\s+name$/i.test(kwNorm);
  }

  // ── SMC INVOICE: SIBLING-LABEL PATTERN ──────────────────────────────────
  //
  // In SMC invoices the 2-column form layout causes PDF.js to produce:
  //   "Date : Time : 01/07/2025 : 15:21:49 Customer Name : ..."
  //
  // After matching a spaced-colon keyword, if the text immediately following
  // starts with one of these sibling label patterns, we skip past it before
  // extracting the actual value.
  //
  // Matches (case-insensitive, leading spaces already stripped):
  //   Time :    Customer Name :    TIN :    Business Style :    Address :
  const SMC_SIBLING_RE = /^(Time|Customer\s+Name|TIN|Business\s+Style|Address)\s{0,10}:/i;

  /**
   * Extract the value for an SMC-style "Date :" keyword by skipping the
   * interleaved sibling "Time :" label that PDF.js inserts before the value.
   *
   * Raw after "Date :": "Time : 01/07/2025 : 15:21:49 Customer Name : ..."
   *                             ↑ skip this  ↑ grab date up to next label
   *
   * @param {string} afterKw  - text starting immediately after "Date :"
   * @param {number[]} stops  - sorted stop positions (global offsets, not used here)
   * @returns {string|null}
   */
  function extractSMCInterleavedValue(afterKw) {
    // Strip leading whitespace / stray colons
    let s = afterKw.replace(/^[\s:]+/, '');

    // If sibling label found, skip past it + its colon
    const sib = SMC_SIBLING_RE.exec(s);
    if (sib) {
      s = s.slice(sib[0].length).replace(/^[\s:]+/, '');
    }

    // Grab up to the next known label start or end-of-meaningful-content
    const stopRe = /\b(Time|Customer\s+Name|TIN\s*:|Business\s+Style\s*:|Address\s*:|Entry\s*:|Exit\s*:|Vatable|THIS\s+SERVES)/i;
    const stopM  = stopRe.exec(s);
    let value    = stopM ? s.slice(0, stopM.index) : s.slice(0, 30);
    value        = value.replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim();
    value        = cleanValue(value);
    return value.length > 0 ? value : null;
  }

  /**
   * Extract Vatable Sales value from the SMC tax block.
   * Block shape: "Vatable Sales VAT-Exempt Sales Zero-Rated Sales VAT 93.75 0.00 0.00 11.25"
   * Returns the FIRST decimal number = Vatable Sales amount.
   */
  function extractVatableSales(text, matchEnd) {
    const seg = text.slice(matchEnd, matchEnd + 300);
    // Skip sibling label text until we reach the first decimal
    const m = seg.match(/(?:VAT-Exempt\s+Sales\s+Zero-Rated\s+Sales\s+VAT\s+)?(\d+\.\d{2})/);
    return m ? m[1] : null;
  }

  /**
   * Extract bare VAT amount from the SMC tax block.
   * Block shape: "VAT-Exempt Sales Zero-Rated Sales VAT 93.75 0.00 0.00 11.25 Total Amount"
   * The bare "VAT" label precedes all 4 numbers; the VAT amount is the 4th (last) one.
   * We scan forward to "Total Amount" and grab the last decimal before it.
   */
  function extractVatAmount(text, matchEnd) {
    const totalIdx = text.indexOf('Total Amount', matchEnd);
    const boundary = totalIdx > matchEnd ? totalIdx : matchEnd + 300;
    const seg      = text.slice(matchEnd, boundary);
    const nums     = [...seg.matchAll(/\d+\.\d{2}/g)];
    if (nums.length === 0) return null;
    return nums[nums.length - 1][0]; // last decimal = VAT
  }

  /**
   * Extract Sales Invoice Number from SMC invoices.
   * Pattern: "SALES INVOICE NUMBER: MMSS3000053914465"
   * The value is an alphanumeric code that may contain digits and letters.
   */
  function extractSalesInvoiceNo(text, matchEnd) {
    const seg = text.slice(matchEnd, matchEnd + 60).replace(/^[\s:]+/, '');
    // Grab alphanumeric token (the invoice number)
    const m = seg.match(/^([A-Z0-9]+)/i);
    return m ? m[1] : null;
  }

  // ── REF NO REGEX ─────────────────────────────────────────────────────────
  // Matches "Ref No. : <digits>" in the enriched table text.
  // TableEngine emits "Ref No. : 2531638662" as an alias alongside "TransNo."
  const REF_NO_RE  = /Ref\s+No\.\s*:\s*(\d+)/gi;
  const IER_NO_RE  = /IER\s+No\.\s*:\s*(\d+)/gi;
  const ESI_NO_RE  = /E-SI\s+No\.\s*:\s*([A-Z0-9]+)/gi;

  /**
   * Scan page text for all Ref No. values.
   * Returns string[] deduplicated.
   */
  function extractAllRefNos(text) {
    const seen = new Set();
    const vals = [];
    REF_NO_RE.lastIndex = 0;
    let m;
    while ((m = REF_NO_RE.exec(text)) !== null) {
      const v = m[1].trim();
      if (!seen.has(v)) { seen.add(v); vals.push(v); }
    }
    return vals;
  }

  /**
   * Scan page text for all IER No. values.
   */
  function extractAllIerNos(text) {
    const seen = new Set();
    const vals = [];
    IER_NO_RE.lastIndex = 0;
    let m;
    while ((m = IER_NO_RE.exec(text)) !== null) {
      const v = m[1].trim();
      if (!seen.has(v)) { seen.add(v); vals.push(v); }
    }
    return vals;
  }

  /**
   * Scan page text for all E-SI No. values.
   */
  function extractAllEsiNos(text) {
    const seen = new Set();
    const vals = [];
    ESI_NO_RE.lastIndex = 0;
    let m;
    while ((m = ESI_NO_RE.exec(text)) !== null) {
      const v = m[1].trim();
      if (!seen.has(v)) { seen.add(v); vals.push(v); }
    }
    return vals;
  }


  // Matches d/m/yyyy or dd/mm/yyyy — date part ONLY, no time component.
  // No leading-digit guard — table rows jam RefNo directly against the date.
  const DATE_ONLY_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/g;

  // ── TIME-ONLY REGEX ──────────────────────────────────────────────────────
  // Matches ONLY values with exactly 2 colons: H:MM:SS or HH:MM:SS[AM/PM]
  // This excludes dates (slashes) and single-colon values.
  const TIME_ONLY_RE = /\b(\d{1,2}:\d{2}:\d{2}(?:\s*[AaPp][Mm])?)\b/g;

  // ── ZONE-CODE REGEX ──────────────────────────────────────────────────────
  // Extracts the highway zone code that appears immediately before "Total"
  // in each transaction row. Zone codes are NOT followed by digits (to
  // distinguish them from E-SI numbers like NAIAX000160425643).
  const ZONE_CODES_RE = /(SKYWAY|NAIAX|SLEX|TPLEX|SIDC|MMSS3|MCX)(?!\d)Total/g;

  /**
   * Scan entire page text for all date-only values (no time component).
   * Returns string[] deduplicated — e.g. ["3/2/2026", "02/01/2026"].
   */
  function extractAllDates(text) {
    const seen = new Set();
    const dates = [];
    DATE_ONLY_RE.lastIndex = 0;
    let m;
    while ((m = DATE_ONLY_RE.exec(text)) !== null) {
      const val = m[1].trim();
      if (!seen.has(val)) { seen.add(val); dates.push(val); }
    }
    return dates;
  }

  /**
   * Scan entire page text for all time-only values (exactly 2 colons).
   * Returns string[] deduplicated — e.g. ["16:41:37", "11:24:05AM"].
   */
  function extractAllTimes(text) {
    const seen = new Set();
    const times = [];
    TIME_ONLY_RE.lastIndex = 0;
    let m;
    while ((m = TIME_ONLY_RE.exec(text)) !== null) {
      const val = m[1].trim();
      if (!seen.has(val)) { seen.add(val); times.push(val); }
    }
    return times;
  }

  /**
   * Scan entire page text for all Zone codes that appear directly before
   * "Total" in transaction rows (e.g. NAIAX, SKYWAY, SLEX).
   * Returns string[] deduplicated.
   */
  function extractAllZones(text) {
    const seen = new Set();
    const zones = [];
    ZONE_CODES_RE.lastIndex = 0;
    let m;
    while ((m = ZONE_CODES_RE.exec(text)) !== null) {
      const val = m[1].trim();
      if (!seen.has(val)) { seen.add(val); zones.push(val); }
    }
    return zones;
  }

  /**
   * Is this an Entry column keyword?
   * e.g. "Entry", "Entry :"
   */
  function isEntryKw(kwNorm) {
    return /^\s*entry\s*$/.test(kwNorm);
  }

  /**
   * Is this an Exit column keyword?
   * e.g. "Exit", "Exit :"
   */
  function isExitKw(kwNorm) {
    return /^\s*exit\s*$/.test(kwNorm);
  }

  // ── PIPE-COLUMN EXTRACTORS ────────────────────────────────────────────────
  // TableEngine emits enriched text as pipe-delimited tokens:
  //   "ColName : value | ColName : value | ..."
  // These helpers extract all unique values for a given column name.

  /**
   * Extract all unique values for a named column from pipe-delimited enriched text.
   * Handles multi-word values (e.g. "NAIAX TRAMO SBE", "TERMINAL 2").
   * @param {string} text       - enriched page text
   * @param {string} colLabel   - column name to search (e.g. "Entry", "Exit", "Zone")
   * @returns {string[]}        - deduplicated array of raw values (NOT title-cased)
   */
  function extractPipeColumnValues(text, colLabel) {
    const escaped = colLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match "ColLabel : <value>" where value runs up to next " | " or end-of-string
    const re = new RegExp(escaped + '\\s*:\\s*([^|]+?)(?=\\s*\\|\\s*[A-Za-z]|$)', 'gi');
    const seen = new Set();
    const vals = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const v = m[1].trim();
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        vals.push(v);
      }
    }
    return vals;
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

    // 2. Generic single-word mixed-case label + colon  (NOT time values — (?!\d) guard)
    //    IMPORTANT: Only fire on labels that actually have a colon — this prevents
    //    "ENTRY" or "EXIT" inside values like "MAMPLASAN NORTH ENTRY/EXIT" from
    //    being treated as stop points (they have no colon after them).
    const labelRe = /(?<![a-z\d])([A-Z][a-z][A-Za-z#\-\.]{0,13})\s{0,3}:(?!\d)/g;
    let m;
    while ((m = labelRe.exec(text)) !== null) posSet.add(m.index);

    // 2b. Two-word Title-Case label + colon  e.g. "Business Style :", "Customer Name :"
    //     Catches labels that GENERIC_SINGLE misses because only the second word precedes ":"
    const twoWordRe = /(?<![a-z\d])([A-Z][a-z][A-Za-z]{0,13}\s+[A-Za-z][A-Za-z]{1,13})\s{0,3}:(?!\d)/g;
    while ((m = twoWordRe.exec(text)) !== null) posSet.add(m.index);

    // 2c. ALL-CAPS multi-word label with attached colon  e.g. "SALES INVOICE NUMBER:"
    //     Uses attached-colon-only (/[A-Z]+:/ not /[A-Z]+ :/) to avoid matching
    //     ALL-CAPS value text that happens to be followed by a spaced colon field.
    const allCapsRe = /(?<!\w)[A-Z]{2,}(?:\s+[A-Z]{2,})+:/g;
    while ((m = allCapsRe.exec(text)) !== null) posSet.add(m.index);

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
    // Strip stray leading/trailing quote characters bleeding in from adjacent quoted text
    value = value.replace(/^[\u201C\u201D"']+/, '').replace(/[\u201C\u201D"']+$/, '').trim();
    return value;
  }

  // ─── SPECIAL CHARACTER CLEANER ──────────────────────────────────────────────
  //
  // Removes label-syntax characters that bleed into extracted values.
  //
  // Applies to BOTH leading AND trailing edges of every captured value.
  //
  // Leading chars stripped:
  //   : ; # - – — | / \ * • · (spaces)
  //   e.g.  '#: INV-2026-042' → 'INV-2026-042'
  //         ': some value'    → 'some value'
  //         '– em dash'       → 'em dash'
  //
  // Trailing chars stripped:
  //   : ; # - – — | / \ * • · , (spaces)
  //   e.g.  'INV-2026-042:'   → 'INV-2026-042'
  //         'CORPORATION,'    → 'CORPORATION'
  //
  // Safe for internal chars:
  //   '006-977-514-000'  → unchanged  (hyphens only stripped at edges)
  //   '$1,500.00'        → unchanged  ($ not in strip list; comma is internal)
  //   'Php 105.00'       → unchanged
  //   'Feb 25, 2026'     → unchanged  (comma is mid-value)

  function cleanValue(value) {
    if (!value) return value;
    // Strip leading label-syntax chars
    value = value.replace(/^[\s:;#\-–—|/\\*•·]+/, '');
    // Strip trailing label-syntax chars
    value = value.replace(/[\s:;#\-–—|/\\*•·,]+$/, '');
    return value.trim();
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

  // ── toTitleCase ─────────────────────────────────────────────────────────────
  // Rules applied to every extracted PDF value:
  //   • Words containing digits → preserved as-is (codes, IDs, dates, times)
  //   • Words where ALL letters are uppercase → preserved as-is (acronyms, proper nouns)
  //   • All other words → Title Case (first letter up, rest lower)
  //   • After every '.'  → next alpha letter is capitalised
  //
  // Examples:
  //   "national grid corporation"   → "National Grid Corporation"
  //   "NATIONAL GRID CORPORATION"   → "National Grid Corporation"
  //   "SMC TPLEX Corporation"       → "Smc Tplex Corporation"  [mixed → title]
  //   "TPLEX000045430892"           → "TPLEX000045430892"       [has digit → unchanged]
  //   "INV-2026-042"                → "INV-2026-042"            [has digit → unchanged]
  //   "QUEZON AVE. COR. BIR ROAD"  → "Quezon Ave. Cor. Bir Road"
  //   "88.39"                       → "88.39"                   [no alpha → unchanged]
  function toTitleCase(val) {
    if (!val) return val;

    // Step 1: transform each space-separated word
    const titled = val.split(' ').map(word => {
      if (!word) return word;

      // Words with digits → codes / IDs / numbers / E-SI codes → preserve exactly
      if (/\d/.test(word)) return word;

      // Find all alpha characters in this word
      const letters = word.replace(/[^a-zA-Z]/g, '');
      if (!letters) return word; // pure symbol/number → unchanged

      // ALL-CAPS words (e.g. "NAIAX", "TERMINAL", "TRAMO", "SBE", "SKYWAY",
      // "ALABANG", "MAKATI", "ENTERTAINMENT", "COASTAL", "SLEX", "TPLEX") →
      // PRESERVE as-is. These are proper nouns, toll zone codes, and place names
      // that must not be lowercased.
      // Only lowercase if the word is already mixed-case (first letter upper,
      // remaining letters contain lowercase), which indicates a normal word.
      const allLettersUpperCase = letters === letters.toUpperCase();
      if (allLettersUpperCase) return word; // preserve ALL-CAPS words exactly

      // Mixed-case or lowercase word → apply title case
      const lower = word.toLowerCase();
      // Find index of first alpha char to handle leading symbols (e.g. "#WORD")
      let firstAlpha = 0;
      while (firstAlpha < lower.length && !/[a-zA-Z]/.test(lower[firstAlpha])) firstAlpha++;
      return lower.slice(0, firstAlpha) + lower[firstAlpha].toUpperCase() + lower.slice(firstAlpha + 1);
    }).join(' ');

    // Step 2: capitalise first alpha character after each '.'
    return titled.replace(/\.([^a-zA-Z]*)([a-zA-Z])/g, (_, gap, letter) => {
      return '.' + gap + letter.toUpperCase();
    });
  }

  // ─── VALUE EXTRACTOR ────────────────────────────────────────────────────────
  //
  // Slices text from matchEnd to the first stop AT OR AFTER matchEnd.
  // A stop exactly at matchEnd → null (empty value / adjacent headers).
  //
  // SMC INTERLEAVED FIX:
  //   For spaced-colon keywords (Date :, Address :, Customer Name :, etc.),
  //   if the text immediately after the match starts with a known sibling label
  //   (Time, Customer Name, TIN, Business Style, Address), that sibling label
  //   is skipped before the value is extracted.
  //
  //   This fixes the 2-column PDF.js rendering artefact:
  //     "Date : Time : 01/07/2025 : 15:21:49" → "Date :" yields "01/07/2025"

  function extractValueAt(text, matchEnd, stopPositions, maxLen = 200, kwType = '') {
    // ── SMC interleaved-label resolver ─────────────────────────────────────
    // Only apply for spaced-colon keywords (type === 'spaced' or 'colon')
    // to avoid touching bare keywords like "Total" or "Description".
    if (kwType === 'spaced' || kwType === 'colon') {
      const afterKw = text.slice(matchEnd, matchEnd + 120);
      const stripped = afterKw.replace(/^[\s:]+/, '');
      if (SMC_SIBLING_RE.test(stripped)) {
        const value = extractSMCInterleavedValue(stripped);
        if (value) return toTitleCase(trimTrailingNoise(value));
      }
    }

    const nextStop = stopPositions.find(p => p >= matchEnd);
    if (nextStop === matchEnd) return null;
    const stopAt = nextStop !== undefined
      ? Math.min(nextStop, matchEnd + maxLen)
      : Math.min(text.length, matchEnd + maxLen);

    let value = text.slice(matchEnd, stopAt);
    value = value.replace(/^[\s:–—\-]+/, '').replace(/\s+/g, ' ').trim();
    value = value.replace(/[\s:–—\-,]+$/, '').trim();
    value = trimTrailingNoise(value);
    value = cleanValue(value);
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
    value = cleanValue(value);
    return value.length > 0 ? [toTitleCase(value)] : [];
  }

  // ─── MAIN SEARCH ────────────────────────────────────────────────────────────
  //
  // Two-pass extraction engine:
  //
  //  PASS 1 — Scout pass (top → bottom through every file/page/keyword):
  //    Run every keyword regex over every page exactly as before.
  //    Instead of immediately emitting results, record the match positions
  //    (regex m.index) into a per-page-per-keyword Set called run1Positions.
  //    Also store the extracted values in run1Results so that pages where only
  //    one occurrence exists can fall back to the scout results.
  //
  //  PASS 2 — Capture pass (top → bottom again, same order):
  //    Re-run every keyword regex over every page.
  //    For each regex match: if its m.index is already in run1Positions for
  //    that (filename, page, keyword) → this is the FIRST occurrence (already
  //    seen in the scout pass) → SKIP it and continue.
  //    The first match that is NOT in run1Positions is the SECOND occurrence
  //    → CAPTURE its value as the result.
  //
  //  Fallback rule:
  //    If the capture pass finds no results for a given (filename, page, keyword)
  //    (i.e. the keyword appears only once on that page) → emit the scout-pass
  //    results instead so no data is lost.
  //
  //  Special keywords (Date, Time, Zone) bypass the two-pass logic because they
  //  use whole-page scans rather than regex-match-position-based extraction.
  //  They are handled identically in both passes; the capture pass result is
  //  used (same as before, since they deduplicate internally).

  function search(pdfData, keywords) {

    // ── PASS 1: Scout — record every first-occurrence match position ─────────

    // run1Results:  Map<key, Array<resultObject>>
    //   key = `${filename}|||${page}|||${keyword}`
    // run1Positions: Map<key, Set<number>>
    //   Set of regex m.index values found in the scout pass per keyword/page
    const run1Results   = new Map();
    const run1Positions = new Map();

    for (const { file, pages } of pdfData) {
      const filename = file.name;

      for (const { page, text } of pages) {
        const stopPositions = findAllStopPositions(text, keywords);

        for (const keyword of keywords) {
          const mapKey  = `${filename}|||${page}|||${keyword}`;
          const found   = [];
          const seen    = new Set();
          const posSet  = new Set();
          const regex   = buildKeywordRegex(keyword);
          const type    = classifyKeyword(keyword);
          const kwNorm  = normalizeKw(keyword).toLowerCase();

          // Special whole-page keywords — run once, store results & skip 2nd pass
          if (isDateKw(kwNorm)) {
            const dates = extractAllDates(text);
            const r1 = [];
            for (const val of dates) {
              const key = val.toLowerCase().replace(/[\s,$]/g, '').slice(0, 60);
              if (!seen.has(key)) { seen.add(key); r1.push({ page, filename, keyword, contexts: [val], closestContext: val }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1])); // sentinel: whole-page scan, no regex positions
            continue;
          }

          if (isTimeKw(kwNorm)) {
            const times = extractAllTimes(text);
            const r1 = [];
            for (const t of times) {
              const tk = t.toLowerCase().replace(/[\s]/g, '');
              if (!seen.has(tk)) { seen.add(tk); r1.push({ page, filename, keyword, contexts: [t], closestContext: t }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          if (isZoneKw(kwNorm)) {
            // Zone: use pipe-column extractor from enriched TableEngine text
            // (also falls back to old ZONE_CODES_RE scan for backward compatibility)
            let vals = extractPipeColumnValues(text, 'Zone');
            if (vals.length === 0) vals = extractAllZones(text);
            const r1 = [];
            for (const z of vals) {
              const key = z.toLowerCase();
              if (!seen.has(key)) { seen.add(key); r1.push({ page, filename, keyword, contexts: [z], closestContext: z }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          if (isEntryKw(kwNorm)) {
            const vals = extractPipeColumnValues(text, 'Entry');
            const r1 = [];
            for (const v of vals) {
              const key = v.toLowerCase();
              if (!seen.has(key)) { seen.add(key); r1.push({ page, filename, keyword, contexts: [v], closestContext: v }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          if (isExitKw(kwNorm)) {
            const vals = extractPipeColumnValues(text, 'Exit');
            const r1 = [];
            for (const v of vals) {
              const key = v.toLowerCase();
              if (!seen.has(key)) { seen.add(key); r1.push({ page, filename, keyword, contexts: [v], closestContext: v }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          if (isRefNoKw(kwNorm)) {
            const vals = extractAllRefNos(text);
            const r1 = [];
            for (const v of vals) {
              if (!seen.has(v)) { seen.add(v); r1.push({ page, filename, keyword, contexts: [v], closestContext: v }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          if (isIerNoKw(kwNorm)) {
            const vals = extractAllIerNos(text);
            const r1 = [];
            for (const v of vals) {
              if (!seen.has(v)) { seen.add(v); r1.push({ page, filename, keyword, contexts: [v], closestContext: v }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          if (isEsiNoKw(kwNorm)) {
            const vals = extractAllEsiNos(text);
            const r1 = [];
            for (const v of vals) {
              if (!seen.has(v)) { seen.add(v); r1.push({ page, filename, keyword, contexts: [v], closestContext: v }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          // ── SMC invoice: Sales Invoice Number ───────────────────────────
          if (isSalesInvoiceNoKw(kwNorm)) {
            const re = /SALES\s+INVOICE\s+NUMBER\s*:\s*/gi;
            let sm;
            const r1 = [];
            while ((sm = re.exec(text)) !== null) {
              const val = extractSalesInvoiceNo(text, sm.index + sm[0].length);
              if (val && !seen.has(val)) { seen.add(val); r1.push({ page, filename, keyword, contexts: [val], closestContext: val }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          // ── SMC invoice: Vatable Sales (1st decimal in tax block) ───────
          if (isVatableSalesKw(kwNorm)) {
            const re = /Vatable\s+Sales/gi;
            let sm;
            const r1 = [];
            while ((sm = re.exec(text)) !== null) {
              const val = extractVatableSales(text, sm.index + sm[0].length);
              if (val && !seen.has(val)) { seen.add(val); r1.push({ page, filename, keyword, contexts: [val], closestContext: val }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          // ── SMC invoice: bare VAT (4th/last decimal before Total Amount) ─
          if (isVatOnlyKw(kwNorm)) {
            // Scan for the VAT row — it appears after Zero-Rated Sales and before Total Amount
            // Pattern: "Zero-Rated Sales VAT <vatable> <exempt> <zero> <vat>"
            const re = /\bVAT\b(?!\s*-|\s*Reg|\s*Exempt|\s*Zero)/gi;
            let sm;
            const r1 = [];
            while ((sm = re.exec(text)) !== null) {
              const val = extractVatAmount(text, sm.index + sm[0].length);
              if (val && !seen.has(val)) { seen.add(val); r1.push({ page, filename, keyword, contexts: [val], closestContext: val }); }
            }
            run1Results.set(mapKey, r1);
            run1Positions.set(mapKey, new Set([-1]));
            continue;
          }

          // Normal regex-based keywords — scout pass
          let m;
          while ((m = regex.exec(text)) !== null) {
            posSet.add(m.index);           // mark this position as seen in run 1
            const matchEnd = m.index + m[0].length;
            let values = [];

            if (type === 'bare') {
              const tableVals = extractTableColumnValues(text, matchEnd, keyword, keywords, stopPositions);
              if (tableVals.length > 0) {
                values = tableVals;
              } else {
                const dv = extractValueAt(text, matchEnd, stopPositions, 200, type);
                if (dv) {
                  const isNum = isMonetaryKw(kwNorm) || isIntegerKw(kwNorm);
                  if (isNum) { if (/^[\$\d]|^Php/i.test(dv)) values = [dv]; }
                  else { if (dv.length < 100 || /^[\$\d]/.test(dv)) values = [dv]; }
                }
              }
            } else {
              const dv = extractValueAt(text, matchEnd, stopPositions, 200, type);
              if (dv) values = [dv];
            }

            for (const value of values) {
              const key = value.toLowerCase().replace(/[\s,$]/g, '').slice(0, 60);
              if (!seen.has(key)) { seen.add(key); found.push(value); }
            }
            if (m[0].length === 0) regex.lastIndex++;
          }

          run1Positions.set(mapKey, posSet);
          run1Results.set(mapKey, found.map(ctx => ({ page, filename, keyword, contexts: [ctx], closestContext: ctx })));
        }
      }
    }

    // ── PASS 2: Capture — skip 1st-occurrence matches, keep 2nd occurrences ─

    const results = [];

    for (const { file, pages } of pdfData) {
      const filename = file.name;

      for (const { page, text } of pages) {
        const stopPositions = findAllStopPositions(text, keywords);

        for (const keyword of keywords) {
          const mapKey   = `${filename}|||${page}|||${keyword}`;
          const r1pos    = run1Positions.get(mapKey) ?? new Set();
          const r1res    = run1Results.get(mapKey)   ?? [];

          // Whole-page special keywords: emit run-1 results directly
          if (r1pos.has(-1)) {
            for (const r of r1res) results.push(r);
            continue;
          }

          const found2  = [];
          const seen2   = new Set();
          const regex2  = buildKeywordRegex(keyword);
          const type    = classifyKeyword(keyword);
          const kwNorm  = normalizeKw(keyword).toLowerCase();

          let m;
          while ((m = regex2.exec(text)) !== null) {
            if (r1pos.has(m.index)) {
              // This position was the first occurrence (scout pass hit) → skip
              if (m[0].length === 0) regex2.lastIndex++;
              continue;
            }

            // New position → second (or later) occurrence → capture it
            const matchEnd = m.index + m[0].length;
            let values = [];

            if (type === 'bare') {
              const tableVals = extractTableColumnValues(text, matchEnd, keyword, keywords, stopPositions);
              if (tableVals.length > 0) {
                values = tableVals;
              } else {
                const dv = extractValueAt(text, matchEnd, stopPositions, 200, type);
                if (dv) {
                  const isNum = isMonetaryKw(kwNorm) || isIntegerKw(kwNorm);
                  if (isNum) { if (/^[\$\d]|^Php/i.test(dv)) values = [dv]; }
                  else { if (dv.length < 100 || /^[\$\d]/.test(dv)) values = [dv]; }
                }
              }
            } else {
              const dv = extractValueAt(text, matchEnd, stopPositions, 200, type);
              if (dv) values = [dv];
            }

            for (const value of values) {
              const key = value.toLowerCase().replace(/[\s,$]/g, '').slice(0, 60);
              if (!seen2.has(key)) { seen2.add(key); found2.push(value); }
            }
            if (m[0].length === 0) regex2.lastIndex++;
          }

          if (found2.length > 0) {
            // Use 2nd-pass results
            for (const ctx of found2) {
              results.push({ page, filename, keyword, contexts: [ctx], closestContext: ctx });
            }
          } else {
            // No 2nd occurrence → fall back to scout-pass results
            for (const r of r1res) results.push(r);
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
          const dv = extractValueAt(text, matchEnd, stopPositions, 200, type);
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
        const dv = extractValueAt(text, matchEnd, stopPositions, 200, type);
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