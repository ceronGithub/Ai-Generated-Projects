/**
 * keyword-remover.js
 * Logic for individual removal and mass clearing of captured fragments.
 */

function deleteResult(index, element) {
    // Sync with global array
    capturedResults.splice(index, 1);
    
    // UI Feedback
    const card = element.closest('.result-card');
    card.style.opacity = "0";
    card.style.transform = "translateX(-20px)";
    
    // Re-render to update indices
    setTimeout(refreshResultsUI, 300);
}

document.getElementById('clear-all-btn').onclick = () => {
    if (confirm("Are you sure you want to purge all captured results?")) {
        capturedResults = [];
        refreshResultsUI();
    }
};

function refreshResultsUI() {
    const output = document.getElementById('results-output');
    const clearBtn = document.getElementById('clear-all-btn');
    const downloadBtn = document.getElementById('download-btn');

    if (capturedResults.length === 0) {
        output.innerHTML = "No fragments scanned.";
        clearBtn.style.display = 'none';
        downloadBtn.style.display = 'none';
    } else {
        clearBtn.style.display = 'block';
        downloadBtn.style.display = 'block';
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
}