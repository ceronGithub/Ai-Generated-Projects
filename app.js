// =============================================
// app.js — Main application logic / state
// =============================================

(() => {

  // ===== STATE =====
  const state = {
    files: [],            // File objects
    mode: null,           // 'multiple' | 'single' | 'extractall' | 'tablemode'
    keywords: [],         // string[]
    lastResults: null,    // last keyword search results
    lastPdfData: null,    // last extraction data
    lastTableRows: null,  // last table-mode parsed rows
  };

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

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });
  dropZone.addEventListener('click', e => {
    if (e.target === dropZone || e.target.classList.contains('drop-icon') ||
        e.target.classList.contains('drop-title') || e.target.classList.contains('drop-sub')) {
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => {
    addFiles([...fileInput.files]);
    fileInput.value = '';
  });
  deleteAllBtn.addEventListener('click', () => {
    state.files = [];
    refreshFileList();
  });

  const MAX_FILES = 2000;

  function addFiles(incoming) {
    const pdfs = incoming.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    const existing = new Set(state.files.map(f => f.name + f.size));
    const newFiles = pdfs.filter(f => !existing.has(f.name + f.size));

    const available = MAX_FILES - state.files.length;

    if (available <= 0) {
      showUploadNote(`⛔ Limit reached — max ${MAX_FILES.toLocaleString()} PDF files allowed.`, 'error');
      return;
    }

    const accepted = newFiles.slice(0, available);
    const rejected = newFiles.length - accepted.length;

    state.files.push(...accepted);
    refreshFileList();

    if (rejected > 0) {
      showUploadNote(`⚠ ${rejected} file${rejected !== 1 ? 's' : ''} skipped — max ${MAX_FILES.toLocaleString()} file limit reached.`, 'warn');
    } else if (accepted.length > 0) {
      showUploadNote(`✓ ${accepted.length} file${accepted.length !== 1 ? 's' : ''} added.`, 'ok');
    }

    if (state.files.length > 0) {
      UIManager.activateStep('step-mode');
    }
  }

  function showUploadNote(msg, type) {
    const el = document.getElementById('uploadNote');
    if (!el) return;
    const colors = { ok: 'var(--green)', warn: 'var(--gold)', error: 'var(--danger)' };
    el.textContent = msg;
    el.style.color = colors[type] || colors.ok;
    el.style.opacity = '1';
    clearTimeout(el._noteTimer);
    el._noteTimer = setTimeout(() => {
      el.textContent = '⚠ Max upload is 2,000 PDF files per batch.';
      el.style.color = '';
      el.style.opacity = '';
    }, 4000);
  }

  function removeFile(idx) {
    state.files.splice(idx, 1);
    refreshFileList();
    if (state.files.length === 0) {
      document.getElementById('step-mode').classList.add('disabled-card');
      document.getElementById('step-mode').classList.remove('active');
    }
  }

  function refreshFileList() {
    UIManager.renderFileList(state.files, removeFile);
    updateRunBtn();
  }

  // ===== MODE SELECTION =====

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => selectMode(btn.dataset.mode));
  });

  changeModeBtn.addEventListener('click', () => {
    // ── Reset state immediately ──────────────────────────
    state.mode         = null;
    state.keywords     = [];
    state.lastResults  = null;
    state.lastPdfData  = null;
    state.lastTableRows = null;

    // ── Animate keyword chips wiping out ─────────────────
    const chips = document.querySelectorAll('.keyword-chip');
    chips.forEach((chip, i) => {
      chip.style.animationDelay = `${i * 35}ms`;
      chip.classList.add('chip-wiping');
    });

    // ── Animate results folding away (if visible) ────────
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer.style.display !== 'none') {
      resultsContainer.classList.add('results-folding');
    }

    // ── Step-results: fold away then settle ──────────────
    stepResults.classList.add('step-folding');
    stepResults.addEventListener('animationend', () => {
      stepResults.classList.remove('step-folding');
      resultsContainer.classList.remove('results-folding');
      resultsContainer.style.display = 'none';
      document.getElementById('resultsList').innerHTML = '';
      document.getElementById('resultsActions').innerHTML = '';
      UIManager.hideProgress();
      UIManager.setRunEnabled(false);
      stepResults.classList.add('disabled-card', 'step-settling');
      stepResults.classList.remove('active');
      stepResults.addEventListener('animationend', () => {
        stepResults.classList.remove('step-settling');
      }, { once: true });
    }, { once: true });

    // ── Step-keywords: fold with slight delay then settle ─
    setTimeout(() => {
      stepKeywords.classList.add('step-folding');
      stepKeywords.addEventListener('animationend', () => {
        stepKeywords.classList.remove('step-folding');
        keywordInput.value = '';
        document.getElementById('keywordChips').innerHTML = '';
        document.getElementById('keywordHint').textContent = '';
        document.getElementById('keywordInputArea').style.display = 'flex';
        keywordInput.placeholder = 'Type a keyword and press Enter…';
        stepKeywords.classList.add('disabled-card', 'step-settling');
        stepKeywords.classList.remove('active');
        stepKeywords.addEventListener('animationend', () => {
          stepKeywords.classList.remove('step-settling');
        }, { once: true });
      }, { once: true });
    }, 80);

    // ── Restore mode buttons after animations ────────────
    setTimeout(() => {
      UIManager.setModeButtonsVisible(true);
      document.getElementById('modeDisplay').style.display = 'none';
      document.querySelector('.mode-buttons').style.display = 'grid';
    }, 420);
  });

  function selectMode(mode) {
    state.mode     = mode;
    state.keywords = [];
    UIManager.setModeSelected(mode);
    UIManager.setModeButtonsVisible(false);

    document.getElementById('modeDisplay').style.display = 'flex';
    document.querySelector('.mode-buttons').style.display = 'none';
    UIManager.setModeSelected(mode);

    UIManager.activateStep('step-keywords');
    UIManager.activateStep('step-results');

    UIManager.setKeywordSectionMode(mode);
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, mode);

    document.getElementById('resultsContainer').style.display = 'none';
    UIManager.hideProgress();

    updateRunBtn();
  }

  // ===== KEYWORDS =====

  function smartCapKeyword(raw) {
    const clean = raw.replace(/[''‛'']/g, '');
    const letters = clean.replace(/[^a-zA-Z]/g, '');
    if (!letters) return clean;
    if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return clean;
    return clean.split(' ').map(word => {
      if (!word) return word;
      let result = '', foundFirst = false;
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
    const val = smartCapKeyword(raw);
    if (state.mode === 'single') {
      state.keywords = [val];
    } else {
      if (!state.keywords.includes(val)) state.keywords.push(val);
    }
    keywordInput.value = '';
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
    updateRunBtn();
  }

  function removeKeyword(idx) {
    state.keywords.splice(idx, 1);
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
    updateRunBtn();
  }

  function editKeyword(idx) {
    const current = state.keywords[idx];
    const newVal = prompt('Edit keyword:', current);
    if (newVal !== null && newVal.trim()) {
      state.keywords[idx] = newVal.trim();
      UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, state.mode);
      updateRunBtn();
    }
  }

  addKeywordBtn.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keydown', e => { if (e.key === 'Enter') addKeyword(); });

  // ===== RUN BUTTON STATE =====

  function updateRunBtn() {
    if (!state.mode || state.files.length === 0) { UIManager.setRunEnabled(false); return; }
    // These modes need no keywords — enable Run immediately once files are loaded
    if (state.mode === 'extractall' || state.mode === 'tablemode') {
      UIManager.setRunEnabled(true);
      return;
    }
    UIManager.setRunEnabled(state.keywords.length > 0);
  }

  // ===== RUN EXTRACTION =====

  runBtn.addEventListener('click', runExtraction);

  async function runExtraction() {
    if (state.files.length === 0 || !state.mode) return;

    UIManager.setRunning(true);
    UIManager.setProgress(0, 'Phase 1 · Pre-reading PDFs and marking text locations…');
    document.getElementById('resultsContainer').style.display = 'none';

    // 🚀 Engage warp drive!
    if (window.StarField) window.StarField.startWarp();

    try {
      // ── Phase 1: Read all PDFs ──────────────────────────────────────────
      const pdfData = await PDFProcessor.extractAll(state.files, (done, total) => {
        const pct = Math.round((done / total) * 45);
        UIManager.setProgress(pct, `Phase 1 · Marking text locations — ${done}/${total} file(s)…`);
      });

      state.lastPdfData = pdfData;

      if (state.mode === 'extractall') {
        UIManager.setProgress(100, 'Done!');
        UIManager.renderExtractAll(pdfData);

      } else if (state.mode === 'tablemode') {
        // ── Table Mode: parse structured transaction rows ─────────────
        UIManager.setProgress(55, 'Phase 2 · Parsing transaction table rows…');
        await new Promise(r => setTimeout(r, 30)); // yield so UI paints
        const tableRows = TableParser.parse(pdfData);
        state.lastTableRows = tableRows;
        UIManager.setProgress(100, 'Done!');
        UIManager.renderTableResults(tableRows, state.files);

      } else if (state.mode === 'multiple') {
        UIManager.setProgress(50, 'Phase 2 · Pass 1 — scouting keyword positions…');
        await new Promise(r => setTimeout(r, 30));
        UIManager.setProgress(70, 'Phase 2 · Pass 2 — capturing second-run values…');
        await new Promise(r => setTimeout(r, 30));
        const results = KeywordHandler.search(pdfData, state.keywords);
        state.lastResults = results;
        UIManager.setProgress(100, 'Done!');
        UIManager.renderKeywordResults(results, state.keywords, state.files);

      } else if (state.mode === 'single') {
        UIManager.setProgress(50, 'Phase 2 · Pass 1 — scouting keyword position…');
        await new Promise(r => setTimeout(r, 30));
        UIManager.setProgress(70, 'Phase 2 · Pass 2 — capturing second-run value…');
        await new Promise(r => setTimeout(r, 30));
        const results = KeywordHandler.search(pdfData, state.keywords);
        state.lastResults = results;
        const renameMap = RenameHandler.buildRenameMap(results);
        UIManager.setProgress(100, 'Done!');
        UIManager.renderSingleKeywordResults(results, state.keywords[0], state.files, renameMap);
      }

      // Scroll to results
      setTimeout(() => {
        stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);

    } catch (err) {
      console.error(err);
      document.getElementById('resultsContainer').style.display = 'block';
      document.getElementById('resultsList').innerHTML =
        `<div class="no-results" style="color:var(--danger);">Error: ${err.message}</div>`;
    } finally {
      // 🛑 Drop out of warp
      if (window.StarField) window.StarField.stopWarp();
      UIManager.setRunning(false);
      setTimeout(() => UIManager.hideProgress(), 1500);
    }
  }

  // ===== INIT =====
  // Steps 3 & 4 start disabled
  stepKeywords.classList.add('disabled-card');
  stepResults.classList.add('disabled-card');

})();