/* ============================================================
   HOLO·PLAN — MODULE 04 FLOOR PLAN GENERATOR
   File: js/generator.js
   ============================================================ */

'use strict';

/* ══ Shared state ════════════════════════════════════════════ */
var genState = {
  option: null, area: null, spaceType: null,
  layout: null, customDesc: '', apiKey: ''
};

/* ── Option 1 (Upload) state ── */
var genUpState = {
  area: null, spaceType: null, layout: null,
  files: [], activeIdx: 0
};

/* ── Option 2 (Generate) reference images state ── */
var genRefState = {
  files: [], activeIdx: 0
};

/* ══ Init ════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {

  /* Patch switchTab */
  var _orig = window.switchTab;
  window.switchTab = function (tab) {
    var va = document.getElementById('viewAnalyzer');
    var vb = document.getElementById('viewBoq');
    var vg = document.getElementById('viewGenerator');
    if (va) va.style.display = 'none';
    if (vb) vb.style.display = 'none';
    if (vg) vg.style.display = 'none';
    document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.remove('active'); });
    if (tab === 'generator') {
      if (vg) vg.style.display = 'block';
      var tg = document.getElementById('tabGenerator');
      if (tg) tg.classList.add('active');
    } else {
      if (_orig) _orig(tab);
    }
  };

  /* ── Option 1: multi-image upload zone ── */
  _initMultiUpload(
    'genFileInput', 'genUploadZone',
    genUpState,
    'genUpThumbBar', 'genUpThumbGrid', 'genUpThumbBarLabel',
    'genPreviewWrap', 'genPreviewImg', 'genPreviewName',
    'genUpImgNav', 'genUpPrevBtn', 'genUpNextBtn', 'genUpNavCounter',
    function () { genUpCheckReady(); }
  );

  /* ── Option 2: reference image upload zone ── */
  _initMultiUpload(
    'genRefFileInput', 'genRefUploadZone',
    genRefState,
    'genRefThumbBar', 'genRefThumbGrid', 'genRefThumbBarLabel',
    'genRefPreviewWrap', 'genRefPreviewImg', 'genRefPreviewName',
    'genRefImgNav', 'genRefPrevBtn', 'genRefNextBtn', 'genRefNavCounter',
    function () { /* reference images don't affect ready state */ }
  );

  /* Howto toggle */
  var ht = document.getElementById('genHowtoToggle');
  if (ht) {
    ht.addEventListener('click', function () {
      var steps   = document.getElementById('genHowtoSteps');
      var chevron = document.getElementById('genHowtoChevron');
      var open    = steps && steps.style.display !== 'none';
      if (steps)   steps.style.display    = open ? 'none' : 'block';
      if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
    });
  }
});

