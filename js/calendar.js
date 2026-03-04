/* ══════════════════════════════════════════════
   MONTH CARD BACKGROUND ANIMATIONS
   Each month has its own unique animation style.
   Styles: bubbles, snow, fireflies, petals,
           rain, stars, confetti, embers,
           ripples, leaves, sparkles, aurora
══════════════════════════════════════════════ */

const CARD_ANIMATIONS = [
  'bubbles',    // Jan  — soft rising bubbles (pink)
  'snow',       // Feb  — gentle snowfall (orange-warm)
  'sunrays',    // Mar  — rotating sun rays (yellow)
  'petals',     // Apr  — drifting cherry petals (green)
  'rain',       // May  — light rainfall (blue)
  'fireflies',  // Jun  — floating fireflies (purple)
  'sparkles',   // Jul  — twinkling sparkles (magenta)
  'embers',     // Aug  — rising ember particles (tomato)
  'ripples',    // Sep  — expanding ripple rings (teal)
  'leaves',     // Oct  — tumbling autumn leaves (lime)
  'confetti',   // Nov  — falling confetti (orange)
  'aurora',     // Dec  — shifting aurora waves (blue)
];

function attachCardCanvas(card, month, color) {
  const canvas = document.createElement('canvas');
  canvas.className = 'month-card-canvas';
  card.insertBefore(canvas, card.firstChild);

  const type = CARD_ANIMATIONS[month];
  const animator = ANIMATORS[type];
  if (animator) animator(canvas, color);
}

/* ── Shared resize helper ── */
function syncCanvasSize(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (!rect.width) return false;
  if (canvas.width === Math.round(rect.width) && canvas.height === Math.round(rect.height)) return false;
  canvas.width  = Math.round(rect.width);
  canvas.height = Math.round(rect.height);
  return true;
}

