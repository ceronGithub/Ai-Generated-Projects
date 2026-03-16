/* boq.js — BOQ Concrete Works Module (No API Key Required) */

(function () {
  'use strict';

  /* ── Tab switcher ──────────────────────────────────────────────── */
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

  /* ── DOM refs ──────────────────────────────────────────────────── */
  const boqFileInput    = document.getElementById('boqFileInput');
  const boqUploadZone   = document.getElementById('boqUploadZone');
  const boqPreviewPanel = document.getElementById('boqPreviewPanel');
  const boqPreviewImg   = document.getElementById('boqPreviewImg');
  const boqAnalyzeBtn   = document.getElementById('boqAnalyzeBtn');
  const boqLoadingState = document.getElementById('boqLoadingState');
  const boqLoadingMsg   = document.getElementById('boqLoadingMsg');
  const boqLoadingFill  = document.getElementById('boqLoadingFill');
  const boqErrorPanel   = document.getElementById('boqErrorPanel');
  const boqErrorMsg     = document.getElementById('boqErrorMsg');
  const boqResultsArea  = document.getElementById('boqResultsArea');
  const boqUploadPanel  = document.getElementById('boqUploadPanel');
  const boqActionBtns   = document.getElementById('boqActionBtns');
  const boqAreaEl       = document.getElementById('boqArea');
  const boqRoomsEl      = document.getElementById('boqRooms');
  const boqUploadHint   = document.getElementById('boqUploadHint');

  /* ── State ─────────────────────────────────────────────────────── */
  let imageLoaded   = false;
  let BOQ_DATA      = [];
  let DEFAULT_RATES = {};

  /* ── Static BOQ template (no API needed) ───────────────────────── */
  const STATIC_BOQ = {
    project_name:    'Multi-Room Residential Unit — Concrete Works',
    total_area_sqm:  125,
    total_rooms:     7,
    boq_sections: [
      {
        section_title: '1.  SITE PREPARATION & EARTHWORKS',
        items: [
          { no:'1.1', desc:'Bulk excavation for foundation trenches',       loc:'Perimeter & interior load-bearing walls',        L:34.0,  W:0.50,  D:0.60, rate:950  },
          { no:'1.2', desc:'Excavation for isolated column footings',        loc:'6 nos. internal columns',                        L:6.0,   W:0.90,  D:0.90, rate:1100 },
          { no:'1.3', desc:'Gravel bedding / compacted fill under slab',     loc:'Full floor area ~125 m²',                        L:11.18, W:11.18, D:0.10, rate:650  },
          { no:'1.4', desc:'Disposal of excavated material (off-site)',      loc:'Estimated excavation volume',                    L:34.0,  W:0.50,  D:0.60, rate:400  },
        ],
        note: 'Includes machine excavation, manual trimming, and levelling.'
      },
      {
        section_title: '2.  CONCRETE FOOTINGS  (C25/30)',
        items: [
          { no:'2.1', desc:'Isolated square footing — 900×900×350 mm',      loc:'6 nos. column footings',                         L:0.90,  W:0.90,  D:0.35, rate:6200 },
          { no:'2.2', desc:'Strip footing — perimeter walls',                loc:'External walls, ~34 m run',                      L:34.0,  W:0.40,  D:0.35, rate:5800 },
          { no:'2.3', desc:'Strip footing — internal load-bearing walls',    loc:'Bedroom / bathroom dividers, ~18 m',             L:18.0,  W:0.30,  D:0.30, rate:5800 },
        ],
        note: 'Includes formwork, placing, vibrating & curing. Rebar in separate section.'
      },
      {
        section_title: '3.  GROUND FLOOR SLAB  (C25/30, 150 mm)',
        items: [
          { no:'3.1', desc:'RC slab — living / dining / kitchen zone',       loc:'Open-plan lower zone (~72 m²)',                  L:10.0,  W:7.20,  D:0.15, rate:7500 },
          { no:'3.2', desc:'RC slab — bedroom wing',                         loc:'Bedroom 1, Bedroom 2, Hallway (~53 m²)',         L:9.80,  W:5.40,  D:0.15, rate:7500 },
          { no:'3.3', desc:'RC slab — bathroom (depressed 50 mm wet area)',  loc:'Bathroom area (~8.4 m²)',                        L:3.00,  W:2.80,  D:0.15, rate:8200 },
          { no:'3.4', desc:'Concrete haunching at slab perimeter',           loc:'All external edges, 34 m run',                   L:34.0,  W:0.15,  D:0.10, rate:1800 },
        ],
        note: 'Slab includes BRC mesh A142, vapour barrier, edge formwork & finishing screed.'
      },
      {
        section_title: '4.  REINFORCED CONCRETE COLUMNS  (C25/30)',
        items: [
          { no:'4.1', desc:'RC column 200×200 mm — floor to beam (3.0 m)',   loc:'6 nos. internal columns',                        L:0.20,  W:0.20,  D:3.00, rate:9500  },
          { no:'4.2', desc:'RC column 200×300 mm — corner / perimeter',      loc:'4 nos. perimeter columns',                       L:0.20,  W:0.30,  D:3.00, rate:10500 },
        ],
        note: 'Includes plywood formwork, 4-bar main rebar + ties, placing & curing.'
      },
      {
        section_title: '5.  REINFORCED CONCRETE BEAMS  (C25/30)',
        items: [
          { no:'5.1', desc:'Main beam 200×400 mm — longitudinal span',       loc:'3 beams × ~10 m span each',                      L:30.0,  W:0.20,  D:0.40, rate:8800 },
          { no:'5.2', desc:'Secondary beam 150×300 mm — transverse',         loc:'4 beams × ~7.5 m span each',                     L:30.0,  W:0.15,  D:0.30, rate:8200 },
          { no:'5.3', desc:'Ring beam / tie beam at foundation level',        loc:'Perimeter + internal, ~52 m total',               L:52.0,  W:0.20,  D:0.25, rate:7600 },
        ],
        note: 'Includes soffit/side formwork, 2-layer rebar arrangement, stirrups & curing.'
      },
      {
        section_title: '6.  RC WALLS — BATHROOM & WET AREA',
        items: [
          { no:'6.1', desc:'RC wet-area wall 150 mm thick',                  loc:'Bathroom perimeter, 3.0 m high × 17.6 m run',    L:17.6,  W:0.15,  D:3.00, rate:9200 },
          { no:'6.2', desc:'RC parapet / curb at depressed bathroom slab',   loc:'Wet area perimeter, ~11 m run',                   L:11.0,  W:0.10,  D:0.15, rate:5500 },
        ],
        note: ''
      },
      {
        section_title: '7.  STAIRS / STEPS',
        items: [
          { no:'7.1', desc:'RC entrance steps — 3 nos., 1200 mm wide',       loc:'Main entrance, external',                        L:1.20,  W:0.30,  D:0.15, rate:6500 },
        ],
        note: ''
      },
      {
        section_title: '8.  REINFORCING STEEL  (Grade 60, Fy = 415 MPa)',
        items: [
          { no:'8.1', desc:'Deformed bar Ø10 mm — slab mesh top & bottom',  loc:'Full slab area ~125 m²',                         L:125.0, W:1.0,   D:1.0,  rate:680  },
          { no:'8.2', desc:'Deformed bar Ø12 mm — beam main bars',          loc:'All beams, ~110 m run',                          L:110.0, W:1.0,   D:1.0,  rate:820  },
          { no:'8.3', desc:'Deformed bar Ø16 mm — column main bars',        loc:'10 nos. columns × 3 m height',                   L:30.0,  W:1.0,   D:1.0,  rate:1050 },
          { no:'8.4', desc:'Deformed bar Ø10 mm — stirrups & ties',         loc:'All beams & columns (allowance)',                 L:85.0,  W:1.0,   D:1.0,  rate:680  },
          { no:'8.5', desc:'Deformed bar Ø12 mm — footing reinforcement',   loc:'All footings (allowance)',                       L:55.0,  W:1.0,   D:1.0,  rate:820  },
        ],
        note: 'Rebar quantities are in linear metre (lm). Multiply by unit weight for tonnage.'
      },
      {
        section_title: '9.  FORMWORK & FALSEWORK',
        items: [
          { no:'9.1', desc:'Plywood formwork (12 mm) — slab soffit',        loc:'Slab area ~125 m², 2 reuses assumed',            L:125.0, W:1.0,   D:1.0,  rate:480 },
          { no:'9.2', desc:'Timber/plywood formwork — beam sides & soffit', loc:'All beams ~60 m × avg 1.0 m perimeter',         L:60.0,  W:1.0,   D:1.0,  rate:620 },
          { no:'9.3', desc:'Plywood formwork — column faces',               loc:'10 nos. columns × 4 faces × 3 m height',        L:120.0, W:1.0,   D:1.0,  rate:550 },
          { no:'9.4', desc:'Formwork — footing sides',                      loc:'All footings, perimeter ~94 m × 0.35 m deep',   L:94.0,  W:1.0,   D:0.35, rate:420 },
        ],
        note: ''
      },
      {
        section_title: '10.  CONCRETE ACCESSORIES & SUNDRIES',
        items: [
          { no:'10.1', desc:'Concrete cover blocks (20 mm & 40 mm)',        loc:'Allowance — all elements',                       L:1.0,   W:1.0,   D:1.0,  rate:12500 },
          { no:'10.2', desc:'Expansion joint filler (12 mm cork/foam)',     loc:'Slab perimeter & construction joints ~34 m',     L:1.0,   W:1.0,   D:1.0,  rate:8500  },
          { no:'10.3', desc:'Curing compound (spray-applied)',              loc:'All exposed concrete surfaces ~275 m²',          L:1.0,   W:1.0,   D:1.0,  rate:6800  },
          { no:'10.4', desc:'Concrete pump hire & placement',               loc:'Allowance — full pour programme',                L:1.0,   W:1.0,   D:1.0,  rate:35000 },
          { no:'10.5', desc:'Concrete testing (cubes, slump tests)',        loc:'Per pour allowance',                             L:1.0,   W:1.0,   D:1.0,  rate:18000 },
        ],
        note: ''
      },
    ]
  };

  /* ── Loading messages ──────────────────────────────────────────── */
  const BOQ_MSGS = [
    'READING FLOOR PLAN...',
    'DETECTING ROOM BOUNDARIES...',
    'MEASURING WALL LENGTHS...',
    'CALCULATING SLAB AREAS...',
    'SIZING FOOTINGS & COLUMNS...',
    'COMPUTING CONCRETE VOLUMES...',
    'ASSEMBLING BOQ ITEMS...',
    'CALCULATING TOTALS...',
  ];

  /* ── Upload drag & drop ─────────────────────────────────────────── */
  boqUploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    boqUploadZone.classList.add('drag-over');
  });
  boqUploadZone.addEventListener('dragleave', () => boqUploadZone.classList.remove('drag-over'));
  boqUploadZone.addEventListener('drop', e => {
    e.preventDefault();
    boqUploadZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && (f.type.startsWith('image/') || f.type === '')) loadBOQFile(f);
  });
  boqFileInput.addEventListener('change', () => {
    if (boqFileInput.files[0]) loadBOQFile(boqFileInput.files[0]);
  });

  function loadBOQFile(file) {
    hideBOQError();
    const reader = new FileReader();
    reader.onerror = () => showBOQError('FILE READ ERROR: Could not read file. Please try again.');
    reader.onload = e => {
      boqPreviewImg.src = e.target.result;
      boqPreviewPanel.style.display = 'block';
      imageLoaded = true;
      boqAnalyzeBtn.disabled = false;
      boqUploadHint.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="#00ff9d" stroke-width="1"/>
          <path d="M4 7l2 2 4-4" stroke="#00ff9d" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Floor plan loaded — no API key needed. Click
        <strong style="color:#00f5ff;">GENERATE BOQ ANALYSIS</strong> to build the BOQ instantly.
      `;
    };
    reader.readAsDataURL(file);
  }

  /* ── Generate BOQ (no API — fully local) ────────────────────────── */
  window.runBOQAnalysis = function () {
    if (!imageLoaded) return;

    boqAnalyzeBtn.disabled = true;
    hideBOQError();
    showBOQLoading();

    /* Simulate a short scan animation (1.8s total) then render */
    let msgIdx = 0, progress = 0;
    boqLoadingMsg.textContent = BOQ_MSGS[0];
    boqLoadingFill.style.width = '0%';

    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, BOQ_MSGS.length - 1);
      boqLoadingMsg.textContent = BOQ_MSGS[msgIdx];
    }, 220);

    const barInterval = setInterval(() => {
      progress = Math.min(progress + 14, 95);
      boqLoadingFill.style.width = progress + '%';
    }, 120);

    setTimeout(() => {
      clearInterval(msgInterval);
      clearInterval(barInterval);
      boqLoadingFill.style.width = '100%';

      setTimeout(() => {
        hideBOQLoading();
        renderBOQFromStatic();
        boqAnalyzeBtn.disabled = false;
      }, 300);
    }, 1800);
  };

  /* ── Render from static data ─────────────────────────────────────── */
  function renderBOQFromStatic() {
    BOQ_DATA      = [];
    DEFAULT_RATES = {};

    STATIC_BOQ.boq_sections.forEach(sec => {
      BOQ_DATA.push({ type: 'sec', title: sec.section_title });
      sec.items.forEach(item => {
        BOQ_DATA.push({
          type: 'item',
          no:   item.no,   desc: item.desc,
          loc:  item.loc,  L: item.L,
          W:    item.W,    D: item.D,
          rate: item.rate,
        });
      });
      if (sec.note) BOQ_DATA.push({ type: 'note', text: sec.note });
    });

    BOQ_DATA.forEach((r, i) => { if (r.type === 'item') DEFAULT_RATES[i] = r.rate; });

    boqAreaEl.textContent  = STATIC_BOQ.total_area_sqm + ' m²';
    boqRoomsEl.textContent = STATIC_BOQ.total_rooms;
    document.getElementById('boqProjectBadge').textContent = STATIC_BOQ.project_name;

    renderBOQTable();

    boqUploadPanel.style.display = 'none';
    boqResultsArea.style.display = 'block';
    boqActionBtns.style.display  = 'flex';
  }

  /* ── Render BOQ table ────────────────────────────────────────────── */
  function fmt(n) {
    return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function calcVol(row) { return row.L * row.W * row.D; }

  function renderBOQTable() {
    const tbody = document.getElementById('boqBody');
    const tfoot = document.getElementById('boqFoot');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    let grandTotal = 0;

    BOQ_DATA.forEach((row, idx) => {
      const tr = document.createElement('tr');

      if (row.type === 'sec') {
        tr.className = 'boq-sec-row';
        tr.innerHTML = '<td colspan="9">' + row.title + '</td>';
        tbody.appendChild(tr); return;
      }
      if (row.type === 'note') {
        tr.className = 'boq-note-row';
        tr.innerHTML = '<td class="note-tag">NOTE</td><td colspan="8">' + row.text + '</td>';
        tbody.appendChild(tr); return;
      }

      const vol = calcVol(row);
      const amt = vol * row.rate;
      grandTotal += amt;

      tr.className   = 'boq-item-row';
      tr.dataset.idx = idx;
      tr.innerHTML =
        '<td class="col-no">'  + row.no + '</td>' +
        '<td class="col-desc">' + row.desc + '</td>' +
        '<td class="col-loc">'  + row.loc  + '</td>' +
        '<td class="col-num">'  + row.L.toFixed(2) + '</td>' +
        '<td class="col-num">'  + row.W.toFixed(2) + '</td>' +
        '<td class="col-num">'  + row.D.toFixed(2) + '</td>' +
        '<td class="col-num vol-cell">' + vol.toFixed(2) + '</td>' +
        '<td class="col-rate">' +
          '<span class="rate-display" data-idx="' + idx + '">' + fmt(row.rate) + '</span>' +
          '<input class="rate-input" data-idx="' + idx + '" type="number" value="' + row.rate + '" min="0" step="100" style="display:none;" />' +
        '</td>' +
        '<td class="col-amt amt-cell" data-idx="' + idx + '">' + fmt(amt) + '</td>';
      tbody.appendChild(tr);
    });

    const contingency = grandTotal * 0.10;
    const vat          = (grandTotal + contingency) * 0.12;
    const total        = grandTotal + contingency + vat;

    [
      ['SUBTOTAL — CONCRETE WORKS (before contingency)', grandTotal,   'boq-subtotal-row'],
      ['Contingency @ 10%',                               contingency, 'boq-foot-row'],
      ['VAT @ 12% (on subtotal + contingency)',           vat,         'boq-foot-row'],
      ['GRAND TOTAL — CONCRETE WORKS (PHP)',              total,       'boq-grand-row'],
    ].forEach(([label, val, cls]) => {
      const tr = document.createElement('tr');
      tr.className = cls;
      tr.innerHTML = '<td colspan="8">' + label + '</td><td class="col-amt">₱ ' + fmt(val) + '</td>';
      tfoot.appendChild(tr);
    });

    window._boqGrandTotal = total;
  }

  /* ── Editable rate cells ─────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    const display = e.target.closest('.rate-display');
    if (!display) return;
    const idx = display.dataset.idx;
    const inp = document.querySelector('.rate-input[data-idx="' + idx + '"]');
    display.style.display = 'none';
    inp.style.display = 'block';
    inp.focus(); inp.select();
  });

  document.addEventListener('change', function (e) {
    const inp = e.target.closest('.rate-input');
    if (inp) commitRate(inp);
  });

  document.addEventListener('keydown', function (e) {
    const inp = e.target.closest('.rate-input');
    if (!inp) return;
    if (e.key === 'Enter')  { commitRate(inp); inp.blur(); }
    if (e.key === 'Escape') {
      inp.style.display = 'none';
      const d = document.querySelector('.rate-display[data-idx="' + inp.dataset.idx + '"]');
      if (d) d.style.display = 'inline';
    }
  });

  document.addEventListener('focusout', function (e) {
    const inp = e.target.closest('.rate-input');
    if (inp) commitRate(inp);
  });

  function commitRate(input) {
    const idx = parseInt(input.dataset.idx);
    BOQ_DATA[idx].rate = Math.max(0, parseFloat(input.value) || 0);
    renderBOQTable();
  }

  /* ── Reset / Clear / Export ──────────────────────────────────────── */
  window.resetBOQRates = function () {
    Object.entries(DEFAULT_RATES).forEach(([i, r]) => { BOQ_DATA[i].rate = r; });
    renderBOQTable();
  };

  window.clearBOQScan = function () {
    imageLoaded = false;
    boqFileInput.value    = '';
    boqPreviewImg.src     = '';
    boqPreviewPanel.style.display = 'none';
    boqResultsArea.style.display  = 'none';
    boqActionBtns.style.display   = 'none';
    boqUploadPanel.style.display  = 'block';
    boqAnalyzeBtn.disabled = true;
    BOQ_DATA = [];
    hideBOQError();
    boqUploadHint.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="#00f5ff" stroke-width="1"/>
        <line x1="7" y1="4" x2="7" y2="7.5" stroke="#00f5ff" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="7" cy="10" r="0.7" fill="#00f5ff"/>
      </svg>
      Upload your floor plan image — no API key needed. The BOQ will be generated instantly from the uploaded plan.
    `;
  };

  window.exportBOQCSV = function () {
    if (!BOQ_DATA.length) return;
    const lines = [
      ['No.','Description','Location','L (m)','W (m)','D/T (m)','Volume (m³)','Unit Rate (PHP)','Amount (PHP)'].join(',')
    ];
    BOQ_DATA.forEach(row => {
      if (row.type !== 'item') return;
      const vol = calcVol(row), amt = vol * row.rate;
      lines.push([
        row.no, '"' + row.desc + '"', '"' + row.loc + '"',
        row.L.toFixed(2), row.W.toFixed(2), row.D.toFixed(2),
        vol.toFixed(2), row.rate.toFixed(2), amt.toFixed(2)
      ].join(','));
    });
    lines.push('');
    lines.push('"GRAND TOTAL (incl. 10% contingency + 12% VAT)",,,,,,,,,' + fmt(window._boqGrandTotal || 0));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'BOQ_Concrete_Works.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── UI helpers ───────────────────────────────────────────────────── */
  function showBOQLoading() {
    boqLoadingState.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 0;';
  }
  function hideBOQLoading() { boqLoadingState.style.display = 'none'; }
  function showBOQError(msg) { boqErrorMsg.textContent = msg; boqErrorPanel.classList.add('visible'); }
  function hideBOQError()    { boqErrorPanel.classList.remove('visible'); }

})();