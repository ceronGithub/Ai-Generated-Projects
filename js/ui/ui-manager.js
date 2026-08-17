// =============================================
// ui-manager.js — UI rendering / updates
// NEW: Individual result remove (pop animation)
//      + Clear All button on all result modes
//      + renderTableResults for Table Mode
// =============================================

const UIManager = (() => {

  // ── Module-level file cache ─────────────────────────────────────────────
  let _cachedFiles = [];

  function _findFile(filename, files) {
    const pool = (files && files.length) ? [...files] : _cachedFiles;
    return pool.find(f => f.name === filename) || null;
  }

  // ----- File List -----

  function renderFileList(files, onDelete) {
    const list   = document.getElementById('fileList');
    const header = document.getElementById('fileListHeader');
    const count  = document.getElementById('fileCount');

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

    const itemHeight = 48;
    const maxVisible = 2;
    list.style.maxHeight = files.length > maxVisible ? `${itemHeight * maxVisible}px` : '';
    list.style.overflowY = files.length > maxVisible ? 'auto' : '';
  }

  // ----- Mode Display -----

  function setModeSelected(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mode === mode);
    });

    const labels = {
      multiple:      'Multiple Keywords',
      single:        'Single Keyword',
      extractall:    'Extract All',
      tablemode:     'Table Mode',
      compressmode:  'Compress PDF',
      splitmode:     'Split PDF',
      toexcel:       'PDF to Excel',
      toword:        'PDF to Word',
      toppt:         'PDF to PPT',
      tojpg:         'PDF to JPG',
      enhancemode:   'Enhance PDF',
      lockmode:      'Lock PDF',
      mergemode:     'Merge PDF',
      watermarkmode: 'Watermark PDF',
      wordtopdf:     'Word to PDF',
      exceltopdf:    'Excel to PDF',
      ppttopdf:      'PPT to PDF',
    };

    const display = document.getElementById('modeDisplay');
    const badge   = document.getElementById('modeBadge');
    if (mode) {
      display.style.display = 'flex';
      badge.textContent = labels[mode] || mode;
    } else {
      display.style.display = 'none';
    }
  }

  function setModeButtonsVisible(show) {
    // .mode-buttons is a flex column (stacked categories) in styles.css —
    // forcing 'grid' here was overriding that layout and, on wider
    // screens, also activating a leftover grid-template-columns rule in
    // media.css meant for .mode-category-grid, breaking the mode picker's
    // layout every time the user changed or re-opened mode selection.
    document.querySelector('.mode-buttons').style.display = show ? 'flex' : 'none';
    document.getElementById('modeDisplay').style.display  = show ? 'none' : 'flex';
  }

  // ----- Keyword Section -----

  function setKeywordSectionMode(mode) {
    const hint  = document.getElementById('keywordHint');
    const input = document.getElementById('keywordInput');
    const area  = document.getElementById('keywordInputArea');

    // Always hide split panel unless entering splitmode
    const splitPanel = document.getElementById('splitConfigPanel');

    if (mode === 'extractall') {
      area.style.display = 'none';
      document.getElementById('keywordChips').innerHTML = '';
      hint.textContent = 'No keywords needed — all text will be extracted.';
      if (splitPanel) splitPanel.style.display = 'none';
    } else if (mode === 'tablemode') {
      // Table mode needs no keywords either
      area.style.display = 'none';
      document.getElementById('keywordChips').innerHTML = '';
      hint.textContent = 'No keywords needed — all transaction rows will be extracted and displayed as cards.';
      if (splitPanel) splitPanel.style.display = 'none';
    } else if (mode === 'compressmode') {
      area.style.display = 'none';
      document.getElementById('keywordChips').innerHTML = '';
      hint.textContent = 'No keywords needed — click Run Extraction to compress your PDF files.';
      if (splitPanel) splitPanel.style.display = 'none';
    } else if (mode === 'splitmode') {
      area.style.display = 'none';
      document.getElementById('keywordChips').innerHTML = '';
      hint.textContent = 'Configure your split settings in Step 03.1 below.';
      if (splitPanel) splitPanel.style.display = 'none';
    } else if (['toexcel','toword','toppt','tojpg','enhancemode','lockmode','mergemode',
                'watermarkmode','wordtopdf','exceltopdf','ppttopdf','sortmergemode'].includes(mode)) {
      area.style.display = 'none';
      document.getElementById('keywordChips').innerHTML = '';
      const modeHints = {
        toexcel:       'No keywords needed — PDF text will be extracted to Excel.',
        toword:        'No keywords needed — PDF text will be exported to Word.',
        toppt:         'No keywords needed — each PDF page becomes a slide.',
        tojpg:         'No keywords needed — each PDF page will be rendered as a JPG.',
        enhancemode:   'No keywords needed — your PDF will be re-rendered at higher quality.',
        lockmode:      'No keywords needed — you will set passwords in the results panel.',
        mergemode:     'No keywords needed — set the merge order in Step 03.1 below.',
        watermarkmode: 'No keywords needed — "Liza O. De Vyra" will be stamped on every page.',
        wordtopdf:     'No keywords needed — upload .docx files and run to convert to PDF.',
        exceltopdf:    'No keywords needed — upload .xlsx files and run to convert to PDF.',
        ppttopdf:      'No keywords needed — upload .pptx files and run to convert to PDF.',
        sortmergemode: 'No keywords needed here — sort your PDFs into types in Step 03.2 below.',
      };
      hint.textContent = modeHints[mode] || '';
      if (splitPanel) splitPanel.style.display = 'none';
    } else {
      area.style.display = 'flex';
      if (splitPanel) splitPanel.style.display = 'none';
      if (mode === 'single') {
        input.placeholder = 'Enter a single keyword';
        hint.textContent  = 'Only one keyword allowed in Single Keyword mode.';
      } else {
        input.placeholder = 'Type a keyword and press Enter or click Add';
        hint.textContent  = 'Add as many keywords as you need.';
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

  // ----- Detected labels (Single Keyword mode auto-suggest) -----

  /**
   * renderDetectedLabels
   * Renders the auto-detected label checklist below the keyword
   * textfield. Only one checkbox is ever active at a time (Single
   * Keyword mode only keeps one keyword) — checking a different
   * label automatically unchecks the previous one.
   *
   * @param {string[]} labels     - detected label strings
   * @param {string|null} activeLabel - the label currently in the keyword field, if any
   * @param {(label: string, checked: boolean) => void} onToggle
   */
  function renderDetectedLabels(labels, activeLabel, onToggle) {
    const wrap = document.getElementById('detectedLabelsWrap');
    const list = document.getElementById('detectedLabelsList');
    if (!wrap || !list) return;

    if (!labels || labels.length === 0) {
      wrap.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    wrap.style.display = 'block';
    list.innerHTML = '';
    labels.forEach(label => {
      const isActive = activeLabel === label;
      const chip = document.createElement('label');
      chip.className = 'detected-label-chip' + (isActive ? ' detected-label-chip--active' : '');
      chip.innerHTML = `
        <input type="checkbox" ${isActive ? 'checked' : ''} />
        <span>${escapeHtml(label)}</span>
      `;
      chip.querySelector('input').addEventListener('change', (e) => onToggle(label, e.target.checked));
      list.appendChild(chip);
    });
  }

  function hideDetectedLabels() {
    const wrap = document.getElementById('detectedLabelsWrap');
    const list = document.getElementById('detectedLabelsList');
    if (wrap) wrap.style.display = 'none';
    if (list) list.innerHTML = '';
  }

  // ----- Steps activation -----

  function activateStep(stepId) {
    const el = document.getElementById(stepId);
    el.classList.add('active');
    el.classList.remove('disabled-card');
  }

  function deactivateStep(stepId) {
    const el = document.getElementById(stepId);
    if (!el) return;
    el.classList.remove('active');
    el.classList.add('disabled-card');
  }

  // ----- Progress -----

  function setProgress(value, label) {
    const wrap = document.getElementById('progressWrap');
    const bar  = document.getElementById('progressBar');
    const lbl  = document.getElementById('progressLabel');
    wrap.style.display = 'block';
    lbl.style.display  = 'block';
    bar.style.width    = `${value}%`;
    lbl.textContent    = label || 'Processing…';
  }

  function hideProgress() {
    document.getElementById('progressWrap').style.display  = 'none';
    document.getElementById('progressLabel').style.display = 'none';
    document.getElementById('progressBar').style.width     = '0%';
  }

  function setRunning(running) {
    const btn     = document.getElementById('runBtn');
    const text    = document.getElementById('runBtnText');
    const spinner = document.getElementById('runSpinner');
    btn.disabled          = running;
    text.style.display    = running ? 'none' : 'inline';
    spinner.style.display = running ? 'inline-block' : 'none';
  }

  function setRunEnabled(enabled) {
    document.getElementById('runBtn').disabled = !enabled;
  }

  // =============================================
  // SHARED RESULT HELPERS
  // =============================================

  function makeResultItem(page, filename, keyword, highlightedHtml, files) {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">Page ${page}</span>
        <span class="result-filename">${escapeHtml(filename)}</span>
        <button class="result-view-btn" title="View PDF">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
          </svg><span class="result-view-label">View</span>
        </button>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>
      <div class="result-keyword">${escapeHtml(keyword)}</div>
      <div class="result-text">${highlightedHtml}</div>
    `;
    item.querySelector('.result-view-btn').addEventListener('click', () => {
      const fileObj = _findFile(filename, files);
      if (fileObj && window.PDFViewer) window.PDFViewer.open(fileObj, page);
    });
    item.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(item));
    return item;
  }

  function makePickerResultItem(page, filename, keyword, values, files) {
    const item = document.createElement('div');
    item.className = 'result-item result-item--picker';
    const editedValues = [...values];

    const optionsHtml = values.map((v, i) => `
      <div class="pick-option-wrap" data-idx="${i}">
        <button class="pick-option" data-idx="${i}" title="${escapeHtml(stripSpecialChars(v))}">
          <span class="pick-dot"></span>
          <span class="pick-label">${escapeHtml(stripSpecialChars(v))}</span>
        </button>
        <button class="pick-edit-btn" data-idx="${i}" title="Edit this value">
          <span class="pick-edit-icon">✎</span><span class="pick-edit-label">Edit</span>
        </button>
      </div>
    `).join('');

    item.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">Page ${page}</span>
        <span class="result-filename">${escapeHtml(filename)}</span>
        <button class="result-view-btn" title="View PDF">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
          </svg><span class="result-view-label">View</span>
        </button>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>
      <div class="result-keyword">
        <span>${escapeHtml(keyword)}</span>
        <span class="pick-badge">${values.length} values found — pick one</span>
      </div>
      <div class="pick-options">${optionsHtml}</div>
      <button class="pick-both-btn" title="Keep all ${values.length} values">
        <span class="pick-both-icon">⊞</span> Record Both
      </button>
      <div class="result-text pick-chosen" style="display:none"></div>
    `;

    item.querySelector('.result-view-btn').addEventListener('click', () => {
      const fileObj = _findFile(filename, files);
      if (fileObj && window.PDFViewer) window.PDFViewer.open(fileObj, page);
    });

    function openInlineEditor(wrap) {
      const idx     = +wrap.dataset.idx;
      const pickBtn = wrap.querySelector('.pick-option');
      const editBtn = wrap.querySelector('.pick-edit-btn');
      if (wrap.querySelector('.pick-inline-editor')) return;
      pickBtn.style.display = 'none';
      editBtn.style.display = 'none';
      const editor = document.createElement('div');
      editor.className = 'pick-inline-editor';
      editor.innerHTML = `
        <input class="pick-edit-input" type="text" value="${escapeHtml(editedValues[idx])}" spellcheck="false" />
        <div class="pick-edit-actions">
          <button class="pick-save-btn">✓ Save</button>
          <button class="pick-cancel-btn">✕ Cancel</button>
        </div>
      `;
      wrap.appendChild(editor);
      const input     = editor.querySelector('.pick-edit-input');
      const saveBtn   = editor.querySelector('.pick-save-btn');
      const cancelBtn = editor.querySelector('.pick-cancel-btn');
      requestAnimationFrame(() => { input.focus(); input.select(); });
      function closeEditor(save) {
        if (save) {
          const newVal = input.value.trim();
          if (newVal) {
            editedValues[idx] = newVal;
            pickBtn.querySelector('.pick-label').textContent = newVal;
            pickBtn.title = newVal;
          }
        }
        editor.remove();
        pickBtn.style.display = '';
        editBtn.style.display = '';
      }
      saveBtn.addEventListener('click',   () => closeEditor(true));
      cancelBtn.addEventListener('click', () => closeEditor(false));
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); closeEditor(true);  }
        if (e.key === 'Escape') { e.preventDefault(); closeEditor(false); }
      });
    }

    item.querySelectorAll('.pick-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openInlineEditor(btn.closest('.pick-option-wrap'));
      });
    });

    item.querySelectorAll('.pick-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen    = editedValues[+btn.dataset.idx];
        item.querySelectorAll('.pick-option').forEach(b => b.classList.remove('pick-option--selected'));
        btn.classList.add('pick-option--selected');
        const optionsEl = item.querySelector('.pick-options');
        const bothBtn   = item.querySelector('.pick-both-btn');
        const chosenEl  = item.querySelector('.pick-chosen');
        optionsEl.classList.add('pick-options--collapsing');
        bothBtn.classList.add('pick-options--collapsing');
        setTimeout(() => {
          optionsEl.style.display = 'none';
          bothBtn.style.display   = 'none';
          chosenEl.textContent    = chosen;
          chosenEl.style.display  = '';
          chosenEl.classList.add('pick-chosen--in');
          item.classList.remove('result-item--picker');
          item.querySelector('.pick-badge').textContent = '✓ selected';
        }, 280);
      });
    });

    item.querySelector('.pick-both-btn').addEventListener('click', () => {
      const optionsEl = item.querySelector('.pick-options');
      const bothBtn   = item.querySelector('.pick-both-btn');
      const chosenEl  = item.querySelector('.pick-chosen');
      optionsEl.classList.add('pick-options--collapsing');
      bothBtn.classList.add('pick-options--collapsing');
      setTimeout(() => {
        optionsEl.style.display = 'none';
        bothBtn.style.display   = 'none';
        chosenEl.textContent    = editedValues.join('\n');
        chosenEl.style.display  = '';
        chosenEl.classList.add('pick-chosen--in');
        item.classList.remove('result-item--picker');
        item.querySelector('.pick-badge').textContent = `✓ ${editedValues.length} recorded`;
      }, 280);
    });

    item.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(item));
    return item;
  }

  function makeSingleResultItem(page, filename, keyword, highlightedHtml, files, renameMap) {
    const item    = document.createElement('div');
    item.className = 'result-item';
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
    const viewBtn = item.querySelector('.result-view-btn');
    if (fileObj && window.PDFViewer) {
      viewBtn.addEventListener('click', () => window.PDFViewer.open(fileObj, page));
    } else {
      viewBtn.style.display = 'none';
    }
    item.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(item));
    return item;
  }

  function makeExtractItem(file, pages) {
    const cards = [];
    for (const p of pages) {
      const fields = KeywordHandler.extractFields(p.text);
      if (fields.length === 0) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
          <div class="result-meta">
            <span class="page-badge">Page ${p.page}</span>
            <span class="result-filename">${escapeHtml(file.name)}</span>
            <button class="result-view-btn" title="View PDF">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
              </svg>
            </button>
            <button class="result-remove-btn" title="Remove this result">✕</button>
          </div>
          <div class="result-keyword">Raw Text</div>
          <div class="result-text">${escapeHtml(p.text) || '<em>(no text)</em>'}</div>
        `;
        if (window.PDFViewer) {
          item.querySelector('.result-view-btn').addEventListener('click', () => window.PDFViewer.open(file, p.page));
        }
      }
      for (const { label, value } of fields) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
          <div class="result-meta">
            <span class="page-badge">Page ${p.page}</span>
            <span class="result-filename">${escapeHtml(file.name)}</span>
            <button class="result-view-btn" title="View PDF">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
              </svg>
            </button>
            <button class="result-remove-btn" title="Remove this result">✕</button>
          </div>
          <div class="result-keyword">${escapeHtml(stripSpecialChars(label))}</div>
          <div class="result-text">${escapeHtml(stripSpecialChars(value))}</div>
        `;
        if (window.PDFViewer) {
          item.querySelector('.result-view-btn').addEventListener('click', () => window.PDFViewer.open(file, p.page));
        }
        item.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(item));
        cards.push(item);
      }
    }
    return cards;
  }

  function popRemove(item) {
    if (item.classList.contains('result-item--popping')) return;
    item.classList.add('result-item--popping');
    item.addEventListener('animationend', () => {
      item.remove();
      syncCount();
    }, { once: true });
  }

  function syncCount() {
    const list = document.getElementById('resultsList');
    if (!list) return;
    const items = list.querySelectorAll(
      '.result-item:not(.result-item--popping), .extract-all-item:not(.result-item--popping), .tm-card:not(.result-item--popping)'
    );
    const n = items.length;
    const numEl = document.querySelector('#resultCountBadge .rcb-num');
    if (numEl) numEl.textContent = n;
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

  function makeClearAllBtn(list) {
    const btn = document.createElement('button');
    btn.className = 'btn-clear-all';
    btn.id        = 'clearAllResultsBtn';
    btn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="flex-shrink:0">
        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      Clear All
    `;
    btn.addEventListener('click', () => {
      const cards = list.querySelectorAll('.result-item, .extract-all-item, .tm-card');
      if (!cards.length) return;
      btn.disabled = true;
      cards.forEach((card, i) => {
        if (card.classList.contains('result-item--popping')) return;
        setTimeout(() => {
          card.classList.add('result-item--popping');
          card.addEventListener('animationend', () => { card.remove(); syncCount(); }, { once: true });
        }, i * 45);
      });
    });
    return btn;
  }

  function makeCountBadge(count, unit) {
    unit      = unit || 'result';
    const el  = document.createElement('span');
    el.className = 'result-count-badge';
    el.id        = 'resultCountBadge';
    el.innerHTML = `<span class="rcb-num">${count}</span>&nbsp;<span class="rcb-unit">${unit}${count !== 1 ? 's' : ''}</span>`;
    return el;
  }

  function capResultsHeight(list) {
    const cards = list.querySelectorAll('.result-item, .extract-all-item, .tm-card');
    if (cards.length <= 3) {
      list.style.maxHeight = '';
      list.style.overflowY = '';
    } else {
      list.style.maxHeight = '600px';
      list.style.overflowY = 'auto';
    }
  }

  // =============================================
  // RESULTS — MULTIPLE KEYWORDS
  // =============================================

  function renderKeywordResults(results, keywords, files) {
    if (files && files.length) _cachedFiles = [...files];
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (results.length === 0) {
      list.innerHTML = '<div class="no-results">No matches found for the given keyword(s).</div>';
      return;
    }

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const excelBtn = document.createElement('button');
    excelBtn.className = 'btn-excel';
    excelBtn.textContent = '⬇ Download in Excel Format';
    excelBtn.addEventListener('click', () => {
      showExcelLayoutPicker(layout => {
        ExcelExporter.exportKeywordResults(results, 'Multiple-Keyword-Results.xlsx', layout);
      });
    });

    actionsRow.appendChild(excelBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    let total = 0;
    for (const r of results) total += r.contexts.length;
    actions.appendChild(makeCountBadge(total, 'result'));

    const grouped = new Map();
    for (const r of results) {
      const key = `${r.keyword}|||${r.filename}|||${r.page}`;
      if (!grouped.has(key)) {
        grouped.set(key, { page: r.page, filename: r.filename, keyword: r.keyword, values: [] });
      }
      for (const ctx of r.contexts) grouped.get(key).values.push(ctx);
    }

    for (const { page, filename, keyword, values } of grouped.values()) {
      if (values.length > 1) {
        const cleanedValues = values.map(stripSpecialChars);
        list.appendChild(makePickerResultItem(page, filename, keyword, cleanedValues, files));
      } else {
        const highlighted = keywords.reduce(
          (text, kw) => KeywordHandler.highlight(text, kw),
          escapeHtml(stripSpecialChars(values[0]))
        );
        list.appendChild(makeResultItem(page, filename, keyword, highlighted, files));
      }
    }
    capResultsHeight(list);
  }

  // =============================================
  // RESULTS — SINGLE KEYWORD
  // =============================================

  function renderSingleKeywordResults(results, keyword, files, renameMap) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (results.length === 0) {
      list.innerHTML = '<div class="no-results">No matches found for the keyword.</div>';
      return;
    }

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const renameBtn = document.createElement('button');
    renameBtn.className   = 'btn-rename';
    renameBtn.textContent = '✏ Rename PDF';

    actionsRow.appendChild(renameBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    const renameStatus = document.createElement('div');
    renameStatus.className = 'rename-status';
    actions.appendChild(renameStatus);

    let total = 0;
    for (const r of results) total += r.contexts.length;
    actions.appendChild(makeCountBadge(total, 'result'));

    renameBtn.addEventListener('click', async () => {
      renameBtn.disabled = true;
      renameStatus.textContent = `📦 Preparing ZIP — ${files.length} file(s) to rename…`;
      await RenameHandler.downloadRenamed(files, renameMap, (done, total, newName, remaining, timeStr) => {
        if (remaining === 0 && newName.startsWith('📦')) {
          renameStatus.textContent = `${newName} ${timeStr}`;
        } else {
          const remainingMsg = remaining > 0
            ? ` — ${remaining} file${remaining !== 1 ? 's' : ''} left${timeStr ? `, ${timeStr}` : ''}`
            : '';
          renameStatus.textContent = `📄 ${done}/${total}: ${newName}${remainingMsg}`;
        }
      });
      renameStatus.className   = 'rename-status rename-done';
      renameStatus.textContent = `✓ ZIP downloaded — ${files.length} file(s) renamed, sorted A→Z inside "PDF-Extractor-Rename-PDF-Result".`;
    });

    for (const r of results) {
      for (const ctx of r.contexts) {
        const highlighted = KeywordHandler.highlight(escapeHtml(stripSpecialChars(ctx)), keyword);
        list.appendChild(makeSingleResultItem(r.page, r.filename, r.keyword, highlighted, files, renameMap));
      }
    }
    capResultsHeight(list);
  }

  // =============================================
  // RESULTS — EXTRACT ALL
  // =============================================

  function renderExtractAll(pdfData) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const dlBtn = document.createElement('button');
    dlBtn.className   = 'btn-excel';
    dlBtn.textContent = '⬇ Download Excel';
    actionsRow.appendChild(dlBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    const totalPages = pdfData.reduce((sum, { pages }) => sum + pages.length, 0);
    actions.appendChild(makeCountBadge(totalPages, 'page'));

    dlBtn.addEventListener('click', () => {
      // Use smart ExtractAll exporter when available, else legacy
      if (window.ExtractAll && pdfData[0]?.docType) {
        ExtractAll.exportExcel(pdfData);
      } else {
        ExcelExporter.exportExtractAll(pdfData, 'extract_all.xlsx');
      }
    });

    // Use smart renderer when pdfData has been enriched by ExtractAll.process
    if (window.ExtractAll && pdfData[0]?.docType) {
      ExtractAll.render(pdfData, list);
    } else {
      // Legacy fallback: per-page field extraction via KeywordHandler
      let totalFields = 0;
      for (const { file, pages } of pdfData) {
        const cards = makeExtractItem(file, pages);
        cards.forEach(card => list.appendChild(card));
        totalFields += cards.length;
      }
      actions.appendChild(makeCountBadge(totalFields, 'field'));
    }
    capResultsHeight(list);
  }

  // =============================================
  // RESULTS — TABLE MODE
  // =============================================

  /**
   * Render TableParser rows as individual transaction cards.
   * Each card = one merged Ref No. transaction (one or more legs combined).
   *
   * Card layout:
   *   ┌──────────────────────────────────────────────────────┐
   *   │  Page X  ·  filename.pdf              [👁 View] [✕] │
   *   │  🏷 Tag: 5005484011  🚘 Plate: WOR777               │
   *   │  📋 Ref No. 2531638662   02/01/2026  16:41:37        │
   *   ├──────────────────────────────────────────────────────┤
   *   │  Zone    NAIAX                                       │
   *   │  E-SI    NAIAX000160425643                           │
   *   │  Entry   NAIAX TRAMO SBE                             │
   *   │  Exit    TERMINAL 2                                  │
   *   │  Toll Fee                              ₱ 45.00       │
   *   └──────────────────────────────────────────────────────┘
   *
   * @param {Array<TransactionRow>} rows  - from TableParser.parse()
   * @param {File[]} files
   */
  function renderTableResults(rows, files) {
    if (files && files.length) _cachedFiles = [...files];

    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (!rows.length) {
      list.innerHTML = `
        <div class="no-results">
          No transaction rows found.<br>
          <span style="opacity:.6;font-size:.85em;">Make sure the PDF is an SMC Skyway Transaction History Report.</span>
        </div>`;
      return;
    }

    // ── Summary stats ───────────────────────────────────────────────────────
    const totalFee    = rows.reduce((s, r) => s + (r.tollFee || 0), 0);
    const uniqueTags  = new Set(rows.map(r => r.tagNumber)).size;
    const uniqueRefs  = new Set(rows.map(r => r.refNo).filter(Boolean)).size;

    // ── Actions row: Download Excel + Clear All + count badge ───────────────
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const excelBtn = document.createElement('button');
    excelBtn.className   = 'btn-excel';
    excelBtn.textContent = '⬇ Download to Excel';
    excelBtn.addEventListener('click', () => {
      const safeName = (files[0]?.name || 'transactions').replace(/\.pdf$/i, '');
      showTableExcelLayoutPicker(layout => {
        ExcelExporter.exportTableRows(rows, `${safeName}_transactions.xlsx`, layout);
      });
    });

    actionsRow.appendChild(excelBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);
    actions.appendChild(makeCountBadge(rows.length, 'transaction'));

    // ── Summary card ────────────────────────────────────────────────────────
    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card';
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat">
          <span class="tm-stat-val">${rows.length.toLocaleString()}</span>
          <span class="tm-stat-lbl">Transactions</span>
        </div>
        <div class="tm-stat">
          <span class="tm-stat-val">${uniqueTags}</span>
          <span class="tm-stat-lbl">Unique Tags</span>
        </div>
        <div class="tm-stat">
          <span class="tm-stat-val">${uniqueRefs.toLocaleString()}</span>
          <span class="tm-stat-lbl">Ref Nos.</span>
        </div>
        <div class="tm-stat tm-stat--fee">
          <span class="tm-stat-val">₱${totalFee.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          <span class="tm-stat-lbl">Total Toll Fees</span>
        </div>
        <div class="tm-stat">
          <span class="tm-stat-val">${files.length}</span>
          <span class="tm-stat-lbl">File${files.length !== 1 ? 's' : ''} Processed</span>
        </div>
      </div>
    `;
    list.appendChild(summaryCard);

    // ── One card per transaction row ────────────────────────────────────────
    for (const row of rows) {
      const card = makeTransactionCard(row, files);
      list.appendChild(card);
    }

    capResultsHeight(list);
  }

  /**
   * Build one transaction card for a merged TransactionRow.
   */
  function makeTransactionCard(row, files) {
    const card = document.createElement('div');
    card.className = 'result-item tm-card';

    const fmtFee = (n) =>
      `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Multi-leg values use " | " separator — render as separate badges if multiple
    const renderMulti = (str, cls) => {
      if (!str) return '<span class="tm-empty">—</span>';
      const parts = str.split(' | ');
      if (parts.length === 1) return `<span class="${cls}">${escapeHtml(str)}</span>`;
      return parts.map(p => `<span class="${cls} tm-badge-multi">${escapeHtml(p.trim())}</span>`).join('');
    };

    const refLabel = escapeHtml(row.refType || 'Ref No.');

    card.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">Page ${row.page}</span>
        <span class="result-filename" title="${escapeHtml(row.filename)}">${escapeHtml(row.filename)}</span>
        <button class="result-view-btn" title="View PDF">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
          </svg>
          <span class="result-view-label">View</span>
        </button>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>

      <div class="tm-header-row">
        <span class="tm-tag-chip">🏷 ${escapeHtml(row.tagNumber)}</span>
        <span class="tm-plate-chip">🚘 ${escapeHtml(row.plateNumber)}</span>
        <span class="tm-ref-chip">${refLabel} · ${escapeHtml(row.refNo)}</span>
        <span class="tm-datetime">${escapeHtml(row.date)}&nbsp;&nbsp;${escapeHtml(row.time)}</span>
      </div>

      <div class="tm-fields">
        <div class="tm-field">
          <span class="tm-field-lbl">Zone</span>
          <span class="tm-field-val">${renderMulti(row.zones, 'tm-zone-badge')}</span>
        </div>
        <div class="tm-field">
          <span class="tm-field-lbl">E-SI No.</span>
          <span class="tm-field-val tm-esi">${renderMulti(row.esiNos, 'tm-esi-val')}</span>
        </div>
        <div class="tm-field">
          <span class="tm-field-lbl">Entry</span>
          <span class="tm-field-val">${renderMulti(row.entries, 'tm-loc-val')}</span>
        </div>
        <div class="tm-field">
          <span class="tm-field-lbl">Exit</span>
          <span class="tm-field-val">${renderMulti(row.exits, 'tm-loc-val')}</span>
        </div>
        <div class="tm-field tm-field--fee">
          <span class="tm-field-lbl">Toll Fee</span>
          <span class="tm-fee-val">${fmtFee(row.tollFee)}</span>
        </div>
      </div>
    `;

    // Wire up View button
    card.querySelector('.result-view-btn').addEventListener('click', () => {
      const fileObj = _findFile(row.filename, files);
      if (fileObj && window.PDFViewer) window.PDFViewer.open(fileObj, row.page);
    });

    // Wire up Remove button
    card.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(card));

    return card;
  }

  // =============================================
  // TABLE MODE EXCEL LAYOUT PICKER MODAL
  // =============================================
  //
  // Table-Mode-specific layout options:
  //   A) Rows    — one row per transaction, all fields as columns
  //   B) Columns — sorted by Tag Number (grouped vehicle view)

  function showTableExcelLayoutPicker(onChoose) {
    const overlay = document.createElement('div');
    overlay.className = 'elp-overlay';

    overlay.innerHTML = `
      <div class="elp-backdrop"></div>
      <div class="elp-panel" role="dialog" aria-modal="true" aria-label="Choose Excel layout">
        <div class="elp-header">
          <span class="elp-title">⬇ Excel Layout</span>
          <button class="elp-close" title="Cancel">✕</button>
        </div>
        <p class="elp-subtitle">How should the transaction data be arranged in the spreadsheet?</p>

        <div class="elp-options">

          <!-- Layout A: Rows -->
          <button class="elp-option" data-layout="rows">
            <div class="elp-option-label">
              <span class="elp-option-icon">☰</span>
              <span class="elp-option-name">Rows</span>
              <span class="elp-option-badge">default</span>
            </div>
            <p class="elp-option-desc">One row per transaction — best for reviewing individual trips.</p>
            <div class="elp-preview elp-preview--rows">
              <div class="elp-th-row">
                <span>Filename</span><span>Tag No.</span><span>Ref No.</span><span>Toll Fee</span>
              </div>
              <div class="elp-td-row"><span>report.pdf</span><span>5005484011</span><span>2531638662</span><span>45.00</span></div>
              <div class="elp-td-row"><span>report.pdf</span><span>5005484011</span><span>2531638701</span><span>80.00</span></div>
              <div class="elp-td-row"><span>report.pdf</span><span>5005484099</span><span>2531638750</span><span>35.00</span></div>
            </div>
          </button>

          <!-- Layout B: Columns (sorted by Tag) -->
          <button class="elp-option" data-layout="columns">
            <div class="elp-option-label">
              <span class="elp-option-icon">⊞</span>
              <span class="elp-option-name">Columns</span>
            </div>
            <p class="elp-option-desc">Sorted by Tag Number — best for comparing trips per vehicle.</p>
            <div class="elp-preview elp-preview--cols">
              <div class="elp-th-row">
                <span>Tag No.</span><span>Plate</span><span>Entry</span><span>Exit</span>
              </div>
              <div class="elp-td-row"><span>5005484011</span><span>WOR777</span><span>NAIAX…</span><span>TERMINAL 2</span></div>
              <div class="elp-td-row"><span>5005484011</span><span>WOR777</span><span>SKYWAY…</span><span>ALABANG</span></div>
              <div class="elp-td-row elp-td-row--faded"><span>5005484099</span><span>ABC123</span><span>NAIAX…</span><span>COASTAL</span></div>
            </div>
          </button>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('elp-open'));

    function closeModal() {
      overlay.classList.add('elp-closing');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      setTimeout(() => overlay.remove(), 400);
    }

    overlay.querySelectorAll('.elp-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.elp-option').forEach(b => b.classList.remove('elp-option--selected'));
        btn.classList.add('elp-option--selected');
        closeModal();
        onChoose(btn.dataset.layout);
      });
    });

    overlay.querySelector('.elp-close').addEventListener('click', closeModal);
    overlay.querySelector('.elp-backdrop').addEventListener('click', closeModal);
  }

  // =============================================
  // EXCEL LAYOUT PICKER MODAL
  // =============================================

  function showExcelLayoutPicker(onChoose) {
    const overlay = document.createElement('div');
    overlay.className = 'elp-overlay';
    overlay.innerHTML = `
      <div class="elp-backdrop"></div>
      <div class="elp-panel" role="dialog" aria-modal="true" aria-label="Choose Excel layout">
        <div class="elp-header">
          <span class="elp-title">⬇ Excel Layout</span>
          <button class="elp-close" title="Cancel">✕</button>
        </div>
        <p class="elp-subtitle">How should the data be arranged in the spreadsheet?</p>
        <div class="elp-options">
          <button class="elp-option" data-layout="rows">
            <div class="elp-option-label">
              <span class="elp-option-icon">☰</span>
              <span class="elp-option-name">Rows</span>
              <span class="elp-option-badge">default</span>
            </div>
            <p class="elp-option-desc">One row per result — best for reviewing individual hits.</p>
            <div class="elp-preview elp-preview--rows">
              <div class="elp-th-row">
                <span>Page</span><span>Filename</span><span>Keyword</span><span>Captured Text</span>
              </div>
              <div class="elp-td-row"><span>Page 1</span><span>file.pdf</span><span>TIN :</span><span>006-887-378-00000</span></div>
              <div class="elp-td-row"><span>Page 1</span><span>file.pdf</span><span>TIN :</span><span>006-977-514-000</span></div>
              <div class="elp-td-row"><span>Page 1</span><span>file.pdf</span><span>Date :</span><span>01/07/2026</span></div>
            </div>
          </button>
          <button class="elp-option" data-layout="columns">
            <div class="elp-option-label">
              <span class="elp-option-icon">⊞</span>
              <span class="elp-option-name">Columns</span>
            </div>
            <p class="elp-option-desc">One column per keyword — best for comparing fields across many PDFs.</p>
            <div class="elp-preview elp-preview--cols">
              <div class="elp-th-row">
                <span>Filename</span><span>Page</span><span>TIN :</span><span>Date :</span>
              </div>
              <div class="elp-td-row"><span>file.pdf</span><span>Page 1</span><span>006-887…</span><span></span></div>
              <div class="elp-td-row"><span>file.pdf</span><span>Page 1</span><span>006-977…</span><span></span></div>
              <div class="elp-td-row elp-td-row--faded"><span>file.pdf</span><span>Page 1</span><span></span><span>01/07/2026</span></div>
            </div>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('elp-open'));

    function closeModal() {
      overlay.classList.add('elp-closing');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      setTimeout(() => overlay.remove(), 400);
    }

    overlay.querySelectorAll('.elp-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.elp-option').forEach(b => b.classList.remove('elp-option--selected'));
        btn.classList.add('elp-option--selected');
        closeModal();
        onChoose(btn.dataset.layout);
      });
    });

    overlay.querySelector('.elp-close').addEventListener('click', closeModal);
    overlay.querySelector('.elp-backdrop').addEventListener('click', closeModal);
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

  // ─── SPECIAL CHARACTER STRIPPER ──────────────────────────────────────────
  // Removes label-syntax characters that bleed into extracted values before
  // they are displayed in result cards or written to Excel.
  //
  // Strips from LEADING edge:  : ; # - – — | / \ * • · (spaces)
  // Strips from TRAILING edge: same + ,
  //
  // Safe for internal chars — only edge characters are removed:
  //   '006-977-514-000'          → unchanged  (hyphens are mid-value)
  //   '$1,500.00'                → unchanged  ($ not in list; comma is internal)
  //   'MAMPLASAN NORTH ENTRY/EXIT' → unchanged (slash is mid-value)
  //   '#: INV-2026-042'          → 'INV-2026-042'
  //   ': some value'             → 'some value'
  //   'some value :'             → 'some value'
  //   'CORPORATION,'             → 'CORPORATION'

  function stripSpecialChars(str) {
    if (!str) return str;
    let s = String(str);
    s = s.replace(/^[\s:;#\-–—|\/\\*•·]+/, '');   // strip leading
    s = s.replace(/[\s:;#\-–—|\/\\*•·,]+$/, '');   // strip trailing
    return s.trim();
  }

  // =============================================
  // COMPRESS RESULTS RENDERER
  // =============================================

  /**
   * renderCompressResults(results)
   *
   * results = Array<{
   *   file, filename, originalSize, compressedSize,
   *   blob, saved, savedPct, error?
   * }>
   */
  function renderCompressResults(results) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (!results || !results.length) {
      list.innerHTML = `<div class="no-results">No files were compressed.</div>`;
      return;
    }

    // ── Summary stats ─────────────────────────────────────────────────────
    const totalOrig  = results.reduce((s, r) => s + r.originalSize,   0);
    const totalComp  = results.reduce((s, r) => s + r.compressedSize, 0);
    const totalSaved = Math.max(0, totalOrig - totalComp);
    const totalPct   = totalOrig > 0 ? Math.round((totalSaved / totalOrig) * 100) : 0;

    // ── Actions row ───────────────────────────────────────────────────────
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    // "Download All" button — zips all blobs via JSZip
    const dlAllBtn = document.createElement('button');
    dlAllBtn.className   = 'btn-excel cm-dl-all-btn';
    dlAllBtn.textContent = '⬇ Download All';
    dlAllBtn.addEventListener('click', () => _downloadAllCompressed(results));
    actionsRow.appendChild(dlAllBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);
    actions.appendChild(makeCountBadge(results.length, 'file'));

    // ── Summary card ──────────────────────────────────────────────────────
    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card cm-summary-card';
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat">
          <span class="tm-stat-val">${results.length}</span>
          <span class="tm-stat-lbl">File${results.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="tm-stat">
          <span class="tm-stat-val">${_fmtBytes(totalOrig)}</span>
          <span class="tm-stat-lbl">Original Size</span>
        </div>
        <div class="tm-stat">
          <span class="tm-stat-val">${_fmtBytes(totalComp)}</span>
          <span class="tm-stat-lbl">Compressed Size</span>
        </div>
        <div class="tm-stat tm-stat--fee">
          <span class="tm-stat-val">${_fmtBytes(totalSaved)}</span>
          <span class="tm-stat-lbl">Saved (${totalPct}%)</span>
        </div>
      </div>
    `;
    list.appendChild(summaryCard);

    // ── One card per file ─────────────────────────────────────────────────
    for (const result of results) {
      list.appendChild(_makeCompressCard(result));
    }

    capResultsHeight(list);
  }

  function _fmtBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function _makeCompressCard(result) {
    const card = document.createElement('div');
    card.className = 'result-item cm-card';

    const hasError  = !!result.error;
    const pctBadge  = hasError
      ? `<span class="cm-badge cm-badge--error">Error</span>`
      : result.savedPct >= 5
        ? `<span class="cm-badge cm-badge--good">−${result.savedPct}%</span>`
        : `<span class="cm-badge cm-badge--neutral">~${result.savedPct}%</span>`;

    card.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">PDF</span>
        <span class="result-filename" title="${escapeHtml(result.file.name)}">${escapeHtml(result.file.name)}</span>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>
      <div class="cm-body">
        <div class="cm-sizes">
          <span class="cm-size-orig">${_fmtBytes(result.originalSize)}</span>
          <span class="cm-arrow">→</span>
          <span class="cm-size-new ${hasError ? '' : 'cm-size-new--reduced'}">${_fmtBytes(result.compressedSize)}</span>
          ${pctBadge}
        </div>
        ${hasError
          ? `<div class="cm-error">⚠ ${escapeHtml(result.error)}</div>`
          : `<div class="cm-filename-out">Output: <span>${escapeHtml(result.filename)}</span></div>`
        }
      </div>
      ${!hasError ? `<button class="cm-dl-btn btn btn-accent">⬇ Download</button>` : ''}
    `;

    if (!hasError) {
      card.querySelector('.cm-dl-btn').addEventListener('click', () => {
        _downloadBlob(result.blob, result.filename);
      });
    }

    card.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(card));
    return card;
  }

  function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function _downloadAllCompressed(results) {
    const valid = results.filter(r => r.blob && !r.error);
    if (!valid.length) return;

    if (valid.length === 1) {
      _downloadBlob(valid[0].blob, valid[0].filename);
      return;
    }

    // Use JSZip if available; otherwise download one-by-one
    if (window.JSZip) {
      const zip = new JSZip();
      for (const r of valid) {
        const buf = await r.blob.arrayBuffer();
        zip.file(r.filename, buf);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
      _downloadBlob(zipBlob, 'compressed_pdfs.zip');
    } else {
      // Fallback: trigger each download with a small delay
      for (let i = 0; i < valid.length; i++) {
        setTimeout(() => _downloadBlob(valid[i].blob, valid[i].filename), i * 300);
      }
    }
  }

  // =============================================
  // SPLIT RESULTS RENDERER
  // =============================================

  function renderSplitResults(results, sourceFile) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');

    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (!results || !results.length) {
      list.innerHTML = `<div class="no-results">No split parts were generated.</div>`;
      return;
    }

    const totalPages = results.reduce((s, r) => s + r.pageCount, 0);

    // ── Actions row ───────────────────────────────────────────────────────
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';

    const dlAllBtn = document.createElement('button');
    dlAllBtn.className   = 'btn-excel cm-dl-all-btn sp-dl-all-btn';
    dlAllBtn.textContent = '⬇ Download All';
    dlAllBtn.addEventListener('click', () => _downloadAllSplit(results));
    actionsRow.appendChild(dlAllBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);
    actions.appendChild(makeCountBadge(results.length, 'part'));

    // ── Summary card ──────────────────────────────────────────────────────
    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card sp-summary-card';
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat">
          <span class="tm-stat-val">${escapeHtml(sourceFile ? sourceFile.name : '—')}</span>
          <span class="tm-stat-lbl">Source File</span>
        </div>
        <div class="tm-stat">
          <span class="tm-stat-val">${totalPages}</span>
          <span class="tm-stat-lbl">Total Pages</span>
        </div>
        <div class="tm-stat tm-stat--fee">
          <span class="tm-stat-val">${results.length}</span>
          <span class="tm-stat-lbl">Output Files</span>
        </div>
      </div>
    `;
    list.appendChild(summaryCard);

    // ── One card per split part ───────────────────────────────────────────
    for (let i = 0; i < results.length; i++) {
      list.appendChild(_makeSplitCard(results[i], i + 1, results.length));
    }

    capResultsHeight(list);
  }

  function _makeSplitCard(result, partNum, totalParts) {
    const card = document.createElement('div');
    card.className = 'result-item sp-card';

    const pageLabel = result.pageNums.length === 1
      ? `Page ${result.pageNums[0]}`
      : `Pages ${result.pageNums[0]}–${result.pageNums[result.pageNums.length - 1]}`;

    card.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">Part ${partNum}/${totalParts}</span>
        <span class="result-filename" title="${escapeHtml(result.filename)}">${escapeHtml(result.filename)}</span>
        <button class="result-view-btn sp-view-btn" title="Preview this PDF">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
          </svg>
          <span class="result-view-label">View</span>
        </button>
        <button class="result-remove-btn" title="Remove this result">✕</button>
      </div>
      <div class="sp-body">
        <div class="sp-info-row">
          <span class="sp-pages-badge">✦ ${pageLabel}</span>
          <span class="sp-page-count">${result.pageCount} page${result.pageCount !== 1 ? 's' : ''}</span>
          <span class="sp-size">${_fmtBytes(result.blob ? result.blob.size : 0)}</span>
        </div>
      </div>
      <button class="cm-dl-btn btn btn-accent sp-dl-btn">⬇ Download</button>
    `;

    // ── View button: convert blob → File, open in PDFViewer ──────────────
    card.querySelector('.sp-view-btn').addEventListener('click', () => {
      if (!result.blob) return;
      if (window.PDFViewer) {
        // Wrap the Blob as a File so PDFViewer.open() can call .arrayBuffer()
        const viewFile = new File([result.blob], result.filename, { type: 'application/pdf' });
        PDFViewer.open(viewFile, 1);
      }
    });

    card.querySelector('.sp-dl-btn').addEventListener('click', () => {
      _downloadBlob(result.blob, result.filename);
    });
    card.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(card));
    return card;
  }

  async function _downloadAllSplit(results) {
    const valid = results.filter(r => r.blob);
    if (!valid.length) return;
    if (valid.length === 1) { _downloadBlob(valid[0].blob, valid[0].filename); return; }
    if (window.JSZip) {
      const zip = new JSZip();
      for (const r of valid) {
        const buf = await r.blob.arrayBuffer();
        zip.file(r.filename, buf);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
      _downloadBlob(zipBlob, 'split_pdfs.zip');
    } else {
      for (let i = 0; i < valid.length; i++) {
        setTimeout(() => _downloadBlob(valid[i].blob, valid[i].filename), i * 350);
      }
    }
  }

  // =============================================
  // CONVERSION RESULTS (Excel / Word / PPT / JPG)
  // =============================================

  const CONV_CONFIG = {
    toexcel:       { icon: '📊', label: 'Excel',       color: '#22a06b',  rgb: '34,160,107',   ext: '.xlsx' },
    toword:        { icon: '📝', label: 'Word',        color: '#2B6CB0',  rgb: '43,108,176',   ext: '.docx' },
    toppt:         { icon: '📽️', label: 'PowerPoint', color: '#c8a96e',  rgb: '200,169,110',  ext: '.pptx' },
    tojpg:         { icon: '🖼️', label: 'JPG',        color: '#8b7ab8',  rgb: '139,122,184',  ext: '.jpg'  },
    watermarkmode: { icon: '💧', label: 'Watermark',  color: '#c8a96e',  rgb: '200,169,110',  ext: '.pdf'  },
    wordtopdf:     { icon: '📄', label: 'PDF',        color: '#c0392b',  rgb: '192,57,43',    ext: '.pdf'  },
    exceltopdf:    { icon: '📄', label: 'PDF',        color: '#22a06b',  rgb: '34,160,107',   ext: '.pdf'  },
    ppttopdf:      { icon: '📄', label: 'PDF',        color: '#c8a96e',  rgb: '200,169,110',  ext: '.pdf'  },
  };

  function renderConversionResults(results, mode) {
    const cfg       = CONV_CONFIG[mode] || CONV_CONFIG.toexcel;
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');
    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (!results || !results.length) {
      list.innerHTML = `<div class="no-results">No files converted.</div>`;
      return;
    }

    // Actions row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';
    const dlAllBtn = document.createElement('button');
    dlAllBtn.className   = `btn-excel conv-dl-all`;
    dlAllBtn.style.cssText = `background:linear-gradient(135deg,rgba(${cfg.rgb},0.85),rgba(${cfg.rgb},0.55));color:#000;font-weight:700;`;
    dlAllBtn.textContent = `⬇ Download All`;
    dlAllBtn.addEventListener('click', () => _downloadAllConv(results));
    actionsRow.appendChild(dlAllBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);
    actions.appendChild(makeCountBadge(results.length, 'file'));

    // Summary card
    const ok  = results.filter(r => !r.error).length;
    const err = results.length - ok;
    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card conv-summary-card';
    summaryCard.style.cssText = `border-color:rgba(${cfg.rgb},0.2)!important;background:linear-gradient(135deg,rgba(${cfg.rgb},0.04) 0%,rgba(8,15,35,0.85) 60%)!important;`;
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat"><span class="tm-stat-val">${cfg.icon}</span><span class="tm-stat-lbl">${cfg.label}</span></div>
        <div class="tm-stat"><span class="tm-stat-val">${results.length}</span><span class="tm-stat-lbl">Files</span></div>
        <div class="tm-stat tm-stat--fee"><span class="tm-stat-val" style="color:${cfg.color}">${ok}</span><span class="tm-stat-lbl">Converted</span></div>
        ${err ? `<div class="tm-stat"><span class="tm-stat-val" style="color:var(--danger)">${err}</span><span class="tm-stat-lbl">Errors</span></div>` : ''}
      </div>`;
    list.appendChild(summaryCard);

    for (const result of results) {
      list.appendChild(_makeConvCard(result, cfg));
    }
    capResultsHeight(list);
  }

  function _makeConvCard(result, cfg) {
    const card = document.createElement('div');
    card.className = 'result-item conv-card';
    const hasError = !!result.error;

    card.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">${cfg.ext.toUpperCase().replace('.','')}</span>
        <span class="result-filename" title="${escapeHtml(result.file.name)}">${escapeHtml(result.file.name)}</span>
        <button class="result-remove-btn" title="Remove">✕</button>
      </div>
      <div class="conv-body">
        <div class="conv-info-row">
          <span class="conv-type-badge" style="color:${cfg.color};border-color:rgba(${cfg.rgb ?? '0,229,255'},0.3);background:rgba(${cfg.rgb ?? '0,229,255'},0.08);">${cfg.icon} ${cfg.label}</span>
          <span class="conv-out-name">${escapeHtml(result.filename || result.file.name)}</span>
          ${result.pages ? `<span class="conv-pages">${result.pages} page${result.pages !== 1 ? 's' : ''}</span>` : ''}
          ${result.blob  ? `<span class="conv-size">${_fmtBytes(result.blob.size)}</span>` : ''}
        </div>
        ${hasError ? `<div class="cm-error">⚠ ${escapeHtml(result.error)}</div>` : ''}
      </div>
      ${!hasError ? `<button class="cm-dl-btn btn btn-accent conv-dl-btn" style="border-color:rgba(${cfg.rgb ?? '0,229,255'},0.3);color:${cfg.color};background:linear-gradient(135deg,rgba(${cfg.rgb ?? '0,229,255'},0.15),rgba(${cfg.rgb ?? '0,229,255'},0.08));">⬇ Download</button>` : ''}
    `;

    if (!hasError) {
      card.querySelector('.conv-dl-btn').addEventListener('click', () => {
        _downloadBlob(result.blob, result.filename);
      });
    }
    card.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(card));
    return card;
  }

  async function _downloadAllConv(results) {
    const valid = results.filter(r => r.blob && !r.error);
    if (!valid.length) return;
    if (valid.length === 1) { _downloadBlob(valid[0].blob, valid[0].filename); return; }
    if (window.JSZip) {
      const zip = new JSZip();
      for (const r of valid) { zip.file(r.filename, await r.blob.arrayBuffer()); }
      const z = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
      _downloadBlob(z, 'converted_files.zip');
    } else {
      valid.forEach((r, i) => setTimeout(() => _downloadBlob(r.blob, r.filename), i * 350));
    }
  }

  // =============================================
  // ENHANCE PDF RESULTS
  // =============================================

  function renderEnhanceResults(results) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');
    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (!results || !results.length) {
      list.innerHTML = `<div class="no-results">No files enhanced.</div>`;
      return;
    }

    const totalOrig = results.reduce((s, r) => s + (r.originalSize || 0), 0);
    const totalEnh  = results.reduce((s, r) => s + (r.enhancedSize || 0), 0);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';
    const dlAllBtn = document.createElement('button');
    dlAllBtn.className   = 'btn-excel enh-dl-all-btn';
    dlAllBtn.textContent = '⬇ Download All';
    dlAllBtn.addEventListener('click', () => {
      const valid = results.filter(r => r.blob && !r.error);
      if (!valid.length) return;
      if (valid.length === 1) { _downloadBlob(valid[0].blob, valid[0].filename); return; }
      if (window.JSZip) {
        const zip = new JSZip();
        Promise.all(valid.map(r => r.blob.arrayBuffer().then(b => zip.file(r.filename, b))))
          .then(() => zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } }))
          .then(z => _downloadBlob(z, 'enhanced_pdfs.zip'));
      } else {
        valid.forEach((r, i) => setTimeout(() => _downloadBlob(r.blob, r.filename), i * 350));
      }
    });
    actionsRow.appendChild(dlAllBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);
    actions.appendChild(makeCountBadge(results.length, 'file'));

    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card enh-summary-card';
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat"><span class="tm-stat-val">${results.length}</span><span class="tm-stat-lbl">Files</span></div>
        <div class="tm-stat"><span class="tm-stat-val">${_fmtBytes(totalOrig)}</span><span class="tm-stat-lbl">Original</span></div>
        <div class="tm-stat tm-stat--fee"><span class="tm-stat-val">${_fmtBytes(totalEnh)}</span><span class="tm-stat-lbl">Enhanced</span></div>
      </div>`;
    list.appendChild(summaryCard);

    for (const result of results) {
      const card = document.createElement('div');
      card.className = 'result-item enh-card';
      const hasError = !!result.error;
      const gainLabel = hasError ? '' : `+${result.gainPct ?? 0}% larger`;
      card.innerHTML = `
        <div class="result-meta">
          <span class="page-badge">PDF</span>
          <span class="result-filename" title="${escapeHtml(result.file.name)}">${escapeHtml(result.file.name)}</span>
          <button class="result-remove-btn" title="Remove">✕</button>
        </div>
        <div class="cm-body">
          <div class="cm-sizes">
            <span class="cm-size-orig">${_fmtBytes(result.originalSize)}</span>
            <span class="cm-arrow">→</span>
            <span class="cm-size-new enh-size-new">${_fmtBytes(result.enhancedSize)}</span>
            ${!hasError ? `<span class="cm-badge enh-badge">✨ ${gainLabel}</span>` : ''}
          </div>
          ${hasError ? `<div class="cm-error">⚠ ${escapeHtml(result.error)}</div>`
                     : `<div class="cm-filename-out">Output: <span>${escapeHtml(result.filename)}</span></div>`}
        </div>
        ${!hasError ? `<button class="cm-dl-btn btn btn-accent enh-dl-btn">⬇ Download</button>` : ''}
      `;
      if (!hasError) {
        card.querySelector('.enh-dl-btn').addEventListener('click', () => _downloadBlob(result.blob, result.filename));
      }
      card.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(card));
      list.appendChild(card);
    }
    capResultsHeight(list);
  }

  // =============================================
  // LOCK PDF RESULTS
  // =============================================

  function renderLockResults(results) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');
    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    if (!results || !results.length) {
      list.innerHTML = `<div class="no-results">No files to lock.</div>`;
      return;
    }

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);
    actions.appendChild(makeCountBadge(results.length, 'file'));

    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card lock-summary-card';
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat"><span class="tm-stat-val">${results.length}</span><span class="tm-stat-lbl">File${results.length!==1?'s':''} Ready</span></div>
        <div class="tm-stat tm-stat--fee"><span class="tm-stat-val">🔒</span><span class="tm-stat-lbl">Set passwords below</span></div>
      </div>`;
    list.appendChild(summaryCard);

    for (const result of results) {
      list.appendChild(_makeLockCard(result));
    }
    capResultsHeight(list);
  }

  function _makeLockCard(result) {
    const card = document.createElement('div');
    card.className = 'result-item lock-card';

    card.innerHTML = `
      <div class="result-meta">
        <span class="page-badge">PDF</span>
        <span class="result-filename" title="${escapeHtml(result.file.name)}">${escapeHtml(result.file.name)}</span>
        <button class="result-remove-btn" title="Remove">✕</button>
      </div>
      <div class="lock-body">
        <div class="lock-pw-row">
          <div class="lock-pw-field-wrap">
            <input type="password" class="lock-pw-input" placeholder="Enter password (min 8 chars, mixed alphanumeric)" maxlength="64" autocomplete="new-password"/>
            <button class="lock-pw-toggle" title="Show/hide password" tabindex="-1">👁</button>
          </div>
          <div class="lock-pw-strength" aria-live="polite"></div>
        </div>
        <div class="lock-status"></div>
      </div>
      <button class="cm-dl-btn btn lock-lock-btn" disabled>🔒 Lock &amp; Download</button>
    `;

    const pwInput    = card.querySelector('.lock-pw-input');
    const pwToggle   = card.querySelector('.lock-pw-toggle');
    const strengthEl = card.querySelector('.lock-pw-strength');
    const statusEl   = card.querySelector('.lock-status');
    const lockBtn    = card.querySelector('.lock-lock-btn');

    // ── Show/hide password ──
    pwToggle.addEventListener('click', () => {
      const show = pwInput.type === 'password';
      pwInput.type = show ? 'text' : 'password';
      pwToggle.textContent = show ? '🙈' : '👁';
    });

    // ── Password strength validation ──
    function validatePw(pw) {
      if (pw.length < 8)                              return { ok: false, msg: '⚠ At least 8 characters required', level: 0 };
      const hasLetter = /[a-zA-Z]/.test(pw);
      const hasNumber = /[0-9]/.test(pw);
      if (!hasLetter || !hasNumber)                   return { ok: false, msg: '⚠ Must contain both letters and numbers', level: 1 };
      const hasUpper  = /[A-Z]/.test(pw);
      const hasSpec   = /[^a-zA-Z0-9]/.test(pw);
      if (pw.length >= 12 && hasUpper && hasSpec)     return { ok: true,  msg: '✦ Strong password',   level: 3 };
      if (pw.length >= 10 && (hasUpper || hasSpec))   return { ok: true,  msg: '✓ Good password',     level: 2 };
      return                                               { ok: true,  msg: '✓ Acceptable password', level: 1 };
    }

    const LEVEL_COLORS = ['var(--danger)', 'var(--gold)', 'var(--cyan)', 'var(--green)'];

    pwInput.addEventListener('input', () => {
      const pw = pwInput.value;
      if (!pw) { strengthEl.textContent = ''; lockBtn.disabled = true; return; }
      const v = validatePw(pw);
      strengthEl.textContent  = v.msg;
      strengthEl.style.color  = LEVEL_COLORS[v.level] || 'var(--text-dim)';
      lockBtn.disabled = !v.ok;
    });

    // ── Lock & Download ──
    lockBtn.addEventListener('click', async () => {
      const pw = pwInput.value.trim();
      const v  = validatePw(pw);
      if (!v.ok) { strengthEl.textContent = v.msg; strengthEl.style.color = 'var(--danger)'; return; }

      lockBtn.disabled    = true;
      lockBtn.textContent = '🔒 Locking…';
      statusEl.textContent = '';

      try {
        const locked = await PDFLocker.lock(result.file, pw);
        statusEl.textContent = `✓ Locked as: ${locked.filename}`;
        statusEl.style.color = 'var(--green)';
        lockBtn.textContent  = '✓ Locked — Download Again';
        lockBtn.disabled     = false;
        lockBtn.classList.add('lock-btn--done');
        _downloadBlob(locked.blob, locked.filename);
        // Wire subsequent clicks to re-download
        lockBtn.onclick = () => _downloadBlob(locked.blob, locked.filename);
      } catch (err) {
        statusEl.textContent = `⚠ Error: ${err.message}`;
        statusEl.style.color = 'var(--danger)';
        lockBtn.textContent  = '🔒 Lock & Download';
        lockBtn.disabled     = false;
      }
    });

    card.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(card));
    return card;
  }

  // =============================================
  // PER-FILE PROGRESS STATUS
  // =============================================

  // Shows a mini status list alongside the progress bar
  // so users can see which file is currently processing.

  function setPerFileStatus(files, doneIdx, status, order) {
    const wrap = document.getElementById('perFileStatusWrap');
    if (!wrap) return;
    wrap.style.display = 'block';

    const fileList = order
      ? order.map(i => files[i]).filter(Boolean)
      : files;

    if (!wrap._rows || wrap._rows.length !== fileList.length) {
      // Build rows
      wrap.innerHTML = '';
      wrap._rows = fileList.map((f, i) => {
        const row = document.createElement('div');
        row.className = 'pfs-row';
        row.innerHTML = `<span class="pfs-icon">⟳</span><span class="pfs-name">${escapeHtml(f.name)}</span>`;
        wrap.appendChild(row);
        return row;
      });
    }

    wrap._rows.forEach((row, i) => {
      const icon = row.querySelector('.pfs-icon');
      if (i < doneIdx) { icon.textContent = '✓'; row.className = 'pfs-row pfs-row--done'; }
      else if (i === doneIdx) {
        icon.textContent = status === 'done' ? '✓' : '⟳';
        row.className = `pfs-row ${status === 'done' ? 'pfs-row--done' : 'pfs-row--active'}`;
      }
    });
  }

  function clearPerFileStatus() {
    const wrap = document.getElementById('perFileStatusWrap');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; wrap._rows = null; }
  }

  // =============================================
  // MERGE RESULT RENDERER
  // =============================================

  function renderMergeResult(result, files, order) {
    const container = document.getElementById('resultsContainer');
    const list      = document.getElementById('resultsList');
    const actions   = document.getElementById('resultsActions');
    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';
    const dlBtn = document.createElement('button');
    dlBtn.className   = 'btn-excel merge-dl-btn';
    dlBtn.textContent = '⬇ Download Merged PDF';
    dlBtn.addEventListener('click', () => _downloadBlob(result.blob, result.filename));
    actionsRow.appendChild(dlBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card merge-summary-card';
    const orderedFiles = (order || files.map((_,i)=>i)).map(i => files[i]).filter(Boolean);
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat"><span class="tm-stat-val">${orderedFiles.length}</span><span class="tm-stat-lbl">Files Merged</span></div>
        <div class="tm-stat"><span class="tm-stat-val">${result.totalPages}</span><span class="tm-stat-lbl">Total Pages</span></div>
        <div class="tm-stat tm-stat--fee"><span class="tm-stat-val">${_fmtBytes(result.blob.size)}</span><span class="tm-stat-lbl">Output Size</span></div>
      </div>
    `;
    list.appendChild(summaryCard);

    // Show merge order
    orderedFiles.forEach((file, i) => {
      const card = document.createElement('div');
      card.className = 'result-item merge-file-card';
      card.innerHTML = `
        <div class="result-meta">
          <span class="page-badge">#${i+1}</span>
          <span class="result-filename" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="merge-file-size">${formatBytes(file.size)}</span>
        </div>
      `;
      list.appendChild(card);
    });

    // Output download card
    const outCard = document.createElement('div');
    outCard.className = 'result-item merge-out-card';
    outCard.innerHTML = `
      <div class="result-meta">
        <span class="page-badge merge-out-badge">OUT</span>
        <span class="result-filename">${escapeHtml(result.filename)}</span>
      </div>
      <button class="cm-dl-btn btn btn-accent merge-dl-card-btn">⬇ Download</button>
    `;
    outCard.querySelector('.merge-dl-card-btn').addEventListener('click', () => _downloadBlob(result.blob, result.filename));
    list.appendChild(outCard);
    capResultsHeight(list);
  }

  // =============================================
  // SORT & MERGE — group checklist + final results
  // =============================================

  /**
   * renderSortMergeGroups
   * Renders the shared group list (both auto-detected and manual groups
   * appear here together). Each row has: a checkbox to mark the group
   * for merging, an editable label, a mode tag ("AUTO"/"MANUAL"), a
   * file-count pill, and a remove button.
   *
   * @param {Array<{id,label,mode,files:File[]}>} groups
   * @param {Set<string>} selectedIds - group ids currently checked for merge
   * @param {{onToggle:Function, onRename:Function, onRemove:Function}} handlers
   */
  function renderSortMergeGroups(groups, selectedIds, handlers) {
    const wrap = document.getElementById('smGroupsWrap');
    const list = document.getElementById('smGroupsList');
    const empty = document.getElementById('smEmptyHint');
    const renameWrap = document.getElementById('smRenameWrap');
    if (!wrap || !list) return;

    if (!groups || groups.length === 0) {
      wrap.style.display = 'none';
      if (renameWrap) renameWrap.style.display = 'none';
      if (empty) { empty.style.display = 'block'; empty.textContent = 'No types yet — use Auto-Detect or add a Manual group above.'; }
      return;
    }

    wrap.style.display = 'block';
    if (renameWrap) renameWrap.style.display = 'block';
    if (empty) empty.style.display = 'none';
    list.innerHTML = '';

    groups.forEach(group => {
      const row = document.createElement('div');
      row.className = 'sm-group-item' + (selectedIds.has(group.id) ? ' sm-group-item--selected' : '');
      row.dataset.groupId = group.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'sm-group-checkbox';
      checkbox.checked = selectedIds.has(group.id);
      checkbox.title = 'Select this type to merge into one PDF';
      checkbox.addEventListener('change', () => handlers.onToggle(group.id, checkbox.checked));

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'sm-group-label';
      labelInput.value = group.label;
      labelInput.title = 'Click to rename this type';
      labelInput.addEventListener('change', () => handlers.onRename(group.id, labelInput.value));

      const modeTag = document.createElement('span');
      modeTag.className = 'sm-group-mode-tag';
      modeTag.textContent = group.mode === 'manual' ? 'MANUAL' : 'AUTO';

      const countPill = document.createElement('span');
      countPill.className = 'sm-group-count';
      countPill.textContent = `${group.files.length} file${group.files.length !== 1 ? 's' : ''}`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'sm-group-remove';
      removeBtn.title = 'Remove this type';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => handlers.onRemove(group.id));

      row.append(checkbox, labelInput, modeTag, countPill, removeBtn);
      list.appendChild(row);
    });
  }

  /**
   * renderSortMergeResult
   * Shows the final output after running Sort & Merge: one download
   * card per merged group PDF, plus a card for the renamed-remainder
   * ZIP (if any files were left unassigned).
   *
   * @param {Array<{groupLabel:string, blob:Blob, filename:string, totalPages:number}>} mergedOutputs
   * @param {{count:number, onDownload:Function}|null} renameInfo - null if nothing was left to rename
   */
  function renderSortMergeResult(mergedOutputs, renameInfo) {
    const container = document.getElementById('resultsContainer');
    const list       = document.getElementById('resultsList');
    const actions    = document.getElementById('resultsActions');
    container.style.display = 'block';
    list.innerHTML    = '';
    actions.innerHTML = '';

    const actionsRow = document.createElement('div');
    actionsRow.className = 'results-actions-row';
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    const summaryCard = document.createElement('div');
    summaryCard.className = 'tm-summary-card merge-summary-card';
    summaryCard.innerHTML = `
      <div class="tm-summary-grid">
        <div class="tm-stat"><span class="tm-stat-val">${mergedOutputs.length}</span><span class="tm-stat-lbl">Types Merged</span></div>
        <div class="tm-stat"><span class="tm-stat-val">${renameInfo ? renameInfo.count : 0}</span><span class="tm-stat-lbl">Files Renamed</span></div>
      </div>
    `;
    list.appendChild(summaryCard);

    mergedOutputs.forEach(out => {
      const card = document.createElement('div');
      card.className = 'result-item merge-out-card';
      card.innerHTML = `
        <div class="result-meta">
          <span class="page-badge merge-out-badge">${escapeHtml(out.groupLabel)}</span>
          <span class="result-filename">${escapeHtml(out.filename)}</span>
          <span class="merge-file-size">${out.totalPages} page${out.totalPages !== 1 ? 's' : ''} · ${formatBytes(out.blob.size)}</span>
        </div>
        <button class="cm-dl-btn btn btn-accent merge-dl-card-btn">⬇ Download</button>
      `;
      card.querySelector('.merge-dl-card-btn').addEventListener('click', () => _downloadBlob(out.blob, out.filename));
      list.appendChild(card);
    });

    if (renameInfo && renameInfo.count > 0) {
      const renameCard = document.createElement('div');
      renameCard.className = 'result-item merge-out-card';
      renameCard.innerHTML = `
        <div class="result-meta">
          <span class="page-badge merge-out-badge">REST</span>
          <span class="result-filename">${renameInfo.count} renamed file${renameInfo.count !== 1 ? 's' : ''} (ZIP)</span>
        </div>
        <button class="cm-dl-btn btn btn-accent merge-dl-card-btn">⬇ Download ZIP</button>
      `;
      renameCard.querySelector('.merge-dl-card-btn').addEventListener('click', renameInfo.onDownload);
      list.appendChild(renameCard);
    }

    capResultsHeight(list);
  }

  return {
    renderFileList,
    setModeSelected,
    setModeButtonsVisible,
    setKeywordSectionMode,
    renderKeywordChips,
    showExcelLayoutPicker,
    activateStep,
    deactivateStep,
    setProgress,
    hideProgress,
    setRunning,
    setRunEnabled,
    renderKeywordResults,
    renderDetectedLabels,
    hideDetectedLabels,
    renderSingleKeywordResults,
    renderExtractAll,
    renderTableResults,
    renderCompressResults,
    renderSplitResults,
    renderConversionResults,
    renderEnhanceResults,
    renderLockResults,
    renderMergeResult,
    renderSortMergeGroups,
    renderSortMergeResult,
    setPerFileStatus,
    clearPerFileStatus,
    escapeHtml,
  };
})();