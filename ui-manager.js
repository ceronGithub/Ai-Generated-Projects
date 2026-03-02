// =============================================
// ui-manager.js — UI rendering / updates
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
        <button class="file-delete" title="Remove file" data-idx="${idx}">✕</button>
      `;
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

  // ----- Results: Multiple / Single keyword -----

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

    // Action buttons
    const excelBtn = document.createElement('button');
    excelBtn.className = 'btn-excel';
    excelBtn.textContent = '📊 Convert to Excel';
    actions.appendChild(excelBtn);

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-excel';
    dlBtn.style.background = '#145a32';
    dlBtn.textContent = '⬇ Download';
    actions.appendChild(dlBtn);

    let exported = false;
    function doExport() {
      ExcelExporter.exportKeywordResults(results, 'keyword_results.xlsx');
    }
    excelBtn.addEventListener('click', () => { exported = true; doExport(); });
    dlBtn.addEventListener('click', () => doExport());

    // Render result items
    for (const r of results) {
      for (const ctx of r.contexts) {
        const item = document.createElement('div');
        item.className = 'result-item';

        const highlightedCtx = keywords.reduce((text, kw) =>
          KeywordHandler.highlight(text, kw), escapeHtml(ctx));

        item.innerHTML = `
          <div class="result-meta">
            <span class="page-badge">Page ${r.page}</span>
            <span>${escapeHtml(r.filename)}</span>
          </div>
          <div class="result-keyword">${escapeHtml(r.keyword)}</div>
          <div class="result-text">${highlightedCtx}</div>
        `;
        list.appendChild(item);
      }
    }
  }

  // ----- Results: Single keyword with rename -----

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

    // Excel buttons
    const excelBtn = document.createElement('button');
    excelBtn.className = 'btn-excel';
    excelBtn.textContent = '📊 Convert to Excel';
    actions.appendChild(excelBtn);

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-excel';
    dlBtn.style.background = '#145a32';
    dlBtn.textContent = '⬇ Download';
    actions.appendChild(dlBtn);

    // Rename button
    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-rename';
    renameBtn.textContent = '✏ Rename Start';
    actions.appendChild(renameBtn);

    const renameStatus = document.createElement('div');
    renameStatus.className = 'rename-status';
    actions.appendChild(renameStatus);

    function doExport() {
      ExcelExporter.exportKeywordResults(results, 'single_keyword_results.xlsx');
    }
    excelBtn.addEventListener('click', doExport);
    dlBtn.addEventListener('click', doExport);

    renameBtn.addEventListener('click', async () => {
      renameBtn.disabled = true;
      renameStatus.textContent = 'Starting downloads with renamed files…';
      await RenameHandler.downloadRenamed(files, renameMap, (done, total, newName) => {
        renameStatus.textContent = `Renamed & downloaded ${done}/${total}: ${newName}`;
      });
      renameStatus.className = 'rename-status rename-done';
      renameStatus.textContent = `✓ All ${files.length} file(s) renamed and downloaded.`;
    });

    // Show rename map summary
    if (renameMap.size > 0) {
      const mapDiv = document.createElement('div');
      mapDiv.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin:0.75rem 0 0.25rem;';
      mapDiv.innerHTML = '<strong style="color:var(--accent2);">Rename Preview:</strong><br>' +
        [...renameMap.entries()].map(([o, n]) =>
          `<span style="color:var(--text-dim)">${escapeHtml(o)}</span> → <span style="color:var(--text)">${escapeHtml(n)}</span>`
        ).join('<br>');
      actions.appendChild(mapDiv);
    }

    // Render items
    for (const r of results) {
      for (const ctx of r.contexts) {
        const item = document.createElement('div');
        item.className = 'result-item';
        const highlighted = KeywordHandler.highlight(escapeHtml(ctx), keyword);
        item.innerHTML = `
          <div class="result-meta">
            <span class="page-badge">Page ${r.page}</span>
            <span>${escapeHtml(r.filename)}</span>
          </div>
          <div class="result-keyword">${escapeHtml(r.keyword)}</div>
          <div class="result-text">${highlighted}</div>
        `;
        list.appendChild(item);
      }
    }
  }

  // ----- Results: Extract All -----

  function renderExtractAll(pdfData) {
    const container = document.getElementById('resultsContainer');
    const list = document.getElementById('resultsList');
    const actions = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML = '';
    actions.innerHTML = '';

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-excel';
    dlBtn.textContent = '⬇ Download Excel';
    actions.appendChild(dlBtn);

    dlBtn.addEventListener('click', () => {
      ExcelExporter.exportExtractAll(pdfData, 'extract_all.xlsx');
    });

    for (const { file, pages } of pdfData) {
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
        </div>
        <div class="extract-all-body">${pageHtml}</div>
      `;
      list.appendChild(item);
    }
  }

  // ----- Helpers -----

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
