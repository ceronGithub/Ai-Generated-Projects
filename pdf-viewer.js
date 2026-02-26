/**
 * pdf-viewer.js 
 * Modified to handle container layout reset.
 */
let pdfDoc = null;
let pageNum = 1;
let isRendering = false;

async function viewPdf(index) {
    if (isRendering) return;
    
    const file = uploadedFiles[index];
    const data = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    
    document.getElementById('page-count').innerText = pdfDoc.numPages;
    document.getElementById('pdf-viewer-modal').style.display = 'flex';
    
    // Reset scroll to top when opening a new document
    document.getElementById('canvas-container').scrollTop = 0;
    
    renderPage(1);
}

async function renderPage(num) {
    if (isRendering) return;
    isRendering = true;

    const page = await pdfDoc.getPage(num);
    const canvas = document.getElementById('pdf-render-canvas');
    const ctx = canvas.getContext('2d');
    
    // Original viewport scale
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };

    try {
        await page.render(renderContext).promise;
        document.getElementById('page-num').innerText = num;
        pageNum = num;
        
        // Reset scroll to top of page on page change
        document.getElementById('canvas-container').scrollTop = 0;
    } finally {
        isRendering = false;
    }
}

// Controls (Keep Original Bindings)
document.getElementById('prev-page').onclick = () => { if (pageNum > 1) renderPage(--pageNum); };
document.getElementById('next-page').onclick = () => { if (pageNum < pdfDoc.numPages) renderPage(++pageNum); };
document.querySelector('.close-btn').onclick = () => { document.getElementById('pdf-viewer-modal').style.display = 'none'; };