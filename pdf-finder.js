document.getElementById('search-btn').onclick = async () => {
    if (!activeKeywords.length) return alert("Define keywords to begin scan.");
    
    speed = 18; 
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Accessing data fragments...";

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
    
    setTimeout(() => speed = 0.5, 1200);

    output.innerHTML = capturedResults.map(r => `
        <div class="result-card">
            <div class="result-header">
                <div class="meta-item"><span>🔍</span> <strong>${r.keyword}</strong></div>
                <div class="meta-item"><span>📄</span> <strong>${r.file}</strong></div>
                <div class="meta-item"><span>📑</span> <strong>Page ${r.page}</strong></div>
            </div>
            <div class="captured-content">
                <span>📡</span>
                <div><em>"...${r.context}..."</em></div>
            </div>
        </div>
    `).join('') || `<div class="glass-card">Sector scanned. No fragments located.</div>`;

    document.getElementById('download-btn').style.display = capturedResults.length ? 'block' : 'none';
};