/* ══ Multi-upload initialiser ════════════════════════════════ */
function _initMultiUpload(
  inputId, zoneId,
  stateObj,
  thumbBarId, thumbGridId, thumbLabelId,
  previewWrapId, previewImgId, previewNameId,
  navId, prevBtnId, nextBtnId, counterid,
  onChange
) {
  var fi   = document.getElementById(inputId);
  var zone = document.getElementById(zoneId);
  if (!fi || !zone) return;

  function loadFiles(files) {
    Array.from(files).forEach(function (f) { stateObj.files.push(f); });
    stateObj.activeIdx = stateObj.files.length - 1;
    _renderThumbs(stateObj, thumbBarId, thumbGridId, thumbLabelId,
      previewWrapId, previewImgId, previewNameId,
      navId, prevBtnId, nextBtnId, counterid, onChange);
    _showPreview(stateObj, previewWrapId, previewImgId, previewNameId,
      navId, prevBtnId, nextBtnId, counterid);
    onChange();
  }

  fi.addEventListener('change', function (e) { if (e.target.files.length) loadFiles(e.target.files); fi.value = ''; });
  zone.addEventListener('dragover',  function (e) { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', function ()  { zone.classList.remove('drag'); });
  zone.addEventListener('drop', function (e) {
    e.preventDefault(); zone.classList.remove('drag');
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
  });
}

function _renderThumbs(stateObj, thumbBarId, thumbGridId, thumbLabelId,
  previewWrapId, previewImgId, previewNameId,
  navId, prevBtnId, nextBtnId, counterid, onChange
) {
  var bar   = document.getElementById(thumbBarId);
  var grid  = document.getElementById(thumbGridId);
  var label = document.getElementById(thumbLabelId);
  if (!bar || !grid) return;
  if (!stateObj.files.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  if (label) label.textContent = stateObj.files.length + ' IMAGE' + (stateObj.files.length > 1 ? 'S' : '') + ' QUEUED';
  grid.innerHTML = '';
  stateObj.files.forEach(function (f, i) {
    var thumb = document.createElement('div');
    thumb.className = 'thumb-item' + (i === stateObj.activeIdx ? ' active' : '');
    var img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.onclick = function () {
      stateObj.activeIdx = i;
      _showPreview(stateObj, previewWrapId, previewImgId, previewNameId,
        navId, prevBtnId, nextBtnId, counterid);
      _renderThumbs(stateObj, thumbBarId, thumbGridId, thumbLabelId,
        previewWrapId, previewImgId, previewNameId,
        navId, prevBtnId, nextBtnId, counterid, onChange);
    };
    var del = document.createElement('button');
    del.className = 'thumb-del';
    del.textContent = '✕';
    del.onclick = function (e) {
      e.stopPropagation();
      stateObj.files.splice(i, 1);
      if (stateObj.activeIdx >= stateObj.files.length) stateObj.activeIdx = Math.max(0, stateObj.files.length - 1);
      _renderThumbs(stateObj, thumbBarId, thumbGridId, thumbLabelId,
        previewWrapId, previewImgId, previewNameId,
        navId, prevBtnId, nextBtnId, counterid, onChange);
      if (stateObj.files.length) {
        _showPreview(stateObj, previewWrapId, previewImgId, previewNameId,
          navId, prevBtnId, nextBtnId, counterid);
      } else {
        var pw = document.getElementById(previewWrapId);
        if (pw) pw.style.display = 'none';
      }
      onChange();
    };
    thumb.appendChild(img); thumb.appendChild(del);
    grid.appendChild(thumb);
  });
}

function _showPreview(stateObj, previewWrapId, previewImgId, previewNameId,
  navId, prevBtnId, nextBtnId, counterid
) {
  var pw  = document.getElementById(previewWrapId);
  var pi  = document.getElementById(previewImgId);
  var pn  = document.getElementById(previewNameId);
  var nav = document.getElementById(navId);
  var pb  = document.getElementById(prevBtnId);
  var nb  = document.getElementById(nextBtnId);
  var ct  = document.getElementById(counterid);
  if (!pw || !stateObj.files.length) return;
  var f = stateObj.files[stateObj.activeIdx];
  if (pi) pi.src = URL.createObjectURL(f);
  if (pn) pn.textContent = 'IMAGE ' + (stateObj.activeIdx + 1) + ' — ' + f.name;
  pw.style.display = 'block';
  if (nav) nav.style.display = stateObj.files.length > 1 ? 'flex' : 'none';
  if (pb) pb.disabled = stateObj.activeIdx === 0;
  if (nb) nb.disabled = stateObj.activeIdx === stateObj.files.length - 1;
  if (ct) ct.textContent = (stateObj.activeIdx + 1) + ' / ' + stateObj.files.length;
}

/* ══ Mode selection ══════════════════════════════════════════ */
function selectGenOption(opt) {
  genState.option = opt;
  var cu = document.getElementById('genCardUpload');
  var cg = document.getElementById('genCardGenerate');
  if (cu) cu.classList.toggle('active', opt === 'upload');
  if (cg) cg.classList.toggle('active', opt === 'generate');
  var chu = document.getElementById('genCheckUpload');
  var chg = document.getElementById('genCheckGenerate');
  if (chu) chu.style.opacity = opt === 'upload'   ? '1' : '0';
  if (chg) chg.style.opacity = opt === 'generate' ? '1' : '0';
  var iu = document.getElementById('genInstructUpload');
  var ig = document.getElementById('genInstructGenerate');
  if (iu) iu.style.display = opt === 'upload'   ? 'block' : 'none';
  if (ig) ig.style.display = opt === 'generate' ? 'block' : 'none';
  var pu = document.getElementById('genUploadPanel');
  var pg = document.getElementById('genGeneratePanel');
  if (pu) pu.style.display = opt === 'upload'   ? 'block' : 'none';
  if (pg) pg.style.display = opt === 'generate' ? 'block' : 'none';
}

/* ══ Option 1 — Upload panel form helpers ════════════════════ */
function genUpSetArea(v) {
  var el = document.getElementById('genUpAreaInput');
  if (el) el.value = v;
  genUpState.area = v;
  document.querySelectorAll('#genUploadPanel .gen-preset').forEach(function (b) {
    b.classList.toggle('sel', b.textContent.trim() === v + ' sqm');
  });
  genUpCheckReady();
}
function genUpOnAreaInput() {
  var v = parseInt(document.getElementById('genUpAreaInput').value);
  if (v > 0) {
    genUpState.area = v;
    document.querySelectorAll('#genUploadPanel .gen-preset').forEach(function (b) {
      b.classList.toggle('sel', b.textContent.trim() === v + ' sqm');
    });
    genUpCheckReady();
  }
}
function genUpSelectType(el, type) {
  document.querySelectorAll('#genUpTypePills .gen-pill').forEach(function (b) { b.classList.remove('sel'); });
  el.classList.add('sel');
  genUpState.spaceType = type;
  genUpCheckReady();
}
function genUpSelectLayout(el, layout) {
  document.querySelectorAll('#genUpLayoutCards .gen-layout-card').forEach(function (c) { c.classList.remove('active'); });
  el.classList.add('active');
  genUpState.layout = layout;
  var w = document.getElementById('genUpCustomWrap');
  if (w) w.style.display = layout === 'Custom' ? 'block' : 'none';
  genUpCheckReady();
}
function genUpCheckReady() {
  var ready = genUpState.area && genUpState.spaceType && genUpState.layout;
  var btn = document.getElementById('genAnalyzeUploadBtn');
  if (btn) btn.disabled = !ready;
}
function genUpClearAll() {
  genUpState.files = []; genUpState.activeIdx = 0;
  var bar = document.getElementById('genUpThumbBar');
  var pw  = document.getElementById('genPreviewWrap');
  if (bar) bar.style.display = 'none';
  if (pw)  pw.style.display  = 'none';
  genUpCheckReady();
}
function clearGenUpload() {
  genUpState.files = []; genUpState.activeIdx = 0;
  var bar = document.getElementById('genUpThumbBar');
  var pw  = document.getElementById('genPreviewWrap');
  if (bar) bar.style.display = 'none';
  if (pw)  pw.style.display  = 'none';
  genUpCheckReady();
}
function genUpNavigate(dir) {
  genUpState.activeIdx = Math.max(0, Math.min(genUpState.files.length - 1, genUpState.activeIdx + dir));
  _showPreview(genUpState, 'genPreviewWrap', 'genPreviewImg', 'genPreviewName',
    'genUpImgNav', 'genUpPrevBtn', 'genUpNextBtn', 'genUpNavCounter');
  _renderThumbs(genUpState, 'genUpThumbBar', 'genUpThumbGrid', 'genUpThumbBarLabel',
    'genPreviewWrap', 'genPreviewImg', 'genPreviewName',
    'genUpImgNav', 'genUpPrevBtn', 'genUpNextBtn', 'genUpNavCounter', genUpCheckReady);
}
async function genAnalyzeUpload() {
  /* ── Show agent panel, hide output/error ── */
  var ap  = document.getElementById('genUpAgentPanel');
  var op  = document.getElementById('genUpOutputPanel');
  var ep  = document.getElementById('genUpErrorPanel');
  var al  = document.getElementById('genUpAgentLog');
  var ad  = document.getElementById('genUpAgentDots');
  var btn = document.getElementById('genAnalyzeUploadBtn');

  if (ap)  ap.style.display  = 'block';
  if (op)  op.style.display  = 'none';
  if (ep)  ep.style.display  = 'none';
  if (al)  al.innerHTML      = '';
  if (ad)  ad.style.display  = 'flex';
  if (btn) btn.disabled      = true;

  var apiKey = genState.apiKey ||
               (document.getElementById('genApiKey') || {}).value || '';
  var hasFiles = genUpState.files.length > 0;
  var useAI = !!apiKey;

  /* ── Simulated log steps ── */
  [
    [0,    'PARSING INPUT PARAMETERS',                                  'run'],
    [300,  'Area: ' + genUpState.area + ' sqm',                         'ok' ],
    [600,  'Type: ' + genUpState.spaceType,                             'ok' ],
    [900,  'Layout: ' + genUpState.layout,                              'ok' ],
    [1200, hasFiles
           ? 'IMAGES QUEUED: ' + genUpState.files.length
           : 'NO REFERENCE IMAGES — USING PARAMETERS',                  hasFiles ? 'ok' : 'run'],
    [1700, useAI ? 'CONNECTING TO CLAUDE AI...' : 'GENERATING FROM TEMPLATE...', 'run'],
    [2200, 'ANALYZING SPATIAL REQUIREMENTS...',                         'run'],
    [2700, 'CALCULATING ROOM PROPORTIONS...',                           'run'],
    [3200, 'GENERATING FLOOR PLAN LAYOUT...',                           'run'],
    [3700, 'PLACING WALLS, DOORS & WINDOWS...',                         'run'],
    [4200, 'FINALIZING DIMENSIONS...',                                  'run']
  ].forEach(function (s) { _genUpLog(s[1], s[2], s[0]); });

  _genUpProgress(5,  'PROCESSING...',       0);
  _genUpProgress(20, 'ANALYZING...',        900);
  _genUpProgress(40, 'CALCULATING...',      1800);
  _genUpProgress(60, 'GENERATING LAYOUT...', 2700);
  _genUpProgress(78, 'PLACING ELEMENTS...',  3600);
  _genUpProgress(90, 'FINALIZING...',        4200);

  try {
    var plan;

    if (useAI) {
      /* ── AI path: call Claude API ── */
      var promptText = _genUpBuildPrompt();
      var msgContent = [];

      var imgFiles = genUpState.files.slice(0, 4);
      if (imgFiles.length) {
        await Promise.all(imgFiles.map(function (file) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) {
              var b64  = e.target.result.split(',')[1];
              var mime = file.type || 'image/jpeg';
              msgContent.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }));
      }
      msgContent.push({ type: 'text', text: promptText });

      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000,
          messages: [{ role: 'user', content: msgContent }] })
      });

      if (!res.ok) {
        var errData = await res.json();
        throw new Error(errData.error?.message || 'API error ' + res.status);
      }

      var data = await res.json();
      var text = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
      var m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No valid JSON in AI response');
      plan = JSON.parse(m[1] || m[0]);

    } else {
      /* ── Template path: generate locally without API key ── */
      plan = _genUpBuildTemplatePlan();
    }

    _genUpProgress(100, 'COMPLETE', 0);
    _genUpLog('FLOOR PLAN GENERATED SUCCESSFULLY', 'ok', 0);
    setTimeout(function () {
      if (ad) ad.style.display = 'none';
      _genUpRenderOutput(plan);
    }, 600);

  } catch (err) {
    _genUpLog('ERROR: ' + err.message, 'warn', 0);
    _genUpProgress(0, 'FAILED', 0);
    if (ep) {
      ep.style.display = 'flex';
      var em = document.getElementById('genUpErrorMsg');
      if (em) em.textContent = err.message;
    }
    if (btn) btn.disabled = false;
  }
}

