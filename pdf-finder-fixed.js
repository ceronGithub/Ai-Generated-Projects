/**
 * pdf-finder.js — FIXED
 *
 * BUG FIXES (invoice search returning undefined):
 *  A. finalOutput was initialized as "" (falsy) instead of null → broke null-check fallback chain
 *  B. rightItems used `item.x >= anchor.x` which included the anchor itself → keyword never stripped cleanly
 *  C. extractValue returned null but callers used falsy `||` check → empty strings masked real results
 *  D. stripSpecialChars stripped ALL colons, breaking "12:00" style values → now only strips LEADING chars
 *  E. "From:" was collecting "To:" address lines because they share the same X column corridor.
 *     Fix: clipBelowToNextLabel() stops collecting below-items the moment another label (word ending in ":")
 *     is encountered, so each label only owns lines up to the next sibling label.
 */

document.getElementById('search-btn').onclick = async () => {
    if (!activeKeywords.length) return alert("Define keywords to begin scan.");

    speed = 18;
    capturedResults = [];
    const output = document.getElementById('results-output');
    output.innerHTML = "Mapping cosmic table coordinates...";

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const detectDataType = (text) => {
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\w{3} \d{1,2}, \d{4}$/.test(text)) return "Date";
        if (/\d+ [A-Z][a-z]+/.test(text) && text.length > 10) return "Address";
        if (text.includes('@')) return "Email";
        if (/^\d+(\.\d{2})?$/.test(text.replace(/,/g, ""))) return "Currency/Number";
        return "Text Block";
    };

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // FIX D: Only strip LEADING special chars — preserves "12:00", "http://..." etc.
    const stripSpecialChars = (str) => str.replace(/^[\$#:/\*\s]+/, '').trim();

    /**
     * FIX E: clipBelowToNextLabel
     * "below" items are already sorted closest-first (descending Y).
     * We walk through them and stop as soon as we hit another label
     * (a text item whose trimmed string ends with ":").
     * This prevents "From:" from absorbing "To:" and its address lines.
     */
    const clipBelowToNextLabel = (belowItems) => {
        const clipped = [];
        for (const item of belowItems) {
            if (clipped.length > 0 && /:\s*$/.test(item.trimStr)) break; // next label found — stop
            clipped.push(item);
        }
        return clipped;
    };

    const splitAfterKeyword = (text, keyword) => {
        if (!keyword) return text;
        const regex = new RegExp(escapeRegex(keyword), 'i');
        const match = text.match(regex);
        if (match) return text.substring(match.index + match[0].length);
        return text;
    };

    // FIX A+C: returns null (not "") when nothing found — lets callers use strict null checks
    const extractValue = (textItems, keyword = "") => {
        if (!textItems.length) return null;
        const raw = textItems.map(i => i.str).join(" ");
        let text = splitAfterKeyword(raw, keyword);
        text = stripSpecialChars(text);
        return text.length > 0 ? text : null;
    };

    // ─── Main scan loop ───────────────────────────────────────────────────────

    for (const file of uploadedFiles) {
        const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            const page = await doc.getPage(pageNum);
            const content = await page.getTextContent();

            const items = content.items
                .map(item => ({
                    str:     item.str,
                    trimStr: item.str.trim(),
                    x:       item.transform[4],
                    y:       item.transform[5],
                    width:   item.width,
                }))
                .filter(item => item.trimStr.length > 0);

            activeKeywords.forEach(keyword => {
                const anchors = items.filter(item =>
                    item.trimStr.toLowerCase().includes(keyword.toLowerCase())
                );

                anchors.forEach(anchor => {

                    // FIX B: exclude anchor itself using identity check (item !== anchor)
                    const rowSiblings = items.filter(item =>
                        Math.abs(item.y - anchor.y) < 5 && item !== anchor
                    );

                    const colItems = items.filter(item =>
                        Math.abs(item.x - anchor.x) < 60 && Math.abs(item.y - anchor.y) >= 5
                    );

                    const right = rowSiblings
                        .filter(item => item.x > anchor.x)
                        .sort((a, b) => a.x - b.x);

                    const below = colItems
                        .filter(item => item.y < anchor.y)
                        .sort((a, b) => b.y - a.y);

                    const above = colItems
                        .filter(item => item.y > anchor.y)
                        .sort((a, b) => a.y - b.y);

                    const isTable = (rowSiblings.length >= 2) ||
                                    (rowSiblings.length >= 1 && below.length > 0);

                    // FIX A: initialize to null (not "") so === null checks work
                    let finalOutput = null;

                    if (isTable) {
                        if (rowSiblings.length <= 1) {
                            finalOutput = extractValue([anchor], keyword);
                            if (finalOutput === null && right.length)  finalOutput = extractValue(right, "");
                            if (finalOutput === null && below.length)  finalOutput = extractValue(clipBelowToNextLabel(below), "");
                            if (finalOutput === null && above.length)  finalOutput = extractValue(above, "");
                        } else {
                            if (below.length) {
                                // Table column values — no label clipping needed here (these are data rows, not labels)
                                const joined = below.map(i => stripSpecialChars(i.str)).filter(Boolean).join(", ");
                                finalOutput = joined || null;
                            }
                            if (finalOutput === null && above.length)  finalOutput = extractValue(above, "");
                            if (finalOutput === null && right.length)  finalOutput = extractValue(right, "");
                        }

                    } else {
                        // FIX B: strictRight uses item.x > anchor.x (strict greater, excludes anchor)
                        const strictRight = items
                            .filter(item => Math.abs(item.y - anchor.y) < 5 && item.x > anchor.x)
                            .sort((a, b) => a.x - b.x);

                        // First: check if anchor itself is a merged "Label: Value" block
                        const anchorOnly = extractValue([anchor], keyword);
                        if (anchorOnly !== null) finalOutput = anchorOnly;

                        // Second: value is to the right on same line
                        if (finalOutput === null && strictRight.length)
                            finalOutput = extractValue(strictRight, "");

                        // Third: value is below (multi-line address, signature, etc.)
                        // FIX E: clip below items at the next label so "From:" doesn't absorb "To:" lines
                        if (finalOutput === null && below.length) {
                            const clipped = clipBelowToNextLabel(below);
                            const joined = clipped.map(i => stripSpecialChars(i.str)).filter(Boolean).join(", ");
                            finalOutput = joined || null;
                        }

                        // Fallback: above
                        if (finalOutput === null && above.length)
                            finalOutput = extractValue(above, "");
                    }

                    // FIX C: strict null check — empty string "" is a valid captured value
                    capturedResults.push({
                        keyword:  anchor.trimStr,
                        file:     file.name,
                        page:     pageNum,
                        value:    finalOutput !== null ? finalOutput : "No fragment captured",
                        type:     finalOutput !== null ? detectDataType(finalOutput) : "—",
                    });
                });
            });
        }
    }

    const hasResults = capturedResults.length > 0;
    document.getElementById('download-btn').style.display = hasResults ? 'inline-block' : 'none';
    document.getElementById('rename-btn').style.display   = hasResults ? 'inline-block' : 'none';

    setTimeout(() => speed = 0.5, 1200);
    if (typeof refreshResultsUI === 'function') refreshResultsUI();
};
