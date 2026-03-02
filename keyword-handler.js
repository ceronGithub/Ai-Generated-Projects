// =============================================
// keyword-handler.js — Keyword search logic
// =============================================

const KeywordHandler = (() => {

  const CONTEXT_CHARS = 200; // chars around match to capture

  /**
   * Find all occurrences of a keyword in text and return context snippets.
   * @param {string} text - Full page text
   * @param {string} keyword
   * @returns {string[]} - Array of context snippets
   */
  function findContexts(text, keyword) {
    const results = [];
    const lower = text.toLowerCase();
    const kLower = keyword.toLowerCase();
    let idx = 0;

    while (true) {
      const found = lower.indexOf(kLower, idx);
      if (found === -1) break;

      const start = Math.max(0, found - CONTEXT_CHARS);
      const end = Math.min(text.length, found + keyword.length + CONTEXT_CHARS);
      let snippet = text.slice(start, end).trim();
      if (start > 0) snippet = '…' + snippet;
      if (end < text.length) snippet = snippet + '…';
      results.push(snippet);

      idx = found + keyword.length;
    }

    return results;
  }

  /**
   * Search one or multiple keywords across extracted PDF data.
   * @param {Array<{file: File, pages: Array<{page, text}>}>} pdfData
   * @param {string[]} keywords
   * @returns {Array<{page, filename, keyword, contexts}>}
   */
  function search(pdfData, keywords) {
    const results = [];

    for (const { file, pages } of pdfData) {
      const filename = file.name;
      for (const { page, text } of pages) {
        for (const keyword of keywords) {
          const contexts = findContexts(text, keyword);
          if (contexts.length > 0) {
            results.push({
              page,
              filename,
              keyword,
              contexts,
              // Store closest single context (first match) for single-keyword use
              closestContext: contexts[0]
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
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  return { search, highlight, findContexts };
})();
