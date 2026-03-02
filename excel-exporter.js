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
  function exportKeywordResults(results, filename = 'keyword_results.xlsx') {
    const rows = [['Page', 'Filename', 'Keyword', 'Captured Text']];

    for (const r of results) {
      for (const ctx of r.contexts) {
        rows.push([
          `Page ${r.page}`,
          r.filename,
          r.keyword,
          ctx
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 10 },
      { wch: 35 },
      { wch: 20 },
      { wch: 80 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, filename);
  }

  /**
   * Export extract-all results to Excel.
   * Format: Filename | Page | Text
   * @param {Array<{file: File, pages: Array<{page, text}>}>} pdfData
   */
  function exportExtractAll(pdfData, filename = 'extract_all.xlsx') {
    const rows = [['Filename', 'Page', 'Extracted Text']];

    for (const { file, pages } of pdfData) {
      for (const { page, text } of pages) {
        rows.push([file.name, `Page ${page}`, text]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 100 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Text');
    XLSX.writeFile(wb, filename);
  }

  return { exportKeywordResults, exportExtractAll };
})();
