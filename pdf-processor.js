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
   * @param {File} file - PDF File object
   * @returns {Promise<Array<{page: number, text: string}>>}
   */
  async function extractPages(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push({ page: i, text });
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
