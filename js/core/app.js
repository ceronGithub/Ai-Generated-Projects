// =============================================
// app.js — Main application logic / state
// v2 — adds: OCR, Merge, Session, per-file
//      progress, negative keywords, rename queue
// =============================================

(() => {

  // Disable the right-click context menu across the whole app —
  // prevents casual inspection via the browser's context menu.
  document.addEventListener('contextmenu', e => e.preventDefault());

  // ===== STATE =====
  const state = {
    files:       [],      // File objects
    mode:        null,
    keywords:    [],
    lastResults: null,
    lastPdfData: null,
    ocrEnabled:  false,   // OCR fallback toggle
    mergeOrder:  [],      // file indices for merge mode
    detectedLabels: [],   // auto-detected label words (Single Keyword mode)
    sortGroups:      [],  // Sort & Merge: detected/manual groups (TypeSorter.Group[])
    sortSelectedIds: new Set(), // Sort & Merge: group ids checked for merging
    sortMode:        'auto', // Sort & Merge: 'auto' | 'manual' toggle
  };
  let labelDetectGen = 0; // guards against out-of-order async label detection results

  // ===== DOM REFS =====
  const dropZone      = document.getElementById('dropZone');
  const fileInput     = document.getElementById('fileInput');
  const deleteAllBtn  = document.getElementById('deleteAllBtn');
  const modeBtns      = document.querySelectorAll('.mode-btn');
  const changeModeBtn = document.getElementById('changeModeBtn');
  const keywordInput  = document.getElementById('keywordInput');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const runBtn        = document.getElementById('runBtn');
  const stepKeywords  = document.getElementById('step-keywords');
  const stepResults   = document.getElementById('step-results');

  // ===== FILE HANDLING =====

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over'); addFiles([...e.dataTransfer.files]);
  });
  dropZone.addEventListener('click', e => {
    if (e.target === dropZone || e.target.classList.contains('drop-icon') ||
        e.target.classList.contains('drop-title') || e.target.classList.contains('drop-sub'))
      fileInput.click();
  });
  fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });

  // ===== RESET =====

  function resetToEmpty() {
    state.mode = null; state.keywords = []; state.lastResults = null; state.lastPdfData = null;
    state.mergeOrder = []; state.detectedLabels = [];
    state.sortGroups = []; state.sortSelectedIds = new Set(); state.sortMode = 'auto';
    UIManager.hideDetectedLabels();
    UIManager.deactivateStep('step-mode');
    UIManager.deactivateStep('step-keywords');
    UIManager.deactivateStep('step-results');
    UIManager.setModeButtonsVisible(true);
    document.getElementById('modeDisplay').style.display = 'none';
    keywordInput.value = '';
    document.getElementById('keywordChips').innerHTML = '';
    document.getElementById('keywordHint').textContent = '';
    document.getElementById('keywordInputArea').style.display = 'flex';
    const rc = document.getElementById('resultsContainer');
    rc.style.display = 'none';
    document.getElementById('resultsList').innerHTML = '';
    document.getElementById('resultsActions').innerHTML = '';
    UIManager.hideProgress(); UIManager.setRunEnabled(false);
    // Hide step-split
    const ss = document.getElementById('step-split');
    if (ss) { ss.style.display = 'none'; ss.classList.add('disabled-card'); ss.classList.remove('active'); }
    // Hide merge order panel
    const mp = document.getElementById('mergeOrderPanel');
    if (mp) mp.style.display = 'none';
    // Hide Sort & Merge panel
    const smp = document.getElementById('sortMergePanel');
    if (smp) smp.style.display = 'none';
  }

  deleteAllBtn.addEventListener('click', () => { state.files = []; refreshFileList(); resetToEmpty(); });

  const MAX_FILES = 2000;

  function addFiles(incoming) {
    // Determine accepted file types based on current mode
    const officeToModesMap = {
      wordtopdf:  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      exceltopdf: ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ppttopdf:   ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    };
    const officeMode = officeToModesMap[state.mode];
    let accepted_files;
    if (officeMode) {
      accepted_files = incoming.filter(f => officeMode.some(t => f.name.toLowerCase().endsWith(t.replace(/^.*\./,'.')) || f.type === t));
    } else {
      accepted_files = incoming.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    }
    const pdfs      = accepted_files;
    const existing  = new Set(state.files.map(f => f.name + f.size));
    const newFiles  = pdfs.filter(f => !existing.has(f.name + f.size));
    const available = MAX_FILES - state.files.length;

    if (available <= 0) { showUploadNote(`⛔ Limit reached — max ${MAX_FILES.toLocaleString()} files.`, 'error'); return; }
    const accepted = newFiles.slice(0, available);
    const rejected = newFiles.length - accepted.length;
    state.files.push(...accepted);
    refreshFileList();

    if (rejected > 0) showUploadNote(`⚠ ${rejected} file(s) skipped — limit reached.`, 'warn');
    else if (accepted.length > 0) showUploadNote(`✓ ${accepted.length} file(s) added.`, 'ok');

    if (state.files.length > 0) {
      UIManager.activateStep('step-mode');
      if (state.mode === 'splitmode') updateSplitPreview();
      // Keep mergeOrder in sync with newly-added files before re-rendering,
      // otherwise files added after entering merge mode are missing from
      // mergeOrder (mismatched length) and PDFMerge.merge() silently
      // discards the user's custom order and falls back to default order.
      if (state.mode === 'mergemode') { syncMergeOrder(); renderMergeOrder(); }
      // Re-scan for label words whenever files change while in Single Keyword mode.
      if (state.mode === 'single') refreshDetectedLabels();
    }
    if (window.SessionStore) SessionStore.saveFileNames(state.files);
  }

  function showUploadNote(msg, type) {
    const el = document.getElementById('uploadNote');
    if (!el) return;
    el.textContent = msg;
    el.style.color = { ok: 'var(--green)', warn: 'var(--gold)', error: 'var(--danger)' }[type] || '';
    el.style.opacity = '1';
    clearTimeout(el._noteTimer);
    el._noteTimer = setTimeout(() => {
      el.textContent = '⚠ Max upload is 2,000 PDF files per batch.';
      el.style.color = ''; el.style.opacity = '';
    }, 4000);
  }

  function removeFile(idx) {
    const removed = state.files[idx];
    state.files.splice(idx, 1);
    // Fix merge order after removal
    state.mergeOrder = state.mergeOrder
      .filter(i => i !== idx)
      .map(i => i > idx ? i - 1 : i);
    // Purge the removed file from any Sort & Merge groups it belonged to
    if (removed && state.sortGroups.length > 0) {
      state.sortGroups = state.sortGroups.map(g => ({ ...g, files: g.files.filter(f => f !== removed) }));
      if (state.mode === 'sortmergemode') renderSortMergeGroups();
    }
    refreshFileList();
    if (state.files.length === 0) resetToEmpty();
    else if (state.mode === 'mergemode') renderMergeOrder();
    else if (state.mode === 'single') refreshDetectedLabels();
  }

  function refreshFileList() { UIManager.renderFileList(state.files, removeFile); updateRunBtn(); }

  // ===== MODE SELECTION =====

  modeBtns.forEach(btn => btn.addEventListener('click', () => selectMode(btn.dataset.mode)));

  changeModeBtn.addEventListener('click', () => {
    state.mode = null; state.keywords = []; state.lastResults = null; state.lastPdfData = null; state.mergeOrder = [];
    state.detectedLabels = [];
    state.sortGroups = []; state.sortSelectedIds = new Set(); state.sortMode = 'auto';
    UIManager.hideDetectedLabels();

    const chips = document.querySelectorAll('.keyword-chip');
    chips.forEach((chip, i) => { chip.style.animationDelay = `${i * 35}ms`; chip.classList.add('chip-wiping'); });

    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer.style.display !== 'none') resultsContainer.classList.add('results-folding');

    // Fold step-split if visible
    const stepSplit = document.getElementById('step-split');
    if (stepSplit && stepSplit.style.display !== 'none') {
      setTimeout(() => {
        stepSplit.classList.add('step-folding');
        stepSplit.addEventListener('animationend', () => {
          stepSplit.classList.remove('step-folding');
          stepSplit.style.display = 'none';
          stepSplit.classList.add('disabled-card'); stepSplit.classList.remove('active');
        }, { once: true });
      }, 50);
    }
    // Hide merge panel
    const mp = document.getElementById('mergeOrderPanel');
    if (mp) mp.style.display = 'none';
    // Hide Sort & Merge panel
    const smp = document.getElementById('sortMergePanel');
    if (smp) smp.style.display = 'none';

    stepResults.classList.add('step-folding');
    stepResults.addEventListener('animationend', () => {
      stepResults.classList.remove('step-folding');
      resultsContainer.classList.remove('results-folding');
      resultsContainer.style.display = 'none';
      document.getElementById('resultsList').innerHTML = '';
      document.getElementById('resultsActions').innerHTML = '';
      UIManager.hideProgress(); UIManager.setRunEnabled(false);
      stepResults.classList.add('disabled-card', 'step-settling'); stepResults.classList.remove('active');
      stepResults.addEventListener('animationend', () => stepResults.classList.remove('step-settling'), { once: true });
    }, { once: true });

    setTimeout(() => {
      stepKeywords.classList.add('step-folding');
      stepKeywords.addEventListener('animationend', () => {
        stepKeywords.classList.remove('step-folding');
        keywordInput.value = '';
        document.getElementById('keywordChips').innerHTML = '';
        document.getElementById('keywordHint').textContent = '';
        document.getElementById('keywordInputArea').style.display = 'flex';
        keywordInput.placeholder = 'Type a keyword and press Enter…';
        stepKeywords.classList.add('disabled-card', 'step-settling'); stepKeywords.classList.remove('active');
        stepKeywords.addEventListener('animationend', () => stepKeywords.classList.remove('step-settling'), { once: true });
      }, { once: true });
    }, 120);

    setTimeout(() => {
      UIManager.setModeButtonsVisible(true);
      document.getElementById('modeDisplay').style.display = 'none';
      document.querySelector('.mode-buttons').style.display = 'grid';
    }, 480);
    if (window.SessionStore) SessionStore.saveMode(null);
    fileInput.accept = '.pdf';
    const uploadNote = document.getElementById('uploadNote');
    if (uploadNote) uploadNote.textContent = '⚠ Max upload is 2,000 PDF files per batch.';
  });

  function selectMode(mode) {
    state.mode = mode; state.keywords = []; state.mergeOrder = state.files.map((_, i) => i);
    UIManager.setModeSelected(mode);
    UIManager.setModeButtonsVisible(false);
    document.getElementById('modeDisplay').style.display = 'flex';
    document.querySelector('.mode-buttons').style.display = 'none';

    // Update file input accept and drop zone hint based on mode
    const officeAccept = {
      wordtopdf:  '.docx',
      exceltopdf: '.xlsx',
      ppttopdf:   '.pptx',
    };
    const uploadNote = document.getElementById('uploadNote');
    if (officeAccept[mode]) {
      fileInput.accept = officeAccept[mode];
      const ext = officeAccept[mode];
      if (uploadNote) uploadNote.textContent = `⚠ Upload ${ext.toUpperCase()} files for this mode.`;
    } else {
      fileInput.accept = '.pdf';
      if (uploadNote) uploadNote.textContent = '⚠ Max upload is 2,000 PDF files per batch.';
    }

    const stepSplit = document.getElementById('step-split');
    if (mode === 'splitmode') {
      if (stepSplit) {
        stepSplit.style.display = 'block';
        stepSplit.classList.remove('disabled-card');
        stepSplit.classList.add('active', 'step-split-entering');
        stepSplit.addEventListener('animationend', () => stepSplit.classList.remove('step-split-entering'), { once: true });
      }
    } else {
      if (stepSplit) { stepSplit.style.display = 'none'; stepSplit.classList.add('disabled-card'); stepSplit.classList.remove('active'); }
    }

    // Show/hide merge order panel
    const mp = document.getElementById('mergeOrderPanel');
    if (mode === 'mergemode') {
      if (mp) { mp.style.display = 'block'; renderMergeOrder(); }
    } else {
      if (mp) mp.style.display = 'none';
    }

    // Show/hide Sort & Merge panel
    const smp = document.getElementById('sortMergePanel');
    if (mode === 'sortmergemode') {
      if (smp) { smp.style.display = 'block'; renderSortMergeGroups(); }
    } else {
      if (smp) smp.style.display = 'none';
    }

    UIManager.activateStep('step-keywords');
    UIManager.activateStep('step-results');
    UIManager.setKeywordSectionMode(mode);
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, mode);

    // Single Keyword mode: auto-scan uploaded PDFs for label words and
    // show them as a checklist under the keyword field. Other modes never
    // show this panel.
    if (mode === 'single' && state.files.length > 0) refreshDetectedLabels();
    else { state.detectedLabels = []; UIManager.hideDetectedLabels(); }

    document.getElementById('resultsContainer').style.display = 'none';
    UIManager.hideProgress();
    updateRunBtn();

    if (mode === 'splitmode' && state.files.length > 0) setTimeout(updateSplitPreview, 100);
    if (window.SessionStore) SessionStore.saveMode(mode);
  }

  // ===== KEYWORDS =====

  function smartCapKeyword(raw) {
    const clean = raw.replace(/[''‛'']/g, '');
    const letters = clean.replace(/[^a-zA-Z]/g, '');
    if (!letters) return clean;
    if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return clean;
    return clean.split(' ').map(word => {
      if (!word) return word;
      let result = ''; let foundFirst = false;
      for (const ch of word) {
        if (/[a-zA-Z]/.test(ch) && !foundFirst) { result += ch.toUpperCase(); foundFirst = true; }
        else if (/[a-zA-Z]/.test(ch)) result += ch.toLowerCase();
        else result += ch;
      }
      return result;
    }).join(' ');
  }

  function addKeyword() {
    const raw = keywordInput.value.trim();
    if (!raw) return;
    const val = raw.startsWith('!') ? '!' + smartCapKeyword(raw.slice(1)) : smartCapKeyword(raw);
    if (state.mode === 'single') state.keywords = [val];
    else if (!state.keywords.includes(val)) state.keywords.push(val);
    keywordInput.value = '';
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
    updateRunBtn();
    syncDetectedLabelsUI();
    if (window.SessionStore) SessionStore.saveKeywords(state.keywords);
  }

  function removeKeyword(idx) {
    state.keywords.splice(idx, 1);
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
    updateRunBtn();
    syncDetectedLabelsUI();
    if (window.SessionStore) SessionStore.saveKeywords(state.keywords);
  }

  // ===== SINGLE KEYWORD MODE — DETECTED LABELS CHECKLIST =====

  // Manual typing in the keyword field only accepts one word (no spaces)
  // when in Single Keyword mode — checking a detected label below still
  // fills the field programmatically and can carry multi-word labels
  // (e.g. "Customer Name"), since that assignment never fires 'input'.
  keywordInput.addEventListener('input', () => {
    if (state.mode !== 'single') return;
    const stripped = keywordInput.value.replace(/\s+/g, '');
    if (stripped !== keywordInput.value) keywordInput.value = stripped;
  });

  // Re-renders the detected-labels checklist using the already-cached
  // state.detectedLabels list (no re-extraction) so the checkbox that
  // matches the current keyword stays highlighted as it changes.
  function syncDetectedLabelsUI() {
    if (state.mode !== 'single') return;
    UIManager.renderDetectedLabels(state.detectedLabels, state.keywords[0] || null, onDetectedLabelToggle);
  }

  // Checking a detected label auto-fills + adds it as the single keyword;
  // unchecking the currently-active one clears the keyword field.
  function onDetectedLabelToggle(label, checked) {
    if (checked) {
      keywordInput.value = label;
      addKeyword();
    } else if (state.keywords[0] === label) {
      state.keywords = [];
      UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
      updateRunBtn();
      syncDetectedLabelsUI();
      if (window.SessionStore) SessionStore.saveKeywords(state.keywords);
    }
  }

  // Scans every uploaded PDF's text for label-shaped tokens ("Word:") and
  // populates the checklist below the keyword field. Only runs in Single
  // Keyword mode. Guarded against out-of-order results — if files change
  // again mid-scan, only the latest call's results get applied.
  async function refreshDetectedLabels() {
    if (state.mode !== 'single' || state.files.length === 0) {
      state.detectedLabels = [];
      UIManager.hideDetectedLabels();
      return;
    }
    const gen = ++labelDetectGen;
    let labels = [];
    try {
      const pdfData = await PDFProcessor.extractAll(state.files);
      if (gen !== labelDetectGen) return; // superseded by a newer scan
      if (window.LabelDetector) labels = LabelDetector.detect(pdfData.map(d => d.pages));
    } catch (e) {
      console.warn('[LabelDetector] Failed to detect labels:', e.message);
    }
    if (gen !== labelDetectGen) return;
    state.detectedLabels = labels;
    syncDetectedLabelsUI();
  }

  function editKeyword(idx) {
    const current = state.keywords[idx];
    const newVal = prompt('Edit keyword:', current);
    if (newVal !== null && newVal.trim()) {
      state.keywords[idx] = newVal.trim();
      UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
      updateRunBtn();
      if (window.SessionStore) SessionStore.saveKeywords(state.keywords);
    }
  }

  addKeywordBtn.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keydown', e => { if (e.key === 'Enter') addKeyword(); });

  // ===== RUN BUTTON =====

  function updateRunBtn() {
    if (!state.mode || state.files.length === 0) { UIManager.setRunEnabled(false); return; }
    const noKwModes = ['extractall','tablemode','compressmode','splitmode','toexcel','toword',
                       'toppt','tojpg','enhancemode','lockmode','mergemode',
                       'watermarkmode','wordtopdf','exceltopdf','ppttopdf','sortmergemode'];
    if (noKwModes.includes(state.mode)) {
      UIManager.setRunEnabled(state.mode === 'mergemode' ? state.files.length >= 2 : true);
      return;
    }
    UIManager.setRunEnabled(state.keywords.length > 0);
  }

  // ===== TABLE WARNING MODAL =====

  function showTableWarningModal() {
    return new Promise(resolve => {
      const overlay  = document.getElementById('tableWarnOverlay');
      const btnOk    = document.getElementById('tableWarnOk');
      const btnProceed = document.getElementById('tableWarnProceed');
      overlay.classList.remove('tw-closing');
      overlay.style.display = 'flex';
      function closeModal(result) {
        btnOk.removeEventListener('click', onOk);
        btnProceed.removeEventListener('click', onProceed);
        overlay.classList.add('tw-closing');
        overlay.addEventListener('animationend', () => {
          overlay.style.display = 'none'; overlay.classList.remove('tw-closing'); resolve(result);
        }, { once: true });
      }
      const onOk = () => closeModal('ok');
      const onProceed = () => closeModal('proceed');
      btnOk.addEventListener('click', onOk);
      btnProceed.addEventListener('click', onProceed);
    });
  }

  // ===== MERGE ORDER PANEL =====

  // Reconciles state.mergeOrder against the current state.files array:
  // drops indices for files that no longer exist, and appends indices
  // for files that were added after merge mode was already entered
  // (in the order they were added). Existing order/positions for
  // already-tracked files are preserved untouched.
  function syncMergeOrder() {
    state.mergeOrder = state.mergeOrder.filter(i => i < state.files.length);
    const tracked = new Set(state.mergeOrder);
    for (let i = 0; i < state.files.length; i++) {
      if (!tracked.has(i)) state.mergeOrder.push(i);
    }
  }

  function renderMergeOrder() {
    const panel = document.getElementById('mergeOrderList');
    if (!panel) return;
    syncMergeOrder();
    panel.innerHTML = '';
    state.mergeOrder.forEach((fileIdx, orderPos) => {
      const file = state.files[fileIdx];
      if (!file) return;
      const row = document.createElement('div');
      row.className = 'merge-row';
      row.draggable = true;
      row.dataset.pos = orderPos;
      row.innerHTML = `
        <span class="merge-drag-handle">⠿</span>
        <span class="merge-order-num">${orderPos + 1}</span>
        <span class="merge-filename" title="${file.name}">${file.name}</span>
        <button class="merge-up-btn" title="Move up" ${orderPos === 0 ? 'disabled' : ''}>↑</button>
        <button class="merge-dn-btn" title="Move down" ${orderPos === state.mergeOrder.length - 1 ? 'disabled' : ''}>↓</button>
      `;
      row.querySelector('.merge-up-btn').addEventListener('click', () => {
        if (orderPos > 0) { [state.mergeOrder[orderPos], state.mergeOrder[orderPos-1]] = [state.mergeOrder[orderPos-1], state.mergeOrder[orderPos]]; renderMergeOrder(); }
      });
      row.querySelector('.merge-dn-btn').addEventListener('click', () => {
        if (orderPos < state.mergeOrder.length - 1) { [state.mergeOrder[orderPos], state.mergeOrder[orderPos+1]] = [state.mergeOrder[orderPos+1], state.mergeOrder[orderPos]]; renderMergeOrder(); }
      });
      // Drag-to-reorder
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', orderPos); row.classList.add('merge-row--dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('merge-row--dragging'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('merge-row--over'); });
      row.addEventListener('dragleave', () => row.classList.remove('merge-row--over'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('merge-row--over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to   = orderPos;
        if (from !== to) {
          const moved = state.mergeOrder.splice(from, 1)[0];
          state.mergeOrder.splice(to, 0, moved);
          renderMergeOrder();
        }
      });
      panel.appendChild(row);
    });
  }

  // ===== SORT & MERGE PANEL =====

  const smToggleAuto   = document.getElementById('smToggleAuto');
  const smToggleManual = document.getElementById('smToggleManual');
  const smPaneAuto      = document.getElementById('smPaneAuto');
  const smPaneManual    = document.getElementById('smPaneManual');
  const smScanBtn       = document.getElementById('smScanBtn');
  const smAddManualBtn  = document.getElementById('smAddManualGroupBtn');
  const smManualInput   = document.getElementById('smManualKeywordInput');

  // Toggle between Auto-Detect and Manual panes — purely visual, does not
  // clear any groups already found, so switching back and forth keeps
  // everything the user has built up so far.
  function setSortMergeToggle(mode) {
    state.sortMode = mode;
    if (smToggleAuto)   smToggleAuto.classList.toggle('sm-toggle-btn--active', mode === 'auto');
    if (smToggleManual) smToggleManual.classList.toggle('sm-toggle-btn--active', mode === 'manual');
    if (smPaneAuto)      smPaneAuto.classList.toggle('sm-pane--active', mode === 'auto');
    if (smPaneManual)    smPaneManual.classList.toggle('sm-pane--active', mode === 'manual');
  }
  if (smToggleAuto)   smToggleAuto.addEventListener('click', () => setSortMergeToggle('auto'));
  if (smToggleManual) smToggleManual.addEventListener('click', () => setSortMergeToggle('manual'));

  // Re-renders the shared group checklist from current state — called
  // after every scan, add, rename, remove, or checkbox toggle.
  function renderSortMergeGroups() {
    UIManager.renderSortMergeGroups(state.sortGroups, state.sortSelectedIds, {
      onToggle: (groupId, checked) => {
        if (checked) state.sortSelectedIds.add(groupId);
        else state.sortSelectedIds.delete(groupId);
        renderSortMergeGroups();
      },
      onRename: (groupId, newLabel) => {
        state.sortGroups = TypeSorter.renameGroup(state.sortGroups, groupId, newLabel);
        renderSortMergeGroups();
      },
      onRemove: (groupId) => {
        state.sortGroups = TypeSorter.removeGroup(state.sortGroups, groupId);
        state.sortSelectedIds.delete(groupId);
        renderSortMergeGroups();
      },
    });
  }

  // Scans every uploaded PDF and replaces any existing AUTO groups with
  // freshly detected ones. Manual groups the user already added are left
  // untouched — re-scanning is meant to refresh auto-detection only.
  if (smScanBtn) smScanBtn.addEventListener('click', async () => {
    if (state.files.length === 0) { showUploadNote('⚠ Upload PDFs first before scanning.', 'warn'); return; }
    smScanBtn.disabled = true;
    const originalText = smScanBtn.textContent;
    smScanBtn.textContent = '⬡ Scanning…';
    try {
      const pdfData = await PDFProcessor.extractAll(state.files);
      const autoGroups = TypeSorter.autoDetectGroups(pdfData);
      const manualGroups = state.sortGroups.filter(g => g.mode === 'manual');
      state.sortGroups = [...autoGroups, ...manualGroups];
      // Keep prior selections only for groups that still exist after rescan
      const stillExists = new Set(state.sortGroups.map(g => g.id));
      state.sortSelectedIds = new Set([...state.sortSelectedIds].filter(id => stillExists.has(id)));
      renderSortMergeGroups();
      updateRunBtn();
    } catch (e) {
      console.error('[Sort & Merge] Scan failed:', e.message);
      showUploadNote('⚠ Scan failed — see console for details.', 'error');
    } finally {
      smScanBtn.disabled = false;
      smScanBtn.textContent = originalText;
    }
  });

  // Adds one manual group from the keyword textfield. Re-scans every
  // uploaded file's already-cached text is not needed here — TypeSorter
  // re-extracts pages itself so this works even before Auto-Detect ran.
  async function addManualSortGroup() {
    const keyword = (smManualInput?.value || '').trim();
    if (!keyword) return;
    if (state.files.length === 0) { showUploadNote('⚠ Upload PDFs first.', 'warn'); return; }
    if (smAddManualBtn) smAddManualBtn.disabled = true;
    try {
      const pdfData = await PDFProcessor.extractAll(state.files);
      state.sortGroups = TypeSorter.addManualGroup(state.sortGroups, keyword, pdfData);
      if (smManualInput) smManualInput.value = '';
      renderSortMergeGroups();
      updateRunBtn();
    } catch (e) {
      console.error('[Sort & Merge] Add manual group failed:', e.message);
      showUploadNote('⚠ Could not add group — see console for details.', 'error');
    } finally {
      if (smAddManualBtn) smAddManualBtn.disabled = false;
    }
  }
  if (smAddManualBtn) smAddManualBtn.addEventListener('click', addManualSortGroup);
  if (smManualInput) smManualInput.addEventListener('keydown', e => { if (e.key === 'Enter') addManualSortGroup(); });

  // ===== RUN EXTRACTION =====

  runBtn.addEventListener('click', runExtraction);

  async function runExtraction() {
    if (state.files.length === 0 || !state.mode) return;

    const labels = {
      compressmode:'Preparing compression…', splitmode:'Preparing split…',
      toexcel:'Preparing Excel conversion…', toword:'Preparing Word conversion…',
      toppt:'Preparing PowerPoint conversion…', tojpg:'Preparing JPG conversion…',
      enhancemode:'Preparing enhancement…', lockmode:'Preparing PDF lock…',
      mergemode:'Preparing merge…', watermarkmode:'Applying watermark…',
      wordtopdf:'Converting Word to PDF…', exceltopdf:'Converting Excel to PDF…',
      ppttopdf:'Converting PPT to PDF…',
    };
    UIManager.setRunning(true);
    UIManager.setProgress(0, labels[state.mode] || 'Phase 1 · Pre-reading PDFs…');
    document.getElementById('resultsContainer').style.display = 'none';
    UIManager.clearPerFileStatus();
    if (window.StarField) window.StarField.startWarp();

    try {

      // ── Compress ─────────────────────────────────────────────────────────
      if (state.mode === 'compressmode') {
        UIManager.setProgress(20, 'Compressing PDFs…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFCompressor.compress(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Compressing — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderCompressResults(res);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Split ─────────────────────────────────────────────────────────────
      if (state.mode === 'splitmode') {
        const file = state.files[0];
        if (!file) throw new Error('Upload a PDF first.');
        const tab = document.querySelector('.scp-tab--active');
        const config = {
          mode:   tab ? tab.dataset.scp : 'every',
          every:  parseInt(document.getElementById('scpEveryN')?.value || '1', 10),
          ranges: document.getElementById('scpRangeInput')?.value || '',
        };
        UIManager.setProgress(15, 'Reading PDF pages…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFSplitter.split(file, config, (done, total) => {
          UIManager.setProgress(15 + Math.round((done/total)*80), `Splitting — page ${done}/${total}…`);
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderSplitResults(res, file);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Merge ─────────────────────────────────────────────────────────────
      if (state.mode === 'mergemode') {
        if (state.files.length < 2) throw new Error('Upload at least 2 PDFs to merge.');
        UIManager.setProgress(10, 'Merging PDFs…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFMerge.merge(state.files, state.mergeOrder, (rendered, total, fname, fi, ft) => {
          UIManager.setProgress(10 + Math.round((rendered/total)*85), `Merging file ${fi}/${ft}: ${fname}…`);
          UIManager.setPerFileStatus(state.files, fi - 1, 'processing', state.mergeOrder);
        });
        UIManager.setProgress(100, 'Done!');
        UIManager.renderMergeResult(res, state.files, state.mergeOrder);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Sort & Merge ─────────────────────────────────────────────────────
      if (state.mode === 'sortmergemode') {
        if (state.sortGroups.length === 0) throw new Error('Scan or add at least one type before running.');

        UIManager.setProgress(5, 'Preparing Sort & Merge…');
        await new Promise(r => setTimeout(r, 30));

        const selectedGroups = state.sortGroups.filter(g => state.sortSelectedIds.has(g.id) && g.files.length > 0);
        const mergedOutputs  = [];
        const totalGroups    = selectedGroups.length;

        for (let gi = 0; gi < selectedGroups.length; gi++) {
          const group = selectedGroups[gi];
          const baseProgress = 5 + Math.round((gi / Math.max(totalGroups, 1)) * 70);
          UIManager.setProgress(baseProgress, `Merging "${group.label}" (${gi + 1}/${totalGroups})…`);
          const res = await PDFMerge.merge(group.files, group.files.map((_, i) => i), (rendered, total, fname) => {
            const groupProgress = baseProgress + Math.round((rendered / total) * (70 / Math.max(totalGroups, 1)));
            UIManager.setProgress(groupProgress, `Merging "${group.label}": ${fname}…`);
          });
          const safeLabel = RenameHandler.sanitizeFilename(group.label) || `type_${gi + 1}`;
          mergedOutputs.push({
            groupLabel: group.label,
            blob:       res.blob,
            filename:   `${safeLabel}_merged.pdf`,
            totalPages: res.totalPages,
          });
        }

        UIManager.setProgress(80, 'Preparing rename for remaining files…');
        await new Promise(r => setTimeout(r, 30));

        // Files not claimed by any SELECTED group go through the rename flow
        const unassignedFiles = TypeSorter.getUnassignedFiles(state.sortGroups, state.files, [...state.sortSelectedIds]);
        let renameInfo = null;
        if (unassignedFiles.length > 0) {
          const renameKeyword = (document.getElementById('smRenameKeywordInput')?.value || '').trim();
          let renameMap = new Map(); // empty map → RenameHandler keeps original filenames
          if (renameKeyword) {
            const unassignedPdfData = await PDFProcessor.extractAll(unassignedFiles);
            const searchFn = (window.KeywordHandler?.searchEnhanced)
              ? KeywordHandler.searchEnhanced.bind(KeywordHandler)
              : KeywordHandler.search.bind(KeywordHandler);
            const results = searchFn(unassignedPdfData, [renameKeyword], {});
            renameMap = RenameHandler.buildRenameMap(results);
          }
          renameInfo = {
            count: unassignedFiles.length,
            onDownload: () => RenameHandler.downloadRenamed(unassignedFiles, renameMap, () => {}),
          };
        }

        UIManager.setProgress(100, 'Done!');
        UIManager.renderSortMergeResult(mergedOutputs, renameInfo);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Convert to Excel ──────────────────────────────────────────────────
      if (state.mode === 'toexcel') {
        UIManager.setProgress(20, 'Converting to Excel…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFToExcel.convert(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Converting — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderConversionResults(res, 'toexcel');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Convert to Word ───────────────────────────────────────────────────
      if (state.mode === 'toword') {
        UIManager.setProgress(20, 'Converting to Word…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFToWord.convert(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Converting — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderConversionResults(res, 'toword');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Convert to PPT ────────────────────────────────────────────────────
      if (state.mode === 'toppt') {
        UIManager.setProgress(15, 'Rendering pages…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFToPPT.convert(state.files, (done, total) => {
          UIManager.setProgress(15 + Math.round((done/total)*80), `Converting — ${done}/${total}…`);
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderConversionResults(res, 'toppt');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Convert to JPG ────────────────────────────────────────────────────
      if (state.mode === 'tojpg') {
        UIManager.setProgress(15, 'Rendering pages to images…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFToJPG.convert(state.files, (done, total) => {
          UIManager.setProgress(15 + Math.round((done/total)*80), `Rendering — ${done}/${total}…`);
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderConversionResults(res, 'tojpg');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Enhance ───────────────────────────────────────────────────────────
      if (state.mode === 'enhancemode') {
        UIManager.setProgress(20, 'Enhancing PDFs…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFEnhancer.enhance(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Enhancing — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!'); UIManager.renderEnhanceResults(res);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Lock ──────────────────────────────────────────────────────────────
      if (state.mode === 'lockmode') {
        UIManager.setProgress(20, 'Preparing lock…');
        await new Promise(r => setTimeout(r, 30));
        const lockResults = state.files.map(file => ({
          file, filename: file.name.replace(/\.pdf$/i,'') + '_locked.pdf', blob: null, pending: true
        }));
        UIManager.setProgress(100, 'Done! Set passwords below.');
        UIManager.renderLockResults(lockResults);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Watermark ─────────────────────────────────────────────────────────
      if (state.mode === 'watermarkmode') {
        UIManager.setProgress(20, 'Applying watermark to PDFs…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PDFWatermark.apply(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Watermarking — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!');
        UIManager.renderConversionResults(res, 'watermarkmode');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Word to PDF ───────────────────────────────────────────────────────
      if (state.mode === 'wordtopdf') {
        UIManager.setProgress(20, 'Converting Word to PDF…');
        await new Promise(r => setTimeout(r, 30));
        const res = await WordToPDF.convert(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Converting — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!');
        UIManager.renderConversionResults(res, 'wordtopdf');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Excel to PDF ──────────────────────────────────────────────────────
      if (state.mode === 'exceltopdf') {
        UIManager.setProgress(20, 'Converting Excel to PDF…');
        await new Promise(r => setTimeout(r, 30));
        const res = await ExcelToPDF.convert(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Converting — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!');
        UIManager.renderConversionResults(res, 'exceltopdf');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── PPT to PDF ────────────────────────────────────────────────────────
      if (state.mode === 'ppttopdf') {
        UIManager.setProgress(20, 'Converting PPT to PDF…');
        await new Promise(r => setTimeout(r, 30));
        const res = await PPTToPDF.convert(state.files, (done, total) => {
          UIManager.setProgress(20 + Math.round((done/total)*75), `Converting — ${done}/${total}…`);
          UIManager.setPerFileStatus(state.files, done - 1, 'done');
        });
        UIManager.setProgress(100, 'Done!');
        UIManager.renderConversionResults(res, 'ppttopdf');
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return;
      }

      // ── Phase 1: PDF text extraction ─────────────────────────────────────
      const pdfData = await PDFProcessor.extractAll(state.files, (done, total) => {
        const maxPct = state.ocrEnabled ? 35 : 45;
        UIManager.setProgress(Math.round((done/total)*maxPct), `Phase 1 · Reading — ${done}/${total} file(s)…`);
        UIManager.setPerFileStatus(state.files, done - 1, 'done');
      });
      state.lastPdfData = pdfData;

      // ── Phase 1.5: OCR fallback ───────────────────────────────────────────
      if (state.ocrEnabled && window.PDFOcr) {
        UIManager.setProgress(45, 'Phase 1.5 · OCR scanning image pages…');
        await new Promise(r => setTimeout(r, 30));
        try {
          await PDFOcr.loadTesseract();
          if (PDFOcr.isAvailable()) {
            let ocrDone = 0;
            const totalPgs = pdfData.reduce((s, d) => s + d.pages.length, 0);
            for (const entry of pdfData) {
              const enhanced = await PDFOcr.ocrFile(entry.file, entry.pages, (done) => {
                ocrDone++;
                UIManager.setProgress(45 + Math.round((ocrDone/totalPgs)*20), `OCR — page ${ocrDone}/${totalPgs}…`);
              });
              const n = enhanced.filter(p => p.ocrApplied).length;
              if (n > 0) entry.pages = enhanced;
            }
          }
        } catch(e) { console.warn('[OCR] Failed:', e); }
      }

      // ── Extract All ───────────────────────────────────────────────────────
      if (state.mode === 'extractall') {
        UIManager.setProgress(100, 'Done!');
        const enriched = window.ExtractAll ? ExtractAll.process(pdfData) : pdfData;
        UIManager.renderExtractAll(enriched);

      // ── Table Mode ────────────────────────────────────────────────────────
      } else if (state.mode === 'tablemode') {
        UIManager.setProgress(70, 'Parsing transaction rows…');
        await new Promise(r => setTimeout(r, 30));
        const rows = TableParser.parse(pdfData);
        UIManager.setProgress(100, 'Done!');
        UIManager.renderTableResults(rows, state.files);

      // ── Keyword search ────────────────────────────────────────────────────
      } else if (state.mode === 'multiple' || state.mode === 'single') {
        const hasTable = TableParser.detectTable(pdfData);
        if (hasTable) {
          if (window.StarField) window.StarField.stopWarp();
          UIManager.setRunning(false); UIManager.hideProgress();
          const choice = await showTableWarningModal();
          if (choice === 'ok') {
            // Animated reset
            state.mode = null; state.keywords = []; state.lastResults = null; state.lastPdfData = null;
            const chips = document.querySelectorAll('.keyword-chip');
            chips.forEach((chip, i) => { chip.style.animationDelay = `${i*35}ms`; chip.classList.add('chip-wiping'); });
            const rc = document.getElementById('resultsContainer');
            if (rc.style.display !== 'none') rc.classList.add('results-folding');
            stepResults.classList.add('step-folding');
            stepResults.addEventListener('animationend', () => {
              stepResults.classList.remove('step-folding');
              rc.classList.remove('results-folding'); rc.style.display = 'none';
              document.getElementById('resultsList').innerHTML = '';
              document.getElementById('resultsActions').innerHTML = '';
              UIManager.hideProgress(); UIManager.setRunEnabled(false);
              stepResults.classList.add('disabled-card','step-settling'); stepResults.classList.remove('active');
              stepResults.addEventListener('animationend', () => stepResults.classList.remove('step-settling'), { once: true });
            }, { once: true });
            setTimeout(() => {
              stepKeywords.classList.add('step-folding');
              stepKeywords.addEventListener('animationend', () => {
                stepKeywords.classList.remove('step-folding');
                keywordInput.value = ''; document.getElementById('keywordChips').innerHTML = '';
                document.getElementById('keywordHint').textContent = '';
                document.getElementById('keywordInputArea').style.display = 'flex';
                stepKeywords.classList.add('disabled-card','step-settling'); stepKeywords.classList.remove('active');
                stepKeywords.addEventListener('animationend', () => stepKeywords.classList.remove('step-settling'), { once: true });
              }, { once: true });
            }, 120);
            setTimeout(() => {
              UIManager.setModeButtonsVisible(true);
              document.getElementById('modeDisplay').style.display = 'none';
              document.querySelector('.mode-buttons').style.display = 'grid';
            }, 480);
            return;
          }
          if (window.StarField) window.StarField.startWarp();
          UIManager.setRunning(true);
        }

        const skipTables = hasTable;
        // Use enhanced search (supports negative keywords + multi-line continuation)
        const searchFn = (window.KeywordHandler?.searchEnhanced)
          ? KeywordHandler.searchEnhanced.bind(KeywordHandler)
          : KeywordHandler.search.bind(KeywordHandler);

        if (state.mode === 'multiple') {
          UIManager.setProgress(50, 'Phase 2 · Pass 1 — scouting positions…');
          await new Promise(r => setTimeout(r, 30));
          UIManager.setProgress(70, 'Phase 2 · Pass 2 — capturing values…');
          await new Promise(r => setTimeout(r, 30));
          const results = searchFn(pdfData, state.keywords, { skipTables });
          state.lastResults = results;
          UIManager.setProgress(100, 'Done!');
          UIManager.renderKeywordResults(results, state.keywords, state.files);
          if (window.SessionStore) SessionStore.saveResultsMeta(results, 'multiple');
        } else {
          UIManager.setProgress(50, 'Phase 2 · Pass 1 — scouting position…');
          await new Promise(r => setTimeout(r, 30));
          UIManager.setProgress(70, 'Phase 2 · Pass 2 — capturing value…');
          await new Promise(r => setTimeout(r, 30));
          const results = searchFn(pdfData, state.keywords, { skipTables });
          state.lastResults = results;
          const renameMap = RenameHandler.buildRenameMap(results);
          UIManager.setProgress(100, 'Done!');
          UIManager.renderSingleKeywordResults(results, state.keywords[0], state.files, renameMap);
          if (window.SessionStore) SessionStore.saveResultsMeta(results, 'single');
        }
      }

      setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);

    } catch (err) {
      console.error(err);
      document.getElementById('resultsContainer').style.display = 'block';
      document.getElementById('resultsList').innerHTML =
        `<div class="no-results" style="color:var(--danger);">Error: ${err.message}</div>`;
    } finally {
      if (window.StarField) window.StarField.stopWarp();
      UIManager.setRunning(false);
      setTimeout(() => UIManager.hideProgress(), 1500);
    }
  }

  // ===== SPLIT CONFIG PANEL =====

  (function initSplitPanel() {
    document.querySelectorAll('.scp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.scp-tab').forEach(t => t.classList.remove('scp-tab--active'));
        document.querySelectorAll('.scp-pane').forEach(p => p.classList.remove('scp-pane--active'));
        tab.classList.add('scp-tab--active');
        const target = document.getElementById('scp' + tab.dataset.scp.charAt(0).toUpperCase() + tab.dataset.scp.slice(1));
        if (target) target.classList.add('scp-pane--active');
        updateSplitPreview();
      });
    });
    const everyInput = document.getElementById('scpEveryN');
    const rangeInput = document.getElementById('scpRangeInput');
    if (everyInput) everyInput.addEventListener('input', updateSplitPreview);
    if (rangeInput) rangeInput.addEventListener('input', updateSplitPreview);

    const overlay  = document.getElementById('splitInstrOverlay');
    const openBtn  = document.getElementById('splitInstructionBtn');
    const closeBtn = document.getElementById('splitInstrClose');
    const doneBtn  = document.getElementById('splitInstrDone');
    const backdrop = document.getElementById('splitInstrBackdrop');

    function openM()  { overlay.classList.remove('si-closing'); overlay.style.display = 'flex'; }
    function closeM() {
      overlay.classList.add('si-closing');
      overlay.addEventListener('animationend', () => { overlay.style.display = 'none'; overlay.classList.remove('si-closing'); }, { once: true });
    }
    if (openBtn)  openBtn.addEventListener('click', openM);
    if (closeBtn) closeBtn.addEventListener('click', closeM);
    if (doneBtn)  doneBtn.addEventListener('click', closeM);
    if (backdrop) backdrop.addEventListener('click', closeM);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay?.style.display !== 'none') closeM(); });
  })();

  function updateSplitPreview() {
    if (!state.files.length) return;
    PDFSplitter.pageCount(state.files[0]).then(total => {
      const everyInput   = document.getElementById('scpEveryN');
      const everyPreview = document.getElementById('scpEveryPreview');
      if (everyInput && everyPreview) {
        const n = Math.max(1, parseInt(everyInput.value, 10) || 1);
        const groups = PDFSplitter.everyNPages(n, total);
        everyPreview.textContent = `${total} pages → ${groups.length} file(s) of up to ${n} page(s) each`;
      }
      const rangeInput   = document.getElementById('scpRangeInput');
      const rangePreview = document.getElementById('scpRangePreview');
      if (rangeInput && rangePreview) {
        const str = rangeInput.value.trim();
        if (!str) { rangePreview.textContent = '— enter ranges above'; return; }
        const groups = PDFSplitter.parseRanges(str, total);
        if (!groups.length) { rangePreview.textContent = '⚠ No valid ranges'; rangePreview.style.color = 'var(--danger)'; }
        else { rangePreview.style.color = ''; rangePreview.textContent = `${groups.length} file(s): ` + groups.map(g => g.length===1?`p${g[0]}`:`p${g[0]}-${g[g.length-1]}`).join(', '); }
      }
    }).catch(() => {});
  }

  // ===== OCR TOGGLE =====

  (function initOcrToggle() {
    const toggle = document.getElementById('ocrToggle');
    if (!toggle) return;
    toggle.addEventListener('change', () => {
      state.ocrEnabled = toggle.checked;
      const label = document.getElementById('ocrToggleLabel');
      if (label) label.textContent = state.ocrEnabled ? 'OCR: ON' : 'OCR: OFF';
    });
  })();

  // ===== SESSION RESTORE =====

  (function restoreSession() {
    if (!window.SessionStore) return;
    const savedMode = SessionStore.loadMode();
    const savedKws  = SessionStore.loadKeywords();
    const age       = SessionStore.getSessionAge();

    if (!savedMode && (!savedKws || !savedKws.length)) return;

    // Show a non-intrusive session banner
    const banner = document.getElementById('sessionBanner');
    if (banner && age) {
      const noKwModes = ['extractall','tablemode','compressmode','splitmode','toexcel',
                         'toword','toppt','tojpg','enhancemode','lockmode','mergemode',
                         'watermarkmode','wordtopdf','exceltopdf','ppttopdf','sortmergemode'];
      const kwInfo = savedKws?.length && !noKwModes.includes(savedMode)
        ? ` · ${savedKws.length} keyword(s)`
        : '';
      banner.querySelector('.sb-text').textContent =
        `Last session (${age})${savedMode ? ': ' + savedMode : ''}${kwInfo}`;
      banner.style.display = 'flex';
      banner.querySelector('.sb-restore').addEventListener('click', () => {
        banner.style.display = 'none';
        if (savedMode && state.files.length > 0) {
          selectMode(savedMode);
          if (savedKws?.length && !noKwModes.includes(savedMode)) {
            state.keywords = savedKws;
            UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, savedMode);
            updateRunBtn();
          }
        }
      });
      banner.querySelector('.sb-dismiss').addEventListener('click', () => {
        banner.style.display = 'none';
        SessionStore.clear();
      });
    }
  })();

  // ===== INIT =====
  document.getElementById('step-mode').classList.add('disabled-card');
  stepKeywords.classList.add('disabled-card');
  stepResults.classList.add('disabled-card');

})();