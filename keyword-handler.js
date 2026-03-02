// =============================================
// keyword-handler.js — Keyword search logic
//
// Supports:
//   ✓ Simple labels:       "Invoice #:", "Created:", "Signature:"
//   ✓ Multi-word labels:   "VAT Reg TIN:", "SALES INVOICE NUMBER:", "Customer Name :"
//   ✓ Space-colon labels:  "Date :", "Time :", "Exit :" (colon is a separate token in PDF)
//   ✓ No-colon headers:    "Description", "Hours", "Total" (table column headers)
//   ✓ Multi-value fields:  "Total" returns both $1,500 (column) and $1,800 (label) as separate cards
//   ✓ Value boundary:      stops at next searched keyword, next label pattern, or separator
//   ✓ No bleed-through:    "To:" does not absorb "Description" table header content
//   ✓ Time values intact:  "14:42:17" is not split at "42:" as a false label stop
// =============================================

const KeywordHandler = (() => {

  // ─── KEYWORD REGEX BUILDER ──────────────────────────────────────────────────
  //
  // Handles three colon styles seen in real PDFs:
  //   "Date :"    — space before colon (PDF.js splits these as separate tokens)
  //   "Created:"  — colon attached to word
  //   "Total"     — no colon (table column header)
  //
  // CRITICAL: adds (?!\w) lookahead after last keyword word so "To:" never
  // matches inside "Total:", and "Date :" never matches "Date Issued:".

  function normalizeKw(kw) {
    return kw.replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim();
  }

  function buildKeywordRegex(kw) {
    const norm = normalizeKw(kw);
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = escaped.split(/\s+/);

    // Detect "Date :" style (space before trailing colon in original keyword)
    const hasSpacedColon = /\s+:/.test(kw.replace(/\s*$/, ''));

    let colonPart;
    if (hasSpacedColon) {
      // Require at least one space before the colon — prevents "Date:" matching "Date Issued:"
      colonPart = '\\s{1,4}:\\s*';
    } else if (/[:#]$/.test(norm)) {
      // Colon already part of last word (e.g. "Invoice #:", "Created:")
      colonPart = '\\s*';
    } else {
      // No colon — table header or bare keyword (e.g. "Total", "Description")
      colonPart = '\\s{0,3}:?\\s*';
    }

    // (?<!\w) — don't match mid-word
    // (?!\w)  — don't match when more word chars follow (prevents "To" matching "Total")
    const inner = words.join('\\s{0,3}') + '(?![\\w])' + colonPart;
    return new RegExp('(?<![\\w])' + inner, 'gi');
  }

  // ─── STOP POSITION DETECTOR ─────────────────────────────────────────────────
  //
  // Builds a sorted list of character positions where a value MUST stop.
  // Three sources:
  //   1. Every searched keyword's own match positions (cross-keyword boundary)
  //   2. General label pattern: 1-2 capitalized words + colon, time-value excluded
  //   3. Standalone " : " field separator (common in formal PH government invoices)
  //   4. Numeric TIN-like patterns (e.g. "006-977-514-000 :")

  function findAllStopPositions(text, allKeywords) {
    const posSet = new Set();

    // 1. Every searched keyword → stop at its own start position
    for (const kw of allKeywords) {
      const re = buildKeywordRegex(kw);
      let km;
      while ((km = re.exec(text)) !== null) {
        posSet.add(km.index);
      }
    }

    // 2. General label stops: 1-2 capitalized/all-caps words + colon
    //    (?!\d) guard prevents "14:" or "42:" in time values from registering as labels
    const re1 = /(?<!\w)([A-Z][a-zA-Z#\-\.]{0,14}(\s[A-Z][a-zA-Z#\-\.]{0,14}){0,1})\s{0,3}:(?!\d)/g;
    let m;
    while ((m = re1.exec(text)) !== null) {
      posSet.add(m.index);
    }

    // 3. " : " standalone separator (PDF field format: "Customer Name : VALUE")
    const re2 = / : /g;
    while ((m = re2.exec(text)) !== null) {
      posSet.add(m.index);
    }

    // 4. Numeric label stops — TIN / reference numbers acting as field markers
    const re3 = /\b\d[\d\-]{3,}\s*:/g;
    while ((m = re3.exec(text)) !== null) {
      posSet.add(m.index);
    }

    return Array.from(posSet).sort((a, b) => a - b);
  }

  // ─── VALUE EXTRACTOR ────────────────────────────────────────────────────────
  //
  // Slices text from matchEnd to the NEXT stop position (or 120 char limit).
  // Uses >= (not >) so stops AT matchEnd correctly return null,
  // which triggers table-header skip mode for no-colon keywords.

  function extractValueAt(text, matchEnd, stopPositions) {
    const nextStop = stopPositions.find(p => p >= matchEnd);

    // Stop exactly at matchEnd → value is empty (adjacent keyword headers)
    if (nextStop === matchEnd) return null;

    const stopAt = nextStop !== undefined ? nextStop : text.length;
    let value = text.slice(matchEnd, Math.min(stopAt, matchEnd + 120));

    // Clean leading noise (colons, dashes, spaces)
    value = value.replace(/^[\s:–—\-]+/, '').trim();
    value = value.replace(/\s+/g, ' ').trim();
    value = value.replace(/[\s:–—]+$/, '').trim();

    if (/^[:\s]+$/.test(value) || value.length === 0) return null;
    return value;
  }

  // ─── TABLE HEADER SKIP MODE ─────────────────────────────────────────────────
  //
  // For no-colon keywords like "Description", "Hours", "Total" used as table column
  // headers: after matching the header word, skip past any OTHER searched keywords
  // (e.g. "Hours", "Total") until we land on actual data tokens, then extract the value.
  //
  // Example:  "Description  Hours  Total  Brand Identity Package  20  $1,500.00"
  //           ^ match       ^ skip  ^ skip  ^ value starts here

  function extractTableColumnValue(text, matchEnd, allKeywords, stopPositions) {
    // Build a combined skip pattern from all keyword norms
    const kwRegs = allKeywords.map(kw => {
      const norm = normalizeKw(kw);
      return norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/).join('\\s{0,3}');
    });
    const skipRe = new RegExp('^(?:' + kwRegs.join('|') + ')(?![\\w])\\s{0,3}:?\\s*', 'i');

    let pos = matchEnd;
    let maxSkips = allKeywords.length + 2;

    while (maxSkips-- > 0) {
      const skipM = text.slice(pos).match(skipRe);
      if (!skipM) break;
      pos += skipM[0].length;
    }

    // No headers were skipped → no column data to show
    if (pos === matchEnd) return null;

    const nextStop = stopPositions.find(p => p >= pos);
    if (nextStop === pos) return null;
    const stopAt = nextStop !== undefined ? nextStop : text.length;

    let value = text.slice(pos, Math.min(stopAt, pos + 120));
    value = value.replace(/^[\s:–—\-]+/, '').trim();
    value = value.replace(/\s+/g, ' ').trim();
    value = value.replace(/[\s:–—]+$/, '').trim();

    return value.length > 0 ? value : null;
  }

  // ─── MAIN SEARCH ────────────────────────────────────────────────────────────
  //
  // Searches all pages of all PDF files for each keyword.
  // Each distinct value found becomes its own result card.

  function search(pdfData, keywords) {
    const results = [];

    for (const { file, pages } of pdfData) {
      const filename = file.name;

      for (const { page, text } of pages) {
        // Build stop map once per page, using ALL keywords for cross-keyword awareness
        const stopPositions = findAllStopPositions(text, keywords);

        for (const keyword of keywords) {
          const found   = [];
          const seen    = new Set();
          const regex   = buildKeywordRegex(keyword);
          const kwNorm  = normalizeKw(keyword);

          // "hasColon" = keyword explicitly carries a colon or spaced-colon
          // No-colon keywords activate table-header skip mode when value is empty
          const hasColon =
            /\s*:\s*$/.test(keyword) ||   // trailing colon
            /#/.test(kwNorm)          ||   // contains # (e.g. "Invoice #:")
            / :/.test(keyword);            // space-colon variant

          let m;
          while ((m = regex.exec(text)) !== null) {
            const matchEnd = m.index + m[0].length;

            let value = extractValueAt(text, matchEnd, stopPositions);

            // For table headers (no colon), skip past sibling headers to find data
            if (value === null && !hasColon) {
              value = extractTableColumnValue(text, matchEnd, keywords, stopPositions);
            }

            if (value !== null) {
              const key = value.toLowerCase().slice(0, 50);
              if (!seen.has(key)) {
                seen.add(key);
                found.push(value);
              }
            }

            // Prevent infinite loop on zero-width matches
            if (m[0].length === 0) regex.lastIndex++;
          }

          // Each value → its own result card
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
    const kwNorm  = normalizeKw(keyword);
    const hasColon = /\s*:\s*$/.test(keyword) || /#/.test(kwNorm) || / :/.test(keyword);

    let m;
    while ((m = regex.exec(text)) !== null) {
      const matchEnd = m.index + m[0].length;
      let value = extractValueAt(text, matchEnd, stopPositions);

      if (value === null && !hasColon) {
        value = extractTableColumnValue(text, matchEnd, [keyword], stopPositions);
      }

      if (value !== null) {
        const key = value.toLowerCase().slice(0, 50);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(value);
        }
      }

      if (m[0].length === 0) regex.lastIndex++;
    }

    return results;
  }

  // ─── EXTRACT FIELDS (for Extract All mode) ──────────────────────────────────
  //
  // Detects label:value pairs automatically without a keyword list.
  // Used by the Extract All mode and Excel export.

  const LABEL_PATTERN = /^(invoice\s*#|created|from|to|description|hours|total|signature|date|due|bill|pay|amount|subtotal|tax|note|terms|po\s*#|ref|attn)/i;

  function tokenize(text) {
    return text.split(/\s+/).filter(t => t.length > 0);
  }

  function extractFields(text) {
    const fields = [];
    const tokens = tokenize(text);
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      const isLabel = /:\s*$/.test(token) || LABEL_PATTERN.test(token);

      if (isLabel) {
        const label = token.replace(/:$/, '').trim();
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
        if (label.length > 0 && value.length > 0) {
          fields.push({ label, value });
        }

        i = j;
      } else {
        i++;
      }
    }

    return fields;
  }

  return { search, highlight, findContexts, extractFields };
})();