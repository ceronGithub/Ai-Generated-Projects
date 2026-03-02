// =============================================
// ui-manager.js — UI rendering / updates
// NEW: Individual result remove (pop animation)
//      + Clear All button on all result modes
// =============================================

const UIManager = (() => {

  // ----- File List -----

  function renderFileList(files, onDelete) {
    const list = document.getElementById('fileList');
    const header = document.getElementById('fileListHeader');
    const count = document.getElementById('fileCount');

    list.innerHTML = '';

    if (files.length === 0) {
      header.style.display = 'none';
      return;
    }

    header.style.display = 'flex';
    count.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} uploaded`;

    files.forEach((file, idx) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <span class="file-icon">📄</span>
        <span class="file-name" title="${file.name}">${file.name}</span>
        <span class="file-size">${formatBytes(file.size)}</span>
        <button class="file-view" title="View PDF" data-idx="${idx}">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
          </svg>
        </button>
        <button class="file-delete" title="Remove file" data-idx="${idx}">✕</button>
      `;
      li.querySelector('.file-view').addEventListener('click', () => {
        if (window.PDFViewer) window.PDFViewer.open(files[idx]);
      });
      li.querySelector('.file-delete').addEventListener('click', () => onDelete(idx));
      list.appendChild(li);
    });
  }

  // ----- Mode Display -----

  function setModeSelected(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mode === mode);
    });

    const labels = {
      multiple: 'Multiple Keywords',
      single: 'Single Keyword',
      extractall: 'Extract All'
    };

    const display = document.getElementById('modeDisplay');
    const badge = document.getElementById('modeBadge');
    if (mode) {
      display.style.display = 'flex';
      badge.textContent = labels[mode] || mode;
    } else {
      display.style.display = 'none';
    }
  }

  function setModeButtonsVisible(show) {
    document.querySelector('.mode-buttons').style.display = show ? 'grid' : 'none';
    document.getElementById('modeDisplay').style.display = show ? 'none' : 'flex';
  }

  // ----- Keyword Section -----

  function setKeywordSectionMode(mode) {
    const hint = document.getElementById('keywordHint');
    const input = document.getElementById('keywordInput');
    const area = document.getElementById('keywordInputArea');

    if (mode === 'extractall') {
      area.style.display = 'none';
      document.getElementById('keywordChips').innerHTML = '';
      hint.textContent = 'No keywords needed — all text will be extracted.';
    } else {
      area.style.display = 'flex';
      if (mode === 'single') {
        input.placeholder = 'Enter a single keyword';
        hint.textContent = 'Only one keyword allowed in Single Keyword mode.';
      } else {
        input.placeholder = 'Type a keyword and press Enter or click Add';
        hint.textContent = 'Add as many keywords as you need.';
      }
    }
  }

  function renderKeywordChips(keywords, onRemove, onEdit, mode) {
    const container = document.getElementById('keywordChips');
    container.innerHTML = '';

    keywords.forEach((kw, idx) => {
      const chip = document.createElement('span');
      chip.className = 'keyword-chip';
      chip.innerHTML = `
        <span class="kw-label" title="Click to edit" style="cursor:pointer;">${escapeHtml(kw)}</span>
        <button title="Remove">✕</button>
      `;

      chip.querySelector('.kw-label').addEventListener('click', () => onEdit(idx));
      chip.querySelector('button').addEventListener('click', () => onRemove(idx));
      container.appendChild(chip);
    });
  }

  // ----- Steps activation -----

  function activateStep(stepId) {
    document.getElementById(stepId).classList.add('active');
    document.getElementById(stepId).classList.remove('disabled-card');
  }

  // ----- Progress -----

  function setProgress(value, label) {
    const wrap = document.getElementById('progressWrap');
    const bar = document.getElementById('progressBar');
    const lbl = document.getElementById('progressLabel');
    wrap.style.display = 'block';
    lbl.style.display = 'block';
    bar.style.width = `${value}%`;
    lbl.textContent = label || 'Processing…';
  }

  function hideProgress() {
    document.getElementById('progressWrap').style.display = 'none';
    document.getElementById('progressLabel').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
  }

  function setRunning(running) {
    const btn = document.getElementById('runBtn');
    const text = document.getElementById('runBtnText');
    const spinner = document.getElementById('runSpinner');
    btn.disabled = running;
    text.style.display = running ? 'none' : 'inline';
    spinner.style.display = running ? 'inline-block' : 'none';
  }

  function setRunEnabled(enabled) {
    document.getElementById('runBtn').disabled = !enabled;
  }

  // =============================================
  // SHARED RESULT HELPERS
  // =============================================

  /**
   * Build a keyword result card with an individual ✕ remove button.
   * Clicking fires a "pop" animation before removing the element.
   */
  function makeResultItem(page, filename, keyword, highlightedHtml) {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">Page ${page}</span>
        <span class="result-filename">${escapeHtml(filename)}</span>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>
      <div class="result-keyword">${escapeHtml(keyword)}</div>
      <div class="result-text">${highlightedHtml}</div>
    `;

    item.querySelector('.result-remove-btn').addEventListener('click', () => {
      popRemove(item);
    });

    return item;
  }

  /**
   * Single-keyword variant of result card.
   * Meta format: Page X  |  📄 filename.pdf  |  👁 view  |  ✕ remove
   */
  function makeSingleResultItem(page, filename, keyword, highlightedHtml, files, renameMap) {
    const item = document.createElement('div');
    item.className = 'result-item';

    // Find the matching File object for the PDF viewer
    const fileObj = files ? [...files].find(f => f.name === filename) : null;

    item.innerHTML = `
      <div class="result-meta result-meta--single">
        <span class="page-badge">Page ${page}</span>
        <span class="result-filename-icon">📄</span>
        <span class="result-filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
        <button class="file-view result-view-btn" title="View PDF">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
          </svg>
        </button>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>
      <div class="result-keyword result-keyword--single">
        <span class="rk-label">${escapeHtml(keyword)}</span>
        <span class="rk-divider">|</span>
        <span class="rk-file-icon">📄</span>
        <span class="rk-oldname">${escapeHtml(filename)}</span>
        <span class="rk-arrow">→</span>
        <span class="rk-file-icon">📄</span>
        <span class="rk-newname">${escapeHtml(renameMap ? (renameMap.get(filename) || filename) : filename)}</span>
      </div>
      <div class="result-text">${highlightedHtml}</div>
    `;

    // Wire up PDF viewer button
    const viewBtn = item.querySelector('.result-view-btn');
    if (fileObj && window.PDFViewer) {
      viewBtn.addEventListener('click', () => window.PDFViewer.open(fileObj));
    } else {
      viewBtn.style.display = 'none';
    }

    item.querySelector('.result-remove-btn').addEventListener('click', () => {
      popRemove(item);
    });

    return item;
  }

  /**
   * Build an extract-all file block with an individual ✕ remove button.
   */
  function makeExtractItem(file, pages) {
    const item = document.createElement('div');
    item.className = 'extract-all-item';

    const pageHtml = pages.map(p =>
      `<div><span style="color:var(--accent);font-weight:600;">Page ${p.page}</span></div>` +
      `<div>${escapeHtml(p.text) || '<em style="color:var(--text-muted);">(no text)</em>'}</div>` +
      `<hr class="extract-page-sep" />`
    ).join('');

    item.innerHTML = `
      <div class="extract-all-header">
        <span>📄 ${escapeHtml(file.name)}</span>
        <span style="color:var(--text-muted);font-weight:400;font-size:0.7rem;">${pages.length} page(s)</span>
        <button class="result-remove-btn result-remove-btn--ea" title="Remove this file">✕</button>
      </div>
      <div class="extract-all-body">${pageHtml}</div>
    `;

    item.querySelector('.result-remove-btn').addEventListener('click', () => {
      popRemove(item);
    });

    return item;
  }

  /**
   * Animate an element out with a pop effect, then remove it.
   * Prevents double-firing with a guard class.
   */
  function popRemove(item) {
    if (item.classList.contains('result-item--popping')) return;
    item.classList.add('result-item--popping');
    item.addEventListener('animationend', () => {
      item.remove();
      syncCount();
    }, { once: true });
  }

  /**
   * Re-count visible result cards and update the badge.
   * Shows an empty state and disables Clear All when nothing remains.
   */
  function syncCount() {
    const list = document.getElementById('resultsList');
    if (!list) return;

    const items = list.querySelectorAll(
      '.result-item:not(.result-item--popping), .extract-all-item:not(.result-item--popping)'
    );
    const n = items.length;

    // Update live badge number
    const numEl = document.querySelector('#resultCountBadge .rcb-num');
    if (numEl) numEl.textContent = n;

    // If empty → show cleared state
    if (n === 0) {
      list.innerHTML = `
        <div class="no-results no-results--cleared">
          <span class="no-results-icon">🧹</span>
          <p>All results cleared.</p>
          <p class="no-results-sub">Run the extraction again to generate new results.</p>
        </div>`;
      const clearBtn = document.getElementById('clearAllResultsBtn');
      if (clearBtn) clearBtn.disabled = true;
    }
  }

  /**
   * Build the "Clear All" button that pops every card with a stagger.
   * @param {HTMLElement} list — the #resultsList element
   */
  function makeClearAllBtn(list) {
    const btn = document.createElement('button');
    btn.className = 'btn-clear-all';
    btn.id = 'clearAllResultsBtn';
    btn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="flex-shrink:0">
        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      Clear All
    `;

    btn.addEventListener('click', () => {
      const cards = list.querySelectorAll('.result-item, .extract-all-item');
      if (!cards.length) return;
      btn.disabled = true;

      // Staggered pop — each card fires 45ms after the previous
      cards.forEach((card, i) => {
        if (card.classList.contains('result-item--popping')) return;
        setTimeout(() => {
          card.classList.add('result-item--popping');
          card.addEventListener('animationend', () => {
            card.remove();
            syncCount();
          }, { once: true });
        }, i * 45);
      });
    });

    return btn;
  }

  /**
   * Live count badge: "12 results" or "3 files"
   */
  function makeCountBadge(count, unit) {
    unit = unit || 'result';
    const el = document.createElement('span');
    el.className = 'result-count-badge';
    el.id = 'resultCountBadge';
    el.innerHTML = `<span class="rcb-num">${count}</span>&nbsp;<span class="rcb-unit">${unit}${count !== 1 ? 's' : ''}</span>`;
    return el;
  }

  // =============================================
  // RESULTS — MULTIPLE KEYWORDS
  // =============================================

  function renderKeywordResults(results, keywords) {
    const container = document.getElementById('resultsContainer');
    const list = document.getElementById('resultsList');
    const actions = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML = '';
    actions.innerHTML = '';

    if (results.length === 0) {
      list.innerHTML = '<div class="no-results">No matches found for the given keyword(s).</div>';
      return;
    }

    // Action row — Download in Excel Format button only
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const excelBtn = document.createElement('button');
    excelBtn.className = 'btn-excel';
    excelBtn.textContent = '⬇ Download in Excel Format';
    excelBtn.addEventListener('click', () => {
      ExcelExporter.exportKeywordResults(results, 'Multiple-Keyword-Results.xlsx');
    });

    actionsRow.appendChild(excelBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    // Count badge
    let total = 0;
    for (const r of results) total += r.contexts.length;
    actions.appendChild(makeCountBadge(total, 'result'));

    function doExport() {
      ExcelExporter.exportKeywordResults(results, 'keyword_results.xlsx');
    }
    excelBtn.addEventListener('click', doExport);
    dlBtn.addEventListener('click', doExport);

    // Result cards
    for (const r of results) {
      for (const ctx of r.contexts) {
        const highlighted = keywords.reduce(
          (text, kw) => KeywordHandler.highlight(text, kw),
          escapeHtml(ctx)
        );
        list.appendChild(makeResultItem(r.page, r.filename, r.keyword, highlighted));
      }
    }
  }

  // =============================================
  // RESULTS — SINGLE KEYWORD
  // =============================================

  function renderSingleKeywordResults(results, keyword, files, renameMap) {
    const container = document.getElementById('resultsContainer');
    const list = document.getElementById('resultsList');
    const actions = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML = '';
    actions.innerHTML = '';

    if (results.length === 0) {
      list.innerHTML = '<div class="no-results">No matches found for the keyword.</div>';
      return;
    }
    
    // Action row — Rename PDF button only
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-rename';
    renameBtn.textContent = '✏ Rename PDF';

    actionsRow.appendChild(renameBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    const renameStatus = document.createElement('div');
    renameStatus.className = 'rename-status';
    actions.appendChild(renameStatus);

    // Count badge
    let total = 0;
    for (const r of results) total += r.contexts.length;
    actions.appendChild(makeCountBadge(total, 'result'));

    renameBtn.addEventListener('click', async () => {
      renameBtn.disabled = true;
      renameStatus.textContent = 'Starting downloads with renamed files…';
      await RenameHandler.downloadRenamed(files, renameMap, (done, total, newName) => {
        renameStatus.textContent = `Renamed & downloaded ${done}/${total}: ${newName}`;
      });
      renameStatus.className = 'rename-status rename-done';
      renameStatus.textContent = `✓ All ${files.length} file(s) renamed and downloaded.`;
    });

    // Rename preview
    if (renameMap.size > 0) {
      const mapDiv = document.createElement('div');
      mapDiv.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin:0.75rem 0 0.25rem;';
      mapDiv.innerHTML = '<strong style="color:var(--accent2);">Rename Preview:</strong><br>' +
        [...renameMap.entries()].map(([o, n]) =>
          `<span style="color:var(--text-dim)">${escapeHtml(o)}</span> → <span style="color:var(--text)">${escapeHtml(n)}</span>`
        ).join('<br>');
      actions.appendChild(mapDiv);
    }
    
    // Result cards
    for (const r of results) {
      for (const ctx of r.contexts) {
        const highlighted = KeywordHandler.highlight(escapeHtml(ctx), keyword);
        list.appendChild(makeSingleResultItem(r.page, r.filename, r.keyword, highlighted, files, renameMap));
      }
    }
  }

  // =============================================
  // RESULTS — EXTRACT ALL
  // =============================================

  function renderExtractAll(pdfData) {
    const container = document.getElementById('resultsContainer');
    const list = document.getElementById('resultsList');
    const actions = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML = '';
    actions.innerHTML = '';

    // Action row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-excel';
    dlBtn.textContent = '⬇ Download Excel';

    actionsRow.appendChild(dlBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    // Count badge (files)
    actions.appendChild(makeCountBadge(pdfData.length, 'file'));

    dlBtn.addEventListener('click', () => {
      ExcelExporter.exportExtractAll(pdfData, 'extract_all.xlsx');
    });

    // File blocks
    for (const { file, pages } of pdfData) {
      list.appendChild(makeExtractItem(file, pages));
    }
  }

  // =============================================
  // HELPERS
  // =============================================

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    renderFileList,
    setModeSelected,
    setModeButtonsVisible,
    setKeywordSectionMode,
    renderKeywordChips,
    activateStep,
    setProgress,
    hideProgress,
    setRunning,
    setRunEnabled,
    renderKeywordResults,
    renderSingleKeywordResults,
    renderExtractAll,
    escapeHtml
  };
})();