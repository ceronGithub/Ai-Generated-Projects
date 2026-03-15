/* app.js — HOLO·PLAN Floor Plan Analyzer Logic */

(function () {
  'use strict';

  /* ---- DOM refs ---- */
  const fileInput     = document.getElementById('fileInput');
  const uploadZone    = document.getElementById('uploadZone');
  const previewWrap   = document.getElementById('previewWrap');
  const previewImg    = document.getElementById('previewImg');
  const clearBtn      = document.getElementById('clearBtn');
  const analyzeBtn    = document.getElementById('analyzeBtn');
  const errorPanel    = document.getElementById('errorPanel');
  const errorMsg      = document.getElementById('errorMsg');
  const loadingState  = document.getElementById('loadingState');
  const loadingMsg    = document.getElementById('loadingMsg');
  const loadingFill   = document.getElementById('loadingFill');
  const emptyState    = document.getElementById('emptyState');
  const resultsContent= document.getElementById('resultsContent');
  const metricsRow    = document.getElementById('metricsRow');
  const roomsGrid     = document.getElementById('roomsGrid');
  const obsBox        = document.getElementById('obsBox');
  const obsSection    = document.getElementById('obsSection');
  const scaleNote     = document.getElementById('scaleNote');
  const sessionCount  = document.getElementById('sessionCount');
  const sessionArea   = document.getElementById('sessionArea');

  /* ---- State ---- */
  let base64Data = null;
  let mediaType  = 'image/jpeg';
  let totalScans = 0;
  let totalArea  = 0;

  /* ---- Type label map (declared early so renderResults can reference it) ---- */
  const TYPE_LABELS = {
    living: 'LIVING',
    bedroom: 'BEDROOM',
    kitchen: 'KITCHEN',
    bath: 'BATHROOM',
    other: 'OTHER',
  };

  /* ---- Loading messages sequence ---- */
  const LOADING_MSGS = [
    'INITIALIZING SPATIAL SCAN...',
    'DETECTING ROOM BOUNDARIES...',
    'CALCULATING WALL SEGMENTS...',
    'ESTIMATING DIMENSIONS...',
    'COMPUTING AREA METRICS...',
    'CROSS-REFERENCING SCALE DATA...',
    'GENERATING SPATIAL REPORT...',
  ];

  /* ---- Upload Zone drag events ---- */
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    // Accept if MIME is image/* OR if MIME is empty (some OS/browsers omit it for valid images)
    if (file && (file.type.startsWith('image/') || file.type === '')) loadFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  /* ---- Load file ---- */
  function loadFile(file) {
    mediaType = file.type || 'image/jpeg';
    hideError();

    const reader = new FileReader();
    reader.onerror = () => showError('FILE READ ERROR: Could not read the selected file. Please try again.');
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      base64Data = dataUrl.split(',')[1];
      previewImg.src = dataUrl;
      previewWrap.classList.add('visible');
      showEmpty();
    };
    reader.readAsDataURL(file);
  }

  /* ---- Clear ---- */
  clearBtn.addEventListener('click', () => {
    base64Data = null;
    fileInput.value = '';
    previewImg.src = '';
    previewWrap.classList.remove('visible');
    hideError();
    showEmpty();
  });

  /* ---- Analyze ---- */
  analyzeBtn.addEventListener('click', runAnalysis);

  async function runAnalysis() {
    if (!base64Data) return;

    analyzeBtn.disabled = true;
    hideError();
    showLoading();

    // Animated loading bar and messages
    let msgIdx = 0;
    let progress = 0;
    loadingMsg.textContent = LOADING_MSGS[0];
    loadingFill.style.width = '0%';

    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MSGS.length - 1);
      loadingMsg.textContent = LOADING_MSGS[msgIdx];
    }, 1800);

    const barInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 6, 88);
      loadingFill.style.width = progress + '%';
    }, 300);

    const PROMPT = `You are an expert architectural analyst with deep knowledge of residential and commercial floor plans.

Carefully examine this floor plan image and extract all spatial information.

CRITICAL: Respond ONLY with a raw JSON object. No markdown fences, no backticks, no preamble or explanation text.

Return exactly this structure:
{
  "rooms": [
    {
      "name": "Living Room",
      "type": "living",
      "width_m": 4.5,
      "length_m": 6.2,
      "area_sqm": 27.9,
      "confidence": "high"
    }
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
- If no scale bar, estimate based on standard residential proportions (e.g., typical bedroom 3x3.5m, living room 4x5m)
- Include every identifiable room or space, including hallways, storage, utility rooms
- area_sqm = width_m * length_m (rounded to 1 decimal)
- total_area_sqm = sum of all room areas
- Be precise and thorough`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data }
              },
              { type: 'text', text: PROMPT }
            ]
          }]
        })
      });

      clearInterval(msgInterval);
      clearInterval(barInterval);
      loadingFill.style.width = '100%';

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = (data.content || []).map(b => b.text || '').join('');
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Update session stats
      totalScans++;
      totalArea += (parsed.total_area_sqm || 0);
      sessionCount.textContent = totalScans;
      sessionArea.textContent = Math.round(totalArea);

      setTimeout(() => {
        renderResults(parsed);
        analyzeBtn.disabled = false;
      }, 300);

    } catch (err) {
      clearInterval(msgInterval);
      clearInterval(barInterval);
      console.error('Analysis error:', err);
      showEmpty();
      // Provide a friendly message depending on error type
      const isParseErr = err instanceof SyntaxError;
      const friendlyMsg = isParseErr
        ? 'SCAN FAILED: AI returned unexpected data. Please try again.'
        : 'SCAN FAILED: ' + (err.message || 'Unable to process image. Ensure the image is a clear floor plan.');
      showError(friendlyMsg);
      analyzeBtn.disabled = false;
    }
  }

  /* ---- Render Results ---- */
  function renderResults(data) {
    hideLoading();
    metricsRow.innerHTML = '';
    roomsGrid.innerHTML = '';

    // Metrics
    const metrics = [
      { label: 'TOTAL AREA', value: (data.total_area_sqm || 0).toFixed(1), unit: 'M²' },
      { label: 'ROOMS', value: (data.rooms || []).length, unit: '' },
      { label: 'FLOORS', value: data.floor_count || 1, unit: '' },
      { label: 'UNIT', value: data.unit === 'meters' ? 'M' : (data.unit || 'M').toUpperCase(), unit: '' },
    ];

    metrics.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.style.animationDelay = (i * 0.08) + 's';
      card.innerHTML = `
        <span class="m-label">${m.label}</span>
        <span class="m-value">${m.value}<span class="m-unit">${m.unit}</span></span>
      `;
      metricsRow.appendChild(card);
    });

    // Room cards
    (data.rooms || []).forEach((room, i) => {
      const typeClass = 'type-' + (room.type || 'other');
      const confBadge = 'badge-conf-' + (room.confidence || 'medium');
      const typeBadge = 'badge-type-' + (room.type || 'other');
      const typeLabel = TYPE_LABELS[room.type] || 'OTHER';
      const dimsText = (room.width_m && room.length_m)
        ? `${parseFloat(room.width_m).toFixed(1)} × ${parseFloat(room.length_m).toFixed(1)} m`
        : 'EST. DIMS';
      const areaText = room.area_sqm ? `${parseFloat(room.area_sqm).toFixed(1)} m²` : '';

      const card = document.createElement('div');
      card.className = `room-card ${typeClass}`;
      card.style.animationDelay = (i * 0.06) + 's';
      card.innerHTML = `
        <div class="room-name">${(room.name || 'ROOM').toUpperCase()}</div>
        <div class="room-dims">${dimsText}</div>
        ${areaText ? `<div class="room-area">${areaText}</div>` : ''}
        <div class="room-badges">
          <span class="badge ${typeBadge}">${typeLabel}</span>
          <span class="badge ${confBadge}">${(room.confidence || 'medium').toUpperCase()}</span>
        </div>
      `;
      roomsGrid.appendChild(card);
    });

    // Observations
    if (data.observations) {
      obsBox.textContent = data.observations;
      obsSection.style.display = 'block';
    } else {
      obsSection.style.display = 'none';
    }

    // Scale note
    if (data.scale_note) {
      scaleNote.textContent = '⬡ ' + data.scale_note;
      scaleNote.classList.add('visible');
    } else {
      scaleNote.classList.remove('visible');
    }

    resultsContent.classList.add('visible');
  }

  /* ---- UI helpers ---- */
  function showLoading() {
    emptyState.style.display = 'none';
    resultsContent.classList.remove('visible');
    loadingState.classList.add('visible');
  }

  function hideLoading() {
    loadingState.classList.remove('visible');
  }

  function showEmpty() {
    hideLoading();
    resultsContent.classList.remove('visible');
    emptyState.style.display = 'flex';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorPanel.classList.add('visible');
  }

  function hideError() {
    errorPanel.classList.remove('visible');
  }

})();
