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

    // Show 5 items max, then scroll
    const itemHeight = 48; // px — matches .file-item height + gap
    const maxVisible = 2;
    list.style.maxHeight = files.length > maxVisible
      ? `${itemHeight * maxVisible}px`
      : '';
    list.style.overflowY = files.length > maxVisible ? 'auto' : '';    
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
    }else {
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
   * Result card with an inline multi-value picker.
   * Shown when a keyword extraction returns 2+ distinct values.
   * The user picks one option — the card then collapses to show only the chosen value.
   */
  function makePickerResultItem(page, filename, keyword, values) {
    const item = document.createElement('div');
    item.className = 'result-item result-item--picker';

    // Live array so edits are reflected when picking or recording both
    const editedValues = [...values];

    const optionsHtml = values.map((v, i) => `
      <div class="pick-option-wrap" data-idx="${i}">
        <button class="pick-option" data-idx="${i}" title="${escapeHtml(v)}">
          <span class="pick-dot"></span>
          <span class="pick-label">${escapeHtml(v)}</span>
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

    // ── Helper: open inline editor for a pick-option-wrap ──────────────────
    function openInlineEditor(wrap) {
      const idx      = +wrap.dataset.idx;
      const pickBtn  = wrap.querySelector('.pick-option');
      const editBtn  = wrap.querySelector('.pick-edit-btn');

      // Don't open a second editor if already editing
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

      // Focus + select all
      requestAnimationFrame(() => { input.focus(); input.select(); });

      function closeEditor(save) {
        if (save) {
          const newVal = input.value.trim();
          if (newVal) {
            editedValues[idx] = newVal;
            // Update the visible label on the pick button
            pickBtn.querySelector('.pick-label').textContent = newVal;
            pickBtn.title = newVal;
          }
        }
        editor.remove();
        pickBtn.style.display = '';
        editBtn.style.display = '';
      }

      saveBtn.addEventListener('click', () => closeEditor(true));
      cancelBtn.addEventListener('click', () => closeEditor(false));
      // Enter = save, Escape = cancel
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); closeEditor(true);  }
        if (e.key === 'Escape') { e.preventDefault(); closeEditor(false); }
      });
    }

    // ── Edit button click ───────────────────────────────────────────────────
    item.querySelectorAll('.pick-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); // don't bubble to the pick-option
        const wrap = btn.closest('.pick-option-wrap');
        openInlineEditor(wrap);
      });
    });

    // ── Option click → pick one value ──────────────────────────────────────
    item.querySelectorAll('.pick-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx    = +btn.dataset.idx;
        const chosen = editedValues[idx];   // use edited value

        // Mark selected
        item.querySelectorAll('.pick-option').forEach(b => b.classList.remove('pick-option--selected'));
        btn.classList.add('pick-option--selected');

        // Collapse options + "Record Both" btn, then show chosen value
        const optionsEl  = item.querySelector('.pick-options');
        const bothBtn    = item.querySelector('.pick-both-btn');
        const chosenEl   = item.querySelector('.pick-chosen');

        optionsEl.classList.add('pick-options--collapsing');
        bothBtn.classList.add('pick-options--collapsing');
        setTimeout(() => {
          optionsEl.style.display = 'none';
          bothBtn.style.display   = 'none';
          chosenEl.textContent = chosen;
          chosenEl.style.display = '';
          chosenEl.classList.add('pick-chosen--in');
          item.classList.remove('result-item--picker');
          item.querySelector('.pick-badge').textContent = '✓ selected';
        }, 280);
      });
    });

    // ── "Record Both" click → show all values joined ───────────────────────
    item.querySelector('.pick-both-btn').addEventListener('click', () => {
      const optionsEl = item.querySelector('.pick-options');
      const bothBtn   = item.querySelector('.pick-both-btn');
      const chosenEl  = item.querySelector('.pick-chosen');

      optionsEl.classList.add('pick-options--collapsing');
      bothBtn.classList.add('pick-options--collapsing');
      setTimeout(() => {
        optionsEl.style.display = 'none';
        bothBtn.style.display   = 'none';
        // Display all edited values, one per line
        chosenEl.textContent = editedValues.join('\n');
        chosenEl.style.display = '';
        chosenEl.classList.add('pick-chosen--in');
        item.classList.remove('result-item--picker');
        item.querySelector('.pick-badge').textContent = `✓ ${editedValues.length} recorded`;
      }, 280);
    });

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
   * Build one result card per detected label:value field.
   * Returns an array of cards — one per field across all pages.
   */
  function makeExtractItem(file, pages) {
    const cards = [];

    for (const p of pages) {
      const fields = KeywordHandler.extractFields(p.text);

      if (fields.length === 0) {
        // Fallback: no fields detected — show raw page text as one card
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
          <div class="result-meta">
            <span class="page-badge">Page ${p.page}</span>
            <span class="result-filename">${escapeHtml(file.name)}</span>
            <button class="result-remove-btn" title="Remove this result">✕</button>
          </div>
          <div class="result-keyword">Raw Text</div>
          <div class="result-text">${escapeHtml(p.text) || '<em>(no text)</em>'}</div>
        `;
        item.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(item));
        cards.push(item);
        continue;
      }

      for (const { label, value } of fields) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
          <div class="result-meta">
            <span class="page-badge">Page ${p.page}</span>
            <span class="result-filename">${escapeHtml(file.name)}</span>
            <button class="result-remove-btn" title="Remove this result">✕</button>
          </div>
          <div class="result-keyword">${escapeHtml(label)}</div>
          <div class="result-text">${escapeHtml(value)}</div>
        `;
        item.querySelector('.result-remove-btn').addEventListener('click', () => popRemove(item));
        cards.push(item);
      }
    }

    return cards;
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

  /**
 * Cap results list to 3 visible cards, enable scroll beyond that.
 */
  function capResultsHeight(list) {
    const cards = list.querySelectorAll('.result-item, .extract-all-item');
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

  // =============================================
  // EXCEL LAYOUT PICKER MODAL
  // =============================================
  //
  // Shows a small modal asking the user which Excel layout to use:
  //   A) Rows    — Page | Filename | Keyword | Captured Text  (one row per hit)
  //   B) Columns — Filename | Page | [KW1] | [KW2] …         (one column per keyword)
  //
  // Calls onChoose('rows') or onChoose('columns') when the user picks.
  // The modal self-destructs after a choice or on backdrop click.

  function showExcelLayoutPicker(onChoose) {
    // ── Build overlay ────────────────────────────────────────────────────
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

          <!-- Layout A: Rows -->
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

          <!-- Layout B: Columns -->
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

    // ── Animate in ───────────────────────────────────────────────────────
    requestAnimationFrame(() => overlay.classList.add('elp-open'));

    // ── Close helper ─────────────────────────────────────────────────────
    function closeModal() {
      overlay.classList.add('elp-closing');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      setTimeout(() => overlay.remove(), 400); // safety net
    }

    // ── Option click ─────────────────────────────────────────────────────
    overlay.querySelectorAll('.elp-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.elp-option').forEach(b => b.classList.remove('elp-option--selected'));
        btn.classList.add('elp-option--selected');
        const layout = btn.dataset.layout;
        closeModal();
        onChoose(layout);
      });
    });

    // ── Close button & backdrop ──────────────────────────────────────────
    overlay.querySelector('.elp-close').addEventListener('click', closeModal);
    overlay.querySelector('.elp-backdrop').addEventListener('click', closeModal);
  }

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
      // Ask the user which layout they want before downloading
      showExcelLayoutPicker(layout => {
        ExcelExporter.exportKeywordResults(results, 'Multiple-Keyword-Results.xlsx', layout);
      });
    });

    actionsRow.appendChild(excelBtn);
    actionsRow.appendChild(makeClearAllBtn(list));
    actions.appendChild(actionsRow);

    // Count badge
    let total = 0;
    for (const r of results) total += r.contexts.length;
    actions.appendChild(makeCountBadge(total, 'result'));

    // Result cards — group by keyword+filename+page so multi-value keywords
    // get a single picker card instead of multiple plain cards.
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
        // 2+ distinct values → ask user to pick one
        list.appendChild(makePickerResultItem(page, filename, keyword, values));
      } else {
        const highlighted = keywords.reduce(
          (text, kw) => KeywordHandler.highlight(text, kw),
          escapeHtml(values[0])
        );
        list.appendChild(makeResultItem(page, filename, keyword, highlighted));
      }
    }
    capResultsHeight(list);
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
      renameStatus.textContent = `📦 Preparing ZIP — ${files.length} file(s) to rename…`;
      await RenameHandler.downloadRenamed(files, renameMap, (done, total, newName, remaining, timeStr) => {
        if (remaining === 0 && newName.startsWith('📦')) {
          // Compression phase
          renameStatus.textContent = `${newName} ${timeStr}`;
        } else {
          const remainingMsg = remaining > 0
            ? ` — ${remaining} file${remaining !== 1 ? 's' : ''} left${timeStr ? `, ${timeStr}` : ''}`
            : '';
          renameStatus.textContent = `📄 ${done}/${total}: ${newName}${remainingMsg}`;
        }
      });
      renameStatus.className = 'rename-status rename-done';
      renameStatus.textContent = `✓ ZIP downloaded — ${files.length} file(s) renamed, sorted A→Z inside "PDF-Extractor-Rename-PDF-Result".`;
    });
    
    // Result cards
    for (const r of results) {
      for (const ctx of r.contexts) {
        const highlighted = KeywordHandler.highlight(escapeHtml(ctx), keyword);
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
    
    // Count badge — total pages across all files
    const totalPages = pdfData.reduce((sum, { pages }) => sum + pages.length, 0);
    actions.appendChild(makeCountBadge(totalPages, 'page'));

    dlBtn.addEventListener('click', () => {
      ExcelExporter.exportExtractAll(pdfData, 'extract_all.xlsx');
    });

    // One card per detected field across all files
    let totalFields = 0;
    for (const { file, pages } of pdfData) {
      const cards = makeExtractItem(file, pages);
      cards.forEach(card => list.appendChild(card));
      totalFields += cards.length;
    }
    // Count badge — total field cards
    actions.appendChild(makeCountBadge(totalFields, 'field'));
    capResultsHeight(list);   
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
    showExcelLayoutPicker,
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