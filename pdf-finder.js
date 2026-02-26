document.getElementById('search-btn').onclick = async () => {
    if (!activeKeywords.length) return alert("Please add keywords first!");
    
    speed = 18; // Warp speed!
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Scanning Cosmic Data Streams...";

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
                        file: file.name, page: i, keyword: word, 
                        context: text.substring(idx - 60, idx + 60).trim()
                    });
                    idx = text.toLowerCase().indexOf(word, idx + 1);
                }
            });
        }
    }
    setTimeout(() => speed = 0.5, 1200);
    output.innerHTML = capturedResults.map(r => `<div class="glass-card" style="margin-bottom:10px; font-size:14px;"><strong>${r.file} [P.${r.page}]</strong>: ...${r.context}...</div>`).join('') || "Void.";
    document.getElementById('download-btn').style.display = capturedResults.length ? 'block' : 'none';
};