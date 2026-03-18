// =============================================
// pdf-enhancer.js — Enhance PDF quality
//
// Re-renders every page at a higher DPI and
// JPEG quality than the compressor, producing
// a cleaner, sharper, larger output PDF.
//
// Uses the same minimal PDF byte-writer as
// pdf-compressor.js and pdf-splitter.js.
//
// Enhancement settings vs compressor:
//   Compressor: SCALE 1.2, JPEG_Q 0.72  → smaller
//   Enhancer:   SCALE 2.5, JPEG_Q 0.96  → sharper/bigger
//
// Public API:
//   PDFEnhancer.enhance(files, onProgress)
//   → Promise<Array<{ file, filename, blob, originalSize, enhancedSize }>>
// =============================================

const PDFEnhancer = (() => {
  'use strict';

  const SCALE  = 2.5;    // 240 dpi — noticeably sharper than screen
  const JPEG_Q = 0.96;   // near-lossless JPEG

  // ── Shared byte-writer (mirrors pdf-compressor.js) ────────────────────────

  function dataURLtoBytes(dataURL) {
    const b64 = dataURL.split(',')[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function enc(str) { return new TextEncoder().encode(str); }

  function buildPDF(pages) {
    const parts = []; const xrefs = []; let offset = 0;
    function write(c) { if (typeof c === 'string') c = enc(c); parts.push(c); offset += c.length; }
    function startObj(n) { xrefs[n] = offset; write(`${n} 0 obj\n`); }
    function endObj()    { write('endobj\n'); }

    write('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
    const N = pages.length;
    const catalogObj = 1, pagesObj = 2;
    const pageBase = 3, xobjBase = 3 + N, streamBase = 3 + 2 * N;

    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      startObj(pageBase + i);
      write(`<< /Type /Page /Parent ${pagesObj} 0 R\n   /MediaBox [0 0 ${width} ${height}]\n   /Contents ${streamBase + i} 0 R\n   /Resources << /XObject << /Im${i} ${xobjBase + i} 0 R >> >>\n>>\n`);
      endObj();
    }
    for (let i = 0; i < N; i++) {
      const { jpegBytes, width, height } = pages[i];
      startObj(xobjBase + i);
      write(`<< /Type /XObject /Subtype /Image\n   /Width ${width} /Height ${height}\n   /ColorSpace /DeviceRGB /BitsPerComponent 8\n   /Filter /DCTDecode /Length ${jpegBytes.length}\n>>\nstream\n`);
      parts.push(jpegBytes); offset += jpegBytes.length;
      write('\nendstream\n'); endObj();
    }
    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      const s = enc(`q ${width} 0 0 ${height} 0 0 cm /Im${i} Do Q\n`);
      startObj(streamBase + i);
      write(`<< /Length ${s.length} >>\nstream\n`);
      parts.push(s); offset += s.length;
      write('\nendstream\n'); endObj();
    }
    startObj(pagesObj);
    write(`<< /Type /Pages /Kids [${Array.from({length:N},(_,i)=>`${pageBase+i} 0 R`).join(' ')}] /Count ${N} >>\n`);
    endObj();
    startObj(catalogObj);
    write(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>\n`);
    endObj();

    const xrefOff = offset;
    const totalObj = 3 + 3 * N;
    write(`xref\n0 ${totalObj + 1}\n`);
    write('0000000000 65535 f \n');
    for (let n = 1; n <= totalObj; n++) write(String(xrefs[n]??0).padStart(10,'0')+' 00000 n \n');
    write(`trailer\n<< /Size ${totalObj+1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`);

    const total = parts.reduce((s,p)=>s+p.length, 0);
    const out   = new Uint8Array(total); let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // ── Main enhance ──────────────────────────────────────────────────────────

  async function enhance(files, onProgress) {
    const results = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const buf  = await file.arrayBuffer();
        const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;
        const pageData = [];

        for (let pi = 1; pi <= pdf.numPages; pi++) {
          const page     = await pdf.getPage(pi);
          const viewport = page.getViewport({ scale: SCALE });
          const canvas   = document.createElement('canvas');
          canvas.width   = Math.round(viewport.width);
          canvas.height  = Math.round(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

          const dataURL  = canvas.toDataURL('image/jpeg', JPEG_Q);
          pageData.push({
            jpegBytes: dataURLtoBytes(dataURL),
            width:  canvas.width,
            height: canvas.height,
          });
        }

        const pdfBytes    = buildPDF(pageData);
        const blob        = new Blob([pdfBytes], { type: 'application/pdf' });
        const origSize    = file.size;
        const enhSize     = blob.size;
        const gainPct     = origSize > 0
          ? Math.round(((enhSize - origSize) / origSize) * 100)
          : 0;

        results.push({
          file,
          filename:     file.name.replace(/\.pdf$/i, '') + '_enhanced.pdf',
          blob,
          originalSize: origSize,
          enhancedSize: enhSize,
          gainPct,
        });

      } catch (err) {
        results.push({ file, filename: file.name, blob: null, error: err.message });
      }

      if (onProgress) onProgress(fi + 1, files.length);
    }

    return results;
  }

  return { enhance };
})();
