// news.js — Firebase Rules Expiry Running Ticker
// Always visible between header and calendar.
// Shows live countdown, color changes by urgency.
//
// STATES:
//  ✅ SAFE      > 14 days  — green
//  🔵 INFO      7–14 days  — blue
//  🟡 SOON      3–7 days   — yellow
//  🟠 WARNING   1–3 days   — orange
//  🔴 CRITICAL  < 24 hrs   — red
//  💀 EXPIRED   past       — deep red

const NEWS_DEFAULT_EXPIRY_TS = 1775232000000;
const NEWS_SCROLL_SPEED      = 55; // px/sec

let _newsRAF       = null;
let _newsScrollPos = 0;
let _newsTick      = null;

/* ── INIT ── */
function initNewsTicker() {
  _renderTicker();
  if (_newsTick) clearInterval(_newsTick);
  // Update every 60s for live countdown
  _newsTick = setInterval(_renderTicker, 60 * 1000);
  // Re-check when rules editor is edited
  document.addEventListener('input', e => {
    if (e.target?.id === 'rulesEditor') _renderTicker();
  });
}

/* ── RENDER ── */
function _renderTicker() {
  const ticker = document.getElementById('newsTicker');
  const track  = document.getElementById('newsTrack');
  const text   = document.getElementById('newsText');
  const label  = document.getElementById('newsLabel');
  if (!ticker || !track || !text) return;

  const expiryTs  = _detectExpiryTimestamp();
  const now       = Date.now();
  const msLeft    = expiryTs - now;
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const daysLeft  = msLeft / (1000 * 60 * 60 * 24);

  let gradient, labelText, msgs;

  if (msLeft <= 0) {
    gradient  = 'linear-gradient(90deg,#c0203a,#e04060,#ff6b8a,#e04060,#c0203a)';
    labelText = '🔴 EXPIRED';
    msgs      = _msgsExpired(expiryTs);
  } else if (hoursLeft < 24) {
    gradient  = 'linear-gradient(90deg,#e04060,#ff6b8a,#ff9900,#ff6b8a,#e04060)';
    labelText = '🚨 CRITICAL';
    msgs      = _msgsCritical(hoursLeft, expiryTs);
  } else if (daysLeft < 3) {
    gradient  = 'linear-gradient(90deg,#ff9900,#ffb700,#ff9900,#e08000,#ff9900)';
    labelText = '⚠️ WARNING';
    msgs      = _msgsWarning(daysLeft, hoursLeft, expiryTs);
  } else if (daysLeft < 7) {
    gradient  = 'linear-gradient(90deg,#f4c430,#ffda44,#f4c430,#e0aa00,#f4c430)';
    labelText = '📅 SOON';
    msgs      = _msgsSoon(daysLeft, expiryTs);
  } else if (daysLeft < 14) {
    gradient  = 'linear-gradient(90deg,#29b5e8,#4ecaff,#29b5e8,#0a95cc,#29b5e8)';
    labelText = '🔵 INFO';
    msgs      = _msgsInfo(daysLeft, expiryTs);
  } else {
    gradient  = 'linear-gradient(90deg,#3cb771,#5ad98a,#3cb771,#1a9a52,#3cb771)';
    labelText = '✅ FIREBASE';
    msgs      = _msgsSafe(daysLeft, expiryTs);
  }

  ticker.style.background     = gradient;
  ticker.style.backgroundSize = '300% 100%';
  ticker.style.display        = 'block';
  if (label) label.textContent = labelText;

  // Build scrolling text
  const sep  = '     ◆     ';
  text.textContent = msgs.join(sep) + sep;

  _startScroll(track, text);
}

