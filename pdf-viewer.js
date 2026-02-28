/**
 * pdf-viewer.js 
 * Features: Optimized Zoom, Fit-to-Width, and Smooth Scroll centering.
 */
let pdfDoc = null;
let pageNum = 1;
let scale = 1.5; 
let isRendering = false;
let renderTask = null;

async function viewPdf(index) {
    const file = uploadedFiles[index];
    const data = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    
    scale = 1.5; 
    updateZoomDisplay();
    
    document.getElementById('page-count').innerText = pdfDoc.numPages;
    document.getElementById('pdf-viewer-modal').style.display = 'flex';
    renderPage(1);
}

async function renderPage(num) {
    if (renderTask) renderTask.cancel();

    const page = await pdfDoc.getPage(num);
    const canvas = document.getElementById('pdf-render-canvas');
    const container = document.getElementById('canvas-container');
    const ctx = canvas.getContext('2d');
    
    // Record current scroll percentages to maintain focus after zoom
    const scrollLeftPercent = container.scrollLeft / (container.scrollWidth || 1);
    const scrollTopPercent = container.scrollTop / (container.scrollHeight || 1);

    const viewport = page.getViewport({ scale: scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = { canvasContext: ctx, viewport: viewport };
    renderTask = page.render(renderContext);

    try {
        await renderTask.promise;
        document.getElementById('page-num').innerText = num;
        pageNum = num;
        
        // Restore focus: Smoothly scroll back to the relative position
        container.scrollLeft = scrollLeftPercent * container.scrollWidth;
        container.scrollTop = scrollTopPercent * container.scrollHeight;
        
        renderTask = null;
    } catch (err) {
        if (err.name !== 'RenderingCancelledException') console.error(err);
    }
}

// Fixed Zoom Logic with immediate re-render
const changeZoom = (delta) => {
    const newScale = scale + delta;
    if (newScale >= 0.25 && newScale <= 4.0) {
        scale = newScale;
        updateZoomDisplay();
        renderPage(pageNum);
    }
};

document.getElementById('zoom-in').onclick = () => changeZoom(0.25);
document.getElementById('zoom-out').onclick = () => changeZoom(-0.25);

async function fitToWidth() {
    const page = await pdfDoc.getPage(pageNum);
    const container = document.getElementById('canvas-container');
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    scale = (container.offsetWidth - 40) / unscaledViewport.width;
    updateZoomDisplay();
    renderPage(pageNum);
}

function updateZoomDisplay() {
    document.getElementById('zoom-percent').innerText = `${Math.round(scale * 100)}%`;
}

// Navigation and Close Bindings
document.getElementById('prev-page').onclick = () => { if (pageNum > 1) renderPage(--pageNum); };
document.getElementById('next-page').onclick = () => { if (pageNum < pdfDoc.numPages) renderPage(++pageNum); };
document.querySelector('.close-btn').onclick = () => { document.getElementById('pdf-viewer-modal').style.display = 'none'; };