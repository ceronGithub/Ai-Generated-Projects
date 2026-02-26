/**
 * pdf-finder.js 
 * Logic: Table-Aware Directional Probes with Special Character Filtering
 */
document.getElementById('search-btn').onclick = async () => {
    if (!activeKeywords.length) return alert("Define keywords to begin scan.");
    
    speed = 18; 
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Mapping cosmic table coordinates...";

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
                width: item.width,
                rightX: item.transform[4] + item.width
            })).filter(item => item.trimStr.length > 0);

            activeKeywords.forEach(keyword => {
                const anchors = items.filter(item => 
                    item.trimStr.toLowerCase().includes(keyword.toLowerCase())
                );

                anchors.forEach(anchor => {
                    // Logic to remove keyword and specifically strip "$"
                    const getCleanedPreservedText = (text, kw) => {
                        // const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&#:');
                        const regex = new RegExp(escapedKw, 'gi');
                        let result = text.replace(regex, "");
                        return result.replace(/\#:/g, "").trim();
                        // return result.replace(/\$/g, "").trim(); // Remove $ specifically
                    };

                    // TABLE DETECTION: Check if other text blocks exist on the same row 
                    // (Common in table structures like your invoice description/total)
                    const rowSiblings = items.filter(item => Math.abs(item.y - anchor.y) < 5 && item.str !== anchor.str);
                    const isTable = rowSiblings.length >= 2;

                    let finalOutput = "";

                    if (isTable) {
                        // --- TABLE LOGIC: 4-PATH VERTICAL PROBING ---
                        const colItems = items.filter(item => Math.abs(item.x - anchor.x) < 40);
                        
                        // Path 1 & 3: Top-to-Bottom (Looking for data below)
                        const below = colItems.filter(item => item.y < anchor.y).sort((a, b) => b.y - a.y);
                        // Path 2 & 4: Bottom-to-Top (Looking for data above)
                        const above = colItems.filter(item => item.y > anchor.y).sort((a, b) => a.y - b.y);

                        if (below.length > 0) {
                            finalOutput = getCleanedPreservedText(below[0].str, "");
                        } else if (above.length > 0) {
                            finalOutput = getCleanedPreservedText(above[0].str, "");
                        }

                    } else {
                        // --- STANDARD LOGIC: Priority Directional ---
                        // Path 1: Right
                        const rightItems = items.filter(item => Math.abs(item.y - anchor.y) < 5 && item.x >= anchor.x).sort((a, b) => a.x - b.x);
                        for (const item of rightItems) {
                            let hit = getCleanedPreservedText(item.str, keyword);
                            if (hit) { finalOutput = hit; break; }
                        }

                        // Path 2: Bottom (if Right is empty)
                        if (!finalOutput) {
                            const below = items.filter(item => Math.abs(item.x - anchor.x) < 40 && item.y <= anchor.y).sort((a, b) => b.y - a.y);
                            for (const item of below) {
                                let hit = getCleanedPreservedText(item.str, keyword);
                                if (hit) { finalOutput = hit; break; }
                            }
                        }

                        // Path 3: Top (if others are empty)
                        if (!finalOutput) {
                            const above = items.filter(item => Math.abs(item.x - anchor.x) < 40 && item.y >= anchor.y).sort((a, b) => a.y - b.y);
                            for (const item of above) {
                                let hit = getCleanedPreservedText(item.str, keyword);
                                if (hit) { finalOutput = hit; break; }
                            }
                        }
                    }

                    capturedResults.push({
                        file: file.name,
                        page: i,
                        keyword: anchor.trimStr,
                        context: finalOutput || "No fragment captured"
                    });
                    // At the end of your scan logic, after the loop finishes:
                    if (capturedResults.length > 0) {
                        document.getElementById('download-btn').style.display = 'inline-block';
                    } else {
                        document.getElementById('download-btn').style.display = 'none';
                    }
                });
            });
        }
    }
    
    setTimeout(() => speed = 0.5, 1200);
    if (typeof refreshResultsUI === 'function') refreshResultsUI();
};