/* ── Agent log & progress helpers (Option 1) ── */
function _genUpLog(msg, cls, delay) {
  setTimeout(function () {
    var log = document.getElementById('genUpAgentLog'); if (!log) return;
    var line = document.createElement('div');
    line.className = 'log-line ' + (cls || 'run');
    line.style.animationDelay = '0s';
    line.textContent = '> ' + msg;
    log.appendChild(line); log.scrollTop = log.scrollHeight;
  }, delay || 0);
}
function _genUpProgress(pct, label, delay) {
  setTimeout(function () {
    var f = document.getElementById('genUpAgentFill');
    var p = document.getElementById('genUpAgentPct');
    var s = document.getElementById('genUpAgentStatus');
    if (f) f.style.width = pct + '%';
    if (p) p.textContent = pct + '%';
    if (s) s.textContent = label;
  }, delay || 0);
}

/* ── Build Claude prompt for upload analyze ── */
function _genUpBuildPrompt() {
  var c = genUpState.layout === 'Custom'
    ? '\nCustom description: "' + (document.getElementById('genUpCustomDesc') || { value: '' }).value + '"'
    : '';
  var imgNote = genUpState.files.length
    ? '\nReference image(s) attached — use them to inform the layout.'
    : '';
  return 'You are an expert architect. Analyze the provided inputs and generate a detailed floor plan as structured JSON:\n' +
    '- Floor area: ' + genUpState.area + ' sqm\n' +
    '- Space type: ' + genUpState.spaceType + '\n' +
    '- Layout shape: ' + genUpState.layout + c + imgNote + '\n\n' +
    'Return ONLY ```json``` with:\n' +
    '{"title":"...","totalArea":' + genUpState.area + ',"shape":"' + genUpState.layout + '",' +
    '"dimensions":{"width":<m>,"depth":<m>},' +
    '"rooms":[{"name":"...","area":<sqm>,"color":"#E6F1FB","x":<0-100>,"y":<0-100>,"w":<pct>,"h":<pct>}],' +
    '"notes":"..."}\n\n' +
    'Rules: x/y/w/h are % of a 700×500 canvas. No overlaps. Total room area ≈ ' + genUpState.area + ' sqm.\n' +
    'Colors: living=#E6F1FB, kitchen=#EAF3DE, bedroom=#EEEDFE, bath=#FAEEDA, hallway=#F1EFE8, dining=#EAF3DE';
}

