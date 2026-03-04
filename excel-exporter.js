// =============================================
// excel-exporter.js — Export results to Excel
// Uses SheetJS (XLSX) loaded via CDN
// =============================================

const ExcelExporter = (() => {

  /**
   * Export keyword search results to Excel.
   * Format: Page | Filename | Keyword | Captured Text
   * @param {Array<{page, filename, keyword, contexts}>} results
   * @param {string} filename - output file name
   */
  // ─── LAYOUT A: Rows ──────────────────────────────────────────────────────
  // Each keyword+value = one row.  Good for scanning individual hits.
  // Header:  Page | Filename | Keyword | Captured Text
  function exportRowsLayout(results, filename) {
    const rows = [['Page', 'Filename', 'Keyword', 'Captured Text']];
    for (const r of results) {
      for (const ctx of r.contexts) {
        rows.push([`Page ${r.page}`, r.filename, r.keyword, ctx]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 25 }, { wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, filename);
  }

  // ─── LAYOUT B: Columns ───────────────────────────────────────────────────
  // Each unique keyword = one column.
  // Each individual captured value gets its OWN row — only that keyword's
  // column is filled; all other columns stay blank.
  //
  // Example with TIN (2 values) and Date (1 value):
  //   Filename  | Page   | TIN :            | Date :
  //   file.pdf  | Page 1 | 006-887-378-000  |
  //   file.pdf  | Page 1 | 006-977-514-000  |
  //   file.pdf  | Page 1 |                  | 01/07/2026
  //   file2.pdf | Page 1 | 005-123-456-000  | 02/08/2026
  function exportColumnsLayout(results, filename) {
    // Collect ordered unique keywords (preserve search order)
    const kwOrder = [];
    const kwSeen  = new Set();
    for (const r of results) {
      if (!kwSeen.has(r.keyword)) { kwSeen.add(r.keyword); kwOrder.push(r.keyword); }
    }

    const header = ['Filename', 'Page', ...kwOrder];
    const rows   = [header];

    // Each value → its own row; only the matching keyword column is filled
    for (const r of results) {
      const kwIdx = kwOrder.indexOf(r.keyword);
      for (const ctx of r.contexts) {
        const row = [r.filename, `Page ${r.page}`, ...kwOrder.map(() => '')];
        row[2 + kwIdx] = ctx;
        rows.push(row);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 35 },  // Filename
      { wch: 10 },  // Page
      ...kwOrder.map(() => ({ wch: 28 }))
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, filename);
  }

  // ─── PUBLIC: exportKeywordResults ────────────────────────────────────────
  // layout: 'rows' (default) | 'columns'
  function exportKeywordResults(results, filename = 'keyword_results.xlsx', layout = 'rows') {
    if (layout === 'columns') {
      exportColumnsLayout(results, filename);
    } else {
      exportRowsLayout(results, filename);
    }
  }

  /**
   * Export extract-all results to Excel.
   * Each card shown in the UI = one row in Excel.
   * Format: Filename | Page | Label | Extracted Text
   * Mirrors exactly what KeywordHandler.extractFields() produces per page.
   * Falls back to "Raw Text" row when no fields are detected (same as UI fallback).
   * @param {Array<{file: File, pages: Array<{page, text}>}>} pdfData
   */
  function exportExtractAll(pdfData, filename = 'extract_all.xlsx') {
    const rows = [['Filename', 'Page', 'Label', 'Extracted Text']];

    for (const { file, pages } of pdfData) {
      for (const { page, text } of pages) {
        const fields = KeywordHandler.extractFields(text);

        if (fields.length === 0) {
          // Matches UI fallback card: show raw text as one row
          rows.push([file.name, `Page ${page}`, 'Raw Text', text]);
        } else {
          // One row per field card — exactly mirrors the UI
          for (const { label, value } of fields) {
            rows.push([file.name, `Page ${page}`, label, value]);
          }
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 35 },   // Filename
      { wch: 10 },   // Page
      { wch: 22 },   // Label
      { wch: 100 },  // Extracted Text
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Text');
    XLSX.writeFile(wb, filename);
  }

  // ─── exportTableRows — Layout A: Rows ────────────────────────────────────
  // One row per transaction leg. Best for reviewing individual trips.
  // Header: Filename | Page | Tag Number | Plate | Ref Type | Ref No. |
  //         Date | Time | E-SI No(s). | Zone(s) | Entry | Exit | Toll Fee
  function exportTableRowsLayout(rows, filename) {
    const header = [
      'Filename', 'Page', 'Tag Number', 'Plate Number',
      'Ref Type', 'Ref No.',
      'Date', 'Time', 'E-SI No(s).', 'Zone(s)',
      'Entry', 'Exit', 'Toll Fee'
    ];

    const data = [header, ...rows.map(r => [
      r.filename,
      `Page ${r.page}`,
      r.tagNumber,
      r.plateNumber,
      r.refType,
      r.refNo,
      r.date,
      r.time,
      r.esiNos,
      r.zones,
      r.entries,
      r.exits,
      r.tollFee,
    ])];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 35 }, // Filename
      { wch: 8  }, // Page
      { wch: 14 }, // Tag Number
      { wch: 12 }, // Plate
      { wch: 10 }, // Ref Type
      { wch: 14 }, // Ref No.
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 26 }, // E-SI
      { wch: 14 }, // Zone
      { wch: 30 }, // Entry
      { wch: 30 }, // Exit
      { wch: 12 }, // Toll Fee
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, filename);
  }

  // ─── exportTableRows — Layout B: Columns (grouped by Tag) ────────────────
  // One column group per unique Tag Number. Best for comparing vehicles.
  // Header: Tag Number | Plate | Ref Type | Ref No. | Date | Time |
  //         E-SI No(s). | Zone(s) | Entry | Exit | Toll Fee | Filename | Page
  function exportTableColumnsLayout(rows, filename) {
    const header = [
      'Tag Number', 'Plate Number', 'Ref Type', 'Ref No.',
      'Date', 'Time', 'E-SI No(s).', 'Zone(s)',
      'Entry', 'Exit', 'Toll Fee',
      'Filename', 'Page'
    ];

    // Sort by tag number then date/time for a cleaner grouped view
    const sorted = [...rows].sort((a, b) => {
      const tagCmp = (a.tagNumber || '').localeCompare(b.tagNumber || '');
      if (tagCmp !== 0) return tagCmp;
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    });

    const data = [header, ...sorted.map(r => [
      r.tagNumber,
      r.plateNumber,
      r.refType,
      r.refNo,
      r.date,
      r.time,
      r.esiNos,
      r.zones,
      r.entries,
      r.exits,
      r.tollFee,
      r.filename,
      `Page ${r.page}`,
    ])];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 14 }, // Tag Number
      { wch: 12 }, // Plate
      { wch: 10 }, // Ref Type
      { wch: 14 }, // Ref No.
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 26 }, // E-SI
      { wch: 14 }, // Zone
      { wch: 30 }, // Entry
      { wch: 30 }, // Exit
      { wch: 12 }, // Toll Fee
      { wch: 35 }, // Filename
      { wch: 8  }, // Page
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions by Tag');
    XLSX.writeFile(wb, filename);
  }

  /**
   * Export TableParser rows to Excel.
   * @param {Array<TransactionRow>} rows  - from TableParser.parse()
   * @param {string} filename
   * @param {'rows'|'columns'} layout
   */
  function exportTableRows(rows, filename = 'transaction_history.xlsx', layout = 'rows') {
    if (layout === 'columns') {
      exportTableColumnsLayout(rows, filename);
    } else {
      exportTableRowsLayout(rows, filename);
    }
  }

  return { exportKeywordResults, exportExtractAll, exportTableRows };
})();