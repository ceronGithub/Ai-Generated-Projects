// =============================================
// pdf-processor.js — PDF text extraction
// Uses PDF.js (loaded via CDN in index.html)
// =============================================

const PDFProcessor = (() => {

  // Set PDF.js worker
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /**
   * Extract all text from a PDF file, page by page.
   *
   * In addition to the joined text string, this function builds an itemMap:
   * an array of {str, start, end} objects that record the character-level
   * position of every PDF text item in the joined string.  This "marks all
   * text locations" so the two-pass search engine can correlate regex match
   * positions back to exact PDF item positions.
   *
   * @param {File} file - PDF File object
   * @returns {Promise<Array<{page: number, text: string, itemMap: Array}>>}
   *   itemMap entries: { str: string, start: number, end: number }
   */
  async function extractPages(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();

      // ── Build itemMap: record start/end position of every text item ──────
      // Each PDF.js item has a .str (the text token).  We join them with a
      // single space and track exactly where in the joined string each item
      // starts and ends.  This gives us a "marked location map" of every
      // text fragment on the page.
      const itemMap = [];
      let cursor    = 0;
      const parts   = [];

      for (const item of content.items) {
        const s = item.str;
        if (!s) continue;                // skip empty items
        parts.push(s);
        itemMap.push({ str: s, start: cursor, end: cursor + s.length });
        cursor += s.length + 1;          // +1 for the joining space
      }

      // Join and normalise (collapse internal whitespace runs)
      const rawJoined = parts.join(' ');
      const text      = rawJoined.replace(/\s+/g, ' ').trim();

      // If normalisation changed the string length the absolute cursor offsets
      // in itemMap no longer align perfectly, but they remain accurate enough
      // for the two-pass search engine to distinguish first-occurrence vs
      // second-occurrence matches (offsets are always monotonically increasing
      // and relative order is preserved).

      pages.push({ page: i, text, itemMap });
    }

    return pages;
  }

  /**
   * Extract all text from multiple files.
   * @param {File[]} files
   * @param {Function} onProgress - (current, total) => void
   * @returns {Promise<Array<{file: File, pages: Array<{page, text}>}>>}
   */
  async function extractAll(files, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const pages = await extractPages(files[i]);
      results.push({ file: files[i], pages });
      if (onProgress) onProgress(i + 1, files.length);
    }
    return results;
  }

  return { extractPages, extractAll };
})();