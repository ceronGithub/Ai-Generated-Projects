// =============================================
// word-to-pdf.js — Word (.docx) to PDF Converter
// Uses mammoth.js (loaded on demand from CDN) to
// extract HTML from .docx, renders it in a hidden
// iframe, then triggers print-to-PDF via the
// browser's native print engine (window.print).
// Delivers a print-ready HTML blob the user can
// open and save as PDF.
// =============================================

const WordToPDF = (() => {

  // ── loadMammoth() ─────────────────────────────────────────────────────────
  // Dynamically loads mammoth.js from CDN if not already available.
  async function loadMammoth() {
    if (window.mammoth) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.onload  = resolve;
      script.onerror = () => reject(new Error('Failed to load mammoth.js'));
      document.head.appendChild(script);
    });
  }

  // ── convert(files, onProgress) ───────────────────────────────────────────
  // Converts each .docx file into a print-ready HTML blob that the browser
  // can open and save as PDF via Ctrl+P / File > Print > Save as PDF.
  async function convert(files, onProgress) {
    await loadMammoth();
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const arrayBuffer  = await file.arrayBuffer();
        const result       = await mammoth.convertToHtml({ arrayBuffer });
        const htmlContent  = result.value;

        // Wrap HTML in a styled print-ready document
        const printHtml = _buildPrintDocument(htmlContent, file.name);
        const blob      = new Blob([printHtml], { type: 'text/html' });
        const outputName = file.name.replace(/\.docx$/i, '') + '_converted.html';

        results.push({ file, filename: outputName, blob, pages: null });
      } catch (err) {
        results.push({ file, filename: file.name, error: err.message });
      }

      if (onProgress) onProgress(i + 1, files.length);
    }

    return results;
  }

  // ── _buildPrintDocument(htmlContent, filename) ───────────────────────────
  // Wraps extracted HTML in a full document with print-optimized CSS.
  // The user opens this file in the browser and prints to PDF.
  function _buildPrintDocument(htmlContent, filename) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${_escapeHtml(filename.replace(/\.docx$/i, ''))}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 2.54cm;
      max-width: 21cm;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 { margin: 0.8em 0 0.4em; font-weight: bold; }
    h1 { font-size: 18pt; }
    h2 { font-size: 15pt; }
    h3 { font-size: 13pt; }
    p  { margin-bottom: 0.6em; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
    }
    td, th {
      border: 1px solid #999;
      padding: 4pt 6pt;
      font-size: 11pt;
    }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-left: 1.5em; margin-bottom: 0.6em; }
    li { margin-bottom: 0.2em; }
    .print-hint {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1a1208;
      color: #c8a96e;
      text-align: center;
      padding: 10px;
      font-family: sans-serif;
      font-size: 13px;
      z-index: 9999;
    }
    @media print {
      .print-hint { display: none; }
      body { padding: 0; max-width: none; }
      @page { margin: 2.54cm; }
    }
  </style>
</head>
<body>
  <div class="print-hint">
    ✦ To save as PDF: press <strong>Ctrl+P</strong> (or Cmd+P on Mac) → choose <strong>Save as PDF</strong> → Save
  </div>
  ${htmlContent}
</body>
</html>`;
  }

  function _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { convert };

})();