/* ── MESSAGE BUILDERS ── */
function _fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-PH', {
    weekday:'short', month:'short', day:'numeric', year:'numeric'
  });
}
function _fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-PH', {
    hour:'2-digit', minute:'2-digit', hour12:true
  });
}
function _fmtCountdown(daysLeft) {
  const d = Math.floor(daysLeft);
  const h = Math.floor((daysLeft - d) * 24);
  if (d === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  return `${d} day${d !== 1 ? 's' : ''}${h > 0 ? ` ${h}h` : ''}`;
}

function _msgsSafe(d, ts) {
  return [
    `🔥 Firebase Rules  ·  ${_fmtCountdown(d)} remaining until expiry`,
    `✅ Database is active and connected`,
    `📅 Rules expire on ${_fmtDate(ts)} at ${_fmtTime(ts)}  ·  ${_fmtCountdown(d)} left`,
    `💡 Renew rules before expiry to avoid booking disruptions`,
  ];
}
function _msgsInfo(d, ts) {
  return [
    `🔵 Firebase Rules expire in ${_fmtCountdown(d)}  ·  ${_fmtDate(ts)}`,
    `📋 Plan to update your Firebase Rules soon — click ⚙️ Settings → Rules tab`,
    `⏰ ${_fmtCountdown(d)} remaining  ·  Expiry: ${_fmtDate(ts)} at ${_fmtTime(ts)}`,
    `🔧 Renew: ⚙️ → Rules tab → copy → paste & publish in Firebase Console`,
  ];
}
function _msgsSoon(d, ts) {
  return [
    `🟡 Firebase Rules expire in ${_fmtCountdown(d)}  ·  ${_fmtDate(ts)}`,
    `⚠️ Only ${_fmtCountdown(d)} left — update rules before ${_fmtDate(ts)}`,
    `🔧 Click ⚙️ Settings → Rules tab → prepare new rules now`,
    `💀 After expiry: new bookings CANNOT be saved to Firebase`,
    `⏰ ${_fmtCountdown(d)} remaining — don't let your rules expire!`,
  ];
}
function _msgsWarning(d, h, ts) {
  const hLeft = Math.floor(h);
  return [
    `🟠 URGENT — Firebase Rules expire in ${_fmtCountdown(d)}  (${_fmtDate(ts)} ${_fmtTime(ts)})`,
    `⚠️ Only ${hLeft} hours left — renew your Firebase Rules NOW`,
    `🔧 Click ⚙️ → Rules tab → copy → paste in Firebase Console → Publish`,
    `💀 After ${_fmtDate(ts)}: database will be BLOCKED — no bookings can be saved`,
  ];
}
function _msgsCritical(h, ts) {
  const hLeft = Math.floor(h);
  const mLeft = Math.floor((h - hLeft) * 60);
  return [
    `🚨 CRITICAL — Firebase Rules expire in ${hLeft}h ${mLeft}m  ·  ${_fmtTime(ts)} TODAY`,
    `🔴 ACT NOW — Open ⚙️ → Rules tab → copy rules → paste & Publish`,
    `⏰ ${hLeft}h ${mLeft}m until database is BLOCKED — fix this immediately!`,
    `💀 ALL booking saves will FAIL after expiry`,
  ];
}
function _msgsExpired(ts) {
  return [
    `💀 FIREBASE RULES HAVE EXPIRED  ·  Expired ${_fmtDate(ts)} at ${_fmtTime(ts)}`,
    `🔴 DATABASE IS BLOCKED — New bookings CANNOT be saved`,
    `🔧 Fix now: Open ⚙️ → Rules tab → use "Open Access" template → Publish`,
    `⚠️ No new data can be written until rules are renewed`,
  ];
}

/* ── SCROLL ENGINE ── */
function _startScroll(track, textEl) {
  if (_newsRAF) cancelAnimationFrame(_newsRAF);
  _newsScrollPos = 0;
  let lastTime   = null;

  // Remove the padding-left offset — we drive position purely via translateX
  track.style.paddingLeft = '0px';

  // Start position = full viewport width so text enters from the right
  const viewW = window.innerWidth || document.documentElement.clientWidth;
  _newsScrollPos = -viewW;

  function step(ts) {
    if (!lastTime) lastTime = ts;
    const delta = (ts - lastTime) / 1000;
    lastTime    = ts;

    const textW = textEl.offsetWidth + 80;
    _newsScrollPos += NEWS_SCROLL_SPEED * delta;

    // Once the entire text has scrolled off the left edge, restart
    if (_newsScrollPos > textW) _newsScrollPos = -viewW;

    track.style.transform = `translateX(-${_newsScrollPos}px)`;
    _newsRAF = requestAnimationFrame(step);
  }
  _newsRAF = requestAnimationFrame(step);
}

/* ── DETECT EXPIRY TIMESTAMP ── */
function _detectExpiryTimestamp() {
  const editor = document.getElementById('rulesEditor');
  if (editor?.value) {
    const ts = _parseTs(editor.value);
    if (ts) return ts;
  }
  try {
    const saved = localStorage.getItem('fb_rules_backup');
    if (saved) { const ts = _parseTs(saved); if (ts) return ts; }
  } catch(e) {}
  return NEWS_DEFAULT_EXPIRY_TS;
}

function _parseTs(str) {
  const m = str.match(/now\s*<\s*(\d{10,14})/);
  if (!m) return null;
  const ts = parseInt(m[1], 10);
  return (ts > 1577836800000 && ts < 2051222400000) ? ts : null;
}

/* ── DISMISS (snooze 1 hour) ── */
function dismissNewsTicker() {
  const ticker = document.getElementById('newsTicker');
  if (!ticker) return;
  ticker.style.transition = 'max-height 0.35s ease, opacity 0.25s ease';
  ticker.style.maxHeight  = '0px';
  ticker.style.opacity    = '0';
  ticker.style.overflow   = 'hidden';
  setTimeout(() => {
    ticker.style.display = 'none';
    ticker.style.maxHeight  = '';
    ticker.style.opacity    = '';
    ticker.style.transition = '';
    ticker.style.overflow   = '';
  }, 380);
  // Re-show after 1 hour
  setTimeout(() => {
    ticker.style.display = 'block';
    _renderTicker();
  }, 60 * 60 * 1000);
}

/* ── PUBLIC refresh (called from firebase.js) ── */
function refreshNewsTicker() {
  _renderTicker();
}