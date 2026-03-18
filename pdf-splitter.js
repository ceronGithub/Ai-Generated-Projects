// =============================================
// pdf-splitter.js — Client-side PDF page splitter
//
// Splits a PDF into multiple PDFs purely in-browser.
// Uses PDF.js to render pages to canvas, then packs
// each group into a new PDF via the same minimal
// PDF byte-writer used by pdf-compressor.js.
//
// Two split modes:
//   'every'  — split every N pages  (e.g. every 1 = one PDF per page)
//   'ranges' — custom page ranges   (e.g. "1-3, 4-7, 8, 9-10")
//
// Public API (window.PDFSplitter):
//   PDFSplitter.split(file, config, onProgress)
//   → Promise<Array<{ filename, blob, pages: number[] }>>
//
//   PDFSplitter.parseRanges(rangeStr, totalPages)
//   → Array<number[]>   (each inner array = page numbers for one output file)
//
//   PDFSplitter.pageCount(file)
//   → Promise<number>
// =============================================

const PDFSplitter = (() => {
  'use strict';

  // ── Render quality ────────────────────────────────────────────────────────
  const SCALE  = 1.5;         // render scale — higher = better quality but larger file
  const JPEG_Q = 0.82;        // JPEG quality per page
  const PAGE_TYPE = 'image/jpeg';

  // ── Minimal PDF byte-writer (same approach as pdf-compressor.js) ──────────

  function dataURLtoBytes(dataURL) {
    const b64 = dataURL.split(',')[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function enc(str) { return new TextEncoder().encode(str); }

  function buildPDF(pages) {
    // pages = [{ jpegBytes: Uint8Array, width: number, height: number }]
    const parts = [];
    const xrefs = [];
    let offset  = 0;

    function write(chunk) {
      if (typeof chunk === 'string') chunk = enc(chunk);
      parts.push(chunk);
      offset += chunk.length;
    }
    function startObj(n) { xrefs[n] = offset; write(`${n} 0 obj\n`); }
    function endObj()    { write('endobj\n'); }

    write('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    const N         = pages.length;
    const catalogObj  = 1;
    const pagesObj    = 2;
    const pageBase    = 3;
    const xobjBase    = 3 + N;
    const streamBase  = 3 + 2 * N;

    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      startObj(pageBase + i);
      write(
        `<< /Type /Page /Parent ${pagesObj} 0 R\n` +
        `   /MediaBox [0 0 ${width} ${height}]\n` +
        `   /Contents ${streamBase + i} 0 R\n` +
        `   /Resources << /XObject << /Im${i} ${xobjBase + i} 0 R >> >>\n>>\n`
      );
      endObj();
    }

    for (let i = 0; i < N; i++) {
      const { jpegBytes, width, height } = pages[i];
      startObj(xobjBase + i);
      write(
        `<< /Type /XObject /Subtype /Image\n` +
        `   /Width ${width} /Height ${height}\n` +
        `   /ColorSpace /DeviceRGB /BitsPerComponent 8\n` +
        `   /Filter /DCTDecode /Length ${jpegBytes.length}\n>>\nstream\n`
      );
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
    write(`<< /Type /Pages /Kids [${Array.from({ length: N }, (_, i) => `${pageBase + i} 0 R`).join(' ')}] /Count ${N} >>\n`);
    endObj();

    startObj(catalogObj);
    write(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>\n`);
    endObj();

    const xrefOff  = offset;
    const totalObj = 3 + 3 * N;
    write(`xref\n0 ${totalObj + 1}\n`);
    write('0000000000 65535 f \n');
    for (let n = 1; n <= totalObj; n++) {
      write(String(xrefs[n] ?? 0).padStart(10, '0') + ' 00000 n \n');
    }
    write(`trailer\n<< /Size ${totalObj + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`);

    const total = parts.reduce((s, p) => s + p.length, 0);
    const out   = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // ── Page count helper ─────────────────────────────────────────────────────

  async function pageCount(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    return pdf.numPages;
  }

  // ── Range parser ──────────────────────────────────────────────────────────
  //
  // Accepts strings like:  "1-3, 4-7, 8, 9-10"
  // Returns array of page-number arrays (1-indexed):
  //   [[1,2,3], [4,5,6,7], [8], [9,10]]
  //
  // Rules:
  //   • Whitespace and extra commas are ignored
  //   • "N-M" where N > M is silently swapped
  //   • Pages outside [1, totalPages] are clamped / skipped
  //   • Duplicate pages within a segment are removed

  function parseRanges(rangeStr, totalPages) {
    const groups = [];
    const segments = String(rangeStr).split(',').map(s => s.trim()).filter(Boolean);

    for (const seg of segments) {
      const dash = seg.indexOf('-');
      let pages;

      if (dash > 0) {
        let a = parseInt(seg.slice(0, dash), 10);
        let b = parseInt(seg.slice(dash + 1), 10);
        if (isNaN(a) || isNaN(b)) continue;
        if (a > b) [a, b] = [b, a];
        a = Math.max(1, a);
        b = Math.min(totalPages, b);
        if (a > totalPages) continue;
        pages = [];
        for (let p = a; p <= b; p++) pages.push(p);
      } else {
        const p = parseInt(seg, 10);
        if (isNaN(p) || p < 1 || p > totalPages) continue;
        pages = [p];
      }

      if (pages.length > 0) groups.push([...new Set(pages)]);
    }

    return groups;
  }

  // ── Every-N helper ────────────────────────────────────────────────────────
  // Returns groups of page numbers: [[1..N], [N+1..2N], …]

  function everyNPages(n, totalPages) {
    const groups = [];
    for (let start = 1; start <= totalPages; start += n) {
      const group = [];
      for (let p = start; p < start + n && p <= totalPages; p++) group.push(p);
      groups.push(group);
    }
    return groups;
  }

  // ── Render a single page to JPEG ──────────────────────────────────────────

  async function renderPage(pdf, pageNum) {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas   = document.createElement('canvas');
    canvas.width   = Math.round(viewport.width);
    canvas.height  = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const dataURL  = canvas.toDataURL(PAGE_TYPE, JPEG_Q);
    return {
      jpegBytes: dataURLtoBytes(dataURL),
      width:     canvas.width,
      height:    canvas.height,
    };
  }

  // ── Main split function ───────────────────────────────────────────────────
  //
  // config = {
  //   mode:       'every' | 'ranges'
  //   every:      number          (used when mode === 'every')
  //   ranges:     string          (used when mode === 'ranges', e.g. "1-3, 4-7")
  // }
  //
  // Returns: Array<{ filename, blob, pageNums, pageCount }>

  async function split(file, config, onProgress) {
    const buf      = await file.arrayBuffer();
    const pdf      = await pdfjsLib.getDocument({ data: buf }).promise;
    const total    = pdf.numPages;
    const baseName = file.name.replace(/\.pdf$/i, '');

    // ── Build page groups ───────────────────────────────────────────────────
    let groups;
    if (config.mode === 'every') {
      const n = Math.max(1, parseInt(config.every, 10) || 1);
      groups = everyNPages(n, total);
    } else {
      groups = parseRanges(config.ranges || '', total);
      if (groups.length === 0) {
        throw new Error('No valid page ranges found. Check your range input.');
      }
    }

    const results  = [];
    let   rendered = 0;
    const totalRenders = groups.reduce((s, g) => s + g.length, 0);

    // ── Render each group into a PDF blob ───────────────────────────────────
    for (let gi = 0; gi < groups.length; gi++) {
      const pageNums = groups[gi];
      const pages    = [];

      for (const pNum of pageNums) {
        pages.push(await renderPage(pdf, pNum));
        rendered++;
        if (onProgress) onProgress(rendered, totalRenders);
      }

      const pdfBytes = buildPDF(pages);
      const blob     = new Blob([pdfBytes], { type: 'application/pdf' });

      // ── Filename strategy ───────────────────────────────────────────────
      // Single page  → baseName_p3.pdf
      // Range        → baseName_p1-3.pdf
      // Part N of M  → baseName_part1.pdf  (for 'every' mode)
      let suffix;
      if (config.mode === 'every') {
        suffix = `_part${gi + 1}`;
      } else {
        const first = pageNums[0];
        const last  = pageNums[pageNums.length - 1];
        suffix = first === last ? `_p${first}` : `_p${first}-${last}`;
      }

      results.push({
        filename:  `${baseName}${suffix}.pdf`,
        blob,
        pageNums,
        pageCount: pageNums.length,
      });
    }

    return results;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return { split, parseRanges, pageCount, everyNPages };

})();
