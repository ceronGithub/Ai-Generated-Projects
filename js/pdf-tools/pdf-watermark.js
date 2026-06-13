// =============================================
// pdf-watermark.js — Watermark PDF Tool
// Stamps "Liza O. De Vyra" diagonally on every
// page of each uploaded PDF using PDF.js + canvas
// re-render then encodes output as a new PDF blob.
// =============================================

const PDFWatermark = (() => {

  const WATERMARK_TEXT    = 'Liza O. De Vyra';
  const WATERMARK_OPACITY = 0.18;
  const WATERMARK_COLOR   = '#8b6914';
  const WATERMARK_FONT    = 'bold 52px "Playfair Display", Georgia, serif';
  const RENDER_SCALE      = 2.0;

  // ── apply(files, onProgress) ──────────────────────────────────────────────
  // Processes each PDF file: renders every page to canvas with watermark,
  // then re-encodes all pages into a new PDF blob using raw PDF structure.
  async function apply(files, onProgress) {
    const results = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc      = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages  = pdfDoc.numPages;

        // Render every page to canvas with watermark overlay
        const pageCanvases = [];
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page     = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: RENDER_SCALE });

          const canvas    = document.createElement('canvas');
          canvas.width    = viewport.width;
          canvas.height   = viewport.height;
          const ctx       = canvas.getContext('2d');

          // Render PDF page onto canvas
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Stamp watermark diagonally across the page
          _drawWatermark(ctx, canvas.width, canvas.height);

          pageCanvases.push({ canvas, width: viewport.width, height: viewport.height });
        }

        // Encode all canvas pages into a single PDF blob
        const pdfBlob = await _canvasesToPDF(pageCanvases);
        const outputName = file.name.replace(/\.pdf$/i, '') + '_watermarked.pdf';

        results.push({ file, filename: outputName, blob: pdfBlob, pages: totalPages });
      } catch (err) {
        results.push({ file, filename: file.name, error: err.message });
      }

      if (onProgress) onProgress(fileIndex + 1, files.length);
    }

    return results;
  }

  // ── _drawWatermark(ctx, width, height) ───────────────────────────────────
  // Draws "Liza O. De Vyra" diagonally centered on the canvas context.
  function _drawWatermark(ctx, width, height) {
    ctx.save();

    // Rotate -35deg around the center of the page
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-35 * Math.PI / 180);

    ctx.globalAlpha  = WATERMARK_OPACITY;
    ctx.fillStyle    = WATERMARK_COLOR;
    ctx.font         = WATERMARK_FONT;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Draw the watermark text centered at origin (which is page center after translate)
    ctx.fillText(WATERMARK_TEXT, 0, 0);

    ctx.restore();
  }

  // ── _canvasesToPDF(pageCanvases) ─────────────────────────────────────────
  // Converts an array of { canvas, width, height } objects into a raw PDF blob.
  // Each canvas is encoded as a JPEG image embedded in a PDF page.
  async function _canvasesToPDF(pageCanvases) {
    const pageDataList = await Promise.all(
      pageCanvases.map(({ canvas, width, height }) => ({
        jpegDataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width,
        height,
      }))
    );

    // Build raw PDF manually — single image per page
    const pdfParts  = [];
    const xrefTable = [];
    let byteOffset  = 0;

    // Helper: append a PDF object and track its byte offset
    function addObject(objNum, content) {
      const str = `${objNum} 0 obj\n${content}\nendobj\n`;
      xrefTable[objNum] = byteOffset;
      byteOffset += str.length;
      pdfParts.push(str);
    }

    // PDF header
    const header = '%PDF-1.4\n';
    byteOffset  += header.length;
    pdfParts.push(header);

    const pageCount   = pageDataList.length;
    const pagesObjNum = 1;
    let nextObjNum    = 2;

    // Reserve page object numbers
    const pageObjNums  = [];
    const imageObjNums = [];
    for (let i = 0; i < pageCount; i++) {
      pageObjNums.push(nextObjNum++);
      imageObjNums.push(nextObjNum++);
    }

    // Pages dictionary object
    const kidsRef = pageObjNums.map(n => `${n} 0 R`).join(' ');
    addObject(pagesObjNum,
      `<< /Type /Pages /Kids [${kidsRef}] /Count ${pageCount} >>`
    );

    // Encode each page + image
    for (let i = 0; i < pageCount; i++) {
      const { jpegDataUrl, width, height } = pageDataList[i];
      const pageObjNum  = pageObjNums[i];
      const imageObjNum = imageObjNums[i];

      // Strip data URL prefix and decode base64 to binary string
      const base64Data  = jpegDataUrl.split(',')[1];
      const binaryStr   = atob(base64Data);
      const imageLength = binaryStr.length;

      // Page object referencing image XObject
      const pageWidth  = (width  / RENDER_SCALE).toFixed(2);
      const pageHeight = (height / RENDER_SCALE).toFixed(2);
      const streamContent = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im${i} Do Q`;
      const streamBytes   = new TextEncoder().encode(streamContent);

      addObject(pageObjNum,
        `<< /Type /Page /Parent ${pagesObjNum} 0 R ` +
        `/MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /XObject << /Im${i} ${imageObjNum} 0 R >> >> ` +
        `/Contents << /Length ${streamBytes.length} >> >>\n` +
        `stream\n${streamContent}\nendstream`
      );

      // Image XObject (JPEG)
      const imageHeader =
        `${imageObjNum} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${Math.round(width)} /Height ${Math.round(height)} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageLength} >>\n` +
        `stream\n`;

      xrefTable[imageObjNum] = byteOffset;
      byteOffset += imageHeader.length + imageLength + '\nendstream\nendobj\n'.length;
      pdfParts.push(imageHeader);
      pdfParts.push(binaryStr);
      pdfParts.push('\nendstream\nendobj\n');
    }

    // Catalog object
    const catalogObjNum = nextObjNum++;
    addObject(catalogObjNum,
      `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`
    );

    // Cross-reference table
    const xrefOffset = byteOffset;
    const xrefLines  = ['xref\n', `0 ${catalogObjNum + 1}\n`, '0000000000 65535 f \n'];
    for (let n = 1; n <= catalogObjNum; n++) {
      xrefLines.push((xrefTable[n] ?? 0).toString().padStart(10, '0') + ' 00000 n \n');
    }

    // Trailer
    const trailer =
      `trailer\n<< /Size ${catalogObjNum + 1} /Root ${catalogObjNum} 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`;

    pdfParts.push(...xrefLines, trailer);

    // Assemble binary blob
    const blobParts = pdfParts.map(part => {
      if (typeof part === 'string') return new TextEncoder().encode(part);
      // Binary image data — convert string to Uint8Array
      const bytes = new Uint8Array(part.length);
      for (let i = 0; i < part.length; i++) bytes[i] = part.charCodeAt(i);
      return bytes;
    });

    return new Blob(blobParts, { type: 'application/pdf' });
  }

  return { apply };

})();