/* ── Build a template floor plan from parameters (no API key needed) ── */
function _genUpBuildTemplatePlan() {
  var a    = genUpState.area;
  var type = genUpState.spaceType;
  var lay  = genUpState.layout;

  /* Derive rough dimensions */
  var ratio = (lay === 'Rectangular') ? 1.5 : 1.0;
  var depth = Math.round(Math.sqrt(a / ratio) * 10) / 10;
  var width = Math.round(depth * ratio * 10) / 10;

  /*
   * ALL x/y/w/h are percentages of the INNER drawable area.
   * Inner area starts at 4% padding from each edge (to sit inside the boundary wall).
   * All rooms must satisfy: x >= 4, y >= 4, (x+w) <= 96, (y+h) <= 96
   * Rows must tile perfectly — no gaps, no overlaps.
   *
   * Layout convention used here:
   *   LEFT COLUMN  = social/wet zones  (x: 4..54, width: 50%)
   *   RIGHT COLUMN = bedroom zones     (x: 54..96, width: 42%)
   *   Rows split vertically to fill the column.
   */
  var templates = {

    'Studio / 1-Bedroom': [
      /* Left col: Living (top 55%) + Kitchen/Dining (bottom 37%) */
      { name:'Living Room', area:Math.round(a*.30), color:'#F0EAE0', x:4,  y:4,  w:50, h:53 },
      { name:'Kitchen',     area:Math.round(a*.15), color:'#D4EAC4', x:4,  y:57, w:28, h:35 },
      { name:'Dining',      area:Math.round(a*.09), color:'#C8E4B8', x:32, y:57, w:22, h:35 },
      /* Right col: Bedroom (top 55%) + Bathroom + Hallway (bottom 37%) */
      { name:'Bedroom',     area:Math.round(a*.30), color:'#D8D2EC', x:54, y:4,  w:42, h:53 },
      { name:'Bathroom',    area:Math.round(a*.10), color:'#F2D8B0', x:54, y:57, w:21, h:35 },
      { name:'Hallway',     area:Math.round(a*.06), color:'#E4DDD0', x:75, y:57, w:21, h:35 }
    ],

    '2-Bedroom Home': [
      /* Left col 3 rows */
      { name:'Living Room', area:Math.round(a*.24), color:'#F0EAE0', x:4,  y:4,  w:50, h:46 },
      { name:'Kitchen',     area:Math.round(a*.12), color:'#D4EAC4', x:4,  y:50, w:28, h:22 },
      { name:'Dining',      area:Math.round(a*.09), color:'#C8E4B8', x:32, y:50, w:22, h:22 },
      { name:'Bathroom',    area:Math.round(a*.08), color:'#F2D8B0', x:4,  y:72, w:25, h:24 },
      { name:'Hallway',     area:Math.round(a*.07), color:'#E4DDD0', x:29, y:72, w:25, h:24 },
      /* Right col 2 rows */
      { name:'Bedroom 1',   area:Math.round(a*.22), color:'#D8D2EC', x:54, y:4,  w:42, h:46 },
      { name:'Bedroom 2',   area:Math.round(a*.18), color:'#CEC8E4', x:54, y:50, w:42, h:46 }
    ],

    '3-Bedroom Home': [
      /* Left col */
      { name:'Living Room', area:Math.round(a*.20), color:'#F0EAE0', x:4,  y:4,  w:50, h:42 },
      { name:'Kitchen',     area:Math.round(a*.11), color:'#D4EAC4', x:4,  y:46, w:28, h:24 },
      { name:'Dining',      area:Math.round(a*.08), color:'#C8E4B8', x:32, y:46, w:22, h:24 },
      { name:'Bathroom',    area:Math.round(a*.08), color:'#F2D8B0', x:4,  y:70, w:25, h:26 },
      { name:'Hallway',     area:Math.round(a*.06), color:'#E4DDD0', x:29, y:70, w:25, h:26 },
      /* Right col 3 rows */
      { name:'Bedroom 1',   area:Math.round(a*.18), color:'#D8D2EC', x:54, y:4,  w:42, h:30 },
      { name:'Bedroom 2',   area:Math.round(a*.15), color:'#CEC8E4', x:54, y:34, w:21, h:32 },
      { name:'Bedroom 3',   area:Math.round(a*.14), color:'#C4BEDC', x:75, y:34, w:21, h:32 }
    ],

    '4-Bedroom Home': [
      { name:'Living Room', area:Math.round(a*.18), color:'#F0EAE0', x:4,  y:4,  w:50, h:38 },
      { name:'Kitchen',     area:Math.round(a*.10), color:'#D4EAC4', x:4,  y:42, w:26, h:22 },
      { name:'Dining',      area:Math.round(a*.08), color:'#C8E4B8', x:30, y:42, w:24, h:22 },
      { name:'Bathroom 1',  area:Math.round(a*.06), color:'#F2D8B0', x:4,  y:64, w:25, h:16 },
      { name:'Bathroom 2',  area:Math.round(a*.06), color:'#EBC89C', x:29, y:64, w:25, h:16 },
      { name:'Hallway',     area:Math.round(a*.06), color:'#E4DDD0', x:4,  y:80, w:50, h:16 },
      { name:'Bedroom 1',   area:Math.round(a*.16), color:'#D8D2EC', x:54, y:4,  w:42, h:23 },
      { name:'Bedroom 2',   area:Math.round(a*.14), color:'#CEC8E4', x:54, y:27, w:42, h:23 },
      { name:'Bedroom 3',   area:Math.round(a*.12), color:'#C4BEDC', x:54, y:50, w:21, h:23 },
      { name:'Bedroom 4',   area:Math.round(a*.10), color:'#BAB4D4', x:75, y:50, w:21, h:23 }
    ],

    'Office / Commercial': [
      { name:'Open Office',   area:Math.round(a*.38), color:'#F2EDE3', x:4,  y:4,  w:92, h:44 },
      { name:'Meeting Room 1',area:Math.round(a*.14), color:'#DDD8EE', x:4,  y:48, w:30, h:24 },
      { name:'Meeting Room 2',area:Math.round(a*.14), color:'#DDD8EE', x:34, y:48, w:30, h:24 },
      { name:'Reception',     area:Math.round(a*.12), color:'#D8EDCC', x:64, y:48, w:32, h:24 },
      { name:'Restroom',      area:Math.round(a*.08), color:'#F5DFC0', x:4,  y:72, w:22, h:24 },
      { name:'Storage',       area:Math.round(a*.06), color:'#E8E3D8', x:26, y:72, w:22, h:24 },
      { name:'Hallway',       area:Math.round(a*.08), color:'#E8E3D8', x:48, y:72, w:48, h:24 }
    ],

    'Apartment Unit': [
      { name:'Living Room',   area:Math.round(a*.26), color:'#F2EDE3', x:4,  y:4,  w:50, h:48 },
      { name:'Kitchen',       area:Math.round(a*.12), color:'#D8EDCC', x:4,  y:52, w:28, h:22 },
      { name:'Dining',        area:Math.round(a*.08), color:'#D8EDCC', x:32, y:52, w:22, h:22 },
      { name:'Bathroom',      area:Math.round(a*.09), color:'#F5DFC0', x:4,  y:74, w:25, h:22 },
      { name:'Hallway',       area:Math.round(a*.07), color:'#E8E3D8', x:29, y:74, w:25, h:22 },
      { name:'Bedroom 1',     area:Math.round(a*.22), color:'#DDD8EE', x:54, y:4,  w:42, h:46 },
      { name:'Bedroom 2',     area:Math.round(a*.16), color:'#DDD8EE', x:54, y:50, w:42, h:46 }
    ],

    'Townhouse': [
      { name:'Living Room',   area:Math.round(a*.22), color:'#F2EDE3', x:4,  y:4,  w:50, h:44 },
      { name:'Kitchen',       area:Math.round(a*.12), color:'#D8EDCC', x:4,  y:48, w:28, h:24 },
      { name:'Dining',        area:Math.round(a*.09), color:'#D8EDCC', x:32, y:48, w:22, h:24 },
      { name:'Bathroom',      area:Math.round(a*.08), color:'#F5DFC0', x:4,  y:72, w:25, h:24 },
      { name:'Storage',       area:Math.round(a*.05), color:'#E8E3D8', x:29, y:72, w:25, h:24 },
      { name:'Bedroom 1',     area:Math.round(a*.22), color:'#DDD8EE', x:54, y:4,  w:42, h:44 },
      { name:'Bedroom 2',     area:Math.round(a*.16), color:'#DDD8EE', x:54, y:48, w:42, h:48 },
      { name:'Garage',        area:Math.round(a*.06), color:'#E8E3D8', x:4,  y:4,  w:50, h:0  }
      /* Garage omitted for simplicity in 2D layout */
    ].filter(function(r){ return r.h > 0; }),

    'Bungalow': [
      { name:'Living Room',   area:Math.round(a*.22), color:'#F2EDE3', x:4,  y:4,  w:50, h:46 },
      { name:'Kitchen',       area:Math.round(a*.12), color:'#D8EDCC', x:4,  y:50, w:28, h:23 },
      { name:'Dining',        area:Math.round(a*.09), color:'#D8EDCC', x:32, y:50, w:22, h:23 },
      { name:'Bathroom',      area:Math.round(a*.08), color:'#F5DFC0', x:4,  y:73, w:25, h:23 },
      { name:'Hallway',       area:Math.round(a*.06), color:'#E8E3D8', x:29, y:73, w:25, h:23 },
      { name:'Bedroom 1',     area:Math.round(a*.22), color:'#DDD8EE', x:54, y:4,  w:42, h:46 },
      { name:'Bedroom 2',     area:Math.round(a*.16), color:'#DDD8EE', x:54, y:50, w:42, h:46 }
    ]
  };

  var rooms = (templates[type] || templates['2-Bedroom Home'])
    .map(function(r){ return Object.assign({}, r); });

  return {
    title: type + ' — ' + a + ' sqm (' + lay + ')',
    totalArea: a,
    shape: lay,
    dimensions: { width: width, depth: depth },
    rooms: rooms,
    notes: 'Template-based layout — no API key used.'
  };
}

