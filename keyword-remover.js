/**
 * keyword-remover.js
 * Logic for individual removal of captured fragments.
 */
function deleteResult(index, element) {
    // 1. Remove from the global data array (syncs with Excel export)
    capturedResults.splice(index, 1);
    
    // 2. UI Animation
    const card = element.closest('.result-card');
    card.style.opacity = "0";
    card.style.transform = "translateX(-20px)";
    
    // 3. Re-render to update the indices of remaining buttons
    setTimeout(refreshResultsUI, 300);
}

function refreshResultsUI() {
    const output = document.getElementById('results-output');
    if (capturedResults.length === 0) {
        output.innerHTML = "No fragments scanned.";
        document.getElementById('download-btn').style.display = 'none';
        return;
    }

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