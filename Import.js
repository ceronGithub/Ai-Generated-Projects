// Ensure PDF.js is loaded
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.getElementById('pdfUpload').addEventListener('change', async (e) => {
    const viewer = document.getElementById('pdf-Viewer');
    const files = Array.from(e.target.files);
    
    // Clear the "AWAITING INPUT" text
    viewer.innerHTML = '';

    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        // Save to global storage for pdf-Finder.js
        pdfDocuments[file.name] = pdf;

        // Create UI Card for the PDF
        const card = document.createElement('div');
        card.className = 'pdf-preview-card';
        
        const canvas = document.createElement('canvas');
        card.appendChild(canvas);
        
        const label = document.createElement('p');
        label.innerText = file.name;
        label.style.fontSize = "0.8rem";
        card.appendChild(label);
        
        viewer.appendChild(card);

        // Render the first page as a thumbnail
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnail
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }
});