/* ── Render the output SVG (Option 1) ── */
function _genUpRenderOutput(plan) {
  var op = document.getElementById('genUpOutputPanel');
  if (op) op.style.display = 'block';

  var svg = document.getElementById('genUpFpCanvas');
  var W = 700, H = 500, P = 30;

  /* Inner drawable area — rooms map to this region */
  var IX = P,          /* inner left   = 30  */
      IY = P,          /* inner top    = 30  */
      IW = W - P*2,    /* inner width  = 640 */
      IH = H - P*2 - 40; /* inner height = 400 (leave 40px for dim line) */

  svg.innerHTML = '<defs><marker id="gDA2" viewBox="0 0 10 10" refX="5" refY="5"'
    + ' markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
    + '<line x1="5" y1="2" x2="5" y2="8" stroke="#2C3A47" stroke-width="1.2"/>'
    + '</marker></defs>';

  /* Outer boundary wall */
  svg.appendChild(gEl('rect', {
    x: IX, y: IY, width: IW, height: IH,
    fill: '#F8F4EE', stroke: '#2C3A47', 'stroke-width': '2.5', rx: '2',
    style: '--len:' + (2*(IW+IH)) + ';--dur:1.2s;--delay:0s',
    'class': 'gen-wall-anim'
  }));
  var delay = 1400;

  var rooms = plan.rooms || [];
  rooms.forEach(function (room, i) {
    /*
     * room.x/y/w/h are percentages of the inner area (4..96 range).
     * Map them: pixel = IX + (pct/100 * IW)
     */
    var rx = IX + (room.x / 100) * IW;
    var ry = IY + (room.y / 100) * IH;
    var rw = (room.w / 100) * IW;
    var rh = (room.h / 100) * IH;

    /* Clamp to inner boundary */
    if (rx < IX) { rw -= (IX - rx); rx = IX; }
    if (ry < IY) { rh -= (IY - ry); ry = IY; }
    if (rx + rw > IX + IW) rw = IX + IW - rx;
    if (ry + rh > IY + IH) rh = IY + IH - ry;

    var fd  = delay + i * 120;
    var wd  = fd + 100;
    var ds  = Math.min(rw * .16, 20);
    var dx  = rx + rw * .2;
    var wx  = rx + rw * .5 - rw * .12;
    var ww  = rw * .24;

    /* Room fill */
    svg.appendChild(gEl('rect', {
      x: rx, y: ry, width: rw, height: rh,
      fill: room.color || '#F0EAE0', opacity: '.88',
      style: '--delay:' + fd + 'ms', 'class': 'gen-room-fill-anim'
    }));

    /* Room wall */
    svg.appendChild(gEl('rect', {
      x: rx, y: ry, width: rw, height: rh,
      fill: 'none', stroke: '#2C3A47', 'stroke-width': '1.8',
      style: '--len:' + (2*(rw+rh)) + ';--dur:.5s;--delay:' + wd + 'ms',
      'class': 'gen-wall-anim'
    }));

    /* Door arc (on bottom wall) */
    var door = gEl('g', { style: '--delay:' + (wd+400) + 'ms', 'class': 'gen-label-anim' });
    door.innerHTML =
      '<line x1="'+dx+'" y1="'+(ry+rh)+'" x2="'+(dx+ds)+'" y2="'+(ry+rh)+'" stroke="#F8F4EE" stroke-width="4"/>'
      +'<line x1="'+dx+'" y1="'+(ry+rh)+'" x2="'+(dx+ds)+'" y2="'+(ry+rh)+'" stroke="#2C3A47" stroke-width="1.5"/>'
      +'<path d="M'+dx+','+(ry+rh)+' A'+ds+','+ds+' 0 0,0 '+dx+','+(ry+rh-ds)+'" fill="none" stroke="rgba(44,58,71,.35)" stroke-width="1" stroke-dasharray="3,2"/>'
      +'<line x1="'+dx+'" y1="'+(ry+rh-ds)+'" x2="'+dx+'" y2="'+(ry+rh)+'" stroke="rgba(44,58,71,.5)" stroke-width="1"/>';
    svg.appendChild(door);

    /* Window (on top wall) */
    var win = gEl('g', { style: '--delay:' + (wd+500) + 'ms', 'class': 'gen-label-anim' });
    win.innerHTML =
      '<line x1="'+wx+'" y1="'+ry+'" x2="'+(wx+ww)+'" y2="'+ry+'" stroke="#F8F4EE" stroke-width="6"/>'
      +'<line x1="'+wx+'" y1="'+ry+'" x2="'+(wx+ww)+'" y2="'+ry+'" stroke="#8ABCD8" stroke-width="3"/>'
      +'<line x1="'+(wx+ww/2)+'" y1="'+(ry-1)+'" x2="'+(wx+ww/2)+'" y2="'+(ry+2)+'" stroke="rgba(44,58,71,.5)" stroke-width="1"/>';
    svg.appendChild(win);

    /* Label — only render if room is tall enough */
    if (rh > 22) {
      var lbl = gEl('g', { style: '--delay:' + (wd+600+i*60) + 'ms', 'class': 'gen-label-anim' });
      lbl.innerHTML =
        '<text x="'+(rx+rw/2)+'" y="'+(ry+rh/2-6)+'"'
        +' text-anchor="middle" dominant-baseline="central"'
        +' font-family="\'Exo 2\',sans-serif" font-size="11" font-weight="700" fill="#2C3A47" letter-spacing="0.5">'
        + room.name.toUpperCase() + '</text>'
        +'<text x="'+(rx+rw/2)+'" y="'+(ry+rh/2+10)+'"'
        +' text-anchor="middle" dominant-baseline="central"'
        +' font-family="\'Share Tech Mono\',monospace" font-size="9" fill="rgba(0,245,255,.5)">'
        + room.area + ' sqm</text>';
      svg.appendChild(lbl);
    }
  });

  /* Dimension lines */
  var dw  = (plan.dimensions && plan.dimensions.width)  || '—';
  var dd  = (plan.dimensions && plan.dimensions.depth)  || '—';
  var dly = delay + rooms.length * 120 + 800;
  var dims = gEl('g', { style: '--delay:' + dly + 'ms', 'class': 'gen-label-anim' });
  dims.innerHTML =
    '<line x1="'+IX+'" y1="'+(IY+IH+14)+'" x2="'+(IX+IW)+'" y2="'+(IY+IH+14)+'"'
    +' stroke="#2C3A47" stroke-width=".8" opacity=".6" marker-start="url(#gDA2)" marker-end="url(#gDA2)"/>'
    +'<text x="'+(IX+IW/2)+'" y="'+(IY+IH+26)+'" text-anchor="middle"'
    +' font-family="\'Share Tech Mono\',monospace" font-size="10" fill="#4A5A6A">'+ dw +' m</text>'
    +'<line x1="'+(IX-14)+'" y1="'+IY+'" x2="'+(IX-14)+'" y2="'+(IY+IH)+'"'
    +' stroke="#2C3A47" stroke-width=".8" opacity=".6" marker-start="url(#gDA2)" marker-end="url(#gDA2)"/>'
    +'<text x="'+(IX-4)+'" y="'+(IY+IH/2)+'" text-anchor="middle"'
    +' font-family="\'Share Tech Mono\',monospace" font-size="10" fill="#4A5A6A"'
    +' transform="rotate(-90,'+(IX-4)+','+(IY+IH/2)+')">'+ dd +' m</text>'
    +'<text x="'+(IX+IW-4)+'" y="'+(IY+14)+'" text-anchor="end"'
    +' font-family="\'Share Tech Mono\',monospace" font-size="9" fill="#8A9AAA">'
    + plan.totalArea +' SQM · '+(plan.shape||'').toUpperCase()+'</text>';
  svg.appendChild(dims);

  /* Compass */
  var cmp = gEl('g', { transform: 'translate('+(IX+IW-22)+','+(IY+22)+')' });
  cmp.innerHTML =
    '<circle cx="0" cy="0" r="16" fill="rgba(44,58,71,.06)" stroke="rgba(44,58,71,.3)" stroke-width="1"/>'
    +'<text x="0" y="-6" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="9" fill="#2C3A47">N</text>'
    +'<polygon points="0,-4 -3,3 0,1 3,3" fill="#2C3A47" opacity=".9"/>'
    +'<text x="0" y="14" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="8" fill="#6B7E8A">S</text>';
  svg.appendChild(cmp);

  /* Room summary cards */
  var cards = document.getElementById('genUpRoomCards');
  if (cards) cards.innerHTML = rooms.map(function (r) {
    return '<div class="gen-room-card">'
      + '<div class="gen-room-card-name">' + r.name.toUpperCase() + '</div>'
      + '<span class="gen-room-card-area">' + r.area + '</span>'
      + '<span class="gen-room-card-unit"> sqm</span></div>';
  }).join('');

  var t = document.getElementById('genUpOutputTitle');
  if (t) t.textContent = (plan.title || 'ANALYZED FLOOR PLAN').toUpperCase();
}

