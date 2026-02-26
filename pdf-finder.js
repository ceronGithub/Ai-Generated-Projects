document.getElementById('search-btn').onclick = async () => {
    const keywords = document.getElementById('keyword-search').value.toLowerCase().split(',').map(k => k.trim()).filter(k => k);
    if (!keywords.length) return;

    speed = 12; // Warp speed
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Scanning Cosmic Data...";

    for (const file of uploadedFiles) {
        const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map(item => item.str).join(' ');

            keywords.forEach(word => {
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
    setTimeout(() => speed = 0.5, 1500);
    output.innerHTML = capturedResults.map(r => `<div class="result-box"><strong>${r.file} (P.${r.page})</strong>: ${r.context}</div>`).join('') || "No signals.";
    document.getElementById('download-btn').style.display = capturedResults.length ? 'block' : 'none';
};