/**
 * keyword-remover.js
 * Keeps the UI and data array in sync for individual deletions.
 */

function deleteResult(index, element) {
    // 1. Remove from the actual data array (important for Excel export sync)
    capturedResults.splice(index, 1);

    // 2. Animate the card out
    const card = element.closest('.result-card');
    card.style.opacity = "0";
    card.style.transform = "translateX(-20px)";
    
    // 3. Re-render the list to update indices for remaining buttons
    setTimeout(refreshResultsUI, 300);
}

function refreshResultsUI() {
    const output = document.getElementById('results-output');
    
    if (capturedResults.length === 0) {
        output.innerHTML = "No fragments scanned.";
        document.getElementById('download-btn').style.display = 'none';
        return;
    }

    // Re-drawing the HTML ensures the 'index' passed to deleteResult is always correct
    output.innerHTML = capturedResults.map((r, index) => `
        <div class="result-card">
            <button class="delete-result-btn" onclick="deleteResult(${index}, this)">✕ REMOVE</button>
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
    `).join('');
}