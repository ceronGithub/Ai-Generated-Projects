document.getElementById('download-btn').onclick = () => {
    let tableRows = capturedResults.map(r => `<tr><td>${r.file}</td><td>${r.page}</td><td>${r.keyword}</td><td>${r.context}</td></tr>`).join('');
    
    let excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head>
        <body><table border="1">
            <tr style="background:#333; color:#fff;"><th>File Name</th><th>Page</th><th>Keyword</th><th>Text Block</th></tr>
            ${tableRows}
        </table></body></html>`;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Cosmic_Data_${Date.now()}.xls`;
    link.click();
};