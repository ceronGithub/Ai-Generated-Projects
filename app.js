// =============================================
// app.js — Main application logic / state
// =============================================

(() => {

  // ===== STATE =====
  const state = {
    files: [],            // File objects
    mode: null,           // 'multiple' | 'single' | 'extractall'
    keywords: [],         // string[]
    lastResults: null,    // last search results
    lastPdfData: null,    // last extraction data
  };

  // ===== DOM REFS =====
  const dropZone     = document.getElementById('dropZone');
  const fileInput    = document.getElementById('fileInput');
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  const modeBtns     = document.querySelectorAll('.mode-btn');
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

  function addFiles(incoming) {
    const pdfs = incoming.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    const existing = new Set(state.files.map(f => f.name + f.size));
    const newFiles = pdfs.filter(f => !existing.has(f.name + f.size));
    state.files.push(...newFiles);
    refreshFileList();

    if (state.files.length > 0) {
      UIManager.activateStep('step-mode');
    }
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
    // ── Reset state immediately ───────────────────
    state.mode = null;
    state.keywords = [];
    state.lastResults = null;
    state.lastPdfData = null;

    // ── Animate keyword chips wiping out ──────────
    const chips = document.querySelectorAll('.keyword-chip');
    chips.forEach((chip, i) => {
      chip.style.animationDelay = `${i * 35}ms`;
      chip.classList.add('chip-wiping');
    });

    // ── Animate results folding away (if visible) ─
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer.style.display !== 'none') {
      resultsContainer.classList.add('results-folding');
    }

    // ── Step-results: fold away then settle ───────
    stepResults.classList.add('step-folding');
    stepResults.addEventListener('animationend', () => {
      stepResults.classList.remove('step-folding');

      // Hard reset results
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

    // ── Step-keywords: fold away with slight delay then settle ──
    setTimeout(() => {
      stepKeywords.classList.add('step-folding');
      stepKeywords.addEventListener('animationend', () => {
        stepKeywords.classList.remove('step-folding');

        // Hard reset keywords
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
    }, 80); // 80ms stagger — results folds first, then keywords

    // ── Show mode buttons after animations complete ──
    setTimeout(() => {
      UIManager.setModeButtonsVisible(true);
      document.getElementById('modeDisplay').style.display = 'none';
      document.querySelector('.mode-buttons').style.display = 'grid';
    }, 420); // after both fold animations finish
  });

  function selectMode(mode) {
    state.mode = mode;
    state.keywords = [];
    UIManager.setModeSelected(mode);
    UIManager.setModeButtonsVisible(false);

    // Show mode display
    document.getElementById('modeDisplay').style.display = 'flex';
    document.querySelector('.mode-buttons').style.display = 'none';
    UIManager.setModeSelected(mode);

    // Activate keyword & results steps
    UIManager.activateStep('step-keywords');
    UIManager.activateStep('step-results');

    UIManager.setKeywordSectionMode(mode);
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, mode);

    // Hide previous results
    document.getElementById('resultsContainer').style.display = 'none';
    UIManager.hideProgress();

    updateRunBtn();
  }

  // ===== KEYWORDS =====

  function addKeyword() {
    const val = keywordInput.value.trim();
    if (!val) return;

    if (state.mode === 'single') {
      // Only one keyword allowed
      state.keywords = [val];
    } else {
      if (!state.keywords.includes(val)) {
        state.keywords.push(val);
      }
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
  keywordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addKeyword();
  });

  // ===== RUN BUTTON STATE =====

  function updateRunBtn() {
    if (!state.mode || state.files.length === 0) {
      UIManager.setRunEnabled(false);
      return;
    }
    if (state.mode === 'extractall') {
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
    UIManager.setProgress(0, 'Reading PDF files…');
    document.getElementById('resultsContainer').style.display = 'none';

    // 🚀 Engage warp drive!
    if (window.StarField) window.StarField.startWarp();

    try {
      // Step 1: Extract all PDF pages
      const pdfData = await PDFProcessor.extractAll(state.files, (done, total) => {
        const pct = Math.round((done / total) * (state.mode === 'extractall' ? 100 : 60));
        UIManager.setProgress(pct, `Extracted ${done}/${total} file(s)…`);
      });

      state.lastPdfData = pdfData;

      if (state.mode === 'extractall') {
        UIManager.setProgress(100, 'Done!');
        UIManager.renderExtractAll(pdfData);

      } else {
        // Step 2: Search keywords
        UIManager.setProgress(70, 'Searching keywords…');
        const results = KeywordHandler.search(pdfData, state.keywords);
        state.lastResults = results;
        UIManager.setProgress(100, 'Done!');

        if (state.mode === 'multiple') {
          UIManager.renderKeywordResults(results, state.keywords);

        } else if (state.mode === 'single') {
          const keyword = state.keywords[0];
          const renameMap = RenameHandler.buildRenameMap(results);
          UIManager.renderSingleKeywordResults(results, keyword, state.files, renameMap);
        }
      }

      // Scroll to results
      setTimeout(() => {
        stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);

    } catch (err) {
      console.error(err);
      const list = document.getElementById('resultsList');
      document.getElementById('resultsContainer').style.display = 'block';
      list.innerHTML = `<div class="no-results" style="color:var(--danger);">Error: ${err.message}</div>`;
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
