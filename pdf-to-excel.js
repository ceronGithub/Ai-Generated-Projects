// =============================================
// pdf-to-excel.js — Convert PDF to Excel (.xlsx)
//
// Strategy: Extract text from each PDF page via
// PDF.js, parse into rows/columns by y-position,
// and write to an Excel sheet via SheetJS.
//
// Public API:
//   PDFToExcel.convert(files, onProgress)
//   → Promise<Array<{ file, filename, blob, pages }>>
// =============================================

const PDFToExcel = (() => {
  'use strict';

  const Y_TOL = 4; // px — items within this y-distance share a row

  async function convert(files, onProgress) {
    if (!window.XLSX) throw new Error('SheetJS (XLSX) library is required but not loaded.');

    const results = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const buf  = await file.arrayBuffer();
        const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;
        const wb   = XLSX.utils.book_new();

        for (let pi = 1; pi <= pdf.numPages; pi++) {
          const page    = await pdf.getPage(pi);
          const content = await page.getTextContent();
          const vp      = page.getViewport({ scale: 1 });

          // Group items by screen-Y row
          const rowMap = new Map();
          for (const item of content.items) {
            if (!item.str || !item.str.trim()) continue;
            const screenY = Math.round(vp.height - item.transform[5]);
            let key = null;
            for (const [k] of rowMap) {
              if (Math.abs(k - screenY) <= Y_TOL) { key = k; break; }
            }
            if (key === null) key = screenY;
            if (!rowMap.has(key)) rowMap.set(key, []);
            rowMap.get(key).push({ str: item.str.trim(), x: item.transform[4] });
          }

          // Sort rows top→bottom, items left→right
          const rows = [...rowMap.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, items]) =>
              items.sort((a, b) => a.x - b.x).map(i => i.str)
            );

          const ws = XLSX.utils.aoa_to_sheet(rows);

          // Auto column widths
          const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
          ws['!cols'] = Array.from({ length: maxCols }, (_, ci) => {
            const maxLen = rows.reduce((m, r) => Math.max(m, (r[ci] || '').length), 0);
            return { wch: Math.min(Math.max(maxLen + 2, 8), 60) };
          });

          const sheetName = pdf.numPages === 1 ? 'Page 1' : `Page ${pi}`;
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob      = new Blob([xlsxBytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        results.push({
          file,
          filename: file.name.replace(/\.pdf$/i, '') + '.xlsx',
          blob,
          pages: pdf.numPages,
        });

      } catch (err) {
        results.push({ file, filename: file.name, blob: null, error: err.message });
      }

      if (onProgress) onProgress(fi + 1, files.length);
    }

    return results;
  }

  return { convert };
})();
