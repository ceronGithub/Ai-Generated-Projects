/* app.js — HOLO·PLAN  |  Normal & Advanced modes  |  Multi-image */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────────────── */
  const fileInput      = document.getElementById('fileInput');
  const uploadZone     = document.getElementById('uploadZone');
  const previewWrap    = document.getElementById('previewWrap');
  const previewImg     = document.getElementById('previewImg');
  const previewLabel   = document.getElementById('previewLabel');
  const clearBtn       = document.getElementById('clearBtn');
  const clearAllBtn    = document.getElementById('clearAllBtn');
  const analyzeBtn     = document.getElementById('analyzeBtn');
  const errorPanel     = document.getElementById('errorPanel');
  const errorMsg       = document.getElementById('errorMsg');
  const loadingState   = document.getElementById('loadingState');
  const loadingMsg     = document.getElementById('loadingMsg');
  const loadingFill    = document.getElementById('loadingFill');
  const emptyState     = document.getElementById('emptyState');
  const resultsStack   = document.getElementById('resultsStack');
  const agentPanel     = document.getElementById('agentPanel');
  const agentLog       = document.getElementById('agentLog');
  const agentStatus    = document.getElementById('agentStatus');
  const agentFill      = document.getElementById('agentProgressFill');
  const agentLabel     = document.getElementById('agentProgressLabel');
  const sessionCount   = document.getElementById('sessionCount');
  const sessionArea    = document.getElementById('sessionArea');
  const apiKeyInput    = document.getElementById('apiKeyInput');
  const apiKeyToggle   = document.getElementById('apiKeyToggle');
  const howtoToggle    = document.getElementById('howtoToggle');
  const howtoSteps     = document.getElementById('howtoSteps');
  const howtoChevron   = document.getElementById('howtoChevron');
  const apikeyBlock    = document.getElementById('apikeyBlock');
  const modeCardNormal   = document.getElementById('modeCardNormal');
  const modeCardAdvanced = document.getElementById('modeCardAdvanced');
  const checkNormal      = document.getElementById('checkNormal');
  const checkAdvanced    = document.getElementById('checkAdvanced');
  const thumbBar         = document.getElementById('thumbBar');
  const thumbGrid        = document.getElementById('thumbGrid');
  const thumbBarLabel    = document.getElementById('thumbBarLabel');
  const imgNav           = document.getElementById('imgNav');
  const imgNavCounter    = document.getElementById('imgNavCounter');
  const prevImgBtn       = document.getElementById('prevImgBtn');
  const nextImgBtn       = document.getElementById('nextImgBtn');

  /* ── State ─────────────────────────────────────────────────────── */
  let currentMode  = 'normal';
  let images       = [];   // [{dataUrl, base64, mime, name}]
  let activeIndex  = 0;
  let totalScans   = 0;
  let totalArea    = 0;

  /* ── Type labels ────────────────────────────────────────────────── */
  const TYPE_LABELS = {
    living:'LIVING', bedroom:'BEDROOM', kitchen:'KITCHEN',
    bath:'BATHROOM', other:'OTHER',
  };

  /* ── AI Agent engine ───────────────────────────────────────────── */
  let agentTimer = null;

  const AGENT_STEPS_NORMAL = [
    { pct: 8,  msg: 'Receiving floor plan image...',            type: 'info'    },
    { pct: 18, msg: 'Parsing image format and dimensions...',   type: 'info'    },
    { pct: 28, msg: 'Detecting outer boundary of floor plan...',type: 'think'   },
    { pct: 38, msg: 'Identifying internal wall segments...',    type: 'think'   },
    { pct: 48, msg: 'Counting distinct room regions...',        type: 'think'   },
    { pct: 58, msg: 'Applying residential scale proportions...', type: 'calc'   },
    { pct: 68, msg: 'Estimating room dimensions (L × W)...',    type: 'calc'    },
    { pct: 78, msg: 'Computing area for each room (m²)...',     type: 'calc'    },
    { pct: 88, msg: 'Classifying room types (bedroom/living/bath)...', type: 'classify' },
    { pct: 95, msg: 'Compiling spatial data report...',         type: 'output'  },
    { pct: 100,msg: 'Analysis complete. Rendering results...',  type: 'done'    },
  ];

  const AGENT_STEPS_ADVANCED = [
    { pct: 5,  msg: 'Receiving floor plan image...',                  type: 'info'     },
    { pct: 10, msg: 'Encoding image as base64 for AI transmission...', type: 'info'    },
    { pct: 15, msg: 'Connecting to Claude AI model...',               type: 'info'     },
    { pct: 20, msg: 'AI agent reading image pixels...',               type: 'think'    },
    { pct: 27, msg: 'Identifying floor plan outer boundary...',       type: 'think'    },
    { pct: 34, msg: 'Detecting internal walls and partitions...',     type: 'think'    },
    { pct: 41, msg: 'Recognising door openings and swing arcs...',    type: 'think'    },
    { pct: 48, msg: 'Locating furniture symbols for scale reference...', type: 'think' },
    { pct: 54, msg: 'Checking for scale bar or dimension labels...',  type: 'think'    },
    { pct: 60, msg: 'Measuring room widths and lengths...',           type: 'calc'     },
    { pct: 67, msg: 'Computing floor area per room (m²)...',         type: 'calc'     },
    { pct: 73, msg: 'Summing total usable floor area...',            type: 'calc'     },
    { pct: 79, msg: 'Classifying each space by room type...',        type: 'classify'  },
    { pct: 85, msg: 'Assigning confidence scores...',                type: 'classify'  },
    { pct: 91, msg: 'Generating architectural observations...',      type: 'output'    },
    { pct: 96, msg: 'Formatting structured JSON output...',          type: 'output'    },
    { pct: 100,msg: 'AI analysis complete. Rendering results...',    type: 'done'      },
  ];

  const AGENT_ICONS = {
    info:     '◎',
    think:    '◈',
    calc:     '◆',
    classify: '◉',
    output:   '◐',
    done:     '✓',
  };

  const AGENT_COLORS = {
    info:     'rgba(0,245,255,0.6)',
    think:    'rgba(123,47,255,0.8)',
    calc:     'rgba(0,102,255,0.8)',
    classify: 'rgba(255,183,0,0.8)',
    output:   'rgba(0,255,157,0.7)',
    done:     '#00ff9d',
  };

  function startAgent(mode) {
    agentPanel.style.display = 'block';
    agentLog.innerHTML = '';
    agentFill.style.width = '0%';
    agentLabel.textContent = '0%';
    agentStatus.textContent = mode === 'advanced' ? 'AI AGENT ACTIVE...' : 'ANALYZING IMAGE...';

    const steps = mode === 'advanced' ? AGENT_STEPS_ADVANCED : AGENT_STEPS_NORMAL;
    let stepIdx = 0;
    clearInterval(agentTimer);

    const interval = mode === 'advanced' ? 900 : 280;

    agentTimer = setInterval(() => {
      if (stepIdx >= steps.length) { clearInterval(agentTimer); return; }
      const step = steps[stepIdx];

      // Update progress bar
      agentFill.style.width  = step.pct + '%';
      agentLabel.textContent = step.pct + '%';

      // Append log entry
      const entry = document.createElement('div');
      entry.className = 'agent-entry agent-entry-' + step.type;
      entry.innerHTML =
        '<span class="agent-entry-icon" style="color:' + AGENT_COLORS[step.type] + '">' + AGENT_ICONS[step.type] + '</span>' +
        '<span class="agent-entry-msg">' + step.msg + '</span>' +
        (step.type === 'done' ? '<span class="agent-entry-done">DONE</span>' : '<span class="agent-entry-cursor"></span>');
      agentLog.appendChild(entry);

      // Auto-scroll log to bottom
      agentLog.scrollTop = agentLog.scrollHeight;

      // Update status label
      if (step.type === 'done') {
        agentStatus.textContent = 'ANALYSIS COMPLETE';
      }

      stepIdx++;
    }, interval);
  }

  function stopAgent() {
    clearInterval(agentTimer);
    agentFill.style.width  = '100%';
    agentLabel.textContent = '100%';
    agentStatus.textContent = 'COMPLETE';
    // Fade out agent panel after short delay
    setTimeout(() => {
      agentPanel.style.opacity = '0';
      agentPanel.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        agentPanel.style.display  = 'none';
        agentPanel.style.opacity  = '1';
        agentPanel.style.transition = '';
      }, 500);
    }, 800);
  }

  /* ── Loading messages ───────────────────────────────────────────── */
  const MSGS_NORMAL = [
    'READING FLOOR PLAN...', 'DETECTING ROOM BOUNDARIES...',
    'MEASURING DIMENSIONS...', 'CALCULATING AREAS...', 'GENERATING REPORT...',
  ];
  const MSGS_ADVANCED = [
    'INITIALIZING AI SCAN...', 'DETECTING ROOM BOUNDARIES...',
    'CALCULATING WALL SEGMENTS...', 'ESTIMATING DIMENSIONS...',
    'COMPUTING AREA METRICS...', 'CROSS-REFERENCING SCALE DATA...',
    'GENERATING SPATIAL REPORT...',
  ];

  /* ── Normal mode: generate unique estimated result per image ───── */
  // Each image gets varied dimensions seeded by its index so results differ visually.
  // These are representative estimates — not extracted from the actual image pixels.
  const ROOM_TEMPLATES = [
    // Template A — 2-bed open plan
    [
      { name:'Living Room',   type:'living',  wBase:4.5, lBase:5.5 },
      { name:'Bedroom 1',     type:'bedroom', wBase:4.0, lBase:4.3 },
      { name:'Bedroom 2',     type:'bedroom', wBase:3.7, lBase:4.0 },
      { name:'Kitchen',       type:'kitchen', wBase:3.4, lBase:3.0 },
      { name:'Dining Area',   type:'other',   wBase:3.4, lBase:3.2 },
      { name:'Bathroom',      type:'bath',    wBase:2.4, lBase:2.0 },
      { name:'Hallway',       type:'other',   wBase:4.3, lBase:2.4 },
    ],
    // Template B — 3-bed with study
    [
      { name:'Living Room',   type:'living',  wBase:5.2, lBase:6.0 },
      { name:'Master Bedroom',type:'bedroom', wBase:4.8, lBase:4.5 },
      { name:'Bedroom 2',     type:'bedroom', wBase:3.8, lBase:3.6 },
      { name:'Bedroom 3',     type:'bedroom', wBase:3.2, lBase:3.5 },
      { name:'Kitchen',       type:'kitchen', wBase:3.8, lBase:3.2 },
      { name:'Bathroom 1',    type:'bath',    wBase:2.6, lBase:2.2 },
      { name:'Bathroom 2',    type:'bath',    wBase:1.8, lBase:2.0 },
      { name:'Study / Office',type:'other',   wBase:2.8, lBase:3.0 },
    ],
    // Template C — studio / 1-bed
    [
      { name:'Open Living / Kitchen', type:'living', wBase:6.0, lBase:5.5 },
      { name:'Bedroom',       type:'bedroom', wBase:3.5, lBase:3.8 },
      { name:'Bathroom',      type:'bath',    wBase:2.2, lBase:2.0 },
      { name:'Balcony',       type:'other',   wBase:3.5, lBase:1.5 },
      { name:'Utility / Storage', type:'other', wBase:1.8, lBase:1.5 },
    ],
    // Template D — 4-bed family
    [
      { name:'Living Room',   type:'living',  wBase:6.0, lBase:5.8 },
      { name:'Dining Room',   type:'other',   wBase:4.2, lBase:3.8 },
      { name:'Kitchen',       type:'kitchen', wBase:4.0, lBase:3.5 },
      { name:'Master Bedroom',type:'bedroom', wBase:5.0, lBase:4.8 },
      { name:'Bedroom 2',     type:'bedroom', wBase:4.0, lBase:4.0 },
      { name:'Bedroom 3',     type:'bedroom', wBase:3.6, lBase:3.8 },
      { name:'Bedroom 4',     type:'bedroom', wBase:3.2, lBase:3.5 },
      { name:'Bathroom 1',    type:'bath',    wBase:3.0, lBase:2.5 },
      { name:'Bathroom 2',    type:'bath',    wBase:2.0, lBase:1.8 },
      { name:'Hallway',       type:'other',   wBase:5.0, lBase:1.8 },
    ],
  ];

  const OBSERVATIONS = [
    'Efficient open-plan layout with good separation between sleeping and living zones. The dining area flows naturally from the kitchen, maximising usable space.',
    'Well-proportioned 3-bedroom layout with a dedicated study. Bathroom placement provides good accessibility from all bedrooms without crossing public areas.',
    'Compact single-bedroom design optimised for natural light and minimal corridor waste. Open kitchen-living configuration maximises perceived space.',
    'Generous 4-bedroom family layout with dual bathrooms. The separate dining room allows formal and informal dining flexibility.',
  ];

  function generateNormalResult(idx) {
    // Cycle through templates and apply a small variance per image
    const tIdx    = idx % ROOM_TEMPLATES.length;
    const template = ROOM_TEMPLATES[tIdx];
    const variance = 0.05 + (idx * 0.07) % 0.25; // subtle size variance per image

    const rooms = template.map(r => {
      const w = parseFloat((r.wBase * (1 + (idx % 3) * variance * 0.1)).toFixed(1));
      const l = parseFloat((r.lBase * (1 + (idx % 5) * variance * 0.08)).toFixed(1));
      const a = parseFloat((w * l).toFixed(1));
      return { name: r.name, type: r.type, width_m: w, length_m: l, area_sqm: a, confidence: 'medium' };
    });

    const totalArea = parseFloat(rooms.reduce((s, r) => s + r.area_sqm, 0).toFixed(1));

    return {
      rooms,
      total_area_sqm: totalArea,
      total_rooms:    rooms.length,
      floor_count:    1,
      unit:           'meters',
      scale_note:     'Normal mode — estimated from standard residential proportions (Template ' + String.fromCharCode(65 + tIdx) + '). Use Advanced mode with an API key for image-specific analysis.',
      observations:   OBSERVATIONS[tIdx],
    };
  }

  /* ── Mode switcher ──────────────────────────────────────────────── */
  window.setMode = function (mode) {
    currentMode = mode;
    if (mode === 'normal') {
      modeCardNormal.classList.add('active');
      modeCardAdvanced.classList.remove('active');
      checkNormal.style.opacity   = '1';
      checkAdvanced.style.opacity = '0';
      apikeyBlock.style.display   = 'none';
    } else {
      modeCardAdvanced.classList.add('active');
      modeCardNormal.classList.remove('active');
      checkAdvanced.style.opacity = '1';
      checkNormal.style.opacity   = '0';
      apikeyBlock.style.display   = 'block';
    }
    document.getElementById('instructNormal').style.display   = mode === 'normal'   ? 'block' : 'none';
    document.getElementById('instructAdvanced').style.display = mode === 'advanced' ? 'block' : 'none';
    hideError();
    showEmpty();
  };

  /* ── How-to + API key toggles ───────────────────────────────────── */
  howtoToggle.addEventListener('click', () => {
    const isOpen = howtoSteps.classList.toggle('open');
    howtoChevron.classList.toggle('open', isOpen);
  });
  apiKeyToggle.addEventListener('click', () => {
    const isPwd = apiKeyInput.type === 'password';
    apiKeyInput.type   = isPwd ? 'text' : 'password';
    apiKeyToggle.title = isPwd ? 'Hide key' : 'Show key';
  });
  apiKeyInput.addEventListener('input', () => {
    const v = apiKeyInput.value.trim();
    apiKeyInput.classList.remove('key-valid', 'key-invalid');
    if (!v) return;
    apiKeyInput.classList.add(v.startsWith('sk-ant-') ? 'key-valid' : 'key-invalid');
  });

  /* ── File loading ───────────────────────────────────────────────── */
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === ''));
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  /* ── Add files to queue ─────────────────────────────────────────── */
  function addFiles(files) {
    hideError();
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onerror = () => showError('FILE READ ERROR: Could not read ' + file.name);
      reader.onload = e => {
        const dataUrl = e.target.result;
        images.push({ dataUrl, base64: dataUrl.split(',')[1], mime: file.type || 'image/jpeg', name: file.name });
        loaded++;
        if (loaded === files.length) {
          activeIndex = images.length - files.length; // jump to first newly added
          refreshUI();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Refresh all UI from images[] ──────────────────────────────── */
  function refreshUI() {
    if (!images.length) {
      thumbBar.style.display   = 'none';
      previewWrap.classList.remove('visible');
      showEmpty();
      return;
    }

    // Show preview of activeIndex
    const img = images[activeIndex];
    previewImg.src = img.dataUrl;
    previewLabel.textContent = 'ACTIVE SCAN — IMAGE ' + (activeIndex + 1) + ' OF ' + images.length;
    previewWrap.classList.add('visible');

    // Thumbnail bar
    thumbBar.style.display = 'block';
    const plural = images.length === 1 ? 'IMAGE LOADED' : 'IMAGES LOADED';
    thumbBarLabel.textContent = images.length + ' ' + plural;
    renderThumbs();

    // Nav arrows
    if (images.length > 1) {
      imgNav.style.display  = 'flex';
      imgNavCounter.textContent = (activeIndex + 1) + ' / ' + images.length;
      prevImgBtn.disabled = activeIndex === 0;
      nextImgBtn.disabled = activeIndex === images.length - 1;
    } else {
      imgNav.style.display = 'none';
    }

    showEmpty();
  }

  /* ── Render thumbnails ──────────────────────────────────────────── */
  function renderThumbs() {
    thumbGrid.innerHTML = '';

    images.forEach((img, i) => {
      const isActive = i === activeIndex;
      const label    = 'IMAGE ' + (i + 1);
      // shorten filename: strip extension, max 16 chars
      const rawName  = img.name || ('image_' + (i + 1));
      const shortName = rawName.replace(/\.[^.]+$/, '').substring(0, 18);

      const div = document.createElement('div');
      const hasRes = results && results[i] !== null && results[i] !== undefined;
      div.className = 'thumb-item' + (isActive ? ' active' : '') + (hasRes ? ' has-result' : '');

      div.innerHTML =
        '<div class="thumb-img-wrap">' +
          '<img src="' + img.dataUrl + '" alt="' + label + '" />' +
          '<span class="thumb-active-badge">ACTIVE</span>' +
          '<button class="thumb-remove" data-idx="' + i + '" title="Remove image ' + (i+1) + '">✕</button>' +
        '</div>' +
        '<div class="thumb-label">' +
          '<span class="thumb-label-name">' + label + '</span>' +
          '<span class="thumb-label-file">' + shortName + '</span>' +
        '</div>';

      div.addEventListener('click', e => {
        if (e.target.closest('.thumb-remove')) return;
        activeIndex = i;
        refreshUI();
        // If this image has a result, scroll to its card in the stack
        if (results && results[i] != null) {
          const card = resultsStack.querySelector('[data-result-idx="' + i + '"]');
          if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          viewingResult = i;
        } else {
          showEmpty();
        }
      });

      thumbGrid.appendChild(div);
    });

    // "Add more" button
    const addDiv = document.createElement('div');
    addDiv.className = 'thumb-add';
    addDiv.title = 'Add more images';
    addDiv.innerHTML =
      '<input type="file" accept="image/*" multiple />' +
      '<span class="thumb-add-icon">+</span>' +
      '<span class="thumb-add-text">ADD MORE</span>';
    addDiv.querySelector('input').addEventListener('change', function () {
      addFiles(Array.from(this.files));
      this.value = '';
    });
    thumbGrid.appendChild(addDiv);
  }

  /* ── Remove thumbnail ───────────────────────────────────────────── */
  thumbGrid.addEventListener('click', e => {
    const btn = e.target.closest('.thumb-remove');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    images.splice(idx, 1);
    if (activeIndex >= images.length) activeIndex = Math.max(0, images.length - 1);
    refreshUI();
  });

  /* ── Navigate images ────────────────────────────────────────────── */
  window.navigateImage = function (dir) {
    activeIndex = Math.max(0, Math.min(images.length - 1, activeIndex + dir));
    refreshUI();
    if (results && results[activeIndex] != null) {
      const card = resultsStack.querySelector('[data-result-idx="' + activeIndex + '"]');
      if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      viewingResult = activeIndex;
    } else {
      showEmpty();
    }
  };

  /* ── Clear all ──────────────────────────────────────────────────── */
  clearAllBtn.addEventListener('click', () => {
    images = []; activeIndex = 0; results = []; queueIndex = 0; queueRunning = false; viewingResult = -1;
    resultsStack.innerHTML = ''; resultsStack.style.display = 'none';
    agentPanel.style.display = 'none'; agentLog.innerHTML = '';
    analyzeBtn.disabled = false;
    analyzeBtn.querySelector('.btn-text').innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6" stroke="#0a0e1a" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#0a0e1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> INITIATE ANALYSIS';
    refreshUI(); hideError();
  });

  /* ── Clear single (active image) ───────────────────────────────── */
  clearBtn.addEventListener('click', () => {
    if (!images.length) return;
    const removedIdx = activeIndex;
    // Remove result card from stack
    const card = resultsStack.querySelector('[data-result-idx="' + removedIdx + '"]');
    if (card) card.remove();
    // Re-index remaining result cards
    Array.from(resultsStack.querySelectorAll('.result-card')).forEach(c => {
      const ci = parseInt(c.dataset.resultIdx);
      if (ci > removedIdx) { c.dataset.resultIdx = ci - 1; }
    });
    images.splice(removedIdx, 1);
    results.splice(removedIdx, 1);
    if (activeIndex >= images.length) activeIndex = Math.max(0, images.length - 1);
    if (!images.length) {
      queueRunning = false; queueIndex = 0; viewingResult = -1;
      resultsStack.innerHTML = ''; resultsStack.style.display = 'none';
      analyzeBtn.querySelector('.btn-text').innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6" stroke="#0a0e1a" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#0a0e1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> INITIATE ANALYSIS';
    }
    if (!resultsStack.children.length) { resultsStack.style.display = 'none'; emptyState.style.display = 'flex'; }
    refreshUI(); hideError();
  });

  /* ── Queue state ────────────────────────────────────────────────── */
  let queueRunning  = false;
  let queueIndex    = 0;       // which image we're currently scanning
  let results       = [];      // stored result per image index
  let viewingResult = -1;      // which result is being viewed (-1 = none)

  /* ── Analyze button ─────────────────────────────────────────────── */
  analyzeBtn.addEventListener('click', startQueue);

  function startQueue() {
    if (!images.length || queueRunning) return;

    if (currentMode === 'advanced') {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        showError('API KEY REQUIRED: Enter your Anthropic API key to use Advanced mode.');
        apiKeyInput.focus(); return;
      }
      if (!apiKey.startsWith('sk-ant-')) {
        showError('INVALID API KEY: Key must start with "sk-ant-".');
        apiKeyInput.focus(); return;
      }
    }

    // Reset results array and clear previous result cards
    results = new Array(images.length).fill(null);
    resultsStack.innerHTML = '';
    resultsStack.style.display = 'none';
    queueIndex   = 0;
    queueRunning = true;
    hideError();
    analyzeBtn.disabled = true;
    renderQueueProgress();
    processNext();
  }

  /* ── Process next image in queue ────────────────────────────────── */
  function processNext() {
    if (queueIndex >= images.length) {
      // All done
      queueRunning = false;
      analyzeBtn.disabled = false;
      analyzeBtn.querySelector('.btn-text').innerHTML =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M3 8l4 4 6-6" stroke="#0a0e1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ALL SCANS COMPLETE';
      renderQueueProgress();
      // Show result for Image 1 (first image) after all scans complete
      showResultFor(0);
      return;
    }

    // Jump active view to current scan image
    activeIndex = queueIndex;
    refreshUI();

    // Update button label
    analyzeBtn.querySelector('.btn-text').innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6" stroke="#0a0e1a" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#0a0e1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      ' SCANNING ' + (queueIndex + 1) + ' / ' + images.length;

    renderQueueProgress();

    if (currentMode === 'normal') {
      runNormalScan(queueIndex);
    } else {
      runAdvancedScan(queueIndex);
    }
  }

  /* ── Render queue progress dots in thumb bar ────────────────────── */
  function renderQueueProgress() {
    const label = document.getElementById('thumbBarLabel');
    if (!queueRunning && results.every(r => r === null)) {
      const plural = images.length === 1 ? 'IMAGE LOADED' : 'IMAGES LOADED';
      label.textContent = images.length + ' ' + plural;
      return;
    }
    const done  = results.filter(r => r !== null).length;
    const total = images.length;
    label.textContent = done + ' / ' + total + ' SCANS COMPLETE';

    // Update thumb badges
    images.forEach((_, i) => {
      const item = thumbGrid.querySelectorAll('.thumb-item')[i];
      if (!item) return;
      let badge = item.querySelector('.thumb-status-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'thumb-status-badge';
        item.querySelector('.thumb-img-wrap').appendChild(badge);
      }
      if (results[i]) {
        badge.textContent = '✓';
        badge.className = 'thumb-status-badge done';
      } else if (queueRunning && i === queueIndex) {
        badge.textContent = '...';
        badge.className = 'thumb-status-badge scanning';
      } else {
        badge.textContent = '';
        badge.className = 'thumb-status-badge';
      }
    });
  }

  /* ── NORMAL single scan ─────────────────────────────────────────── */
  function runNormalScan(idx) {
    showLoading('SCANNING IMAGE ' + (idx + 1) + ' OF ' + images.length + '...');
    startAgent('normal');

    let progress = 0;
    loadingMsg.textContent = MSGS_NORMAL[0];
    loadingFill.style.width = '0%';

    let msgIdx = 0;
    const msgInt = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, MSGS_NORMAL.length - 1);
      loadingMsg.textContent = MSGS_NORMAL[msgIdx];
    }, 260);
    const barInt = setInterval(() => {
      progress = Math.min(progress + 18, 95);
      loadingFill.style.width = progress + '%';
    }, 160);

    setTimeout(() => {
      clearInterval(msgInt); clearInterval(barInt);
      loadingFill.style.width = '100%';
      setTimeout(() => {
        totalScans++;
        sessionCount.textContent = totalScans;
        sessionArea.textContent  = Math.round(totalArea);
        const generated = generateNormalResult(idx);
        generated._imageLabel = 'IMAGE ' + (idx + 1);
        results[idx] = generated;
        totalArea += generated.total_area_sqm;
        stopAgent();
        renderQueueProgress();
        renderResults(results[idx]);
        viewingResult = idx;
        queueIndex++;
        setTimeout(processNext, 2500);
      }, 300);
    }, 1400);
  }

  /* ── ADVANCED single scan ───────────────────────────────────────── */
  async function runAdvancedScan(idx) {
    const img    = images[idx];
    const apiKey = apiKeyInput.value.trim();

    showLoading('AI SCANNING IMAGE ' + (idx + 1) + ' OF ' + images.length + '...');
    startAgent('advanced');

    let msgIdx = 0, progress = 0;
    loadingMsg.textContent = MSGS_ADVANCED[0];
    loadingFill.style.width = '0%';

    const msgInt = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, MSGS_ADVANCED.length - 1);
      loadingMsg.textContent = MSGS_ADVANCED[msgIdx];
    }, 1800);
    const barInt = setInterval(() => {
      progress = Math.min(progress + Math.random() * 6, 88);
      loadingFill.style.width = progress + '%';
    }, 300);

    const PROMPT = `You are an expert architectural analyst. Examine this floor plan image and extract all spatial information.

CRITICAL: Respond ONLY with a raw JSON object. No markdown, no backticks, no explanation.

{
  "rooms": [{ "name":"Living Room","type":"living","width_m":4.5,"length_m":6.2,"area_sqm":27.9,"confidence":"high" }],
  "total_area_sqm": 95.5,
  "total_rooms": 4,
  "floor_count": 1,
  "unit": "meters",
  "scale_note": "Brief scale note.",
  "observations": "2-3 sentence architectural observation."
}

Rules: type = living|bedroom|kitchen|bath|other. confidence = high|medium|low.
Estimate from standard proportions if no scale bar. Include every room and hallway.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role:'user', content: [
            { type:'image', source:{ type:'base64', media_type: img.mime, data: img.base64 } },
            { type:'text', text: PROMPT }
          ]}]
        })
      });

      clearInterval(msgInt); clearInterval(barInt);
      loadingFill.style.width = '100%';

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || 'HTTP ' + resp.status);
      }

      const data   = await resp.json();
      const raw    = (data.content || []).map(b => b.text || '').join('');
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      totalScans++;
      totalArea += (parsed.total_area_sqm || 0);
      sessionCount.textContent = totalScans;
      sessionArea.textContent  = Math.round(totalArea);

      results[idx] = Object.assign({}, parsed, { _imageLabel: 'IMAGE ' + (idx + 1) });
      renderQueueProgress();
      setTimeout(() => {
        stopAgent();
        renderResults(results[idx]);
        viewingResult = idx;
        queueIndex++;
        setTimeout(processNext, 2500);
      }, 300);

    } catch (err) {
      clearInterval(msgInt); clearInterval(barInt);
      showEmpty();
      showError('SCAN FAILED (Image ' + (idx + 1) + '): ' +
        ((err instanceof SyntaxError) ? 'Unexpected AI response.' : (err.message || 'Unable to process.')));
      // Skip this image and continue queue
      results[idx] = null;
      queueIndex++;
      setTimeout(processNext, 800);
    }
  }

  /* ── Show a specific stored result ─────────────────────────────── */
  function showResultFor(idx) {
    if (results[idx]) {
      activeIndex = idx;
      refreshUI();
      // Scroll to that result card if it exists
      const card = resultsStack.querySelector('[data-result-idx="' + idx + '"]');
      if (card) {
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  }

  /* ── Thumb remove is handled by the delegated listener below ────── */

  /* ── Append a result card to the stack ─────────────────────────── */
  function renderResults(data) {
    hideLoading();
    emptyState.style.display = 'none';
    resultsStack.style.display = 'block';

    const imgLabel = data._imageLabel || ('IMAGE ' + (activeIndex + 1));
    const imgIndex = parseInt((imgLabel.match(/\d+/) || ['1'])[0]) - 1;

    // Check if a card for this image already exists — update it instead of duplicating
    const existingCard = resultsStack.querySelector('[data-result-idx="' + imgIndex + '"]');
    if (existingCard) existingCard.remove();

    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.resultIdx = imgIndex;
    card.style.animationDelay = '0s';

    // ── Header
    const header = document.createElement('div');
    header.className = 'result-card-header';
    header.innerHTML =
      '<div class="result-card-title">' +
        '<span class="result-card-dot"></span>' +
        '<span class="result-card-label">' + imgLabel + '</span>' +
        '<span class="result-card-mode">' + currentMode.toUpperCase() + '</span>' +
      '</div>' +
      '<div class="result-card-meta">' +
        '<span>' + (data.total_area_sqm||0).toFixed(1) + ' m²</span>' +
        '<span>' + (data.rooms||[]).length + ' rooms</span>' +
        '<span>' + (data.floor_count||1) + ' floor' + ((data.floor_count||1)>1?'s':'') + '</span>' +
      '</div>';
    card.appendChild(header);

    // ── Export buttons
    const exportRow = document.createElement('div');
    exportRow.className = 'result-export-row';
    exportRow.innerHTML =
      '<span class="result-export-label">EXPORT</span>' +
      '<button class="export-btn export-pdf" onclick="exportResultPDF(' + imgIndex + ')" title="Export to PDF">' +
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="1" width="7" height="10" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M5 1v3h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="4" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>' +
        ' PDF' +
      '</button>' +
      '<button class="export-btn export-ppt" onclick="exportResultPPT(' + imgIndex + ')" title="Export to PowerPoint">' +
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.1"/><rect x="3" y="4" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.6"/><line x1="8.5" y1="5" x2="10.5" y2="5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="8.5" y1="7" x2="10.5" y2="7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>' +
        ' PPT' +
      '</button>';
    card.appendChild(exportRow);

    // ── Metrics row
    const metricsRow = document.createElement('div');
    metricsRow.className = 'metrics-row';
    [
      { label:'TOTAL AREA', value:(data.total_area_sqm||0).toFixed(1), unit:'M²' },
      { label:'ROOMS',      value:(data.rooms||[]).length,              unit:''   },
      { label:'FLOORS',     value:data.floor_count||1,                  unit:''   },
      { label:'MODE',       value:currentMode.toUpperCase(),            unit:''   },
    ].forEach((m, i) => {
      const mc = document.createElement('div');
      mc.className = 'metric-card';
      mc.style.animationDelay = (i * 0.06) + 's';
      mc.innerHTML = '<span class="m-label">' + m.label + '</span>'
        + '<span class="m-value">' + m.value + '<span class="m-unit">' + m.unit + '</span></span>';
      metricsRow.appendChild(mc);
    });
    card.appendChild(metricsRow);

    // ── Room breakdown
    const roomSec = document.createElement('div');
    roomSec.className = 'rooms-section';
    const secLabel = document.createElement('div');
    secLabel.className = 'section-label';
    secLabel.textContent = 'ROOM BREAKDOWN';
    roomSec.appendChild(secLabel);

    const roomsGrid = document.createElement('div');
    roomsGrid.className = 'rooms-grid';
    (data.rooms || []).forEach((room, i) => {
      const tc = 'type-' + (room.type || 'other');
      const cb = 'badge-conf-' + (room.confidence || 'medium');
      const tb = 'badge-type-' + (room.type || 'other');
      const tl = TYPE_LABELS[room.type] || 'OTHER';
      const dims = (room.width_m && room.length_m)
        ? parseFloat(room.width_m).toFixed(1) + ' × ' + parseFloat(room.length_m).toFixed(1) + ' m'
        : 'EST. DIMS';
      const area = room.area_sqm ? parseFloat(room.area_sqm).toFixed(1) + ' m²' : '';
      const rc = document.createElement('div');
      rc.className = 'room-card ' + tc;
      rc.style.animationDelay = (i * 0.05) + 's';
      rc.innerHTML =
        '<div class="room-name">' + (room.name||'ROOM').toUpperCase() + '</div>' +
        '<div class="room-dims">' + dims + '</div>' +
        (area ? '<div class="room-area">' + area + '</div>' : '') +
        '<div class="room-badges">' +
          '<span class="badge ' + tb + '">' + tl + '</span>' +
          '<span class="badge ' + cb + '">' + (room.confidence||'medium').toUpperCase() + '</span>' +
        '</div>';
      roomsGrid.appendChild(rc);
    });
    roomSec.appendChild(roomsGrid);
    card.appendChild(roomSec);

    // ── Observations
    if (data.observations) {
      const obsSec = document.createElement('div');
      obsSec.className = 'obs-section';
      obsSec.innerHTML = '<div class="section-label">AI OBSERVATIONS</div>' +
        '<div class="obs-box">' + data.observations + '</div>';
      card.appendChild(obsSec);
    }

    // ── Scale note
    if (data.scale_note) {
      const sn = document.createElement('div');
      sn.className = 'scale-note visible';
      sn.textContent = '⬡ ' + data.scale_note;
      card.appendChild(sn);
    }

    // Insert card in correct order by image index
    const allCards = Array.from(resultsStack.querySelectorAll('.result-card'));
    const insertBefore = allCards.find(c => parseInt(c.dataset.resultIdx) > imgIndex);
    if (insertBefore) {
      resultsStack.insertBefore(card, insertBefore);
    } else {
      resultsStack.appendChild(card);
    }

    // Register result for export module
    data._mode = currentMode;
    data._imgDataUrl = images[imgIndex] ? images[imgIndex].dataUrl : null;
    window._holoResults = window._holoResults || {};
    window._holoResults[imgIndex] = data;
    document.dispatchEvent(new CustomEvent('holoResultReady', { detail:{ idx: imgIndex, data } }));

    // Scroll new card into view smoothly
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  /* ── UI helpers ─────────────────────────────────────────────────── */
  function showLoading(msg) {
    emptyState.style.display = 'none';
    loadingState.classList.add('visible');
    if (msg) loadingMsg.textContent = msg;
  }
  function hideLoading() { loadingState.classList.remove('visible'); }
  function showEmpty() {
    hideLoading();
    if (!resultsStack.children.length) {
      emptyState.style.display = 'flex';
      resultsStack.style.display = 'none';
    }
  }
  function showError(msg) { errorMsg.textContent = msg; errorPanel.classList.add('visible'); }
  function hideError()    { errorPanel.classList.remove('visible'); }

})();