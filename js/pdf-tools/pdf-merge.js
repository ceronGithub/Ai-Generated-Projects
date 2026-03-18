// =============================================
// pdf-merge.js — Merge multiple PDFs into one
//
// Renders every page of every input PDF via PDF.js,
// then packs them all into a single output PDF
// using the same minimal byte-writer as the other
// PDF tools.
//
// Public API:
//   PDFMerge.merge(files, order, onProgress)
//   → Promise<{ blob, filename, totalPages }>
//
//   order = Array<number>  (indices into files[], default 0,1,2…)
// =============================================

const PDFMerge = (() => {
  'use strict';

  const SCALE  = 1.5;
  const JPEG_Q = 0.88;

  // ── Shared byte-writer ────────────────────────────────────────────────────

  function dataURLtoBytes(dataURL) {
    const bin = atob(dataURL.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function enc(str) { return new TextEncoder().encode(str); }

  function buildPDF(pages) {
    const parts  = [];
    const xrefs  = [];
    let   offset = 0;

    function write(c) {
      if (typeof c === 'string') c = enc(c);
      parts.push(c); offset += c.length;
    }
    function startObj(n) { xrefs[n] = offset; write(`${n} 0 obj\n`); }
    function endObj()    { write('endobj\n'); }

    write('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    const N = pages.length;
    const catalogObj = 1, pagesObj = 2;
    const pageBase = 3, xobjBase = 3 + N, streamBase = 3 + 2 * N;

    startObj(catalogObj);
    write(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>\n`);
    endObj();

    startObj(pagesObj);
    write(`<< /Type /Pages /Kids [${Array.from({length:N},(_,i)=>`${pageBase+i} 0 R`).join(' ')}] /Count ${N} >>\n`);
    endObj();

    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      startObj(pageBase + i);
      write(`<< /Type /Page /Parent ${pagesObj} 0 R\n   /MediaBox [0 0 ${width} ${height}]\n   /Contents ${streamBase+i} 0 R\n   /Resources << /XObject << /Im${i} ${xobjBase+i} 0 R >> >>\n>>\n`);
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

    const xrefOff  = offset;
    const totalObj = 2 + 3 * N;
    write(`xref\n0 ${totalObj + 1}\n`);
    write('0000000000 65535 f \n');
    for (let n = 1; n <= totalObj; n++) {
      write(String(xrefs[n] ?? 0).padStart(10, '0') + ' 00000 n \n');
    }
    write(`trailer\n<< /Size ${totalObj+1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`);

    const total = parts.reduce((s, p) => s + p.length, 0);
    const out   = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // ── Main merge ────────────────────────────────────────────────────────────

  async function merge(files, order, onProgress) {
    // order defaults to 0,1,2,…,N-1 if not supplied
    const seq   = order && order.length === files.length
      ? order
      : files.map((_, i) => i);

    const allPages  = [];
    let   rendered  = 0;

    // Count total pages for progress
    const pageCounts = [];
    for (const idx of seq) {
      const buf = await files[idx].arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      pageCounts.push(pdf.numPages);
    }
    const totalPages = pageCounts.reduce((s, n) => s + n, 0);

    for (let fi = 0; fi < seq.length; fi++) {
      const file = files[seq[fi]];
      const buf  = await file.arrayBuffer();
      const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;

      for (let pi = 1; pi <= pdf.numPages; pi++) {
        const page     = await pdf.getPage(pi);
        const viewport = page.getViewport({ scale: SCALE });
        const canvas   = document.createElement('canvas');
        canvas.width   = Math.round(viewport.width);
        canvas.height  = Math.round(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const dataURL = canvas.toDataURL('image/jpeg', JPEG_Q);
        allPages.push({
          jpegBytes: dataURLtoBytes(dataURL),
          width:     canvas.width,
          height:    canvas.height,
        });

        rendered++;
        if (onProgress) onProgress(rendered, totalPages, file.name, fi + 1, seq.length);
      }
    }

    const pdfBytes   = buildPDF(allPages);
    const blob       = new Blob([pdfBytes], { type: 'application/pdf' });
    const firstName  = files[seq[0]]?.name.replace(/\.pdf$/i, '') ?? 'merged';
    const filename   = `${firstName}_merged.pdf`;

    return { blob, filename, totalPages: allPages.length };
  }

  return { merge };
})();
