/* export.js — Module 1 Export: PDF & PPTX per result card */

/* ── Colour palette (matches holographic theme) ───────────────── */
const EX = {
  bgDeep:    '02040f',
  bgPanel:   '0a1628',
  bgCard:    '0d1f3c',
  cyan:      '00f5ff',
  cyanDim:   '006066',
  violet:    '7b2fff',
  green:     '00ff9d',
  amber:     'ffb700',
  pink:      'ff2d78',
  white:     'e8f4ff',
  dim:       '3a5a6a',
  dimText:   '4a7a8a',

  /* Room type accent colours */
  roomColors: {
    living:  '00f5ff',
    bedroom: '7b2fff',
    kitchen: 'ffb700',
    bath:    '00ff9d',
    other:   '5a8a9a',
  },
};

/* ── Helpers ─────────────────────────────────────────────────── */
function getImageDataUrl(idx) {
  // Prefer the stored dataUrl from result registration
  if (window._holoResults && window._holoResults[idx] && window._holoResults[idx]._imgDataUrl) {
    return window._holoResults[idx]._imgDataUrl;
  }
  // Fallback: pull from thumbnail grid
  const thumbImgs = document.querySelectorAll('#thumbGrid .thumb-item img');
  if (thumbImgs[idx]) return thumbImgs[idx].src;
  return null;
}

function getResultData(idx) {
  // Access results array via the global app scope closure — stored on window for export
  if (window._holoResults && window._holoResults[idx]) return window._holoResults[idx];
  return null;
}

function roomColor(type) {
  return EX.roomColors[type] || EX.roomColors.other;
}

function showExportToast(msg, isError) {
  let toast = document.getElementById('exportToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'exportToast';
    toast.style.cssText = 'position:fixed;bottom:28px;right:24px;z-index:9999;font-family:Orbitron,monospace;font-size:10px;letter-spacing:2px;padding:10px 18px;border-radius:4px;transition:opacity 0.4s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.style.background     = isError ? 'rgba(255,45,120,0.15)' : 'rgba(0,245,255,0.12)';
  toast.style.border         = '1px solid ' + (isError ? '#ff2d78' : '#00f5ff');
  toast.style.color          = isError ? '#ff2d78' : '#00f5ff';
  toast.style.boxShadow      = '0 0 16px ' + (isError ? 'rgba(255,45,120,0.3)' : 'rgba(0,245,255,0.3)');
  toast.textContent          = msg;
  toast.style.opacity        = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3200);
}

