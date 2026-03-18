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
  // ===== RESET — fires whenever all files are removed ======================
  // Disables steps 02, 03, 04 and clears all related state so the user must
  // re-upload before continuing.

  function resetToEmpty() {
    // Clear state
    state.mode        = null;
    state.keywords    = [];
    state.lastResults = null;
    state.lastPdfData = null;

    // Disable steps 02 → 04
    UIManager.deactivateStep('step-mode');
    UIManager.deactivateStep('step-keywords');
    UIManager.deactivateStep('step-results');

    // Reset mode UI back to button grid
    UIManager.setModeButtonsVisible(true);
    document.getElementById('modeDisplay').style.display   = 'none';

    // Clear keyword chips + input
    keywordInput.value = '';
    document.getElementById('keywordChips').innerHTML      = '';
    document.getElementById('keywordHint').textContent     = '';
    document.getElementById('keywordInputArea').style.display = 'flex';

    // Hide results
    const rc = document.getElementById('resultsContainer');
    rc.style.display = 'none';
    document.getElementById('resultsList').innerHTML   = '';
    document.getElementById('resultsActions').innerHTML = '';
    UIManager.hideProgress();
    UIManager.setRunEnabled(false);
  }

  deleteAllBtn.addEventListener('click', () => {
    state.files = [];
    refreshFileList();
    resetToEmpty();
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
      if (state.mode === 'splitmode') updateSplitPreview();
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
      resetToEmpty();
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

    // ── Step-split (03.1): fold away if visible ───
    const stepSplit = document.getElementById('step-split');
    if (stepSplit && stepSplit.style.display !== 'none') {
      setTimeout(() => {
        stepSplit.classList.add('step-folding');
        stepSplit.addEventListener('animationend', () => {
          stepSplit.classList.remove('step-folding');
          stepSplit.style.display = 'none';
          stepSplit.classList.add('disabled-card');
          stepSplit.classList.remove('active');
        }, { once: true });
      }, 50);
    }

    // ── Step-keywords: fold away with slight delay then settle ──
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
    }, 120);

    // ── Show mode buttons after animations complete ──
    setTimeout(() => {
      UIManager.setModeButtonsVisible(true);
      document.getElementById('modeDisplay').style.display = 'none';
      document.querySelector('.mode-buttons').style.display = 'grid';
    }, 480);
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

    // Handle step-split visibility
    const stepSplit = document.getElementById('step-split');
    if (mode === 'splitmode') {
      // Show step-split (03.1), keep step-keywords active but minimal
      if (stepSplit) {
        stepSplit.style.display = 'block';
        // Animate in
        stepSplit.classList.remove('disabled-card');
        stepSplit.classList.add('active', 'step-split-entering');
        stepSplit.addEventListener('animationend', () => {
          stepSplit.classList.remove('step-split-entering');
        }, { once: true });
      }
      // Activate keyword & results steps
      UIManager.activateStep('step-keywords');
      UIManager.activateStep('step-results');
    } else {
      // Hide step-split for all other modes
      if (stepSplit) {
        stepSplit.style.display = 'none';
        stepSplit.classList.add('disabled-card');
        stepSplit.classList.remove('active');
      }
      // Activate keyword & results steps
      UIManager.activateStep('step-keywords');
      UIManager.activateStep('step-results');
    }

    UIManager.setKeywordSectionMode(mode);
    UIManager.renderKeywordChips(state.keywords, removeKeyword, editKeyword, mode);

    // Hide previous results
    document.getElementById('resultsContainer').style.display = 'none';
    UIManager.hideProgress();

    updateRunBtn();

    // Trigger split preview if files already uploaded
    if (mode === 'splitmode' && state.files.length > 0) {
      setTimeout(updateSplitPreview, 100);
    }
  }

  // ===== KEYWORDS =====

  // ── Smart keyword capitalisation ────────────────────────────────────────
  // Rules:
  //   • If ALL letter characters are UPPERCASE → keep unchanged (user typed caps deliberately)
  //   • Everything else (all-lower OR mixed case) → apply Title Case word-by-word
  //   • Apostrophes/smart-quotes are stripped (PDF labels never contain them)
  //   • Non-letter characters (colons, spaces, numbers) are ignored for case detection
  function smartCapKeyword(raw) {
    // Strip apostrophes/smart-quotes first
    const clean = raw.replace(/[‘’‛'']/g, '');
    const letters = clean.replace(/[^a-zA-Z]/g, '');
    if (!letters) return clean; // no letters → return as-is

    // All letters uppercase → user deliberately typed ALL CAPS, keep unchanged
    if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
      return clean;
    }

    // All-lower OR mixed case → apply Title Case word by word
    return clean.split(' ').map(word => {
      if (!word) return word;
      let result = '';
      let foundFirst = false;
      for (const ch of word) {
        if (/[a-zA-Z]/.test(ch) && !foundFirst) {
          result += ch.toUpperCase();
          foundFirst = true;
        } else if (/[a-zA-Z]/.test(ch)) {
          result += ch.toLowerCase();
        } else {
          result += ch;
        }
      }
      return result;
    }).join(' ');
  }

  function addKeyword() {
    const raw = keywordInput.value.trim();
    if (!raw) return;
    const val = smartCapKeyword(raw);  // apply smart capitalisation on Enter

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
    if (state.mode === 'extractall' || state.mode === 'tablemode' || state.mode === 'compressmode' || state.mode === 'splitmode') {
      UIManager.setRunEnabled(true);
      return;
    }
    UIManager.setRunEnabled(state.keywords.length > 0);
  }

  // ===== TABLE-DETECTED MODAL =====

  function showTableWarningModal() {
    return new Promise(resolve => {
      const overlay    = document.getElementById('tableWarnOverlay');
      const btnOk      = document.getElementById('tableWarnOk');
      const btnProceed = document.getElementById('tableWarnProceed');
      overlay.style.display = 'flex';

      function cleanup(result) {
        btnOk.removeEventListener('click', onOk);
        btnProceed.removeEventListener('click', onProceed);
        overlay.style.display = 'none';
        resolve(result);
      }
      const onOk      = () => cleanup('ok');
      const onProceed = () => cleanup('proceed');
      btnOk.addEventListener('click', onOk);
      btnProceed.addEventListener('click', onProceed);
    });
  }

  // ===== RUN EXTRACTION =====

  runBtn.addEventListener('click', runExtraction);

  async function runExtraction() {
    if (state.files.length === 0 || !state.mode) return;

    UIManager.setRunning(true);
    UIManager.setProgress(0,
      state.mode === 'compressmode' ? 'Preparing compression…' :
      state.mode === 'splitmode'    ? 'Preparing split…' :
      'Phase 1 · Pre-reading PDFs and marking text locations…');
    document.getElementById('resultsContainer').style.display = 'none';

    // 🚀 Engage warp drive!
    if (window.StarField) window.StarField.startWarp();

    try {
      // ── Compress mode ────────────────────────────────────────────────────
      if (state.mode === 'compressmode') {
        UIManager.setProgress(20, 'Compressing PDFs…');
        await new Promise(r => setTimeout(r, 30));
        const compResults = await PDFCompressor.compress(state.files, (done, total) => {
          const pct = 20 + Math.round((done / total) * 75);
          UIManager.setProgress(pct, `Compressing — ${done}/${total} file(s)…`);
        });
        UIManager.setProgress(100, 'Done!');
        UIManager.renderCompressResults(compResults);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        return;
      }

      // ── Split mode ───────────────────────────────────────────────────────
      if (state.mode === 'splitmode') {
        const file = state.files[0];
        if (!file) throw new Error('Please upload a PDF file first.');

        // Read split config from the panel
        const activeTab  = document.querySelector('.scp-tab--active');
        const splitMode  = activeTab ? activeTab.dataset.scp : 'every';
        const everyN     = parseInt(document.getElementById('scpEveryN')?.value || '1', 10);
        const rangesStr  = document.getElementById('scpRangeInput')?.value || '';

        const config = {
          mode:   splitMode,
          every:  everyN,
          ranges: rangesStr,
        };

        UIManager.setProgress(15, 'Reading PDF pages…');
        await new Promise(r => setTimeout(r, 30));

        const splitResults = await PDFSplitter.split(file, config, (done, total) => {
          const pct = 15 + Math.round((done / total) * 80);
          UIManager.setProgress(pct, `Splitting — rendering page ${done}/${total}…`);
        });

        UIManager.setProgress(100, 'Done!');
        UIManager.renderSplitResults(splitResults, file);
        setTimeout(() => stepResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        return;
      }

      // ── Phase 1: Read all PDFs and mark every text item's location ──────
      // extractAll() now returns itemMap alongside each page's text, giving us
      // the character-level position of every PDF text token (the "marks").
      const pdfData = await PDFProcessor.extractAll(state.files, (done, total) => {
        const pct = Math.round((done / total) * 45);
        UIManager.setProgress(pct, `Phase 1 · Marking text locations — ${done}/${total} file(s)…`);
      });

      state.lastPdfData = pdfData;

      if (state.mode === 'extractall') {
        UIManager.setProgress(100, 'Done!');
        // Enrich pdfData with smart document-type detection + structured parsing
        const enriched = window.ExtractAll ? ExtractAll.process(pdfData) : pdfData;
        UIManager.renderExtractAll(enriched);

      } else if (state.mode === 'tablemode') {
        UIManager.setProgress(70, 'Parsing transaction rows…');
        await new Promise(r => setTimeout(r, 30));
        const rows = TableParser.parse(pdfData);
        UIManager.setProgress(100, 'Done!');
        UIManager.renderTableResults(rows, state.files);

      } else if (state.mode === 'multiple' || state.mode === 'single') {

        // ── Table guard: detect before running keyword search ─────────────
        const hasTable = TableParser.detectTable(pdfData);
        if (hasTable) {
          // Stop warp + progress immediately before showing modal
          if (window.StarField) window.StarField.stopWarp();
          UIManager.setRunning(false);
          UIManager.hideProgress();

          const choice = await showTableWarningModal();

          if (choice === 'ok') {
            // Reset back to mode selection cleanly
            resetToEmpty();
            return;
          }
          // choice === 'proceed': continue but skip table regions in search
          // Re-engage warp for the search phase
          if (window.StarField) window.StarField.startWarp();
          UIManager.setRunning(true);
        }

        const skipTables = hasTable;

        if (state.mode === 'multiple') {
          // ── Phase 2: Two-pass keyword search ───────────────────────────
          UIManager.setProgress(50, 'Phase 2 · Pass 1 — scouting keyword positions…');
          await new Promise(r => setTimeout(r, 30)); // yield so UI can update
          UIManager.setProgress(70, 'Phase 2 · Pass 2 — capturing second-run values…');
          await new Promise(r => setTimeout(r, 30));
          const results = KeywordHandler.search(pdfData, state.keywords, { skipTables });
          state.lastResults = results;
          UIManager.setProgress(100, 'Done!');
          UIManager.renderKeywordResults(results, state.keywords, state.files);

        } else {
          // ── Phase 2: Two-pass keyword search (single) ──────────────────
          UIManager.setProgress(50, 'Phase 2 · Pass 1 — scouting keyword position…');
          await new Promise(r => setTimeout(r, 30));
          UIManager.setProgress(70, 'Phase 2 · Pass 2 — capturing second-run value…');
          await new Promise(r => setTimeout(r, 30));
          const results = KeywordHandler.search(pdfData, state.keywords, { skipTables });
          state.lastResults = results;
          const renameMap = RenameHandler.buildRenameMap(results);
          UIManager.setProgress(100, 'Done!');
          UIManager.renderSingleKeywordResults(results, state.keywords[0], state.files, renameMap);
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

  // ===== SPLIT CONFIG PANEL =====

  (function initSplitPanel() {
    // ── Tab switching ──────────────────────────────────────────────────────
    document.querySelectorAll('.scp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.scp-tab').forEach(t => t.classList.remove('scp-tab--active'));
        document.querySelectorAll('.scp-pane').forEach(p => p.classList.remove('scp-pane--active'));
        tab.classList.add('scp-tab--active');
        const key    = tab.dataset.scp;
        const target = document.getElementById('scp' + key.charAt(0).toUpperCase() + key.slice(1));
        if (target) target.classList.add('scp-pane--active');
        updateSplitPreview();
      });
    });

    // ── Live preview on input changes ──────────────────────────────────────
    const everyInput = document.getElementById('scpEveryN');
    const rangeInput = document.getElementById('scpRangeInput');
    if (everyInput) everyInput.addEventListener('input', updateSplitPreview);
    if (rangeInput) rangeInput.addEventListener('input', updateSplitPreview);

    // ── Instruction modal ──────────────────────────────────────────────────
    const overlay    = document.getElementById('splitInstrOverlay');
    const openBtn    = document.getElementById('splitInstructionBtn');
    const closeBtn   = document.getElementById('splitInstrClose');
    const doneBtn    = document.getElementById('splitInstrDone');
    const backdrop   = document.getElementById('splitInstrBackdrop');

    function openInstrModal() {
      overlay.classList.remove('si-closing');
      overlay.style.display = 'flex';
    }

    function closeInstrModal() {
      overlay.classList.add('si-closing');
      overlay.addEventListener('animationend', () => {
        overlay.style.display = 'none';
        overlay.classList.remove('si-closing');
      }, { once: true });
    }

    if (openBtn)  openBtn.addEventListener('click',   openInstrModal);
    if (closeBtn) closeBtn.addEventListener('click',  closeInstrModal);
    if (doneBtn)  doneBtn.addEventListener('click',   closeInstrModal);
    if (backdrop) backdrop.addEventListener('click',  closeInstrModal);

    // Esc key closes modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
        closeInstrModal();
      }
    });
  })();

  function updateSplitPreview() {
    if (!state.files.length) return;
    const file = state.files[0];

    // Get page count async and update preview text
    PDFSplitter.pageCount(file).then(total => {
      // Every N preview
      const everyInput   = document.getElementById('scpEveryN');
      const everyPreview = document.getElementById('scpEveryPreview');
      if (everyInput && everyPreview) {
        const n      = Math.max(1, parseInt(everyInput.value, 10) || 1);
        const groups = PDFSplitter.everyNPages(n, total);
        everyPreview.textContent =
          `${total} pages → ${groups.length} file${groups.length !== 1 ? 's' : ''} of up to ${n} page${n !== 1 ? 's' : ''} each`;
      }

      // Ranges preview
      const rangeInput   = document.getElementById('scpRangeInput');
      const rangePreview = document.getElementById('scpRangePreview');
      if (rangeInput && rangePreview) {
        const str    = rangeInput.value.trim();
        if (!str) {
          rangePreview.textContent = '— enter ranges above';
          return;
        }
        const groups = PDFSplitter.parseRanges(str, total);
        if (groups.length === 0) {
          rangePreview.textContent = '⚠ No valid ranges — check your input';
          rangePreview.style.color = 'var(--danger)';
        } else {
          rangePreview.style.color = '';
          rangePreview.textContent =
            `${groups.length} file${groups.length !== 1 ? 's' : ''}: ` +
            groups.map(g => g.length === 1 ? `p${g[0]}` : `p${g[0]}-${g[g.length-1]}`).join(', ');
        }
      }
    }).catch(() => {});
  }

  // ===== INIT =====
  // Steps 02, 03 & 04 start disabled — only unlocked after files are uploaded
  document.getElementById('step-mode').classList.add('disabled-card');
  stepKeywords.classList.add('disabled-card');
  stepResults.classList.add('disabled-card');

})();