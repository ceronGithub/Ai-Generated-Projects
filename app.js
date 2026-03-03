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

  /**
   * Show a temporary feedback message on the upload note element.
   * type: 'ok' | 'warn' | 'error'
   */
  function showUploadNote(msg, type) {
    const el = document.getElementById('uploadNote');
    if (!el) return;

    const colors = {
      ok:    'var(--green)',
      warn:  'var(--gold)',
      error: 'var(--danger)'
    };

    el.textContent = msg;
    el.style.color = colors[type] || colors.ok;
    el.style.opacity = '1';

    // Reset back to default note after 4 seconds
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

  /**
   * Smart keyword capitalisation applied when the user confirms a keyword.
   *
   * Rules:
   *   - All letters lowercase  -> Title Case each word (first letter big, rest unchanged)
   *   - All letters uppercase  -> leave exactly as typed  (e.g. "SALES INVOICE NUMBER:")
   *   - Mixed case             -> leave exactly as typed  (user was deliberate)
   *
   * Non-letter characters (colons, spaces, numbers, punctuation) are ignored
   * when deciding which rule applies, so "invoice #:" still counts as all-lowercase.
   */
  function smartCapKeyword(raw) {
    // Strip apostrophes/smart-quotes first — users sometimes type "Sale's" but
    // PDF label text never contains apostrophes, so they only break matching.
    const clean = raw.replace(/[\u2018\u2019\u201B'']/g, '');
    const letters = clean.replace(/[^a-zA-Z]/g, '');
    if (!letters) return clean;
    const allLower = letters === letters.toLowerCase();
    if (!allLower) return clean;                       // mixed or all-upper → unchanged
    // All-lowercase → capitalise first letter of every space-separated word
    return clean.split(' ').map(word => {
      for (let i = 0; i < word.length; i++) {
        if (/[a-zA-Z]/.test(word[i])) {
          return word.slice(0, i) + word[i].toUpperCase() + word.slice(i + 1);
        }
      }
      return word;
    }).join(' ');
  }

  function addKeyword() {
    const raw = keywordInput.value.trim();
    if (!raw) return;
    const val = smartCapKeyword(raw);

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

      } else if (state.mode === 'multiple') {
        UIManager.setProgress(80, 'Searching keywords…');
        const results = KeywordHandler.search(pdfData, state.keywords);
        state.lastResults = results;
        UIManager.setProgress(100, 'Done!');
        UIManager.renderKeywordResults(results, state.keywords);

      } else if (state.mode === 'single') {
        UIManager.setProgress(80, 'Searching keyword…');
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