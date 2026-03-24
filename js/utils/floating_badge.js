// ============================================================
// STREETWISE PH — Floating Badge
// Visitor counter + daily line graph + Facebook Messenger link
// Injected on every page via p_main.js
// ============================================================

const FB_MESSENGER_URL = 'https://m.me/miguelito.bangayan';
const VISITOR_KEY      = 'swph_visitor_count';
const SESSION_KEY      = 'swph_session_counted';
const HISTORY_KEY      = 'swph_visitor_history'; // { "YYYY-MM-DD": count }

// ── Date helper ───────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return days;
}

function shortLabel(key) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ── Visitor counter ───────────────────────────────────────
function getVisitorCount() {
  return parseInt(localStorage.getItem(VISITOR_KEY) || '0', 10);
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
  catch { return {}; }
}

function incrementVisitor() {
  if (sessionStorage.getItem(SESSION_KEY)) return getVisitorCount();

  const next = getVisitorCount() + 1;
  localStorage.setItem(VISITOR_KEY, next);

  const history = getHistory();
  const key = todayKey();
  history[key] = (history[key] || 0) + 1;

  // Keep only last 30 days
  const allKeys = Object.keys(history).sort();
  if (allKeys.length > 30) {
    allKeys.slice(0, allKeys.length - 30).forEach(k => delete history[k]);
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  sessionStorage.setItem(SESSION_KEY, '1');
  return next;
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

// ── SVG Line Graph ────────────────────────────────────────
function buildLineGraph() {
  const W = 220, H = 80;
  const PAD = { top: 10, right: 8, bottom: 22, left: 28 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const history = getHistory();
  const days    = lastNDays(7);
  const values  = days.map(d => history[d] || 0);
  const maxVal  = Math.max(...values, 1);
  const today   = todayKey();

  const xOf = i => PAD.left + (i / (days.length - 1)) * iW;
  const yOf = v => PAD.top + iH - (v / maxVal) * iH;

  const pts = days.map((_, i) => `${xOf(i)},${yOf(values[i])}`).join(' ');

  const areaPath =
    `M${xOf(0)},${yOf(values[0])} ` +
    days.slice(1).map((_, i) => `L${xOf(i+1)},${yOf(values[i+1])}`).join(' ') +
    ` L${xOf(days.length-1)},${PAD.top + iH} L${xOf(0)},${PAD.top + iH} Z`;

  const yTicks = [0, Math.round(maxVal / 2), maxVal].map(v => ({ y: yOf(v), label: v }));

  const dots = days.map((d, i) => {
    const isToday = d === today;
    return `<circle cx="${xOf(i)}" cy="${yOf(values[i])}" r="${isToday ? 4 : 2.5}"
      fill="${isToday ? '#c9a96e' : '#4caf76'}"
      stroke="#161616" stroke-width="1.5">
      <title>${shortLabel(d)}: ${values[i]} visitor${values[i]!==1?'s':''}</title>
    </circle>`;
  }).join('');

  const xLabels = [0, 3, 6].map(i => {
    const lbl = shortLabel(days[i]);
    const anchor = i === 0 ? 'start' : i === 6 ? 'end' : 'middle';
    return `<text x="${xOf(i)}" y="${H - 4}" text-anchor="${anchor}"
      font-size="8" fill="rgba(255,255,255,.35)" font-family="sans-serif">${lbl}</text>`;
  }).join('');

  const yLabels = yTicks.map(t =>
    `<text x="${PAD.left - 5}" y="${t.y + 3}" text-anchor="end"
      font-size="8" fill="rgba(255,255,255,.35)" font-family="sans-serif">${t.label}</text>`
  ).join('');

  const gridLines = yTicks.map(t =>
    `<line x1="${PAD.left}" y1="${t.y}" x2="${PAD.left + iW}" y2="${t.y}"
      stroke="rgba(255,255,255,.06)" stroke-width="1" stroke-dasharray="3,3"/>`
  ).join('');

  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
      <defs>
        <linearGradient id="swph-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#4caf76" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#4caf76" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#swph-area-grad)"/>
      <polyline points="${pts}" fill="none" stroke="#4caf76" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
      ${yLabels}
    </svg>`;
}

// ── Inject CSS ────────────────────────────────────────────
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #swph-floating-badge {
      position: fixed;
      bottom: 28px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
    }

    /* Graph popup card */
    #swph-graph-card {
      pointer-events: none;
      background: var(--bg-card, #161616);
      border: 1px solid var(--border-light, #3a332c);
      border-radius: 10px;
      padding: 14px 16px 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,.65);
      width: 254px;
      transform-origin: bottom right;
      transform: scale(.92) translateY(8px);
      opacity: 0;
      transition: opacity .22s ease, transform .22s ease;
    }
    #swph-graph-card.swph-visible {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }
    .swph-graph-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .swph-graph-heading {
      font-size: .65rem;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--accent, #c9a96e);
      font-family: var(--font-display, sans-serif);
    }
    .swph-graph-sub {
      font-size: .6rem;
      color: rgba(255,255,255,.3);
      font-family: sans-serif;
    }
    .swph-graph-legend {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,.06);
    }
    .swph-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: .6rem;
      color: rgba(255,255,255,.4);
      font-family: sans-serif;
    }
    .swph-legend-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Visitor pill */
    #swph-visitor-pill {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-card, #161616);
      border: 1px solid var(--border-light, #3a332c);
      border-radius: 999px;
      padding: 7px 12px 7px 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,.45);
      transition: all .25s ease;
      cursor: pointer;
      user-select: none;
    }
    #swph-visitor-pill:hover,
    #swph-visitor-pill.swph-active {
      border-color: var(--accent, #c9a96e);
      box-shadow: 0 4px 24px rgba(201,169,110,.22);
    }
    .swph-pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf76;
      animation: swph-pulse 2s infinite;
      flex-shrink: 0;
    }
    @keyframes swph-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(76,175,118,.6); }
      70%  { box-shadow: 0 0 0 7px rgba(76,175,118,0); }
      100% { box-shadow: 0 0 0 0 rgba(76,175,118,0); }
    }
    .swph-pill-label {
      font-size: .7rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: rgba(255,255,255,.45);
      font-family: var(--font-display, sans-serif);
    }
    .swph-pill-count {
      font-size: .875rem;
      font-weight: 600;
      color: var(--accent, #c9a96e);
      font-family: var(--font-display, sans-serif);
      min-width: 24px;
      text-align: right;
    }
    .swph-pill-chevron {
      width: 10px;
      height: 10px;
      color: rgba(255,255,255,.28);
      transition: transform .2s ease, color .2s ease;
      flex-shrink: 0;
    }
    #swph-visitor-pill.swph-active .swph-pill-chevron {
      transform: rotate(180deg);
      color: var(--accent, #c9a96e);
    }

    /* Messenger button */
    #swph-messenger-btn {
      pointer-events: auto;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #0084ff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,132,255,.45);
      transition: all .25s ease;
      text-decoration: none;
      flex-shrink: 0;
    }
    #swph-messenger-btn:hover {
      background: #0070d8;
      transform: translateY(-3px) scale(1.06);
      box-shadow: 0 8px 28px rgba(0,132,255,.55);
    }
    #swph-messenger-btn svg { width: 28px; height: 28px; }

    @media (max-width: 480px) {
      #swph-floating-badge { bottom: 20px; right: 16px; }
      #swph-graph-card      { width: 234px; }
      #swph-messenger-btn   { width: 46px; height: 46px; }
      #swph-messenger-btn svg { width: 24px; height: 24px; }
    }
  `;
  document.head.appendChild(style);
}

// ── Inject HTML ───────────────────────────────────────────
function injectBadge(count) {
  const wrap = document.createElement('div');
  wrap.id = 'swph-floating-badge';
  wrap.innerHTML = `
    <div id="swph-graph-card">
      <div class="swph-graph-header">
        <span class="swph-graph-heading">Visitor Trend</span>
        <span class="swph-graph-sub">Last 7 days</span>
      </div>
      <div id="swph-graph-inner">${buildLineGraph()}</div>
      <div class="swph-graph-legend">
        <div class="swph-legend-item">
          <span class="swph-legend-dot" style="background:#4caf76"></span>Past days
        </div>
        <div class="swph-legend-item">
          <span class="swph-legend-dot" style="background:#c9a96e"></span>Today
        </div>
      </div>
    </div>

    <div id="swph-visitor-pill" title="Click to view visitor trend">
      <span class="swph-pill-dot"></span>
      <span class="swph-pill-label">Visitors</span>
      <span class="swph-pill-count" id="swph-count-val">${formatCount(count)}</span>
      <svg class="swph-pill-chevron" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
        <polyline points="2,3.5 5,6.5 8,3.5"/>
      </svg>
    </div>

    <a id="swph-messenger-btn"
       href="${FB_MESSENGER_URL}"
       target="_blank"
       rel="noopener noreferrer"
       title="Message us on Facebook Messenger"
       aria-label="Message us on Facebook Messenger">
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2C7.373 2 2 7.059 2 13.333c0 3.369 1.515 6.383 3.924 8.46V26l3.99-2.195A12.56 12.56 0 0014 24.667c6.627 0 12-5.059 12-11.334C26 7.059 20.627 2 14 2z" fill="white"/>
        <path d="M15.155 17.333l-3.044-3.25L6.5 17.333l6.2-6.583 3.1 3.25 5.555-3.25-6.2 6.583z" fill="#0084ff"/>
      </svg>
    </a>
  `;
  document.body.appendChild(wrap);

  const pill = document.getElementById('swph-visitor-pill');
  const card = document.getElementById('swph-graph-card');

  pill.addEventListener('click', e => {
    e.stopPropagation();
    const open = card.classList.contains('swph-visible');
    if (open) {
      card.classList.remove('swph-visible');
      pill.classList.remove('swph-active');
    } else {
      document.getElementById('swph-graph-inner').innerHTML = buildLineGraph();
      card.classList.add('swph-visible');
      pill.classList.add('swph-active');
    }
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) {
      card.classList.remove('swph-visible');
      pill.classList.remove('swph-active');
    }
  });
}

// ── Init ──────────────────────────────────────────────────
function init() {
  const count = incrementVisitor();
  injectStyles();
  injectBadge(count);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}