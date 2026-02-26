document.getElementById('download-btn').onclick = () => {
    let rows = capturedResults.map(r => `<tr><td>${r.file}</td><td>${r.page}</td><td>${r.keyword}</td><td>${r.context}</td></tr>`).join('');
    
    let excelXML = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head>
        <body><table border="1">
            <tr style="background:#222; color:#fff;"><th>Source File</th><th>Page No</th><th>Keyword Found</th><th>Text Snippet</th></tr>
            ${rows}
        </table></body></html>`;

    const blob = new Blob([excelXML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cosmic_Scan_Report_${Date.now()}.xls`;
    a.click();
};