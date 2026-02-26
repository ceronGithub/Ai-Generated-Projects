/**
 * pdf-finder.js
 * Original logic for keyword scanning + UI Sync for deletions.
 */
document.getElementById('search-btn').onclick = async () => {
    if (!activeKeywords.length) return alert("Define keywords to begin scan.");
    
    // Original Warp Speed Animation logic
    speed = 18; 
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Accessing data fragments...";

    // Original Scanning Loop
    for (const file of uploadedFiles) {
        const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map(item => item.str).join(' ');

            activeKeywords.forEach(word => {
                let idx = text.toLowerCase().indexOf(word);
                while (idx !== -1) {
                    capturedResults.push({
                        file: file.name,
                        page: i,
                        keyword: word,
                        context: text.substring(idx - 60, idx + 60).trim()
                    });
                    idx = text.toLowerCase().indexOf(word, idx + 1);
                }
            });
        }
    }
    
    // Return to normal star speed
    setTimeout(() => speed = 0.5, 1200);

    // --- UPDATED SECTION START ---
    // Instead of rendering static HTML here, we call the sync function 
    // from keyword-remover.js to enable the individual "Remove" buttons.
    if (typeof refreshResultsUI === 'function') {
        refreshResultsUI();
    } else {
        // Fallback if remover script isn't loaded
        output.innerHTML = capturedResults.length ? "Scan complete. Syncing..." : "No fragments located.";
    }
    // --- UPDATED SECTION END ---

    document.getElementById('download-btn').style.display = capturedResults.length ? 'block' : 'none';
};