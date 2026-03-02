// =============================================
// keyword-handler.js — Keyword search logic
// Smart value extraction: grabs only the value
// that follows a keyword label, not a blob of
// surrounding context.
// =============================================

const KeywordHandler = (() => {

  // ─── STOP WORDS ───────────────────────────────────────────────────────────
  // When extracting a value we stop before these so "From:" doesn't absorb "To:" lines
  const LABEL_PATTERN = /^(invoice\s*#|created|from|to|description|hours|total|signature|date|due|bill|pay|amount|subtotal|tax|note|terms|po\s*#|ref|attn)/i;

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  function tokenize(text) {
    return text.split(/\s+/).filter(t => t.length > 0);
  }

  /**
   * Given the full page text and the position just after the keyword match,
   * extract the "value" — everything up to:
   *   - the next keyword label, OR
   *   - 120 char hard limit, OR
   *   - end of text
   */
  function extractValueAfter(text, matchEnd) {
    const after = text.slice(matchEnd);
    const tokens = tokenize(after);
    if (!tokens.length) return null;

    const collected = [];

    for (const token of tokens) {
      // Stop if we hit another label keyword (but only after collecting something)
      if (collected.length > 0 && LABEL_PATTERN.test(token)) break;
      // Skip leading colons/dashes
      if (/^[:\-–—]+$/.test(token)) {
        if (collected.length === 0) continue;
        break;
      }
      collected.push(token);
      if (collected.join(' ').length >= 120) break;
    }

    const value = collected.join(' ').replace(/^[\s:]+/, '').trim();
    return value.length > 0 ? value : null;
  }

  /**
   * Find all value occurrences for a keyword.
   * Returns string[] — one entry per distinct value found.
   * Each occurrence becomes its own result-item card.
   */
  function findContexts(text, keyword) {
    const results = [];
    const lower = text.toLowerCase();
    const kLower = keyword.toLowerCase().replace(/\s*:\s*$/, ''); // strip trailing colon for search
    const keywordWithColon = kLower + ':';

    let idx = 0;
    const seen = new Set();

    while (true) {
      // Try "keyword:" first, then bare "keyword"
      let found = lower.indexOf(keywordWithColon, idx);
      let matchLen = keywordWithColon.length;

      if (found === -1) {
        found = lower.indexOf(kLower, idx);
        matchLen = kLower.length;
      }

      if (found === -1) break;

      // Word boundary check — skip mid-word matches
      const charBefore = found > 0 ? text[found - 1] : ' ';
      if (/\w/.test(charBefore)) {
        idx = found + 1;
        continue;
      }

      const matchEnd = found + matchLen;
      const value = extractValueAfter(text, matchEnd);

      if (value !== null && !seen.has(value.toLowerCase())) {
        seen.add(value.toLowerCase());
        results.push(value);
      }

      idx = matchEnd;
    }

    return results;
  }

  /**
   * Search keywords across all PDF data.
   * Each distinct value found becomes its own result entry (its own card).
   */
  function search(pdfData, keywords) {
    const results = [];

    for (const { file, pages } of pdfData) {
      const filename = file.name;
      for (const { page, text } of pages) {
        for (const keyword of keywords) {
          const contexts = findContexts(text, keyword);
          if (contexts.length === 0) continue;

          // Each value → its own result-item card
          for (const ctx of contexts) {
            results.push({
              page,
              filename,
              keyword,
              contexts: [ctx],
              closestContext: ctx
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Highlight keyword in text for display (returns HTML string).
   */
  function highlight(text, keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedBase = escaped.replace(/\\:$/, '');
    const regex = new RegExp(`(${escapedBase}:?)`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  return { search, highlight, findContexts };
})();