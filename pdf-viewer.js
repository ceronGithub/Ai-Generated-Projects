let pdfDoc = null;
let pageNum = 1;

async function viewPdf(index) {
    const data = await uploadedFiles[index].arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    document.getElementById('page-count').innerText = pdfDoc.numPages;
    document.getElementById('pdf-viewer-modal').style.display = 'flex';
    renderPage(1);
}

async function renderPage(num) {
    const page = await pdfDoc.getPage(num);
    const canvas = document.getElementById('pdf-render-canvas');
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height; canvas.width = viewport.width;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    document.getElementById('page-num').innerText = num;
    pageNum = num;
}

document.getElementById('prev-page').onclick = () => { if (pageNum > 1) renderPage(--pageNum); };
document.getElementById('next-page').onclick = () => { if (pageNum < pdfDoc.numPages) renderPage(++pageNum); };
document.querySelector('.close-btn').onclick = () => { document.getElementById('pdf-viewer-modal').style.display = 'none'; };