/* ══ Option 2 — Reference image helpers ═════════════════════ */
function genRefClearAll() {
  genRefState.files = []; genRefState.activeIdx = 0;
  var bar = document.getElementById('genRefThumbBar');
  var pw  = document.getElementById('genRefPreviewWrap');
  if (bar) bar.style.display = 'none';
  if (pw)  pw.style.display  = 'none';
}
function genRefClearActive() {
  genRefClearAll();
}
function genRefNavigate(dir) {
  genRefState.activeIdx = Math.max(0, Math.min(genRefState.files.length - 1, genRefState.activeIdx + dir));
  _showPreview(genRefState, 'genRefPreviewWrap', 'genRefPreviewImg', 'genRefPreviewName',
    'genRefImgNav', 'genRefPrevBtn', 'genRefNextBtn', 'genRefNavCounter');
  _renderThumbs(genRefState, 'genRefThumbBar', 'genRefThumbGrid', 'genRefThumbBarLabel',
    'genRefPreviewWrap', 'genRefPreviewImg', 'genRefPreviewName',
    'genRefImgNav', 'genRefPrevBtn', 'genRefNextBtn', 'genRefNavCounter', function(){});
}

/* ══ Option 2 — Generate form helpers ═══════════════════════ */
function genSetArea(v) {
  var el = document.getElementById('genAreaInput');
  if (el) el.value = v;
  genState.area = v;
  document.querySelectorAll('#genGeneratePanel .gen-preset').forEach(function (b) {
    b.classList.toggle('sel', b.textContent.trim() === v + ' sqm');
  });
  genCheckReady();
}
function genOnAreaInput() {
  var v = parseInt(document.getElementById('genAreaInput').value);
  if (v > 0) {
    genState.area = v;
    document.querySelectorAll('#genGeneratePanel .gen-preset').forEach(function (b) {
      b.classList.toggle('sel', b.textContent.trim() === v + ' sqm');
    });
    genCheckReady();
  }
}
function genSelectType(el, type) {
  document.querySelectorAll('#genTypePills .gen-pill').forEach(function (b) { b.classList.remove('sel'); });
  el.classList.add('sel');
  genState.spaceType = type;
  genCheckReady();
}
function genSelectLayout(el, layout) {
  document.querySelectorAll('#genLayoutCards .gen-layout-card').forEach(function (c) { c.classList.remove('active'); });
  el.classList.add('active');
  genState.layout = layout;
  var w = document.getElementById('genCustomWrap');
  if (w) w.style.display = layout === 'Custom' ? 'block' : 'none';
  genCheckReady();
}
function genCheckReady() {
  var key = (document.getElementById('genApiKey') || {}).value || '';
  genState.apiKey = key.trim();
  var ready = genState.area && genState.spaceType && genState.layout
              && genState.apiKey.startsWith('sk-ant');
  var btn = document.getElementById('genGenerateBtn');
  if (btn) btn.disabled = !ready;
}
function genToggleKey(id) {
  var el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

/* ══ AI Agent helpers ════════════════════════════════════════ */
function genAgentLog(msg, cls, delay) {
  setTimeout(function () {
    var log = document.getElementById('genAgentLog'); if (!log) return;
    var line = document.createElement('div');
    line.className = 'log-line ' + (cls || 'run');
    line.style.animationDelay = '0s';
    line.textContent = '> ' + msg;
    log.appendChild(line); log.scrollTop = log.scrollHeight;
  }, delay || 0);
}
function genAgentProgress(pct, label, delay) {
  setTimeout(function () {
    var f = document.getElementById('genAgentFill');
    var p = document.getElementById('genAgentPct');
    var s = document.getElementById('genAgentStatus');
    if (f) f.style.width = pct + '%';
    if (p) p.textContent = pct + '%';
    if (s) s.textContent = label;
  }, delay || 0);
}

/* ══ Generate floor plan ═════════════════════════════════════ */
async function genGeneratePlan() {
  genState.customDesc = genState.layout === 'Custom'
    ? (document.getElementById('genCustomDesc') || { value: '' }).value || '' : '';

  var ap = document.getElementById('genAgentPanel');
  var op = document.getElementById('genOutputPanel');
  var ep = document.getElementById('genErrorPanel');
  var al = document.getElementById('genAgentLog');
  var ad = document.getElementById('genAgentDots');
  var gb = document.getElementById('genGenerateBtn');

  if (ap) ap.style.display = 'block';
  if (op) op.style.display = 'none';
  if (ep) ep.style.display = 'none';
  if (al) al.innerHTML = '';
  if (ad) ad.style.display = 'flex';
  if (gb) gb.disabled = true;

  [[0,'PARSING INPUT PARAMETERS','run'],[300,'Area: '+genState.area+' sqm','ok'],
   [600,'Type: '+genState.spaceType,'ok'],[900,'Layout: '+genState.layout,'ok'],
   [1200,'CONNECTING TO CLAUDE AI...','run'],[1700,'CALCULATING ROOM PROPORTIONS...','run'],
   [2200,'GENERATING SPATIAL LAYOUT...','run'],[2700,'PLACING WALLS AND PARTITIONS...','run'],
   [3200,'INSERTING DOORS & WINDOWS...','run'],[3700,'FINALIZING DIMENSIONS...','run']
  ].forEach(function (s) { genAgentLog(s[1], s[2], s[0]); });

  genAgentProgress(5,'CONNECTING...',0); genAgentProgress(20,'ANALYZING...',800);
  genAgentProgress(45,'GENERATING LAYOUT...',1800); genAgentProgress(70,'PLACING ELEMENTS...',2800);
  genAgentProgress(88,'FINALIZING...',3600);

  try {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': genState.apiKey,
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000,
        messages: [{ role: 'user', content: genBuildPrompt() }] })
    });
    if (!res.ok) { var e = await res.json(); throw new Error(e.error?.message || 'API error ' + res.status); }
    var data = await res.json();
    var text = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
    var m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No valid JSON in AI response');
    var plan = JSON.parse(m[1] || m[0]);
    genAgentProgress(100, 'COMPLETE', 0);
    genAgentLog('FLOOR PLAN GENERATED SUCCESSFULLY', 'ok', 0);
    setTimeout(function () { if (ad) ad.style.display='none'; genRenderFloorPlan(plan); }, 600);
  } catch (err) {
    genAgentLog('ERROR: ' + err.message, 'warn', 0);
    genAgentProgress(0, 'FAILED', 0);
    if (ep) { ep.style.display = 'flex'; var em = document.getElementById('genErrorMsg'); if (em) em.textContent = err.message; }
    if (gb) gb.disabled = false;
  }
}

