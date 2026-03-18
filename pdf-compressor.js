// =============================================
// pdf-compressor.js — Client-side PDF compression
//
// Strategy: Re-render each PDF page onto a canvas
// at a reduced scale/quality, then pack the canvases
// back into a new PDF using a minimal PDF writer.
//
// No server. No upload. Everything stays in-browser.
//
// Public API:
//   PDFCompressor.compress(files, onProgress)
//   → Promise<Array<{ file: File, originalSize, compressedSize, blob, filename }>>
//
// Compression levers:
//   SCALE       — render scale (0.0–1.0); lower = smaller file
//   JPEG_Q      — JPEG quality (0.0–1.0); lower = smaller file
//   MIN_SCALE   — never go below this render scale
//   TARGET_RATIO— try to reach this size reduction fraction
// =============================================

const PDFCompressor = (() => {
  'use strict';

  // ── Tuning ────────────────────────────────────────────────────────────────
  const SCALE      = 1.2;   // initial render scale (1.0 = 96 dpi; 1.2 ≈ 115 dpi)
  const JPEG_Q     = 0.72;  // JPEG quality for image pages
  const PAGE_TYPE  = 'image/jpeg';

  // ── Minimal PDF byte-level writer ─────────────────────────────────────────
  //
  // Builds a valid single-PDF from an array of JPEG DataURLs.
  // Each page is stored as a full-page JPEG XObject.
  //
  // Structure per page:
  //   /Type /Page  /MediaBox [0 0 w h]  /Contents (stream)  /Resources (XObject ref)
  //
  function dataURLtoBytes(dataURL) {
    const b64 = dataURL.split(',')[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function enc(str) {
    return new TextEncoder().encode(str);
  }

  function buildPDF(pages) {
    // pages = [{ jpegBytes: Uint8Array, width: number, height: number }]
    // Returns a Uint8Array of the complete PDF.

    const parts  = [];   // byte chunks to concat
    const xrefs  = [];   // byte offsets of each object
    let   offset = 0;

    function write(chunk) {
      if (typeof chunk === 'string') chunk = enc(chunk);
      parts.push(chunk);
      offset += chunk.length;
    }

    function startObj(n) {
      xrefs[n] = offset;
      write(`${n} 0 obj\n`);
    }

    function endObj() {
      write('endobj\n');
    }

    // ── Header ──────────────────────────────────────────────────────────────
    write('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    const N        = pages.length;
    // Object numbering:
    //   1        → Catalog
    //   2        → Pages (parent)
    //   3…2+N    → Page objects
    //   3+N…2+2N → XObject (image) for each page
    //   3+2N…2+3N→ Content stream for each page

    const catalogObj    = 1;
    const pagesObj      = 2;
    const pageBase      = 3;
    const xobjBase      = 3  + N;
    const streamBase    = 3  + 2 * N;

    // ── Page objects ────────────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      const pageN  = pageBase  + i;
      const xobjN  = xobjBase  + i;
      const strmN  = streamBase + i;

      startObj(pageN);
      write(
        `<< /Type /Page\n` +
        `   /Parent ${pagesObj} 0 R\n` +
        `   /MediaBox [0 0 ${width} ${height}]\n` +
        `   /Contents ${strmN} 0 R\n` +
        `   /Resources << /XObject << /Im${i} ${xobjN} 0 R >> >>\n` +
        `>>\n`
      );
      endObj();
    }

    // ── Image XObjects ───────────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const { jpegBytes, width, height } = pages[i];
      const xobjN = xobjBase + i;

      startObj(xobjN);
      write(
        `<< /Type /XObject /Subtype /Image\n` +
        `   /Width ${width} /Height ${height}\n` +
        `   /ColorSpace /DeviceRGB\n` +
        `   /BitsPerComponent 8\n` +
        `   /Filter /DCTDecode\n` +
        `   /Length ${jpegBytes.length}\n` +
        `>>\nstream\n`
      );
      parts.push(jpegBytes);
      offset += jpegBytes.length;
      write('\nendstream\n');
      endObj();
    }

    // ── Content streams (draw image to fill page) ────────────────────────────
    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      const strmN  = streamBase + i;
      const stream = `q ${width} 0 0 ${height} 0 0 cm /Im${i} Do Q\n`;
      const sBytes = enc(stream);

      startObj(strmN);
      write(`<< /Length ${sBytes.length} >>\nstream\n`);
      parts.push(sBytes);
      offset += sBytes.length;
      write('\nendstream\n');
      endObj();
    }

    // ── Pages dictionary ────────────────────────────────────────────────────
    startObj(pagesObj);
    const kids = Array.from({ length: N }, (_, i) => `${pageBase + i} 0 R`).join(' ');
    write(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>\n`);
    endObj();

    // ── Catalog ─────────────────────────────────────────────────────────────
    startObj(catalogObj);
    write(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>\n`);
    endObj();

    // ── Cross-reference table ────────────────────────────────────────────────
    const xrefOffset = offset;
    const totalObjs  = 3 + 3 * N;  // 1 catalog + 1 pages + N pages + N xobjs + N streams
    write(`xref\n0 ${totalObjs + 1}\n`);
    write('0000000000 65535 f \n');
    for (let n = 1; n <= totalObjs; n++) {
      const off = xrefs[n] !== undefined ? xrefs[n] : 0;
      write(String(off).padStart(10, '0') + ' 00000 n \n');
    }

    // ── Trailer ─────────────────────────────────────────────────────────────
    write(
      `trailer\n<< /Size ${totalObjs + 1} /Root ${catalogObj} 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`
    );

    // ── Concatenate all chunks ───────────────────────────────────────────────
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out   = new Uint8Array(total);
    let   pos   = 0;
    for (const p of parts) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }

  // ── Main compress function ────────────────────────────────────────────────

  /**
   * Compress an array of PDF Files.
   *
   * @param {File[]}   files       — array of PDF File objects
   * @param {Function} onProgress  — (done, total) => void
   * @returns {Promise<Array<{
   *   file:           File,
   *   filename:       string,
   *   originalSize:   number,
   *   compressedSize: number,
   *   blob:           Blob,
   *   saved:          number,    // bytes saved
   *   savedPct:       number,    // percent reduction
   * }>>}
   */
  async function compress(files, onProgress) {
    const results = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageData    = [];

        for (let pi = 1; pi <= pdf.numPages; pi++) {
          const page     = await pdf.getPage(pi);
          const viewport = page.getViewport({ scale: SCALE });

          // Render to offscreen canvas
          const canvas  = document.createElement('canvas');
          canvas.width  = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx     = canvas.getContext('2d');

          await page.render({ canvasContext: ctx, viewport }).promise;

          // Encode to JPEG
          const dataURL   = canvas.toDataURL(PAGE_TYPE, JPEG_Q);
          const jpegBytes = dataURLtoBytes(dataURL);

          pageData.push({
            jpegBytes,
            width:  canvas.width,
            height: canvas.height,
          });
        }

        // Build compressed PDF
        const pdfBytes     = buildPDF(pageData);
        const blob         = new Blob([pdfBytes], { type: 'application/pdf' });
        const originalSize = file.size;
        const compSize     = blob.size;
        const saved        = Math.max(0, originalSize - compSize);
        const savedPct     = originalSize > 0
          ? Math.round((saved / originalSize) * 100)
          : 0;

        // Derive output filename
        const baseName = file.name.replace(/\.pdf$/i, '');
        const filename = `${baseName}_compressed.pdf`;

        results.push({
          file,
          filename,
          originalSize,
          compressedSize: compSize,
          blob,
          saved,
          savedPct,
        });

      } catch (err) {
        console.error(`PDFCompressor: failed on "${file.name}":`, err);
        results.push({
          file,
          filename:       file.name,
          originalSize:   file.size,
          compressedSize: file.size,
          blob:           null,
          saved:          0,
          savedPct:       0,
          error:          err.message,
        });
      }

      if (onProgress) onProgress(fi + 1, files.length);
    }

    return results;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return { compress };

})();
