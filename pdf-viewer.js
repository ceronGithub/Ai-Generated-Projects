/**
 * pdf-viewer.js
 * Handles PDF rendering and page navigation within the modal.
 */

let pdfDoc = null;
let pageNum = 1;
let pageIsRendering = false;
let pageNumIsPending = null;

const canvas = document.getElementById('pdf-render-canvas');
const ctx = canvas.getContext('2d');

// 1. Render the specific page
async function renderPage(num) {
    pageIsRendering = true;

    // Get page
    const page = await pdfDoc.getPage(num);

    // Set scale
    const viewport = page.getViewport({ scale: 1 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderCtx = {
        canvasContext: ctx,
        viewport
    };

    await page.render(renderCtx).promise;
    pageIsRendering = false;

    if (pageNumIsPending !== null) {
        renderPage(pageNumIsPending);
        pageNumIsPending = null;
    }

    // Update UI
    document.getElementById('page-num').innerText = num;
}

// 2. Check for pages rendering
function queueRenderPage(num) {
    if (pageIsRendering) {
        pageNumIsPending = num;
    } else {
        renderPage(num);
    }
}

// 3. Show Previous Page
function showPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

// 4. Show Next Page
function showNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

// 5. Initialize the Viewer (called from the file list)
async function viewPdf(index) {
    const file = uploadedFiles[index];
    const data = await file.arrayBuffer();
    
    // Load Document
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    
    document.getElementById('page-count').innerText = pdfDoc.numPages;
    document.getElementById('pdf-viewer-modal').style.display = 'flex';
    
    // Always start at page 1
    pageNum = 1;
    renderPage(pageNum);
}

// --- Event Listeners ---

// Button Events
document.getElementById('prev-page').addEventListener('click', showPrevPage);
document.getElementById('next-page').addEventListener('click', showNextPage);

// Close Modal Event
document.querySelector('.close-btn').addEventListener('click', () => {
    document.getElementById('pdf-viewer-modal').style.display = 'none';
});