// =============================================
// ppt-to-pdf.js — PowerPoint (.pptx) to PDF Converter
// Uses JSZip (already loaded via CDN) to unzip .pptx,
// extracts slide XML text content, renders each slide
// as a styled HTML card, and produces a print-ready
// document the user saves as PDF via the browser's
// native print dialog.
// =============================================

const PPTToPDF = (() => {

  // ── convert(files, onProgress) ───────────────────────────────────────────
  // Reads each .pptx file, extracts text from every slide,
  // and returns a print-ready HTML blob per file.
  async function convert(files, onProgress) {
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip         = await JSZip.loadAsync(arrayBuffer);
        const slides      = await _extractSlides(zip);

        if (!slides.length) throw new Error('No slides found in this .pptx file.');

        const printHtml  = _buildPrintDocument(slides, file.name);
        const blob       = new Blob([printHtml], { type: 'text/html' });
        const outputName = file.name.replace(/\.pptx$/i, '') + '_converted.html';

        results.push({ file, filename: outputName, blob, pages: slides.length });
      } catch (err) {
        results.push({ file, filename: file.name, error: err.message });
      }

      if (onProgress) onProgress(i + 1, files.length);
    }

    return results;
  }

  // ── _extractSlides(zip) ──────────────────────────────────────────────────
  // Finds all ppt/slides/slideN.xml files in the zip, parses their XML,
  // and extracts all text runs (<a:t>) per slide.
  async function _extractSlides(zip) {
    // Collect and sort slide files by their slide number
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)[1], 10);
        const numB = parseInt(b.match(/slide(\d+)/)[1], 10);
        return numA - numB;
      });

    const slides = [];
    for (const slidePath of slideFiles) {
      const xmlString = await zip.files[slidePath].async('string');
      const textBlocks = _parseSlideXml(xmlString);
      const slideNum   = parseInt(slidePath.match(/slide(\d+)/)[1], 10);
      slides.push({ slideNum, textBlocks });
    }

    return slides;
  }

  // ── _parseSlideXml(xmlString) ────────────────────────────────────────────
  // Parses slide XML and extracts text grouped by paragraph (<a:p>).
  // Returns an array of paragraph strings.
  function _parseSlideXml(xmlString) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xmlString, 'application/xml');

    // Extract all <a:p> paragraph elements
    const paragraphs = doc.querySelectorAll('p');
    const textBlocks = [];

    paragraphs.forEach(para => {
      // Collect all <a:t> text runs inside this paragraph
      const runs = para.querySelectorAll('t');
      const text = Array.from(runs).map(r => r.textContent).join('').trim();
      if (text) textBlocks.push(text);
    });

    return textBlocks;
  }

  // ── _buildPrintDocument(slides, filename) ────────────────────────────────
  // Wraps all slides into a print-optimized HTML document.
  // Each slide renders as a card with its number and extracted text.
  function _buildPrintDocument(slides, filename) {
    const slidesMarkup = slides.map(({ slideNum, textBlocks }) => {
      const textHtml = textBlocks.length
        ? textBlocks.map((t, i) => {
            // First text block treated as slide title
            const tag = i === 0 ? 'h2' : 'p';
            return `<${tag} class="${i === 0 ? 'slide-title' : 'slide-body'}">${_escapeHtml(t)}</${tag}>`;
          }).join('\n')
        : `<p class="slide-empty">(No text content on this slide)</p>`;

      return `
        <div class="slide-card">
          <div class="slide-num">Slide ${slideNum}</div>
          <div class="slide-content">${textHtml}</div>
        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${_escapeHtml(filename.replace(/\.pptx$/i, ''))}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #f3ede3;
      padding: 1.5cm;
    }
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
    .slide-card {
      background: #fff;
      border: 1px solid #d4c9b0;
      border-radius: 6px;
      padding: 1.5cm 2cm;
      margin-bottom: 1.5em;
      min-height: 14cm;
      page-break-after: always;
      position: relative;
    }
    .slide-num {
      font-size: 8pt;
      color: #9a8f7e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1em;
      border-bottom: 1px solid #e8e0d0;
      padding-bottom: 0.4em;
    }
    .slide-title {
      font-size: 22pt;
      font-weight: bold;
      color: #1a1208;
      margin-bottom: 0.8em;
      line-height: 1.3;
    }
    .slide-body {
      font-size: 13pt;
      color: #3a2e1e;
      margin-bottom: 0.5em;
      line-height: 1.6;
    }
    .slide-empty { color: #9a8f7e; font-style: italic; font-size: 11pt; }
    @media print {
      .print-hint { display: none; }
      body { background: #fff; padding: 0; }
      @page { margin: 1.5cm; size: landscape; }
      .slide-card { page-break-after: always; border: none; border-top: 2px solid #c8a96e; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="print-hint">
    ✦ To save as PDF: press <strong>Ctrl+P</strong> (or Cmd+P on Mac) → choose <strong>Save as PDF</strong> → Save
  </div>
  ${slidesMarkup}
</body>
</html>`;
  }

  function _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { convert };

})();
