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

    const detectDataType = (text) => {
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\w{3} \d{1,2}, \d{4}$/.test(text)) return "Date";
        if (/\d+ [A-Z][a-z]+/.test(text) && text.length > 10) return "Address";
        if (text.includes('@')) return "Email";
        if (/^\d+(\.\d{2})?$/.test(text.replace(/,/g, ""))) return "Currency/Number";
        return "Text Block";
    };

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
                        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\[\#\:\#:]&');                
                        const regex = new RegExp(escapedKw, 'gi');
                        let result = text.replace(regex, "");                        
                        return result.replace(/[\#\:\#:]/g, "").trim(); // Remove $ specifically
                    };

                    const rowSiblings = items.filter(item => Math.abs(item.y - anchor.y) < 5 && item.str !== anchor.str);
            
                    // We treat it as a "Table/Header" if it has at least one neighbor 
                    // either on the same row OR directly in its vertical column.
                    const isTable = rowSiblings.length >= 1 || items.some(item => Math.abs(item.x - anchor.x) < 60 && item.y !== anchor.y);

                    let finalOutput = "";

                    if (isTable) {
                        // --- 3-PATH PRIORITIZED PROBING ---
                        
                        // Path 1: header-To-Bottom (Capture first text directly below)
                        // Increased tolerance to 60px to catch "Description" -> "Document" 
                        const colItems = items.filter(item => Math.abs(item.x - anchor.x) < 60);
                        const below = colItems.filter(item => item.y < anchor.y).sort((a, b) => b.y - a.y);
                        
                        // Path 2: header-To-Right (Capture first text on the same row)
                        const right = rowSiblings.filter(item => item.x > anchor.x).sort((a, b) => a.x - b.x);

                        // Path 3: header-To-Top (Capture first text directly above)
                        const above = colItems.filter(item => item.y > anchor.y).sort((a, b) => a.y - b.y);

                        // EXECUTION PRIORITY: BOTTOM > RIGHT > TOP
                        if (below.length > 0) {
                            finalOutput = getCleanedPreservedText(below[0].str, "");
                        } else if (right.length > 0) {
                            finalOutput = getCleanedPreservedText(right[0].str, "");
                        } else if (above.length > 0) {
                            finalOutput = getCleanedPreservedText(above[0].str, "");
                        }

                    }
                    else {
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
                        keyword: anchor.trimStr,
                        file: file.name,
                        page: i,                        
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
