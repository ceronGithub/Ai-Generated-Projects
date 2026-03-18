// =============================================
// pdf-ocr.js — OCR fallback for scanned PDFs
//
// Uses Tesseract.js (CDN) to extract text from
// PDF pages that contain no selectable text.
//
// Strategy:
//   1. Render page to canvas via PDF.js
//   2. Detect if page has < MIN_CHARS of real text
//   3. If so, run Tesseract OCR on the canvas
//   4. Return OCR text merged with any real text
//
// Public API:
//   PDFOcr.isAvailable()          → bool
//   PDFOcr.needsOcr(pageText)     → bool
//   PDFOcr.ocrPage(pdf, pageNum)  → Promise<string>
//   PDFOcr.ocrFile(file, onProgress) → Promise<Array<{page, text}>>
// =============================================

const PDFOcr = (() => {
  'use strict';

  const MIN_CHARS   = 20;   // pages with fewer chars are treated as image-only
  const OCR_SCALE   = 2.0;  // render scale for OCR — higher = better accuracy
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  let _tesseractLoaded = false;
  let _worker          = null;

  // ── Check availability ────────────────────────────────────────────────────

  function isAvailable() {
    return typeof Tesseract !== 'undefined' || _tesseractLoaded;
  }

  // ── Load Tesseract on demand ───────────────────────────────────────────────

  function loadTesseract() {
    if (isAvailable()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s   = document.createElement('script');
      s.src     = TESSERACT_CDN;
      s.onload  = () => { _tesseractLoaded = true; resolve(); };
      s.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'));
      document.head.appendChild(s);
    });
  }

  // ── Lazy worker ────────────────────────────────────────────────────────────

  async function getWorker() {
    if (_worker) return _worker;
    await loadTesseract();
    _worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {}, // suppress verbose logs
    });
    return _worker;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function needsOcr(pageText) {
    return !pageText || pageText.trim().length < MIN_CHARS;
  }

  // ── OCR a single page ─────────────────────────────────────────────────────

  async function ocrPage(pdf, pageNum) {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: OCR_SCALE });
    const canvas   = document.createElement('canvas');
    canvas.width   = Math.round(viewport.width);
    canvas.height  = Math.round(viewport.height);
    const ctx      = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(canvas);
    return text.trim();
  }

  // ── OCR a full file ───────────────────────────────────────────────────────
  //
  // Returns the same shape as PDFProcessor.extractPages():
  //   Array<{ page: number, text: string, itemMap: Array, ocrApplied: bool }>
  //
  // For pages that already have sufficient text, the original text is kept.
  // For image-only pages, OCR text replaces the empty text.

  async function ocrFile(file, existingPages, onProgress) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    const results = [];

    for (let i = 0; i < existingPages.length; i++) {
      const p = existingPages[i];

      if (!needsOcr(p.text)) {
        // Page already has text — keep it
        results.push({ ...p, ocrApplied: false });
      } else {
        // Run OCR
        try {
          const ocrText = await ocrPage(pdf, p.page);
          results.push({
            ...p,
            text:       ocrText || p.text,
            ocrApplied: true,
          });
        } catch (err) {
          console.warn(`[PDFOcr] OCR failed for page ${p.page}:`, err);
          results.push({ ...p, ocrApplied: false });
        }
      }

      if (onProgress) onProgress(i + 1, existingPages.length);
    }

    return results;
  }

  // ── Terminate worker (call on app unload if needed) ───────────────────────

  async function terminate() {
    if (_worker) {
      await _worker.terminate();
      _worker = null;
    }
  }

  return { isAvailable, needsOcr, ocrPage, ocrFile, terminate, loadTesseract };
})();