function genBuildPrompt() {
  var c = genState.customDesc ? '\nCustom layout: "' + genState.customDesc + '"' : '';
  var refs = genRefState.files.length ? '\n- ' + genRefState.files.length + ' reference image(s) provided.' : '';
  return 'You are an expert architect. Generate a floor plan as structured JSON for:\n' +
    '- Floor area: ' + genState.area + ' sqm\n- Space type: ' + genState.spaceType +
    '\n- Layout shape: ' + genState.layout + c + refs + '\n\n' +
    'Return ONLY ```json``` with:\n{"title":"...","totalArea":' + genState.area + ',"shape":"' + genState.layout + '",' +
    '"dimensions":{"width":<m>,"depth":<m>},' +
    '"rooms":[{"name":"...","area":<sqm>,"color":"#E6F1FB","x":<0-100>,"y":<0-100>,"w":<pct>,"h":<pct>}],"notes":"..."}\n\n' +
    'Rules: x/y/w/h are % of 700×500px canvas. No overlaps. Total area≈' + genState.area + ' sqm.\n' +
    'Colors: living=#E6F1FB, kitchen=#EAF3DE, bedroom=#EEEDFE, bath=#FAEEDA, hallway=#F1EFE8, dining=#EAF3DE';
}

/* ══ SVG Renderer ════════════════════════════════════════════ */
function genRenderFloorPlan(plan) {
  var svg = document.getElementById('genFpCanvas'), W=700, H=500, P=30;
  svg.innerHTML = '<defs><marker id="gDA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><line x1="5" y1="2" x2="5" y2="8" stroke="#00f5ff" stroke-width="1.2"/></marker></defs>';
  var rooms = plan.rooms || [], delay = 0;

  svg.appendChild(gEl('rect', { x:P, y:P, width:W-P*2, height:H-P*2-40, fill:'#0f1424', stroke:'#00f5ff', 'stroke-width':'2', rx:'4',
    style:'--len:'+(2*((W-P*2)+(H-P*2-40)))+';--dur:1.2s;--delay:0s', 'class':'gen-wall-anim' }));
  delay += 1400;

  rooms.forEach(function (room, i) {
    var rx=room.x/100*W, ry=room.y/100*H, rw=room.w/100*W, rh=room.h/100*H;
    var fd=delay+i*120, wd=fd+100, ds=Math.min(rw*.18,22), dx=rx+rw*.2, wx=rx+rw*.5-rw*.12, ww=rw*.24;
    svg.appendChild(gEl('rect',{ x:rx,y:ry,width:rw,height:rh, fill:room.color||'#E6F1FB',opacity:'.45', style:'--delay:'+fd+'ms','class':'gen-room-fill-anim' }));
    svg.appendChild(gEl('rect',{ x:rx,y:ry,width:rw,height:rh, fill:'none',stroke:'#00f5ff','stroke-width':'1.5', style:'--len:'+(2*(rw+rh))+';--dur:.5s;--delay:'+wd+'ms','class':'gen-wall-anim' }));
    var door=gEl('g',{style:'--delay:'+(wd+400)+'ms','class':'gen-label-anim'});
    door.innerHTML='<line x1="'+dx+'" y1="'+(ry+rh)+'" x2="'+(dx+ds)+'" y2="'+(ry+rh)+'" stroke="#0a0e1a" stroke-width="3"/><line x1="'+dx+'" y1="'+(ry+rh)+'" x2="'+(dx+ds)+'" y2="'+(ry+rh)+'" stroke="#00f5ff" stroke-width="1.5"/><path d="M'+dx+','+(ry+rh)+' A'+ds+','+ds+' 0 0,0 '+dx+','+(ry+rh-ds)+'" fill="none" stroke="rgba(0,245,255,.4)" stroke-width="1" stroke-dasharray="3,2"/><line x1="'+dx+'" y1="'+(ry+rh-ds)+'" x2="'+dx+'" y2="'+(ry+rh)+'" stroke="rgba(0,245,255,.6)" stroke-width="1"/>';
    svg.appendChild(door);
    var win=gEl('g',{style:'--delay:'+(wd+500)+'ms','class':'gen-label-anim'});
    win.innerHTML='<line x1="'+wx+'" y1="'+ry+'" x2="'+(wx+ww)+'" y2="'+ry+'" stroke="#0a0e1a" stroke-width="5"/><line x1="'+wx+'" y1="'+ry+'" x2="'+(wx+ww)+'" y2="'+ry+'" stroke="white" stroke-width="3"/><line x1="'+(wx+ww/2)+'" y1="'+(ry-1)+'" x2="'+(wx+ww/2)+'" y2="'+(ry+2)+'" stroke="rgba(0,245,255,.6)" stroke-width="1"/>';
    svg.appendChild(win);
    var lbl=gEl('g',{style:'--delay:'+(wd+600+i*60)+'ms','class':'gen-label-anim'});
    lbl.innerHTML='<text x="'+(rx+rw/2)+'" y="'+(ry+rh/2-6)+'" text-anchor="middle" dominant-baseline="central" font-family="\'Exo 2\',sans-serif" font-size="11" font-weight="700" fill="#2C3A47" letter-spacing="0.5">'+room.name.toUpperCase()+'</text><text x="'+(rx+rw/2)+'" y="'+(ry+rh/2+10)+'" text-anchor="middle" dominant-baseline="central" font-family="\'Share Tech Mono\',monospace" font-size="9" fill="rgba(0,245,255,.5)">'+room.area+' sqm</text>';
    svg.appendChild(lbl);
  });

  var dw=(plan.dimensions&&plan.dimensions.width)||'—', dd=(plan.dimensions&&plan.dimensions.depth)||'—';
  var dims=gEl('g',{style:'--delay:'+(delay+rooms.length*120+800)+'ms','class':'gen-label-anim'});
  dims.innerHTML='<line x1="'+P+'" y1="'+(H-14)+'" x2="'+(W-P)+'" y2="'+(H-14)+'" stroke="#00f5ff" stroke-width=".8" opacity=".5" marker-start="url(#gDA)" marker-end="url(#gDA)"/><text x="'+(W/2)+'" y="'+(H-4)+'" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="10" fill="rgba(0,245,255,.6)">'+dw+' m</text><line x1="14" y1="'+P+'" x2="14" y2="'+(H-P-40)+'" stroke="#00f5ff" stroke-width=".8" opacity=".5" marker-start="url(#gDA)" marker-end="url(#gDA)"/><text x="4" y="'+((H-40)/2)+'" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="10" fill="rgba(0,245,255,.6)" transform="rotate(-90,4,'+((H-40)/2)+')">'+dd+' m</text><text x="'+(W-P-4)+'" y="'+(P+14)+'" text-anchor="end" font-family="\'Share Tech Mono\',monospace" font-size="9" fill="rgba(0,245,255,.4)">'+plan.totalArea+' SQM · '+(plan.shape||'').toUpperCase()+'</text>';
  svg.appendChild(dims);

  var cmp=gEl('g',{transform:'translate('+(W-52)+','+(P+20)+')'});
  cmp.innerHTML='<circle cx="0" cy="0" r="16" fill="rgba(0,245,255,.04)" stroke="rgba(0,245,255,.2)" stroke-width="1"/><text x="0" y="-6" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="9" fill="rgba(0,245,255,.7)">N</text><polygon points="0,-4 -3,3 0,1 3,3" fill="#00f5ff" opacity=".8"/><text x="0" y="14" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="8" fill="rgba(0,245,255,.4)">S</text>';
  svg.appendChild(cmp);

  var cards=document.getElementById('genRoomCards');
  if (cards) cards.innerHTML=rooms.map(function(r){
    return '<div class="gen-room-card"><div class="gen-room-card-name">'+r.name.toUpperCase()+'</div><span class="gen-room-card-area">'+r.area+'</span><span class="gen-room-card-unit"> sqm</span></div>';
  }).join('');

  var t=document.getElementById('genOutputTitle'); if(t) t.textContent=(plan.title||'GENERATED FLOOR PLAN').toUpperCase();
  var op=document.getElementById('genOutputPanel'); if(op) op.style.display='block';
}

function gEl(tag, attrs) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (var k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
function genDownloadSVG() {
  var svg=document.getElementById('genFpCanvas');
  var blob=new Blob(['<?xml version="1.0"?>'+svg.outerHTML],{type:'image/svg+xml'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='holoplan-floorplan.svg'; a.click();
}
function genRegenerate() { genGeneratePlan(); }

/* ── Option 1 export & regenerate ── */
function genUpDownloadSVG() {
  var svg=document.getElementById('genUpFpCanvas');
  var blob=new Blob(['<?xml version="1.0"?>'+svg.outerHTML],{type:'image/svg+xml'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='holoplan-analyzed-plan.svg'; a.click();
}
function genUpRegenerate() { genAnalyzeUpload(); }