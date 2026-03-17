/* boq.js — BOQ Module with multi-image gallery + stacked results */
(function () {
  'use strict';

  /* ── Tab switcher ─────────────────────────────────────────────── */
  window.switchTab = function (tab) {
    const analyzer = document.getElementById('viewAnalyzer');
    const boq      = document.getElementById('viewBoq');
    const tabA     = document.getElementById('tabAnalyzer');
    const tabB     = document.getElementById('tabBoq');
    if (tab === 'boq') {
      analyzer.style.display = 'none';
      boq.style.display      = 'block';
      tabA.classList.remove('active');
      tabB.classList.add('active');
    } else {
      boq.style.display      = 'none';
      analyzer.style.display = 'grid';
      tabB.classList.remove('active');
      tabA.classList.add('active');
    }
  };

  /* ── BOQ Mode switcher ───────────────────────────────────────── */
  window.setBOQMode = function(mode) {
    boqMode = mode;
    if (mode === 'standard') {
      boqModeCardStd.classList.add('active');
      boqModeCardAI.classList.remove('active');
      boqCheckStd.style.opacity = '1';
      boqCheckAI.style.opacity  = '0';
      boqApikeyBlock.style.display = 'none';
      boqInstructStd.style.display = 'block';
      boqInstructAI.style.display  = 'none';
    } else {
      boqModeCardAI.classList.add('active');
      boqModeCardStd.classList.remove('active');
      boqCheckAI.style.opacity  = '1';
      boqCheckStd.style.opacity = '0';
      boqApikeyBlock.style.display = 'block';
      boqInstructAI.style.display  = 'block';
      boqInstructStd.style.display = 'none';
    }
  };

  /* ── DOM refs ─────────────────────────────────────────────────── */
  const boqFileInput    = document.getElementById('boqFileInput');
  const boqUploadZone   = document.getElementById('boqUploadZone');
  const boqThumbBar     = document.getElementById('boqThumbBar');
  const boqThumbGrid    = document.getElementById('boqThumbGrid');
  const boqThumbLabel   = document.getElementById('boqThumbBarLabel');
  const boqPreviewWrap  = document.getElementById('boqPreviewWrap');
  const boqPreviewImg   = document.getElementById('boqPreviewImg');
  const boqPreviewLabel = document.getElementById('boqPreviewLabel');
  const boqClearBtn     = document.getElementById('boqClearBtn');
  const boqClearAllBtn  = document.getElementById('boqClearAllBtn');
  const boqAnalyzeBtn   = document.getElementById('boqAnalyzeBtn');
  const boqBtnText      = document.getElementById('boqBtnText');
  const boqImgNav       = document.getElementById('boqImgNav');
  const boqNavCounter   = document.getElementById('boqNavCounter');
  const boqPrevBtn      = document.getElementById('boqPrevBtn');
  const boqNextBtn      = document.getElementById('boqNextBtn');
  const boqLoadingState = document.getElementById('boqLoadingState');
  const boqLoadingMsg   = document.getElementById('boqLoadingMsg');
  const boqLoadingFill  = document.getElementById('boqLoadingFill');
  const boqErrorPanel   = document.getElementById('boqErrorPanel');
  const boqErrorMsg     = document.getElementById('boqErrorMsg');
  const boqResultsStack = document.getElementById('boqResultsStack');
  const boqActionBtns   = document.getElementById('boqActionBtns');
  const boqUploadPanel  = document.getElementById('boqUploadPanel');
  const boqModeCardStd  = document.getElementById('boqModeCardStd');
  const boqModeCardAI   = document.getElementById('boqModeCardAI');
  const boqCheckStd     = document.getElementById('boqCheckStd');
  const boqCheckAI      = document.getElementById('boqCheckAI');
  const boqApikeyBlock  = document.getElementById('boqApikeyBlock');
  const boqApiKeyInput  = document.getElementById('boqApiKeyInput');
  const boqApiKeyToggle = document.getElementById('boqApiKeyToggle');
  const boqInstructStd  = document.getElementById('boqInstructStd');
  const boqInstructAI   = document.getElementById('boqInstructAI');

  /* ── State ────────────────────────────────────────────────────── */
  let boqMode        = 'standard'; // 'standard' | 'ai'
  let boqImages      = [];   // [{dataUrl,base64,mime,name}]
  let boqActive      = 0;
  let boqResults     = [];   // stored BOQ_DATA per image
  let boqDefaultRates= [];   // default rates per image
  let boqQueueIdx    = 0;
  let boqQueueRun    = false;

  /* ── Loading messages ─────────────────────────────────────────── */
  const BOQ_MSGS = [
    'READING FLOOR PLAN...','DETECTING ROOM BOUNDARIES...',
    'MEASURING WALL LENGTHS...','CALCULATING SLAB AREAS...',
    'SIZING FOOTINGS & COLUMNS...','COMPUTING CONCRETE VOLUMES...',
    'ASSEMBLING BOQ ITEMS...','CALCULATING TOTALS...',
  ];

  /* ── Static BOQ templates (one per image, cycled) ─────────────── */
  const BOQ_TEMPLATES = [
    // Template A — 2-bed open plan ~125 m²
    { name:'2-Bed Open-Plan Unit', area:125, rooms:7,
      perimeter:34, slabSide1:10.0, slabSide2:7.2, cols:10, beamRun:30, slabArea:125 },
    // Template B — 3-bed family ~165 m²
    { name:'3-Bed Family Unit', area:165, rooms:9,
      perimeter:42, slabSide1:12.5, slabSide2:7.8, cols:12, beamRun:38, slabArea:165 },
    // Template C — studio ~60 m²
    { name:'Studio / 1-Bed Unit', area:60, rooms:4,
      perimeter:22, slabSide1:8.0, slabSide2:5.5, cols:6, beamRun:18, slabArea:60 },
    // Template D — 4-bed large ~200 m²
    { name:'4-Bed Residential Unit', area:200, rooms:11,
      perimeter:50, slabSide1:14.0, slabSide2:9.2, cols:14, beamRun:48, slabArea:200 },
  ];

  function generateBOQData(idx) {
    const t  = BOQ_TEMPLATES[idx % BOQ_TEMPLATES.length];
    const v  = 1 + (idx * 0.04) % 0.18; // slight variance per image
    const p  = parseFloat((t.perimeter * v).toFixed(1));
    const s1 = parseFloat((t.slabSide1 * Math.sqrt(v)).toFixed(2));
    const s2 = parseFloat((t.slabSide2 * Math.sqrt(v)).toFixed(2));
    const sa = parseFloat((s1 * s2).toFixed(1));
    const br = parseFloat((t.beamRun   * v).toFixed(1));

    return {
      project_name:   'IMAGE ' + (idx+1) + ' — ' + t.name,
      total_area_sqm: parseFloat((t.area * v).toFixed(1)),
      total_rooms:    t.rooms,
      boq_sections: [
        {
          section_title: '1.  SITE PREPARATION & EARTHWORKS',
          items: [
            { no:'1.1', desc:'Bulk excavation — foundation trenches',      loc:'Perimeter & load-bearing walls',   L:p,    W:0.50, D:0.60, rate:950  },
            { no:'1.2', desc:'Excavation — isolated column footings',       loc:t.cols+' nos. columns',             L:parseFloat((t.cols*0.5).toFixed(1)), W:0.90, D:0.90, rate:1100 },
            { no:'1.3', desc:'Gravel bedding / compacted fill under slab',  loc:'Full floor area ~'+sa+' m²',       L:s1,   W:s2,   D:0.10, rate:650  },
            { no:'1.4', desc:'Disposal of excavated material (off-site)',   loc:'Estimated volume',                 L:p,    W:0.50, D:0.60, rate:400  },
          ], note:'Includes machine excavation, manual trimming, and levelling.'
        },
        {
          section_title: '2.  CONCRETE FOOTINGS  (C25/30)',
          items: [
            { no:'2.1', desc:'Isolated square footing — 900×900×350 mm', loc:t.cols+' nos. column footings',        L:parseFloat((t.cols*0.15).toFixed(2)), W:0.90, D:0.35, rate:6200 },
            { no:'2.2', desc:'Strip footing — perimeter walls',           loc:'External walls, ~'+p+' m run',        L:p,    W:0.40, D:0.35, rate:5800 },
            { no:'2.3', desc:'Strip footing — internal load-bearing',     loc:'Internal dividers',                   L:parseFloat((p*0.53).toFixed(1)), W:0.30, D:0.30, rate:5800 },
          ], note:'Includes formwork, placing, vibrating & curing.'
        },
        {
          section_title: '3.  GROUND FLOOR SLAB  (C25/30, 150 mm)',
          items: [
            { no:'3.1', desc:'RC slab — main living zone',                loc:'Living / dining / kitchen area',      L:s1,   W:parseFloat((s2*0.72).toFixed(2)), D:0.15, rate:7500 },
            { no:'3.2', desc:'RC slab — bedroom wing',                    loc:'Bedrooms + hallway',                  L:parseFloat((s1*0.95).toFixed(2)), W:parseFloat((s2*0.54).toFixed(2)), D:0.15, rate:7500 },
            { no:'3.3', desc:'RC slab — bathroom (depressed wet area)',   loc:'Bathroom area',                       L:3.00, W:2.80, D:0.15, rate:8200 },
            { no:'3.4', desc:'Concrete haunching at slab perimeter',      loc:'All external edges, '+p+' m run',    L:p,    W:0.15, D:0.10, rate:1800 },
          ], note:'Slab includes BRC mesh A142, vapour barrier, edge formwork & finishing screed.'
        },
        {
          section_title: '4.  REINFORCED CONCRETE COLUMNS  (C25/30)',
          items: [
            { no:'4.1', desc:'RC column 200×200 mm — floor to beam (3.0 m)', loc:Math.round(t.cols*0.6)+' nos. internal columns',   L:0.20, W:0.20, D:3.00, rate:9500  },
            { no:'4.2', desc:'RC column 200×300 mm — corner/perimeter',      loc:Math.round(t.cols*0.4)+' nos. perimeter columns', L:0.20, W:0.30, D:3.00, rate:10500 },
          ], note:'Includes plywood formwork, 4-bar main rebar + ties, placing & curing.'
        },
        {
          section_title: '5.  REINFORCED CONCRETE BEAMS  (C25/30)',
          items: [
            { no:'5.1', desc:'Main beam 200×400 mm — longitudinal',  loc:'Main beams, ~'+br+' m total',                   L:br,   W:0.20, D:0.40, rate:8800 },
            { no:'5.2', desc:'Secondary beam 150×300 mm — transverse',loc:'Secondary beams, ~'+parseFloat((br*0.82).toFixed(1))+' m', L:parseFloat((br*0.82).toFixed(1)), W:0.15, D:0.30, rate:8200 },
            { no:'5.3', desc:'Ring beam / tie beam at foundation',    loc:'Perimeter + internal, ~'+parseFloat((p*1.5).toFixed(1))+' m', L:parseFloat((p*1.5).toFixed(1)), W:0.20, D:0.25, rate:7600 },
          ], note:'Includes soffit/side formwork, 2-layer rebar, stirrups & curing.'
        },
        {
          section_title: '6.  RC WALLS — BATHROOM & WET AREA',
          items: [
            { no:'6.1', desc:'RC wet-area wall 150 mm thick',           loc:'Bathroom perimeter, 3.0 m high', L:parseFloat((p*0.52).toFixed(1)), W:0.15, D:3.00, rate:9200 },
            { no:'6.2', desc:'RC parapet / curb at depressed slab',     loc:'Wet area perimeter',             L:parseFloat((p*0.32).toFixed(1)), W:0.10, D:0.15, rate:5500 },
          ], note:''
        },
        {
          section_title: '7.  STAIRS / STEPS',
          items: [
            { no:'7.1', desc:'RC entrance steps — 3 nos., 1200 mm wide', loc:'Main entrance, external', L:1.20, W:0.30, D:0.15, rate:6500 },
          ], note:''
        },
        {
          section_title: '8.  REINFORCING STEEL  (Grade 60, Fy = 415 MPa)',
          items: [
            { no:'8.1', desc:'Deformed bar Ø10 mm — slab mesh top & bottom', loc:'Full slab area ~'+sa+' m²',        L:sa,   W:1.0, D:1.0, rate:680  },
            { no:'8.2', desc:'Deformed bar Ø12 mm — beam main bars',         loc:'All beams, ~'+br+' m run',         L:br,   W:1.0, D:1.0, rate:820  },
            { no:'8.3', desc:'Deformed bar Ø16 mm — column main bars',       loc:t.cols+' nos. columns × 3 m',       L:parseFloat((t.cols*3).toFixed(0)), W:1.0, D:1.0, rate:1050 },
            { no:'8.4', desc:'Deformed bar Ø10 mm — stirrups & ties',        loc:'All beams & columns',              L:parseFloat((br*2.5).toFixed(0)), W:1.0, D:1.0, rate:680  },
            { no:'8.5', desc:'Deformed bar Ø12 mm — footing reinforcement',  loc:'All footings (allowance)',         L:parseFloat((p*1.6).toFixed(0)), W:1.0, D:1.0, rate:820  },
          ], note:'Rebar quantities in linear metre (lm). Multiply by unit weight for tonnage.'
        },
        {
          section_title: '9.  FORMWORK & FALSEWORK',
          items: [
            { no:'9.1', desc:'Plywood formwork (12 mm) — slab soffit',         loc:'Slab area ~'+sa+' m², 2 reuses', L:sa,  W:1.0, D:1.0, rate:480 },
            { no:'9.2', desc:'Timber/plywood formwork — beam sides & soffit',  loc:'All beams ~'+br+' m',            L:br,  W:1.0, D:1.0, rate:620 },
            { no:'9.3', desc:'Plywood formwork — column faces',                loc:t.cols+' cols × 4 faces × 3 m',   L:parseFloat((t.cols*12).toFixed(0)), W:1.0, D:1.0, rate:550 },
            { no:'9.4', desc:'Formwork — footing sides',                       loc:'All footings, perimeter',         L:parseFloat((p*2.8).toFixed(0)), W:1.0, D:0.35, rate:420 },
          ], note:''
        },
        {
          section_title: '10.  CONCRETE ACCESSORIES & SUNDRIES',
          items: [
            { no:'10.1', desc:'Concrete cover blocks (20 mm & 40 mm)',   loc:'Allowance — all elements',                   L:1.0, W:1.0, D:1.0, rate:parseFloat((12500*v).toFixed(0)) },
            { no:'10.2', desc:'Expansion joint filler (12 mm)',          loc:'Slab perimeter & construction joints',        L:1.0, W:1.0, D:1.0, rate:parseFloat((8500*v).toFixed(0))  },
            { no:'10.3', desc:'Curing compound (spray-applied)',         loc:'All exposed concrete surfaces',               L:1.0, W:1.0, D:1.0, rate:parseFloat((6800*v).toFixed(0))  },
            { no:'10.4', desc:'Concrete pump hire & placement',          loc:'Allowance — full pour programme',             L:1.0, W:1.0, D:1.0, rate:parseFloat((35000*v).toFixed(0)) },
            { no:'10.5', desc:'Concrete testing (cubes, slump tests)',   loc:'Per pour allowance',                          L:1.0, W:1.0, D:1.0, rate:parseFloat((18000*v).toFixed(0)) },
          ], note:''
        },
      ]
    };
  }

  /* ── BOQ API Key toggle ──────────────────────────────────────── */
  boqApiKeyToggle.addEventListener('click', () => {
    const isPwd = boqApiKeyInput.type === 'password';
    boqApiKeyInput.type = isPwd ? 'text' : 'password';
  });
  boqApiKeyInput.addEventListener('input', () => {
    const v = boqApiKeyInput.value.trim();
    boqApiKeyInput.classList.remove('key-valid','key-invalid');
    if (!v) return;
    boqApiKeyInput.classList.add(v.startsWith('sk-ant-') ? 'key-valid' : 'key-invalid');
  });

  /* ── Drag & drop upload ───────────────────────────────────────── */
  boqUploadZone.addEventListener('dragover', e => { e.preventDefault(); boqUploadZone.classList.add('drag-over'); });
  boqUploadZone.addEventListener('dragleave', () => boqUploadZone.classList.remove('drag-over'));
  boqUploadZone.addEventListener('drop', e => {
    e.preventDefault(); boqUploadZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === '');
    if (files.length) addBOQFiles(files);
  });
  boqFileInput.addEventListener('change', () => {
    if (boqFileInput.files.length) addBOQFiles(Array.from(boqFileInput.files));
    boqFileInput.value = '';
  });

  function addBOQFiles(files) {
    hideBOQError();
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onerror = () => showBOQError('FILE READ ERROR: Could not read ' + file.name);
      reader.onload = e => {
        const dataUrl = e.target.result;
        boqImages.push({ dataUrl, base64: dataUrl.split(',')[1], mime: file.type || 'image/jpeg', name: file.name });
        loaded++;
        if (loaded === files.length) {
          boqActive = boqImages.length - files.length;
          refreshBOQUI();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Refresh UI ───────────────────────────────────────────────── */
  function refreshBOQUI() {
    if (!boqImages.length) {
      boqThumbBar.style.display  = 'none';
      boqPreviewWrap.classList.remove('visible');
      return;
    }
    const img = boqImages[boqActive];
    boqPreviewImg.src = img.dataUrl;
    boqPreviewLabel.textContent = 'ACTIVE SCAN — IMAGE ' + (boqActive+1) + ' OF ' + boqImages.length;
    boqPreviewWrap.classList.add('visible');
    boqAnalyzeBtn.disabled = false;

    boqThumbBar.style.display = 'block';
    boqThumbLabel.textContent = boqImages.length + (boqImages.length===1?' IMAGE LOADED':' IMAGES LOADED');
    renderBOQThumbs();

    if (boqImages.length > 1) {
      boqImgNav.style.display = 'flex';
      boqNavCounter.textContent = (boqActive+1) + ' / ' + boqImages.length;
      boqPrevBtn.disabled = boqActive === 0;
      boqNextBtn.disabled = boqActive === boqImages.length-1;
    } else {
      boqImgNav.style.display = 'none';
    }
  }

  /* ── Render thumbnails ────────────────────────────────────────── */
  function renderBOQThumbs() {
    boqThumbGrid.innerHTML = '';
    boqImages.forEach((img, i) => {
      const isActive = i === boqActive;
      const hasRes   = boqResults[i] != null;
      const label    = 'IMAGE ' + (i+1);
      const shortName = (img.name||'image').replace(/\.[^.]+$/,'').substring(0,18);

      const div = document.createElement('div');
      div.className = 'thumb-item' + (isActive?' active':'') + (hasRes?' has-result':'');

      div.innerHTML =
        '<div class="thumb-img-wrap">' +
          '<img src="'+img.dataUrl+'" alt="'+label+'" />' +
          '<span class="thumb-active-badge">ACTIVE</span>' +
          '<button class="thumb-remove" data-idx="'+i+'" title="Remove">✕</button>' +
        '</div>' +
        '<div class="thumb-label">' +
          '<span class="thumb-label-name">'+label+'</span>' +
          '<span class="thumb-label-file">'+shortName+'</span>' +
        '</div>';

      div.addEventListener('click', e => {
        if (e.target.closest('.thumb-remove')) return;
        boqActive = i;
        refreshBOQUI();
        // Scroll to result card if exists
        if (hasRes) {
          const card = boqResultsStack.querySelector('[data-boq-idx="'+i+'"]');
          if (card) setTimeout(() => card.scrollIntoView({behavior:'smooth',block:'start'}), 50);
        }
      });
      boqThumbGrid.appendChild(div);
    });

    // Add more button
    const addDiv = document.createElement('div');
    addDiv.className = 'thumb-add';
    addDiv.innerHTML = '<input type="file" accept="image/*" multiple /><span class="thumb-add-icon">+</span><span class="thumb-add-text">ADD MORE</span>';
    addDiv.querySelector('input').addEventListener('change', function() { addBOQFiles(Array.from(this.files)); this.value=''; });
    boqThumbGrid.appendChild(addDiv);
  }

  /* ── Remove / Clear buttons ───────────────────────────────────── */
  boqThumbGrid.addEventListener('click', e => {
    const btn = e.target.closest('.thumb-remove');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    const card = boqResultsStack.querySelector('[data-boq-idx="'+idx+'"]');
    if (card) card.remove();
    // Re-index remaining cards
    Array.from(boqResultsStack.querySelectorAll('.boq-result-card')).forEach(c => {
      const ci = parseInt(c.dataset.boqIdx);
      if (ci > idx) c.dataset.boqIdx = ci-1;
    });
    boqImages.splice(idx,1); boqResults.splice(idx,1); boqDefaultRates.splice(idx,1);
    if (boqActive >= boqImages.length) boqActive = Math.max(0, boqImages.length-1);
    if (!boqImages.length) { resetBOQFull(); return; }
    refreshBOQUI();
  });

  boqClearBtn.addEventListener('click', () => {
    if (!boqImages.length) return;
    const idx = boqActive;
    const card = boqResultsStack.querySelector('[data-boq-idx="'+idx+'"]');
    if (card) card.remove();
    Array.from(boqResultsStack.querySelectorAll('.boq-result-card')).forEach(c => {
      const ci = parseInt(c.dataset.boqIdx);
      if (ci > idx) c.dataset.boqIdx = ci-1;
    });
    boqImages.splice(idx,1); boqResults.splice(idx,1); boqDefaultRates.splice(idx,1);
    if (boqActive >= boqImages.length) boqActive = Math.max(0, boqImages.length-1);
    if (!boqImages.length) { resetBOQFull(); return; }
    refreshBOQUI(); hideBOQError();
  });

  boqClearAllBtn.addEventListener('click', resetBOQFull);

  function resetBOQFull() {
    boqImages=[]; boqResults=[]; boqDefaultRates=[]; boqActive=0; boqQueueIdx=0; boqQueueRun=false;
    boqResultsStack.innerHTML=''; boqResultsStack.style.display='none';
    boqThumbBar.style.display='none';
    boqPreviewWrap.classList.remove('visible');
    boqAnalyzeBtn.disabled=true;
    boqActionBtns.style.display='none';
    setBOQBtnText('GENERATE BOQ ANALYSIS');
    hideBOQError();
  }

  /* ── Navigation ───────────────────────────────────────────────── */
  window.boqNavigate = function(dir) {
    boqActive = Math.max(0, Math.min(boqImages.length-1, boqActive+dir));
    refreshBOQUI();
    if (boqResults[boqActive] != null) {
      const card = boqResultsStack.querySelector('[data-boq-idx="'+boqActive+'"]');
      if (card) setTimeout(() => card.scrollIntoView({behavior:'smooth',block:'start'}), 50);
    }
  };

  /* ── Start queue ──────────────────────────────────────────────── */
  boqAnalyzeBtn.addEventListener('click', startBOQQueue);

  function startBOQQueue() {
    if (!boqImages.length || boqQueueRun) return;
    // Validate API key in AI mode
    if (boqMode === 'ai') {
      // Check BOQ key first, fallback to Module 1 key
      const k = boqApiKeyInput.value.trim() || (document.getElementById('apiKeyInput')||{}).value?.trim() || '';
      if (!k) { showBOQError('API KEY REQUIRED: Enter your Anthropic API key above to use AI-Powered mode.'); boqApiKeyInput.focus(); return; }
      if (!k.startsWith('sk-ant-')) { showBOQError('INVALID API KEY: Key must start with "sk-ant-".'); boqApiKeyInput.focus(); return; }
    }
    boqResults     = new Array(boqImages.length).fill(null);
    boqDefaultRates= new Array(boqImages.length).fill(null);
    boqResultsStack.innerHTML=''; boqResultsStack.style.display='none';
    boqQueueIdx=0; boqQueueRun=true;
    hideBOQError();
    boqAnalyzeBtn.disabled=true;
    renderBOQQueueProgress();
    boqProcessNext();
  }

  function boqProcessNext() {
    if (boqQueueIdx >= boqImages.length) {
      boqQueueRun=false;
      boqAnalyzeBtn.disabled=false;
      boqActionBtns.style.display='flex';
      setBOQBtnText('ALL BOQ SCANS COMPLETE');
      renderBOQQueueProgress();
      // Scroll to first result
      const first = boqResultsStack.querySelector('.boq-result-card');
      if (first) setTimeout(() => first.scrollIntoView({behavior:'smooth',block:'start'}), 200);
      return;
    }
    boqActive = boqQueueIdx;
    refreshBOQUI();
    setBOQBtnText('SCANNING '+(boqQueueIdx+1)+' / '+boqImages.length);
    renderBOQQueueProgress();
    runBOQScan(boqQueueIdx);
  }

  /* ── Queue progress badges ────────────────────────────────────── */
  function renderBOQQueueProgress() {
    const done = boqResults.filter(r=>r!==null).length;
    boqThumbLabel.textContent = boqQueueRun
      ? done+' / '+boqImages.length+' SCANS COMPLETE'
      : (boqImages.length===1?'1 IMAGE LOADED':boqImages.length+' IMAGES LOADED');

    boqImages.forEach((_,i) => {
      const item = boqThumbGrid.querySelectorAll('.thumb-item')[i];
      if (!item) return;
      let badge = item.querySelector('.thumb-status-badge');
      if (!badge) {
        badge=document.createElement('span');
        badge.className='thumb-status-badge';
        item.querySelector('.thumb-img-wrap').appendChild(badge);
      }
      if (boqResults[i]) { badge.textContent='✓'; badge.className='thumb-status-badge done'; }
      else if (boqQueueRun && i===boqQueueIdx) { badge.textContent='...'; badge.className='thumb-status-badge scanning'; }
      else { badge.textContent=''; badge.className='thumb-status-badge'; }
    });
  }

  /* ── Single scan ──────────────────────────────────────────────── */
  function runBOQScan(idx) {
    if (boqMode === 'ai') { runBOQScanAI(idx); }
    else { runBOQScanStandard(idx); }
  }

  /* Standard scan — instant template-based ── */
  function runBOQScanStandard(idx) {
    showBOQLoading('GENERATING BOQ FOR IMAGE '+(idx+1)+' OF '+boqImages.length+'...');
    let progress=0, msgIdx=0;
    boqLoadingMsg.textContent=BOQ_MSGS[0]; boqLoadingFill.style.width='0%';
    const msgInt=setInterval(()=>{ msgIdx=Math.min(msgIdx+1,BOQ_MSGS.length-1); boqLoadingMsg.textContent=BOQ_MSGS[msgIdx]; },220);
    const barInt=setInterval(()=>{ progress=Math.min(progress+14,95); boqLoadingFill.style.width=progress+'%'; },120);
    setTimeout(()=>{
      clearInterval(msgInt); clearInterval(barInt);
      boqLoadingFill.style.width='100%';
      setTimeout(()=>{
        hideBOQLoading();
        finishBOQScan(idx, generateBOQData(idx));
      },300);
    },1800);
  }

  /* AI scan — calls Anthropic API ── */
  async function runBOQScanAI(idx) {
    const img    = boqImages[idx];
    const apiKey = boqApiKeyInput.value.trim() || (document.getElementById('apiKeyInput')||{}).value?.trim() || '';

    showBOQLoading('AI GENERATING BOQ FOR IMAGE '+(idx+1)+' OF '+boqImages.length+'...');
    let msgIdx=0, progress=0;
    boqLoadingMsg.textContent=BOQ_MSGS[0]; boqLoadingFill.style.width='0%';
    const msgInt=setInterval(()=>{ msgIdx=Math.min(msgIdx+1,BOQ_MSGS.length-1); boqLoadingMsg.textContent=BOQ_MSGS[msgIdx]; },1800);
    const barInt=setInterval(()=>{ progress=Math.min(progress+Math.random()*5,88); boqLoadingFill.style.width=progress+'%'; },350);

    const PROMPT = `You are a professional quantity surveyor. Analyze this floor plan image and generate a Bill of Quantities for concrete works.

CRITICAL: Respond ONLY with a raw JSON object — no markdown, no backticks, no explanation.

{
  "project_name": "Short description",
  "total_area_sqm": 125.0,
  "total_rooms": 7,
  "boq_sections": [
    {
      "section_title": "1.  SITE PREPARATION & EARTHWORKS",
      "items": [
        { "no":"1.1", "desc":"Bulk excavation for foundation trenches", "loc":"Perimeter & load-bearing walls", "L":34.0, "W":0.50, "D":0.60, "rate":950 }
      ],
      "note": "Optional note or empty string"
    }
  ]
}

Include all 10 sections: Site Prep, Footings, Slab, Columns, Beams, RC Walls, Stairs, Rebar, Formwork, Accessories.
Base quantities on the actual floor plan. Use PHP unit rates at Metro Manila 2025 prices.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:3000,
          messages:[{role:'user',content:[
            {type:'image',source:{type:'base64',media_type:img.mime,data:img.base64}},
            {type:'text',text:PROMPT}
          ]}]
        })
      });
      clearInterval(msgInt); clearInterval(barInt);
      boqLoadingFill.style.width='100%';
      if (!resp.ok) { const e=await resp.json().catch(()=>({})); throw new Error(e.error?.message||'HTTP '+resp.status); }
      const d    = await resp.json();
      const raw  = (d.content||[]).map(b=>b.text||'').join('');
      const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
      // Convert AI response to same structure as generateBOQData
      const aiData = {
        project_name:'IMAGE '+(idx+1)+' — '+parsed.project_name,
        total_area_sqm: parsed.total_area_sqm||0,
        total_rooms: parsed.total_rooms||0,
        boq_sections: parsed.boq_sections||[]
      };
      setTimeout(()=>{ hideBOQLoading(); finishBOQScan(idx, aiData); },300);
    } catch(err) {
      clearInterval(msgInt); clearInterval(barInt);
      hideBOQLoading();
      showBOQError('AI BOQ FAILED (Image '+(idx+1)+'): '+((err instanceof SyntaxError)?'Unexpected response.':(err.message||'Unable to process.')));
      // Fallback to standard on error and continue queue
      finishBOQScan(idx, generateBOQData(idx));
    }
  }

  /* Common finish after any scan mode ── */
  function finishBOQScan(idx, data) {
    data._imageIdx = idx;
    const flat=[]; const defRates={};
    data.boq_sections.forEach(sec=>{
      flat.push({type:'sec',title:sec.section_title});
      (sec.items||[]).forEach(item=>{ flat.push({type:'item',no:item.no,desc:item.desc,loc:item.loc,L:parseFloat(item.L)||1,W:parseFloat(item.W)||1,D:parseFloat(item.D)||1,rate:parseFloat(item.rate)||0}); });
      if(sec.note) flat.push({type:'note',text:sec.note});
    });
    flat.forEach((r,i)=>{ if(r.type==='item') defRates[i]=r.rate; });
    boqResults[idx]      = { data, flat };
    boqDefaultRates[idx] = defRates;
    renderBOQQueueProgress();
    appendBOQResultCard(idx, data, flat, defRates);
    boqQueueIdx++;
    setTimeout(boqProcessNext, 2500);
  }

  /* ── Append result card to stack ─────────────────────────────── */
  function appendBOQResultCard(idx, data, flat, defRates) {
    boqResultsStack.style.display='block';
    const existing = boqResultsStack.querySelector('[data-boq-idx="'+idx+'"]');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'boq-result-card';
    card.dataset.boqIdx = idx;

    // Card header
    const header = document.createElement('div');
    header.className = 'result-card-header';
    header.innerHTML =
      '<div class="result-card-title">' +
        '<span class="result-card-dot"></span>' +
        '<span class="result-card-label">IMAGE '+(idx+1)+'</span>' +
        '<span class="result-card-mode">'+(boqMode==='ai'?'AI BOQ':'STD BOQ')+'</span>' +
      '</div>' +
      '<div class="result-card-meta">' +
        '<span>'+data.total_area_sqm+' m²</span>' +
        '<span>'+data.total_rooms+' rooms</span>' +
        '<span>'+data.project_name.replace('IMAGE '+(idx+1)+' — ','')+'</span>' +
      '</div>';
    card.appendChild(header);

    // Info strip
    const strip = document.createElement('div');
    strip.className = 'boq-info-strip';
    strip.style.marginBottom = '14px';
    strip.innerHTML =
      '<div class="boq-info-item"><span class="boq-info-label">FLOOR AREA</span><span class="boq-info-val">'+data.total_area_sqm+' m²</span></div>' +
      '<div class="boq-info-item"><span class="boq-info-label">TOTAL ROOMS</span><span class="boq-info-val">'+data.total_rooms+'</span></div>' +
      '<div class="boq-info-item"><span class="boq-info-label">CONCRETE GRADE</span><span class="boq-info-val">C25/30 (1:2:4)</span></div>' +
      '<div class="boq-info-item"><span class="boq-info-label">CURRENCY</span><span class="boq-info-val">PHP</span></div>';
    card.appendChild(strip);

    // Table wrapper
    const tableWrap = document.createElement('div');
    tableWrap.className = 'boq-table-wrap';
    const table = document.createElement('table');
    table.className = 'boq-table';
    table.dataset.boqCard = idx;

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th class="col-no">No.</th><th class="col-desc">Description of Work</th><th class="col-loc">Location / Scope</th><th class="col-num">L (m)</th><th class="col-num">W (m)</th><th class="col-num">D/T (m)</th><th class="col-num">Vol (m³)</th><th class="col-rate">Unit Rate (PHP)</th><th class="col-amt">Amount (PHP)</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const tfoot = document.createElement('tfoot');
    table.appendChild(tbody); table.appendChild(tfoot);
    tableWrap.appendChild(table);
    card.appendChild(tableWrap);

    // Disclaimer
    const disc = document.createElement('div');
    disc.className = 'boq-disclaimer';
    disc.textContent = 'Quantities estimated from standard residential proportions. Blue unit rates are editable — click to update. All totals recalculate automatically.';
    card.appendChild(disc);

    // Insert in order
    const allCards = Array.from(boqResultsStack.querySelectorAll('.boq-result-card'));
    const before = allCards.find(c=>parseInt(c.dataset.boqIdx)>idx);
    if (before) boqResultsStack.insertBefore(card, before);
    else boqResultsStack.appendChild(card);

    renderSingleBOQTable(tbody, tfoot, flat, idx);
    setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }

  /* ── Render one BOQ table ─────────────────────────────────────── */
  function fmt(n){ return Number(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function calcVol(row){ return row.L*row.W*row.D; }

  function renderSingleBOQTable(tbody, tfoot, flat, cardIdx) {
    tbody.innerHTML=''; tfoot.innerHTML='';
    let grand=0;
    flat.forEach((row,idx)=>{
      const tr=document.createElement('tr');
      if(row.type==='sec'){ tr.className='boq-sec-row'; tr.innerHTML='<td colspan="9">'+row.title+'</td>'; tbody.appendChild(tr); return; }
      if(row.type==='note'){ tr.className='boq-note-row'; tr.innerHTML='<td class="note-tag">NOTE</td><td colspan="8">'+row.text+'</td>'; tbody.appendChild(tr); return; }
      const vol=calcVol(row), amt=vol*row.rate; grand+=amt;
      tr.className='boq-item-row'; tr.dataset.idx=idx; tr.dataset.card=cardIdx;
      tr.innerHTML='<td class="col-no">'+row.no+'</td><td class="col-desc">'+row.desc+'</td><td class="col-loc">'+row.loc+'</td><td class="col-num">'+row.L.toFixed(2)+'</td><td class="col-num">'+row.W.toFixed(2)+'</td><td class="col-num">'+row.D.toFixed(2)+'</td><td class="col-num vol-cell">'+vol.toFixed(2)+'</td><td class="col-rate"><span class="rate-display" data-card="'+cardIdx+'" data-idx="'+idx+'">'+fmt(row.rate)+'</span><input class="rate-input" data-card="'+cardIdx+'" data-idx="'+idx+'" type="number" value="'+row.rate+'" min="0" step="100" style="display:none;"></td><td class="col-amt amt-cell">'+fmt(amt)+'</td>';
      tbody.appendChild(tr);
    });
    const cont=grand*0.10, vat=(grand+cont)*0.12, total=grand+cont+vat;
    [['SUBTOTAL — CONCRETE WORKS',grand,'boq-subtotal-row'],['Contingency @ 10%',cont,'boq-foot-row'],['VAT @ 12%',vat,'boq-foot-row'],['GRAND TOTAL (PHP)',total,'boq-grand-row']].forEach(([l,v,c])=>{
      const tr=document.createElement('tr'); tr.className=c;
      tr.innerHTML='<td colspan="8">'+l+'</td><td class="col-amt">₱ '+fmt(v)+'</td>'; tfoot.appendChild(tr);
    });
  }

  /* ── Editable rates (scoped to card) ─────────────────────────── */
  document.addEventListener('click',function(e){
    const d=e.target.closest('.rate-display'); if(!d) return;
    const inp=document.querySelector('.rate-input[data-card="'+d.dataset.card+'"][data-idx="'+d.dataset.idx+'"]');
    if(!inp) return; d.style.display='none'; inp.style.display='block'; inp.focus(); inp.select();
  });
  document.addEventListener('change',function(e){ const i=e.target.closest('.rate-input'); if(i) commitBOQRate(i); });
  document.addEventListener('keydown',function(e){
    const i=e.target.closest('.rate-input'); if(!i) return;
    if(e.key==='Enter'){commitBOQRate(i);i.blur();}
    if(e.key==='Escape'){i.style.display='none';const d=document.querySelector('.rate-display[data-card="'+i.dataset.card+'"][data-idx="'+i.dataset.idx+'"]');if(d)d.style.display='inline';}
  });
  document.addEventListener('focusout',function(e){ const i=e.target.closest('.rate-input'); if(i) commitBOQRate(i); });

  function commitBOQRate(input) {
    const cardIdx = parseInt(input.dataset.card);
    const rowIdx  = parseInt(input.dataset.idx);
    const val     = Math.max(0, parseFloat(input.value)||0);
    if (boqResults[cardIdx]) {
      boqResults[cardIdx].flat[rowIdx].rate = val;
      // Re-render just that card's table
      const card  = boqResultsStack.querySelector('[data-boq-idx="'+cardIdx+'"]');
      if (!card) return;
      const tbody = card.querySelector('tbody');
      const tfoot = card.querySelector('tfoot');
      renderSingleBOQTable(tbody, tfoot, boqResults[cardIdx].flat, cardIdx);
    }
  }

  /* ── Reset / Export ───────────────────────────────────────────── */
  window.resetBOQRates = function() {
    boqResults.forEach((res,cardIdx)=>{
      if (!res) return;
      const defRates = boqDefaultRates[cardIdx] || {};
      Object.entries(defRates).forEach(([i,r])=>{ res.flat[i].rate=r; });
      const card  = boqResultsStack.querySelector('[data-boq-idx="'+cardIdx+'"]');
      if (!card) return;
      renderSingleBOQTable(card.querySelector('tbody'), card.querySelector('tfoot'), res.flat, cardIdx);
    });
  };

  window.clearBOQScan = resetBOQFull;

  window.exportBOQCSV = function() {
    const lines=[['Image','No.','Description','Location','L(m)','W(m)','D/T(m)','Vol(m³)','Rate(PHP)','Amount(PHP)'].join(',')];
    boqResults.forEach((res,ci)=>{
      if(!res) return;
      res.flat.forEach(row=>{
        if(row.type!=='item') return;
        const vol=calcVol(row),amt=vol*row.rate;
        lines.push(['IMAGE '+(ci+1),row.no,'"'+row.desc+'"','"'+row.loc+'"',row.L.toFixed(2),row.W.toFixed(2),row.D.toFixed(2),vol.toFixed(2),row.rate.toFixed(2),amt.toFixed(2)].join(','));
      });
      lines.push('');
    });
    const blob=new Blob([lines.join('\n')],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='BOQ_All_Images.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── UI helpers ───────────────────────────────────────────────── */
  function setBOQBtnText(txt) {
    boqBtnText.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="2" y="2" width="5" height="5" stroke="#0a0e1a" stroke-width="1.3" rx="1"/><rect x="9" y="2" width="5" height="5" stroke="#0a0e1a" stroke-width="1.3" rx="1"/><rect x="2" y="9" width="5" height="5" stroke="#0a0e1a" stroke-width="1.3" rx="1"/><rect x="9" y="9" width="5" height="5" stroke="#0a0e1a" stroke-width="1.3" rx="1"/></svg> ' + txt;
  }
  function showBOQLoading(msg) {
    boqLoadingState.style.cssText='display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 0;';
    if(msg) boqLoadingMsg.textContent=msg;
  }
  function hideBOQLoading() { boqLoadingState.style.display='none'; }
  function showBOQError(msg) { boqErrorMsg.textContent=msg; boqErrorPanel.classList.add('visible'); }
  function hideBOQError()    { boqErrorPanel.classList.remove('visible'); }

})();