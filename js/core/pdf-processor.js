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
    // Always use file.slice(0) to get a fresh Blob copy before reading.
    // This prevents "invalid PDF structure" errors caused by detached
    // ArrayBuffers when the same File object is read more than once
    // (e.g. extraction phase + rename ZIP packing phase).
    let arrayBuffer;
    try {
      arrayBuffer = await file.slice(0).arrayBuffer();
    } catch (e) {
      throw new Error(`Cannot read "${file.name}": ${e.message}`);
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(`"${file.name}" produced an empty buffer — the file may be corrupt.`);
    }

    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      throw new Error(`"${file.name}" — invalid PDF structure: ${e.message}`);
    }

    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();

      // ── Build itemMap: record start/end position of every text item ──────
      // Each PDF.js item has a .str (the text token).  We join them with a
      // single space and track exactly where in the joined string each item
      // starts and ends.  This gives us a "marked location map" of every
      // text fragment on the page.
      //
      // We also capture spatial coordinates (x, screenY, width, height) from
      // each item's transform matrix so that TableEngine can perform spatial
      // table detection across column boundaries.
      const itemMap = [];
      let cursor    = 0;
      const parts   = [];

      // Get the page viewport for coordinate conversion
      const viewport = page.getViewport({ scale: 1 });

      for (const item of content.items) {
        const s = item.str;
        if (!s) continue;                // skip empty items
        parts.push(s);

        // Extract x, y from the item's transform matrix [a,b,c,d,e,f]
        // e = x position, f = y position (PDF coords, origin bottom-left)
        // Convert to screen coords (origin top-left) using viewport height
        const tx = item.transform;
        const x       = tx ? tx[4] : 0;
        const pdfY    = tx ? tx[5] : 0;
        const screenY = viewport.height - pdfY;  // flip to top-origin
        const width   = item.width  || 0;
        const height  = item.height || 0;

        itemMap.push({
          str: s,
          start:   cursor,
          end:     cursor + s.length,
          x,
          screenY,
          width,
          height,
        });
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

      pages.push({ page: i, text, itemMap, pageWidth: viewport.width });
    }

    return pages;
  }

  /**
   * Extract all text from multiple files.
   * Per-file errors are isolated — a corrupt or unreadable file produces
   * an empty pages array with an error flag instead of crashing the batch.
   * @param {File[]} files
   * @param {Function} onProgress - (current, total) => void
   * @returns {Promise<Array<{file: File, pages: Array<{page, text}>, error?: string}>>}
   */
  async function extractAll(files, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const pages = await extractPages(files[i]);
        results.push({ file: files[i], pages });
      } catch (err) {
        console.warn(`[PDFProcessor] Skipping "${files[i].name}":`, err.message);
        results.push({ file: files[i], pages: [], error: err.message });
      }
      if (onProgress) onProgress(i + 1, files.length);
    }
    return results;
  }

  return { extractPages, extractAll };
})();