/* ═══════════════════════
   ANIMATORS
═══════════════════════ */
const ANIMATORS = {

  /* ── JAN: Bubbles ── */
  bubbles(canvas, color) {
    const ctx = canvas.getContext('2d');
    let bubbles = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        r: Math.random() * 10 + 4,
        speed: Math.random() * 0.5 + 0.2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.03 + 0.01,
        alpha: Math.random() * 0.18 + 0.06,
      };
    }
    function init() {
      syncCanvasSize(canvas);
      bubbles = Array.from({length: 14}, () => {
        const b = spawn(); b.y = Math.random() * canvas.height; return b;
      });
    }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.04) bubbles.push(spawn());
      bubbles = bubbles.filter(b => b.y > -20);
      bubbles.forEach(b => {
        b.y -= b.speed;
        b.wobble += b.wobbleSpeed;
        b.x += Math.sin(b.wobble) * 0.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = color.accent + '55';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = color.accent + '44';
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── FEB: Snow ── */
  snow(canvas, color) {
    const ctx = canvas.getContext('2d');
    let flakes = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: -6,
        r: Math.random() * 4 + 1.5,
        speed: Math.random() * 0.6 + 0.2,
        drift: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.25 + 0.08,
      };
    }
    function init() { syncCanvasSize(canvas); flakes = Array.from({length: 18}, () => { const f = spawn(); f.y = Math.random() * canvas.height; return f; }); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.08) flakes.push(spawn());
      flakes = flakes.filter(f => f.y < canvas.height + 10);
      flakes.forEach(f => {
        f.y += f.speed; f.x += f.drift;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, color.accent + Math.round(f.alpha * 255).toString(16).padStart(2,'0'));
        g.addColorStop(1, color.accent + '00');
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── MAR: Sun Rays ── */
  sunrays(canvas, color) {
    const ctx = canvas.getContext('2d');
    let angle = 0;
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width * 0.72, cy = canvas.height * 0.18;
      const rays = 12;
      for (let i = 0; i < rays; i++) {
        const a = angle + (i / rays) * Math.PI * 2;
        const len = canvas.height * 1.4;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, color.accent + '28');
        g.addColorStop(1, color.accent + '00');
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.lineTo(20, len); ctx.lineTo(-20, len);
        ctx.closePath();
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
      }
      angle += 0.003;
      requestAnimationFrame(frame);
    }
    syncCanvasSize(canvas); frame();
  },

  /* ── APR: Petals ── */
  petals(canvas, color) {
    const ctx = canvas.getContext('2d');
    let petals = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: -10,
        size: Math.random() * 7 + 4,
        speed: Math.random() * 0.5 + 0.2,
        drift: (Math.random() - 0.5) * 0.6,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        alpha: Math.random() * 0.22 + 0.08,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.025 + 0.01,
      };
    }
    function drawPetal(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
      ctx.fillStyle = color.accent + 'cc';
      ctx.fill();
      ctx.restore();
    }
    function init() { syncCanvasSize(canvas); petals = Array.from({length: 12}, () => { const p = spawn(); p.y = Math.random() * canvas.height; return p; }); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.05) petals.push(spawn());
      petals = petals.filter(p => p.y < canvas.height + 20);
      petals.forEach(p => {
        p.y += p.speed; p.rot += p.rotSpeed;
        p.wobble += p.wobbleSpeed; p.x += Math.sin(p.wobble) * 0.7 + p.drift;
        drawPetal(p);
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── MAY: Rain ── */
  rain(canvas, color) {
    const ctx = canvas.getContext('2d');
    let drops = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: -10,
        len: Math.random() * 12 + 6,
        speed: Math.random() * 3 + 2,
        alpha: Math.random() * 0.15 + 0.05,
      };
    }
    function init() { syncCanvasSize(canvas); drops = Array.from({length: 22}, () => { const d = spawn(); d.y = Math.random() * canvas.height; return d; }); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.25) drops.push(spawn());
      drops = drops.filter(d => d.y < canvas.height + 20);
      drops.forEach(d => {
        d.y += d.speed; d.x -= d.speed * 0.15;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * 0.15, d.y - d.len);
        ctx.strokeStyle = color.accent + Math.round(d.alpha * 255).toString(16).padStart(2,'0');
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── JUN: Fireflies ── */
  fireflies(canvas, color) {
    const ctx = canvas.getContext('2d');
    let flies = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.5 + 1,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.025 + 0.01,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      };
    }
    function init() { syncCanvasSize(canvas); flies = Array.from({length: 18}, spawn); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      flies.forEach(f => {
        f.phase += f.phaseSpeed;
        f.x += f.vx + Math.sin(f.phase * 1.3) * 0.3;
        f.y += f.vy + Math.cos(f.phase) * 0.3;
        if (f.x < 0) f.x = canvas.width;
        if (f.x > canvas.width) f.x = 0;
        if (f.y < 0) f.y = canvas.height;
        if (f.y > canvas.height) f.y = 0;
        const alpha = (Math.sin(f.phase) * 0.5 + 0.5) * 0.5 + 0.05;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3.5);
        g.addColorStop(0, color.accent + Math.round(alpha * 255).toString(16).padStart(2,'0'));
        g.addColorStop(1, color.accent + '00');
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff' + Math.round(alpha * 255).toString(16).padStart(2,'0');
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── JUL: Sparkles ── */
  sparkles(canvas, color) {
    const ctx = canvas.getContext('2d');
    let stars = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 5 + 2,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.04 + 0.015,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.02,
      };
    }
    function drawStar(ctx, x, y, size, rot, alpha) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      }
      ctx.strokeStyle = color.accent;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    function init() { syncCanvasSize(canvas); stars = Array.from({length: 20}, spawn); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.phase += s.phaseSpeed; s.rot += s.rotSpeed;
        const alpha = (Math.sin(s.phase) * 0.5 + 0.5) * 0.35 + 0.02;
        drawStar(ctx, s.x, s.y, s.size, s.rot, alpha);
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── AUG: Embers ── */
  embers(canvas, color) {
    const ctx = canvas.getContext('2d');
    let embers = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + 5,
        r: Math.random() * 2.5 + 1,
        speed: Math.random() * 0.8 + 0.3,
        vx: (Math.random() - 0.5) * 0.6,
        alpha: Math.random() * 0.4 + 0.15,
        fade: Math.random() * 0.004 + 0.001,
      };
    }
    function init() { syncCanvasSize(canvas); embers = Array.from({length: 16}, () => { const e = spawn(); e.y = Math.random() * canvas.height; return e; }); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.08) embers.push(spawn());
      embers = embers.filter(e => e.alpha > 0.01 && e.y > -10);
      embers.forEach(e => {
        e.y -= e.speed; e.x += e.vx; e.alpha -= e.fade;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.5);
        g.addColorStop(0, '#fff' + Math.round(Math.min(e.alpha * 1.5, 1) * 255).toString(16).padStart(2,'0'));
        g.addColorStop(0.4, color.accent + Math.round(e.alpha * 255).toString(16).padStart(2,'0'));
        g.addColorStop(1, color.accent + '00');
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── SEP: Ripples ── */
  ripples(canvas, color) {
    const ctx = canvas.getContext('2d');
    let rings = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0,
        maxR: Math.random() * 40 + 20,
        speed: Math.random() * 0.4 + 0.15,
        alpha: Math.random() * 0.2 + 0.08,
      };
    }
    function init() { syncCanvasSize(canvas); rings = Array.from({length: 6}, spawn); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.025) rings.push(spawn());
      rings = rings.filter(r => r.r < r.maxR);
      rings.forEach(r => {
        r.r += r.speed;
        const progress = r.r / r.maxR;
        const alpha = r.alpha * (1 - progress);
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = color.accent + Math.round(alpha * 255).toString(16).padStart(2,'0');
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── OCT: Leaves ── */
  leaves(canvas, color) {
    const ctx = canvas.getContext('2d');
    let leaves = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: -12,
        size: Math.random() * 8 + 5,
        speed: Math.random() * 0.6 + 0.25,
        drift: (Math.random() - 0.5) * 0.5,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.008,
        alpha: Math.random() * 0.2 + 0.08,
      };
    }
    function drawLeaf(l) {
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.globalAlpha = l.alpha;
      ctx.beginPath();
      ctx.moveTo(0, -l.size);
      ctx.bezierCurveTo(l.size, -l.size * 0.5, l.size, l.size * 0.5, 0, l.size);
      ctx.bezierCurveTo(-l.size, l.size * 0.5, -l.size, -l.size * 0.5, 0, -l.size);
      ctx.fillStyle = color.accent + 'cc'; ctx.fill();
      ctx.restore();
    }
    function init() { syncCanvasSize(canvas); leaves = Array.from({length: 10}, () => { const l = spawn(); l.y = Math.random() * canvas.height; return l; }); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.04) leaves.push(spawn());
      leaves = leaves.filter(l => l.y < canvas.height + 20);
      leaves.forEach(l => {
        l.y += l.speed; l.rot += l.rotSpeed;
        l.wobble += l.wobbleSpeed; l.x += Math.sin(l.wobble) * 0.8 + l.drift;
        drawLeaf(l);
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── NOV: Confetti ── */
  confetti(canvas, color) {
    const ctx = canvas.getContext('2d');
    const COLORS = [color.accent, color.light, '#fff', color.accent + 'aa'];
    let pieces = [];
    function spawn() {
      return {
        x: Math.random() * canvas.width,
        y: -8,
        w: Math.random() * 7 + 3,
        h: Math.random() * 4 + 2,
        speed: Math.random() * 0.7 + 0.3,
        drift: (Math.random() - 0.5) * 0.5,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.07,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.25 + 0.08,
      };
    }
    function init() { syncCanvasSize(canvas); pieces = Array.from({length: 16}, () => { const p = spawn(); p.y = Math.random() * canvas.height; return p; }); }
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.06) pieces.push(spawn());
      pieces = pieces.filter(p => p.y < canvas.height + 20);
      pieces.forEach(p => {
        p.y += p.speed; p.x += p.drift; p.rot += p.rotSpeed;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    }
    init(); frame();
  },

  /* ── DEC: Aurora ── */
  aurora(canvas, color) {
    const ctx = canvas.getContext('2d');
    let t = 0;
    function frame() {
      if (!canvas.isConnected) return;
      syncCanvasSize(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;
      const bands = 3;
      for (let b = 0; b < bands; b++) {
        const offset = (b / bands) * Math.PI * 2;
        const yBase  = H * (0.25 + b * 0.18);
        const amp    = H * 0.09;
        ctx.beginPath();
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 4) {
          const y = yBase + Math.sin((x / W) * Math.PI * 3 + t + offset) * amp
                          + Math.sin((x / W) * Math.PI * 5 + t * 1.3 + offset) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
        const g = ctx.createLinearGradient(0, yBase - amp, 0, yBase + amp * 2);
        g.addColorStop(0, color.accent + '00');
        g.addColorStop(0.5, color.accent + '22');
        g.addColorStop(1, color.light + '11');
        ctx.fillStyle = g; ctx.fill();
      }
      t += 0.008;
      requestAnimationFrame(frame);
    }
    syncCanvasSize(canvas); frame();
  },
};
// calendar.js — builds all 12 month cards at once

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay();
}

function isToday(year, month, day) {
  const t = AppState.today;
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
}

function renderAllMonths() {
  const grid = document.getElementById('yearGrid');
  grid.innerHTML = '';

  for (let m = 0; m < 12; m++) {
    const card = buildMonthCard(AppState.year, m);
    grid.appendChild(card);
  }
}

function buildMonthCard(year, month) {
  const color = MONTH_COLORS[month];
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const prevDays    = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const card = document.createElement('div');
  card.className = 'month-card';
  card.style.setProperty('--m-accent', color.accent);
  card.style.setProperty('--m-light', color.light);
  card.style.setProperty('--m-tint', color.tint);

  // Attach unique animated background canvas for this month
  attachCardCanvas(card, month, color);

  // Header
  const header = document.createElement('div');
  header.className = 'month-header';
  header.style.background = `linear-gradient(135deg, ${color.tint}cc 0%, rgba(255,255,255,0.82) 100%)`;
  header.style.borderBottom = `2px solid ${color.light}`;

  const nameEl = document.createElement('div');
  nameEl.className = 'month-name';
  nameEl.textContent = MONTH_NAMES[month];
  nameEl.style.color = color.accent;

  const tagEl = document.createElement('div');
  tagEl.className = 'month-year-tag';
  tagEl.textContent = year;
  tagEl.style.color = color.accent;

  header.appendChild(nameEl);
  header.appendChild(tagEl);
  card.appendChild(header);

  // Weekday row
  const wRow = document.createElement('div');
  wRow.className = 'weekday-row';
  DAY_SHORT.forEach(d => {
    const s = document.createElement('span');
    s.textContent = d;
    wRow.appendChild(s);
  });
  card.appendChild(wRow);

  // Day grid
  const dayGrid = document.createElement('div');
  dayGrid.className = 'month-grid';

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    let dayNum, cellMonth, cellYear, isCurrent;

    if (i < firstDay) {
      dayNum    = prevDays - firstDay + 1 + i;
      cellMonth = month - 1 < 0 ? 11 : month - 1;
      cellYear  = month - 1 < 0 ? year - 1 : year;
      isCurrent = false;
      cell.classList.add('other-month');
    } else if (i >= firstDay + daysInMonth) {
      dayNum    = i - (firstDay + daysInMonth) + 1;
      cellMonth = month + 1 > 11 ? 0 : month + 1;
      cellYear  = month + 1 > 11 ? year + 1 : year;
      isCurrent = false;
      cell.classList.add('other-month');
    } else {
      dayNum    = i - firstDay + 1;
      cellMonth = month;
      cellYear  = year;
      isCurrent = true;

      const dow = (firstDay + dayNum - 1) % 7;
      if (dow === 0 || dow === 6) cell.classList.add('weekend');

      const key = toKey(cellYear, cellMonth, dayNum);

      if (isToday(cellYear, cellMonth, dayNum)) {
        cell.classList.add('today');
      }

      // Hover tint
      cell.addEventListener('mouseenter', () => {
        if (!cell.classList.contains('today')) {
          cell.style.background = color.tint;
        }
      });
      cell.addEventListener('mouseleave', () => {
        if (!cell.classList.contains('today')) {
          cell.style.background = '';
        }
      });

      cell.addEventListener('click', () => openModal(key, dayNum, month, year, color));
    }

    // Day number
    const numEl = document.createElement('div');
    numEl.className = 'day-num';
    numEl.textContent = dayNum;

    if (cell.classList.contains('today')) {
      numEl.style.background = color.accent;
      numEl.style.color = '#fff';
    }

    cell.appendChild(numEl);

    // Event dots
    if (isCurrent) {
      const key  = toKey(cellYear, cellMonth, dayNum);
      const evts = getEventsForKey(key);
      if (evts.length > 0) {
        const dotRow = document.createElement('div');
        dotRow.className = 'event-dots';
        const showDots = Math.min(evts.length, 3);
        for (let d = 0; d < showDots; d++) {
          const dot = document.createElement('div');
          dot.className = 'event-dot';
          dot.style.background = color.accent;
          dot.style.animationDelay = `${d * 0.08}s`;
          dotRow.appendChild(dot);
        }
        cell.appendChild(dotRow);
      }
    }

    dayGrid.appendChild(cell);
  }

  card.appendChild(dayGrid);
  return card;
}

// Refresh a single month's card (after event mutation)
function refreshMonth(month) {
  const grid    = document.getElementById('yearGrid');
  const cards   = grid.querySelectorAll('.month-card');
  const newCard = buildMonthCard(AppState.year, month);
  newCard.style.animationDelay = '0s';
  newCard.style.opacity        = '1';
  newCard.style.animation      = 'none';
  grid.replaceChild(newCard, cards[month]);
}