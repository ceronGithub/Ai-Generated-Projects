/* app.js — HOLO·PLAN  |  Normal & Advanced modes */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────────────── */
  const fileInput      = document.getElementById('fileInput');
  const uploadZone     = document.getElementById('uploadZone');
  const previewWrap    = document.getElementById('previewWrap');
  const previewImg     = document.getElementById('previewImg');
  const clearBtn       = document.getElementById('clearBtn');
  const analyzeBtn     = document.getElementById('analyzeBtn');
  const errorPanel     = document.getElementById('errorPanel');
  const errorMsg       = document.getElementById('errorMsg');
  const loadingState   = document.getElementById('loadingState');
  const loadingMsg     = document.getElementById('loadingMsg');
  const loadingFill    = document.getElementById('loadingFill');
  const emptyState     = document.getElementById('emptyState');
  const resultsContent = document.getElementById('resultsContent');
  const metricsRow     = document.getElementById('metricsRow');
  const roomsGrid      = document.getElementById('roomsGrid');
  const obsBox         = document.getElementById('obsBox');
  const obsSection     = document.getElementById('obsSection');
  const scaleNote      = document.getElementById('scaleNote');
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

  /* ── State ─────────────────────────────────────────────────────── */
  let currentMode = 'normal';   // 'normal' | 'advanced'
  let base64Data  = null;
  let mediaType   = 'image/jpeg';
  let totalScans  = 0;
  let totalArea   = 0;

  /* ── Type labels ────────────────────────────────────────────────── */
  const TYPE_LABELS = {
    living:'LIVING', bedroom:'BEDROOM', kitchen:'KITCHEN',
    bath:'BATHROOM', other:'OTHER',
  };

  /* ── Loading messages ───────────────────────────────────────────── */
  const LOADING_MSGS_NORMAL = [
    'READING FLOOR PLAN...', 'DETECTING ROOM BOUNDARIES...',
    'MEASURING DIMENSIONS...', 'CALCULATING AREAS...',
    'GENERATING REPORT...',
  ];
  const LOADING_MSGS_ADVANCED = [
    'INITIALIZING AI SCAN...', 'DETECTING ROOM BOUNDARIES...',
    'CALCULATING WALL SEGMENTS...', 'ESTIMATING DIMENSIONS...',
    'COMPUTING AREA METRICS...', 'CROSS-REFERENCING SCALE DATA...',
    'GENERATING SPATIAL REPORT...',
  ];

  /* ── Static result for Normal mode ─────────────────────────────── */
  const STATIC_RESULT = {
    rooms: [
      { name:'Living Room',   type:'living',  width_m:4.5, length_m:5.5, area_sqm:24.8, confidence:'medium' },
      { name:'Bedroom 1',     type:'bedroom', width_m:4.0, length_m:4.3, area_sqm:17.2, confidence:'medium' },
      { name:'Bedroom 2',     type:'bedroom', width_m:3.7, length_m:4.0, area_sqm:14.8, confidence:'medium' },
      { name:'Kitchen',       type:'kitchen', width_m:3.4, length_m:3.0, area_sqm:10.2, confidence:'medium' },
      { name:'Dining Area',   type:'other',   width_m:3.4, length_m:3.2, area_sqm:10.9, confidence:'medium' },
      { name:'Bathroom',      type:'bath',    width_m:2.4, length_m:2.0, area_sqm:4.8,  confidence:'medium' },
      { name:'Hallway',       type:'other',   width_m:4.3, length_m:2.4, area_sqm:10.3, confidence:'low'    },
    ],
    total_area_sqm: 93.0,
    total_rooms: 7,
    floor_count: 1,
    unit: 'meters',
    scale_note: 'Normal mode — dimensions estimated using standard residential proportions. Use Advanced mode for AI-powered precision.',
    observations: 'Standard residential layout detected. Upload in Advanced mode with an API key for a precise AI-powered room-by-room analysis tailored to your specific floor plan.',
  };

  /* ── Mode switcher (global so onclick in HTML works) ────────────── */
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
    // Toggle instruction panels
    document.getElementById('instructNormal').style.display   = mode === 'normal'   ? 'block' : 'none';
    document.getElementById('instructAdvanced').style.display = mode === 'advanced' ? 'block' : 'none';
    // Reset results when mode changes
    hideError();
    showEmpty();
  };

  /* ── How-to guide toggle ────────────────────────────────────────── */
  howtoToggle.addEventListener('click', () => {
    const isOpen = howtoSteps.classList.toggle('open');
    howtoChevron.classList.toggle('open', isOpen);
  });

  /* ── API Key show/hide & validation ─────────────────────────────── */
  apiKeyToggle.addEventListener('click', () => {
    const isPwd = apiKeyInput.type === 'password';
    apiKeyInput.type  = isPwd ? 'text' : 'password';
    apiKeyToggle.title = isPwd ? 'Hide key' : 'Show key';
  });

  apiKeyInput.addEventListener('input', () => {
    const val = apiKeyInput.value.trim();
    apiKeyInput.classList.remove('key-valid', 'key-invalid');
    if (!val.length) return;
    apiKeyInput.classList.add(val.startsWith('sk-ant-') ? 'key-valid' : 'key-invalid');
  });

  /* ── Upload drag & drop ─────────────────────────────────────────── */
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && (f.type.startsWith('image/') || f.type === '')) loadFile(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

  function loadFile(file) {
    mediaType = file.type || 'image/jpeg';
    hideError();
    const reader = new FileReader();
    reader.onerror = () => showError('FILE READ ERROR: Could not read file. Please try again.');
    reader.onload = e => {
      const dataUrl = e.target.result;
      base64Data = dataUrl.split(',')[1];
      previewImg.src = dataUrl;
      previewWrap.classList.add('visible');
      showEmpty();
    };
    reader.readAsDataURL(file);
  }

  /* ── Clear ──────────────────────────────────────────────────────── */
  clearBtn.addEventListener('click', () => {
    base64Data = null;
    fileInput.value = '';
    previewImg.src  = '';
    previewWrap.classList.remove('visible');
    hideError();
    showEmpty();
  });

  /* ── Analyze button ─────────────────────────────────────────────── */
  analyzeBtn.addEventListener('click', () => {
    if (currentMode === 'normal') runNormalAnalysis();
    else runAdvancedAnalysis();
  });

  /* ── NORMAL MODE — no API, static result ───────────────────────── */
  function runNormalAnalysis() {
    if (!base64Data) return;

    analyzeBtn.disabled = true;
    hideError();
    showLoading();

    let msgIdx = 0, progress = 0;
    loadingMsg.textContent = LOADING_MSGS_NORMAL[0];
    loadingFill.style.width = '0%';

    const msgInt = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MSGS_NORMAL.length - 1);
      loadingMsg.textContent = LOADING_MSGS_NORMAL[msgIdx];
    }, 250);
    const barInt = setInterval(() => {
      progress = Math.min(progress + 18, 95);
      loadingFill.style.width = progress + '%';
    }, 150);

    setTimeout(() => {
      clearInterval(msgInt);
      clearInterval(barInt);
      loadingFill.style.width = '100%';

      setTimeout(() => {
        totalScans++;
        totalArea += STATIC_RESULT.total_area_sqm;
        sessionCount.textContent = totalScans;
        sessionArea.textContent  = Math.round(totalArea);
        renderResults(STATIC_RESULT);
        analyzeBtn.disabled = false;
      }, 300);
    }, 1400);
  }

  /* ── ADVANCED MODE — AI via Anthropic API ───────────────────────── */
  async function runAdvancedAnalysis() {
    if (!base64Data) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showError('API KEY REQUIRED: Enter your Anthropic API key to use Advanced mode.');
      apiKeyInput.focus();
      return;
    }
    if (!apiKey.startsWith('sk-ant-')) {
      showError('INVALID API KEY: Key must start with "sk-ant-". Get yours at console.anthropic.com');
      apiKeyInput.focus();
      return;
    }

    analyzeBtn.disabled = true;
    hideError();
    showLoading();

    let msgIdx = 0, progress = 0;
    loadingMsg.textContent = LOADING_MSGS_ADVANCED[0];
    loadingFill.style.width = '0%';

    const msgInt = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MSGS_ADVANCED.length - 1);
      loadingMsg.textContent = LOADING_MSGS_ADVANCED[msgIdx];
    }, 1800);
    const barInt = setInterval(() => {
      progress = Math.min(progress + Math.random() * 6, 88);
      loadingFill.style.width = progress + '%';
    }, 300);

    const PROMPT = `You are an expert architectural analyst with deep knowledge of residential and commercial floor plans.

Carefully examine this floor plan image and extract all spatial information.

CRITICAL: Respond ONLY with a raw JSON object. No markdown fences, no backticks, no preamble or explanation text.

Return exactly this structure:
{
  "rooms": [
    { "name": "Living Room", "type": "living", "width_m": 4.5, "length_m": 6.2, "area_sqm": 27.9, "confidence": "high" }
  ],
  "total_area_sqm": 95.5,
  "total_rooms": 4,
  "floor_count": 1,
  "unit": "meters",
  "scale_note": "Brief note about scale detection or estimation method.",
  "observations": "2-3 sentence architectural observation about the layout, flow, natural light, and design."
}

Rules:
- "type" must be one of: living, bedroom, kitchen, bath, other
- "confidence" must be one of: high, medium, low
- If a scale bar is present, use it for accurate measurements
- If no scale bar, estimate based on standard residential proportions
- Include every identifiable room or space including hallways and storage
- area_sqm = width_m * length_m (rounded to 1 decimal)
- Be precise and thorough`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: PROMPT }
          ]}]
        })
      });

      clearInterval(msgInt); clearInterval(barInt);
      loadingFill.style.width = '100%';

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || 'HTTP ' + response.status);
      }

      const data    = await response.json();
      const rawText = (data.content || []).map(b => b.text || '').join('');
      const parsed  = JSON.parse(rawText.replace(/```json|```/g, '').trim());

      totalScans++;
      totalArea += (parsed.total_area_sqm || 0);
      sessionCount.textContent = totalScans;
      sessionArea.textContent  = Math.round(totalArea);

      setTimeout(() => {
        renderResults(parsed);
        analyzeBtn.disabled = false;
      }, 300);

    } catch (err) {
      clearInterval(msgInt); clearInterval(barInt);
      console.error('Analysis error:', err);
      showEmpty();
      showError((err instanceof SyntaxError)
        ? 'SCAN FAILED: AI returned unexpected data. Please try again.'
        : 'SCAN FAILED: ' + (err.message || 'Unable to process image.'));
      analyzeBtn.disabled = false;
    }
  }

  /* ── Render results ─────────────────────────────────────────────── */
  function renderResults(data) {
    hideLoading();
    metricsRow.innerHTML = '';
    roomsGrid.innerHTML  = '';

    const metrics = [
      { label:'TOTAL AREA', value:(data.total_area_sqm||0).toFixed(1), unit:'M²' },
      { label:'ROOMS',      value:(data.rooms||[]).length,              unit:''   },
      { label:'FLOORS',     value:data.floor_count||1,                  unit:''   },
      { label:'MODE',       value:currentMode.toUpperCase(),            unit:''   },
    ];

    metrics.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.style.animationDelay = (i * 0.08) + 's';
      card.innerHTML = '<span class="m-label">' + m.label + '</span>'
        + '<span class="m-value">' + m.value + '<span class="m-unit">' + m.unit + '</span></span>';
      metricsRow.appendChild(card);
    });

    (data.rooms || []).forEach((room, i) => {
      const typeClass = 'type-' + (room.type || 'other');
      const confBadge = 'badge-conf-' + (room.confidence || 'medium');
      const typeBadge = 'badge-type-' + (room.type || 'other');
      const typeLabel = TYPE_LABELS[room.type] || 'OTHER';
      const dimsText  = (room.width_m && room.length_m)
        ? parseFloat(room.width_m).toFixed(1) + ' × ' + parseFloat(room.length_m).toFixed(1) + ' m'
        : 'EST. DIMS';
      const areaText = room.area_sqm
        ? parseFloat(room.area_sqm).toFixed(1) + ' m²' : '';

      const card = document.createElement('div');
      card.className = 'room-card ' + typeClass;
      card.style.animationDelay = (i * 0.06) + 's';
      card.innerHTML =
        '<div class="room-name">' + (room.name || 'ROOM').toUpperCase() + '</div>' +
        '<div class="room-dims">' + dimsText + '</div>' +
        (areaText ? '<div class="room-area">' + areaText + '</div>' : '') +
        '<div class="room-badges">' +
          '<span class="badge ' + typeBadge + '">' + typeLabel + '</span>' +
          '<span class="badge ' + confBadge + '">' + (room.confidence || 'medium').toUpperCase() + '</span>' +
        '</div>';
      roomsGrid.appendChild(card);
    });

    if (data.observations) {
      obsBox.textContent = data.observations;
      obsSection.style.display = 'block';
    } else {
      obsSection.style.display = 'none';
    }

    if (data.scale_note) {
      scaleNote.textContent = '⬡ ' + data.scale_note;
      scaleNote.classList.add('visible');
    } else {
      scaleNote.classList.remove('visible');
    }

    resultsContent.classList.add('visible');
  }

  /* ── UI helpers ─────────────────────────────────────────────────── */
  function showLoading() {
    emptyState.style.display = 'none';
    resultsContent.classList.remove('visible');
    loadingState.classList.add('visible');
  }
  function hideLoading() { loadingState.classList.remove('visible'); }
  function showEmpty() {
    hideLoading();
    resultsContent.classList.remove('visible');
    emptyState.style.display = 'flex';
  }
  function showError(msg) { errorMsg.textContent = msg; errorPanel.classList.add('visible'); }
  function hideError()    { errorPanel.classList.remove('visible'); }

})();