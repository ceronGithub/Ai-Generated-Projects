/**
 * pdf-finder.js 
 * Logic: 3-Path Search Strategy (Right, Bottom, Top)
 * Rules: Filter Special Chars, 3-Space Termination, Keyword Exclusion.
 */
document.getElementById('search-btn').onclick = async () => {
    if (!activeKeywords.length) return alert("Define keywords to begin scan.");
    
    speed = 18; 
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Navigating Cosmic Paths...";

    for (const file of uploadedFiles) {
        const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            
            const items = content.items.map(item => ({
                str: item.str, 
                trimStr: item.str.trim(),
                x: item.transform[4],
                y: item.transform[5],
                width: item.width
            })).filter(item => item.trimStr.length > 0);

            activeKeywords.forEach(keyword => {
                const anchors = items.filter(item => 
                    item.trimStr.toLowerCase().includes(keyword.toLowerCase())
                );

                anchors.forEach(anchor => {
                    /**
                     * CLEANING LOGIC:
                     * 1. Removes the keyword label.
                     * 2. Removes special characters: $, #, :, *, &, %, @.
                     * 3. Stops capturing if 3 consecutive white spaces are detected.
                     */
                    const processCapture = (text, kw) => {
                        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regexKw = new RegExp(escapedKw, 'gi');
                        
                        // Path Rule: Stop at 3 white spaces
                        let segment = text.split(/\s{3,}/)[0];

                        // Path Rule: Remove keyword and Special Characters
                        let result = segment.replace(regexKw, "");
                        return result.replace(/[\$#:\*&%@]/g, "").trim(); 
                    };

                    let finalOutput = "";

                    // PATH 1: Left-to-Right (Same horizontal line)
                    const rightItems = items.filter(item => 
                        Math.abs(item.y - anchor.y) < 5 && item.x >= anchor.x
                    ).sort((a, b) => a.x - b.x);

                    for (const item of rightItems) {
                        let hit = processCapture(item.str, keyword);
                        if (hit) { finalOutput = hit; break; }
                    }

                    // PATH 2: Left-to-Bottom (Vertical column below)
                    if (!finalOutput) {
                        const belowItems = items.filter(item => 
                            Math.abs(item.x - anchor.x) < 40 && item.y < anchor.y
                        ).sort((a, b) => b.y - a.y);

                        for (const item of belowItems) {
                            let hit = processCapture(item.str, "");
                            if (hit) { finalOutput = hit; break; }
                        }
                    }

                    // PATH 3: Left-to-Top (Vertical column above)
                    if (!finalOutput) {
                        const aboveItems = items.filter(item => 
                            Math.abs(item.x - anchor.x) < 40 && item.y > anchor.y
                        ).sort((a, b) => a.y - b.y);

                        for (const item of aboveItems) {
                            let hit = processCapture(item.str, "");
                            if (hit) { finalOutput = hit; break; }
                        }
                    }

                    if (finalOutput) {
                        capturedResults.push({
                            file: file.name,
                            page: i,
                            keyword: anchor.trimStr.replace(/[#:]/g, ""),
                            context: finalOutput
                        });
                    }
                });
            });
        }
    }

    // FINAL RENDER & DOWNLOAD BUTTON TOGGLE
    const downloadBtn = document.getElementById('download-btn');
    if (capturedResults.length > 0) {
        output.innerHTML = "";
        capturedResults.forEach(res => {
            const card = document.createElement('div');
            card.className = "result-card";
            card.innerHTML = `
                <div class="result-header">
                    <span class="meta-item">📄 ${res.file}</span>
                    <span class="meta-item">📍 Page ${res.page}</span>
                </div>
                <strong>${res.keyword}</strong>: ${res.context}
            `;
            output.appendChild(card);
        });
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
    } else {
        output.innerHTML = "No fragments found in defined paths.";
        if (downloadBtn) downloadBtn.style.display = 'none';
    }
    
    setTimeout(() => speed = 0.5, 1200);
};