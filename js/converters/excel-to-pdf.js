// =============================================
// excel-to-pdf.js — Excel (.xlsx) to PDF Converter
// Uses SheetJS (already loaded via CDN in index.html
// as xlsx-js-style) to parse .xlsx files, converts
// each sheet into a styled HTML table, then wraps
// it in a print-ready document the user saves as PDF
// via the browser's native print dialog.
// =============================================

const ExcelToPDF = (() => {

  // ── convert(files, onProgress) ───────────────────────────────────────────
  // Reads each .xlsx file, converts all sheets to HTML tables,
  // and returns a print-ready HTML blob for each file.
  async function convert(files, onProgress) {
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook    = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
        const sheetsHtml  = [];

        // Convert every sheet in the workbook to an HTML table
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const tableHtml = XLSX.utils.sheet_to_html(worksheet, { header: '', footer: '' });
          sheetsHtml.push({ name: sheetName, tableHtml });
        }

        const printHtml  = _buildPrintDocument(sheetsHtml, file.name);
        const blob       = new Blob([printHtml], { type: 'text/html' });
        const outputName = file.name.replace(/\.xlsx$/i, '') + '_converted.html';

        results.push({ file, filename: outputName, blob, pages: null });
      } catch (err) {
        results.push({ file, filename: file.name, error: err.message });
      }

      if (onProgress) onProgress(i + 1, files.length);
    }

    return results;
  }

  // ── _buildPrintDocument(sheetsHtml, filename) ────────────────────────────
  // Wraps all sheets into a single print-optimized HTML document.
  // Each sheet gets its own section with the sheet name as a heading.
  function _buildPrintDocument(sheetsHtml, filename) {
    const sheetsMarkup = sheetsHtml.map(({ name, tableHtml }) => `
      <div class="sheet-section">
        <h2 class="sheet-title">${_escapeHtml(name)}</h2>
        <div class="table-wrap">${tableHtml}</div>
      </div>
    `).join('<div class="sheet-break"></div>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${_escapeHtml(filename.replace(/\.xlsx$/i, ''))}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #000;
      background: #fff;
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
    .sheet-section { margin-bottom: 2em; }
    .sheet-title {
      font-size: 13pt;
      font-weight: bold;
      margin-bottom: 0.5em;
      color: #1a1208;
      border-bottom: 2px solid #c8a96e;
      padding-bottom: 4px;
    }
    .sheet-break { page-break-after: always; margin: 2em 0; border-top: 1px dashed #ccc; }
    .table-wrap { overflow-x: auto; }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 9pt;
    }
    td, th {
      border: 1px solid #ccc;
      padding: 3pt 5pt;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    tr:nth-child(even) { background: #f9f6f0; }
    @media print {
      .print-hint { display: none; }
      body { padding: 0; }
      @page { margin: 1.5cm; size: landscape; }
      .sheet-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="print-hint">
    ✦ To save as PDF: press <strong>Ctrl+P</strong> (or Cmd+P on Mac) → choose <strong>Save as PDF</strong> → Save
  </div>
  ${sheetsMarkup}
</body>
</html>`;
  }

  function _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { convert };

})();
