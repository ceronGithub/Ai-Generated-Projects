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
                width: item.width
            })).filter(item => item.trimStr.length > 0);

            activeKeywords.forEach(keyword => {
                const anchors = items.filter(item => 
                    item.trimStr.toLowerCase().includes(keyword.toLowerCase())                
            );
                anchors.forEach(anchor => {
                    // Logic to remove keyword and specifically strip "$"
                    const getCleanedPreservedText = (text, kw) => {
                        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\[\#\:\#:\$]&');                
                        const regex = new RegExp(escapedKw, 'gi');
                        let result = text.replace(regex, "");                        
                        return result.replace(/[\#\:\#:\$]/g, "").trim(); // Remove $ specifically
                    };

                    // --- REFINED DETECTION: TABLE HEADER vs. STANDALONE ---

                    // 1. Identify neighbors on the exact same horizontal line (Row check)
                    const rowSiblings = items.filter(item => 
                        Math.abs(item.y - anchor.y) < 5 && item.str !== anchor.str
                    );

                    // 2. Identify neighbors in the same vertical corridor (Column check)
                    const columnSiblings = items.filter(item => 
                        Math.abs(item.x - anchor.x) < 60 && item.y !== anchor.y
                    );

                    /**
                     * isTable Criteria:
                     * - Has at least 2 other items in the same row (standard table row)
                     * - OR has significant vertical data below it while being part of a row (table header)
                     */
                    const isTable = (rowSiblings.length >= 2) || (rowSiblings.length >= 1 && columnSiblings.some(c => c.y < anchor.y));

                    let finalOutput = "";

                    if (isTable) {
                    // --- REFINED TABLE LOGIC: DYNAMIC PATH PRIORITIZATION ---
                    
                    // Identify neighbors to determine row structure
                    const rowSiblings = items.filter(item => Math.abs(item.y - anchor.y) < 5 && item.str !== anchor.str);
                    const colItems = items.filter(item => Math.abs(item.x - anchor.x) < 60);
                    
                    // Define directional paths for probing
                    const right = rowSiblings.filter(item => item.x > anchor.x).sort((a, b) => a.x - b.x);
                    const below = colItems.filter(item => item.y < anchor.y).sort((a, b) => b.y - a.y);
                    const above = colItems.filter(item => item.y > anchor.y).sort((a, b) => a.y - b.y);

                    /**
                     * Helper to process extraction:
                     * 1. Breaks text blocks at keyword (essential for merged blocks like "Created: Feb 25").
                     * 2. Cleans text and filters special characters ($ # : / *).
                     * 3. Stops at 3 spaces (grid boundary).
                     */
                    const extractCleanedText = (textItems, kw = "") => {
                        if (!textItems.length) return null;
                        let rawStr = textItems[0].str;
                        let processingText = rawStr;

                        // Break text block if keyword and value are merged
                        if (kw) {
                            const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const match = rawStr.match(new RegExp(escapedKw, 'i'));
                            if (match) {
                                processingText = rawStr.substring(match.index + match[0].length);
                            }
                        }

                        let captured = "";
                        let spaceCount = 0;
                        for (let i = 0; i < processingText.length; i++) {
                            let char = processingText[i];
                            if (char === " ") {
                                spaceCount++;
                                if (spaceCount >= 3) break;
                            } else {
                                spaceCount = 0;
                            }
                            // Filter special characters
                            if (/[\$#:/\*]/.test(char)) continue; 
                            captured += char;
                        }
                        return captured.trim() || null;
                    };

                    // --- DYNAMIC SEARCH SELECTION ---

                    // 1. If 1-2 columns (rowSiblings.length <= 1): Priority L-to-R, then Bottom, then Top
                    // Handles: "Created: Feb 25, 2026" 
                    if (rowSiblings.length <= 1) {
                        // Check same block first (for merged label/value)
                        finalOutput = extractCleanedText([anchor], keyword);

                        if (!finalOutput && right.length > 0) {
                            finalOutput = extractCleanedText(right, "");
                        }
                        if (!finalOutput && below.length > 0) {
                            finalOutput = extractCleanedText(below, "");
                        }
                        if (!finalOutput && above.length > 0) {
                            finalOutput = extractCleanedText(above, "");
                        }
                    } 
                    // 2. If more than 2 columns (rowSiblings.length >= 2): Priority Bottom, then Top, then L-to-R
                    // Handles: "Description", "Hours", "Total" headers 
                    else {
                        if (below.length > 0) {
                            finalOutput = extractCleanedText(below, "");
                        }
                        if (!finalOutput && above.length > 0) {
                            finalOutput = extractCleanedText(above, "");
                        }
                        // if (!finalOutput && right.length > 0) {
                        //     finalOutput = extractCleanedText(right, "");
                        // }
                    }
                }
                    else {
                        // --- STANDARD LOGIC: 3-PATH CHARACTER-LEVEL SCANNER ---
                        // (Used for standalone labels like "Invoice #:" or "Licensee:")
                        
                        const extractWithPaths = (textItems, kw) => {
                            if (!textItems.length) return null;
                            let rawContent = textItems.map(item => item.str).join(" ");
                            const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regexKw = new RegExp(escapedKw, 'gi');
                            let processingText = rawContent.replace(regexKw, "").trimStart();

                            let captured = "";
                            let spaceCount = 0;

                            for (let i = 0; i < processingText.length; i++) {
                                let char = processingText[i];
                                if (char === " ") {
                                    spaceCount++;
                                    if (spaceCount >= 3) break;
                                } else {
                                    spaceCount = 0;
                                }

                                if (/[\$#:/\*]/.test(char)) {
                                    continue; // Escape special characters
                                } else {
                                    captured += char;
                                }
                            }
                            return captured.trim() || null;
                        };

                        // Path 1: Right | Path 2: Down | Path 3: Top
                        const rightItems = items.filter(item => Math.abs(item.y - anchor.y) < 5 && item.x >= anchor.x).sort((a, b) => a.x - b.x);
                        finalOutput = extractWithPaths(rightItems, keyword);

                        if (!finalOutput) {
                            const belowItems = items.filter(item => Math.abs(item.x - anchor.x) < 40 && item.y < anchor.y).sort((a, b) => b.y - a.y);
                            finalOutput = extractWithPaths(belowItems, "");
                        }

                        if (!finalOutput) {
                            const aboveItems = items.filter(item => Math.abs(item.x - anchor.x) < 40 && item.y > anchor.y).sort((a, b) => a.y - b.y);
                            finalOutput = extractWithPaths(aboveItems, "");
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