/* ── PDF Export ──────────────────────────────────────────────── */
window.exportResultPDF = async function (idx) {
  const data = getResultData(idx);
  if (!data) { showExportToast('⚠ NO DATA — Run analysis first.', true); return; }

  showExportToast('⧗ GENERATING PDF...', false);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;
  const M  = 14;   // margin
  const CW = PW - M * 2; // content width
  let   Y  = M;

  /* helpers */
  const hex = h => [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  const bg  = (c, x, y, w, h, r=2) => {
    const [r1,g1,b1] = hex(c);
    doc.setFillColor(r1,g1,b1);
    doc.roundedRect(x, y, w, h, r, r, 'F');
  };
  const line = (c, x1, y1, x2, y2, lw=0.3) => {
    const [r1,g1,b1] = hex(c);
    doc.setDrawColor(r1,g1,b1); doc.setLineWidth(lw);
    doc.line(x1,y1,x2,y2);
  };
  const txt = (str, x, y, opts={}) => {
    const [r1,g1,b1] = hex(opts.color || EX.white);
    doc.setTextColor(r1,g1,b1);
    doc.setFontSize(opts.size || 9);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.align) doc.text(String(str), x, y, { align: opts.align });
    else doc.text(String(str), x, y);
  };
  const newPage = () => {
    doc.addPage();
    Y = M;
    bg(EX.bgDeep, 0, 0, PW, PH, 0);
    // page header stripe
    bg(EX.bgPanel, 0, 0, PW, 8, 0);
    txt('HOLO·PLAN — SPATIAL ANALYSIS REPORT', M, 5.5, { size:7, color:EX.cyan });
    txt('IMAGE ' + (idx+1), PW - M, 5.5, { size:7, color:EX.dim, align:'right' });
    Y = 14;
  };
  const checkPage = (needed) => { if (Y + needed > PH - 14) newPage(); };

  /* ── Cover background */
  bg(EX.bgDeep, 0, 0, PW, PH, 0);

  /* ── Header bar */
  bg(EX.bgPanel, 0, 0, PW, 22, 0);
  bg(EX.cyan,    0, 0, PW,  1, 0);
  txt('HOLO·PLAN', M, 9, { size:13, bold:true, color:EX.cyan });
  txt('SPATIAL INTELLIGENCE SYSTEM  v2.0', M, 15, { size:6.5, color:EX.dim });
  txt('FLOOR PLAN ANALYSIS REPORT', PW-M, 9,  { size:8,  bold:true, color:EX.white, align:'right' });
  txt(new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}), PW-M, 15, { size:6.5, color:EX.dim, align:'right' });
  Y = 28;

  /* ── Title block */
  const label = data._imageLabel || ('IMAGE ' + (idx+1));
  bg(EX.bgPanel, M, Y, CW, 14, 2);
  bg(EX.cyan, M, Y, 2, 14, 1);
  txt(label, M+5, Y+5.5, { size:12, bold:true, color:EX.cyan });
  txt('Mode: ' + (data._mode||'NORMAL').toUpperCase() + '  ·  Analysis: HOLO·AGENT  ·  Created by: Ceron Matthew Calsena', M+5, Y+11, { size:6.5, color:EX.dim });
  Y += 18;

  /* ── Floor plan image */
  const imgSrc = getImageDataUrl(idx);
  if (imgSrc) {
    try {
      const imgH = 56;
      bg(EX.bgPanel, M, Y, CW, imgH+4, 2);
      txt('FLOOR PLAN', M+3, Y+4.5, { size:6.5, color:EX.dim });
      doc.addImage(imgSrc, 'PNG', M + (CW/2) - 55, Y+6, 110, imgH - 10);
      Y += imgH + 8;
    } catch(e) { Y += 4; }
  }

  /* ── Summary metrics */
  checkPage(22);
  const metrics = [
    { label:'TOTAL AREA', value:(data.total_area_sqm||0).toFixed(1)+' m²' },
    { label:'ROOMS',      value:String((data.rooms||[]).length) },
    { label:'FLOORS',     value:String(data.floor_count||1) },
    { label:'UNIT',       value:(data.unit||'meters').toUpperCase() },
  ];
  const mW = (CW - 9) / 4;
  metrics.forEach((m, i) => {
    const mx = M + i*(mW+3);
    bg(EX.bgCard, mx, Y, mW, 16, 2);
    bg(EX.cyan, mx, Y, mW, 0.8, 0);
    txt(m.label, mx + mW/2, Y+5.5, { size:5.5, color:EX.dim, align:'center' });
    txt(m.value, mx + mW/2, Y+12,  { size:10, bold:true, color:EX.cyan, align:'center' });
  });
  Y += 20;

  /* ── Room breakdown */
  checkPage(10);
  txt('ROOM BREAKDOWN', M, Y+1, { size:7, bold:true, color:EX.violet });
  line(EX.violet, M, Y+3, M+CW, Y+3, 0.2);
  Y += 6;

  const rooms = data.rooms || [];
  const rW = (CW - (2*3)) / 3; // 3 cols
  rooms.forEach((room, i) => {
    if (i % 3 === 0) {
      checkPage(20);
      if (i > 0) Y += 3;
    }
    const col = i % 3;
    const rx  = M + col*(rW+3);
    const rc  = roomColor(room.type || 'other');
    bg(EX.bgCard, rx, Y, rW, 17, 2);
    bg(rc, rx, Y, 1.5, 17, 1);

    txt((room.name||'Room').toUpperCase(), rx+4, Y+5, { size:5.5, bold:true, color:EX.white });
    const dims = (room.width_m && room.length_m)
      ? parseFloat(room.width_m).toFixed(1)+' × '+parseFloat(room.length_m).toFixed(1)+' m'
      : 'EST.';
    txt(dims, rx+4, Y+10, { size:7.5, bold:true, color:rc });
    const area = room.area_sqm ? parseFloat(room.area_sqm).toFixed(1)+' m²' : '';
    if (area) txt(area, rx+4, Y+15, { size:6, color:EX.dim });

    if ((i % 3 === 2) || i === rooms.length-1) Y += 20;
  });
  Y += 2;

  /* ── Observations */
  if (data.observations) {
    checkPage(20);
    txt('AI OBSERVATIONS', M, Y+1, { size:7, bold:true, color:EX.violet });
    line(EX.violet, M, Y+3, M+CW, Y+3, 0.2);
    Y += 6;
    bg(EX.bgCard, M, Y, CW, 1, 0);
    const lines = doc.splitTextToSize(data.observations, CW-8);
    const obsH  = lines.length*4.5 + 6;
    bg(EX.bgPanel, M, Y, CW, obsH, 2);
    const [rc,gc,bc] = hex(EX.white);
    doc.setTextColor(rc,gc,bc); doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    lines.forEach((ln, li) => { doc.text(ln, M+4, Y+5+li*4.5); });
    Y += obsH + 4;
  }

  /* ── Scale note */
  if (data.scale_note) {
    checkPage(12);
    bg(EX.bgPanel, M, Y, CW, 10, 2);
    const [rc,gc,bc] = hex(EX.dim);
    doc.setTextColor(rc,gc,bc); doc.setFontSize(6.5); doc.setFont('helvetica','italic');
    const slines = doc.splitTextToSize('⬡ ' + data.scale_note, CW-8);
    slines.forEach((sl, si) => doc.text(sl, M+4, Y+4+si*4));
    Y += 13;
  }

  /* ── Footer on every page */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    bg(EX.bgPanel, 0, PH-9, PW, 9, 0);
    bg(EX.cyan, 0, PH-9, PW, 0.4, 0);
    txt('HOLO·PLAN © 2025  ·  Created by Ceron Matthew Calsena', M, PH-4, { size:6, color:EX.dim });
    txt('Page ' + p + ' of ' + pageCount, PW-M, PH-4, { size:6, color:EX.dim, align:'right' });
  }

  doc.save('HOLOPLAN_' + label.replace(/\s+/g,'_') + '.pdf');
  showExportToast('✓ PDF EXPORTED', false);
};

/* ── PPTX Export ─────────────────────────────────────────────── */
window.exportResultPPT = async function (idx) {
  const data = getResultData(idx);
  if (!data) { showExportToast('⚠ NO DATA — Run analysis first.', true); return; }
  if (!window.PptxGenJS) { showExportToast('⚠ PptxGenJS not loaded yet. Try again.', true); return; }

  showExportToast('⧗ GENERATING PPT...', false);

  const pptx  = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Ceron Matthew Calsena';
  pptx.title  = 'HOLO·PLAN — ' + (data._imageLabel || ('IMAGE ' + (idx+1)));

  const label = data._imageLabel || ('IMAGE ' + (idx+1));
  const rooms = data.rooms || [];

  /* ── Slide 1: Cover ─────────────────────────────── */
  const s1 = pptx.addSlide();
  s1.background = { color: '02040f' };

  // Full-bleed top accent
  s1.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.08, fill:{ color:'00f5ff' } });
  // Dark header band
  s1.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:1.4, fill:{ color:'0a1628' } });

  s1.addText('HOLO·PLAN', { x:0.5, y:0.18, w:5, h:0.6, fontSize:30, bold:true, color:'00f5ff', fontFace:'Arial Black', charSpacing:4, margin:0 });
  s1.addText('SPATIAL INTELLIGENCE SYSTEM  v2.0', { x:0.5, y:0.82, w:6, h:0.35, fontSize:8, color:'3a5a6a', fontFace:'Arial', charSpacing:3, margin:0 });
  s1.addText('FLOOR PLAN\nANALYSIS REPORT', { x:6.5, y:0.18, w:3, h:1.0, fontSize:14, bold:true, color:'e8f4ff', fontFace:'Arial', align:'right', valign:'middle', margin:0 });

  // Floor plan image + glow frame
  const imgSrc = getImageDataUrl(idx);
  if (imgSrc) {
    try {
      s1.addShape(pptx.ShapeType.rect, { x:1.2, y:1.5, w:4.6, h:3.2, fill:{ color:'0d1f3c' }, line:{ color:'00f5ff', width:1 } });
      s1.addImage({ data: imgSrc, x:1.3, y:1.6, w:4.4, h:3.0 });
    } catch(e) {}
  }

  // Info panel
  s1.addShape(pptx.ShapeType.rect, { x:6.1, y:1.5, w:3.4, h:3.2, fill:{ color:'0a1628' }, line:{ color:'1a3a5a', width:0.5 } });
  s1.addShape(pptx.ShapeType.rect, { x:6.1, y:1.5, w:0.06, h:3.2, fill:{ color:'00f5ff' } });

  s1.addText(label, { x:6.24, y:1.62, w:3.1, h:0.45, fontSize:13, bold:true, color:'00f5ff', fontFace:'Arial', charSpacing:2, margin:0 });
  s1.addText('MODE: ' + (data._mode||'NORMAL').toUpperCase(), { x:6.24, y:2.1, w:3.1, h:0.28, fontSize:7, color:'4a7a8a', fontFace:'Arial', charSpacing:2, margin:0 });

  const mArr = [
    ['TOTAL AREA', (data.total_area_sqm||0).toFixed(1)+' m²'],
    ['ROOMS',      String(rooms.length)],
    ['FLOORS',     String(data.floor_count||1)],
  ];
  mArr.forEach(([lbl, val], mi) => {
    const my = 2.5 + mi * 0.62;
    s1.addShape(pptx.ShapeType.rect, { x:6.24, y:my, w:3.1, h:0.52, fill:{ color:'0d1f3c' }, line:{ color:'1a3a5a', width:0.3 } });
    s1.addText(lbl, { x:6.34, y:my+0.04, w:3.0, h:0.22, fontSize:6, color:'3a5a6a', fontFace:'Arial', charSpacing:2, margin:0 });
    s1.addText(val, { x:6.34, y:my+0.25, w:3.0, h:0.24, fontSize:11, bold:true, color:'00f5ff', fontFace:'Arial', margin:0 });
  });

  s1.addText('Created by: Ceron Matthew Calsena', { x:0, y:5.3, w:'100%', h:0.2, fontSize:7, color:'3a5a6a', fontFace:'Arial', align:'center', margin:0 });
  s1.addShape(pptx.ShapeType.rect, { x:0, y:5.55, w:'100%', h:0.07, fill:{ color:'7b2fff' } });

  /* ── Slide 2: Room Breakdown ─────────────────────── */
  const s2 = pptx.addSlide();
  s2.background = { color: '02040f' };
  s2.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.08, fill:{ color:'00f5ff' } });
  s2.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.65, fill:{ color:'0a1628' } });

  s2.addText('ROOM BREAKDOWN', { x:0.4, y:0.1, w:6, h:0.45, fontSize:14, bold:true, color:'e8f4ff', fontFace:'Arial', charSpacing:3, margin:0 });
  s2.addText(label + '  ·  ' + rooms.length + ' rooms detected  ·  ' + (data.total_area_sqm||0).toFixed(1) + ' m² total', { x:0.4, y:0.42, w:9, h:0.2, fontSize:7, color:'4a7a8a', fontFace:'Arial', charSpacing:1, margin:0 });

  // Room cards — up to 9 per slide in a 3×3 grid
  const COLS = 3, cardW = 2.9, cardH = 1.2, gx = 0.28, gy = 0.18;
  const startX = (10 - COLS*cardW - (COLS-1)*gx) / 2;

  rooms.slice(0, 9).forEach((room, i) => {
    const col  = i % COLS;
    const row  = Math.floor(i / COLS);
    const cx   = startX + col*(cardW+gx);
    const cy   = 0.8 + row*(cardH+gy);
    const rc   = roomColor(room.type || 'other');
    const dims = (room.width_m && room.length_m)
      ? parseFloat(room.width_m).toFixed(1)+' × '+parseFloat(room.length_m).toFixed(1)+' m'
      : 'EST. DIMS';
    const area = room.area_sqm ? parseFloat(room.area_sqm).toFixed(1)+' m²' : '';

    s2.addShape(pptx.ShapeType.rect, { x:cx, y:cy, w:cardW, h:cardH, fill:{ color:'0d1f3c' }, line:{ color:'1a3a5a', width:0.4 } });
    s2.addShape(pptx.ShapeType.rect, { x:cx, y:cy, w:0.06, h:cardH, fill:{ color:rc } });
    s2.addText((room.name||'Room').toUpperCase(), { x:cx+0.12, y:cy+0.08, w:cardW-0.2, h:0.26, fontSize:7, bold:true, color:'c0d8e0', fontFace:'Arial', charSpacing:1, margin:0 });
    s2.addText(dims, { x:cx+0.12, y:cy+0.36, w:cardW-0.2, h:0.34, fontSize:12, bold:true, color:rc, fontFace:'Arial', margin:0 });
    if (area) s2.addText(area, { x:cx+0.12, y:cy+0.74, w:cardW-0.2, h:0.24, fontSize:8, color:'3a5a6a', fontFace:'Arial', margin:0 });
    s2.addText((room.type||'other').toUpperCase() + '  ·  ' + (room.confidence||'medium').toUpperCase(), { x:cx+0.12, y:cy+0.94, w:cardW-0.2, h:0.18, fontSize:5.5, color:'2a4a5a', fontFace:'Arial', charSpacing:1, margin:0 });
  });

  // Extra slide if more than 9 rooms
  if (rooms.length > 9) {
    const s2b = pptx.addSlide();
    s2b.background = { color:'02040f' };
    s2b.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.08, fill:{ color:'00f5ff' } });
    s2b.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.65, fill:{ color:'0a1628' } });
    s2b.addText('ROOM BREAKDOWN (cont.)', { x:0.4, y:0.1, w:7, h:0.45, fontSize:14, bold:true, color:'e8f4ff', fontFace:'Arial', charSpacing:3, margin:0 });
    rooms.slice(9, 18).forEach((room, i) => {
      const col=i%COLS, row=Math.floor(i/COLS);
      const cx=startX+col*(cardW+gx), cy=0.8+row*(cardH+gy);
      const rc=roomColor(room.type||'other');
      const dims=(room.width_m&&room.length_m)?parseFloat(room.width_m).toFixed(1)+' × '+parseFloat(room.length_m).toFixed(1)+' m':'EST.';
      s2b.addShape(pptx.ShapeType.rect, { x:cx, y:cy, w:cardW, h:cardH, fill:{color:'0d1f3c'}, line:{color:'1a3a5a',width:0.4} });
      s2b.addShape(pptx.ShapeType.rect, { x:cx, y:cy, w:0.06, h:cardH, fill:{color:rc} });
      s2b.addText((room.name||'Room').toUpperCase(), { x:cx+0.12, y:cy+0.08, w:cardW-0.2, h:0.26, fontSize:7, bold:true, color:'c0d8e0', fontFace:'Arial', charSpacing:1, margin:0 });
      s2b.addText(dims, { x:cx+0.12, y:cy+0.36, w:cardW-0.2, h:0.34, fontSize:12, bold:true, color:rc, fontFace:'Arial', margin:0 });
    });
  }

  /* ── Slide 3: Observations + Scale note ─────────── */
  if (data.observations || data.scale_note) {
    const s3 = pptx.addSlide();
    s3.background = { color:'02040f' };
    s3.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.08, fill:{color:'7b2fff'} });
    s3.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:0.65, fill:{color:'0a1628'} });
    s3.addText('AI OBSERVATIONS', { x:0.4, y:0.1, w:7, h:0.45, fontSize:14, bold:true, color:'e8f4ff', fontFace:'Arial', charSpacing:3, margin:0 });
    s3.addText(label, { x:0.4, y:0.44, w:6, h:0.2, fontSize:7, color:'4a7a8a', fontFace:'Arial', charSpacing:1, margin:0 });

    if (imgSrc) {
      try {
        s3.addShape(pptx.ShapeType.rect, { x:0.4, y:0.82, w:3.8, h:2.8, fill:{color:'0d1f3c'}, line:{color:'1a3a5a',width:0.5} });
        s3.addImage({ data: imgSrc, x:0.5, y:0.9, w:3.6, h:2.6 });
      } catch(e) {}
    }

    if (data.observations) {
      s3.addShape(pptx.ShapeType.rect, { x:4.5, y:0.82, w:5.1, h:2.2, fill:{color:'0d1f3c'}, line:{color:'1a3a5a',width:0.5} });
      s3.addShape(pptx.ShapeType.rect, { x:4.5, y:0.82, w:0.06, h:2.2, fill:{color:'7b2fff'} });
      s3.addText(data.observations, { x:4.66, y:0.9, w:4.8, h:2.0, fontSize:9.5, color:'c0d8e0', fontFace:'Arial', valign:'top', margin:0, wrap:true });
    }

    if (data.scale_note) {
      s3.addShape(pptx.ShapeType.rect, { x:0.4, y:3.8, w:9.2, h:0.7, fill:{color:'0a1628'}, line:{color:'1a3a5a',width:0.4} });
      s3.addText('⬡  ' + data.scale_note, { x:0.6, y:3.88, w:8.8, h:0.52, fontSize:7.5, color:'3a5a6a', fontFace:'Arial', italic:true, margin:0 });
    }

    // Footer
    s3.addShape(pptx.ShapeType.rect, { x:0, y:5.3, w:'100%', h:0.07, fill:{color:'1a3a5a'} });
    s3.addText('HOLO·PLAN © 2025  ·  Created by Ceron Matthew Calsena  ·  POWERED BY CLAUDE AI', { x:0, y:5.38, w:'100%', h:0.22, fontSize:6, color:'2a4a5a', fontFace:'Arial', align:'center', margin:0 });
  }

  const fileName = 'HOLOPLAN_' + label.replace(/\s+/g,'_') + '.pptx';
  await pptx.writeFile({ fileName });
  showExportToast('✓ PPT EXPORTED', false);
};

/* ── Expose results to export module ────────────────────────── */
// app.js stores results in a closure; we bridge via a shared registry
window._holoResults = window._holoResults || {};

// Patch: intercept renderResults to register data for export
(function patchAppForExport() {
  const tryPatch = () => {
    // Wait until app.js has set up the results array
    if (!document.getElementById('resultsStack')) { setTimeout(tryPatch, 200); return; }

    // Override via MutationObserver — when a result card appears, read its data from DOM
    // The cleanest bridge: expose a setter from app.js scope via a custom event
    document.addEventListener('holoResultReady', function(e) {
      const { idx, data } = e.detail;
      window._holoResults[idx] = data;
    });
  };
  tryPatch();
})();
