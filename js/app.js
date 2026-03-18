// app.js — entry point

/* ── Day-type label: Weekday / Weekend / Holiday(event name) ── */
function getDayTypeLabel(date) {
  const key = toKey(date.getFullYear(), date.getMonth(), date.getDate());
  const events = AppState.events || {};
  if (events[key] && events[key].length > 0) {
    const name = events[key][0].replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();
    return { label: name || 'Holiday', type: 'holiday' };
  }
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return { label: 'Weekend', type: 'weekend' };
  return { label: 'Weekday', type: 'weekday' };
}

/* ── Live clock + day badge ── */
let _clockInterval = null;

function renderTodayBadge() {
  const el = document.getElementById('todayBadge');
  if (!el) return;

  function tick() {
    const now = new Date();
    const dow = DAY_NAMES[now.getDay()];
    const mon = MONTH_NAMES[now.getMonth()].slice(0, 3);
    const dateStr = `${dow}, ${mon} ${now.getDate()}, ${now.getFullYear()}`;

    // Clock
    let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`;

    // Day type
    const { label, type } = getDayTypeLabel(now);
    const typeColors = {
      holiday: { bg: '#fff3cd', color: '#9a6000', border: '#ffe08a' },
      weekend: { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
      weekday: { bg: '#f0eeff', color: '#5a48c8', border: '#d0caff' },
    };
    const tc = typeColors[type];

    el.innerHTML = `
      <span style="font-size:12px;font-weight:700;color:#1a1a2e;white-space:nowrap;">📅 ${dateStr}</span>
      <span style="
        display:inline-flex;align-items:center;
        background:${tc.bg};color:${tc.color};
        border:1.5px solid ${tc.border};
        border-radius:20px;padding:2px 10px;
        font-size:11px;font-weight:800;white-space:nowrap;
      ">${type === 'holiday' ? '🎉 ' : type === 'weekend' ? '🌿 ' : '💼 '}${label}</span>
      <span style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#29b5e8;letter-spacing:1px;white-space:nowrap;">⏰ ${timeStr}</span>
    `;
    el.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
  }

  tick();
  if (_clockInterval) clearInterval(_clockInterval);
  _clockInterval = setInterval(tick, 1000);
}

// Wrap refreshMonth so booking indicators re-apply after a card rebuild
const _origRefreshMonth = refreshMonth;
function refreshMonth(month) {
  _origRefreshMonth(month);
  const grid = document.getElementById('yearGrid');
  if (!grid) return;
  const card = grid.querySelectorAll('.month-card')[month];
  if (!card) return;
  card.querySelectorAll('.day-cell:not(.other-month)').forEach(cell => {
    const numEl = cell.querySelector('.day-num');
    if (!numEl) return;
    const day = parseInt(numEl.textContent);
    const key = toKey(AppState.year, month, day);
    if (Bookings[key] && Bookings[key].length > 0) {
      cell.classList.add('has-booking');
    }
  });
}

function init() {
  renderTodayBadge();
  renderAllMonths();
  setupModalListeners();
  setupBookingListeners();

  initFirebase().then(async () => {
    applyBookingIndicators();
    syncBackupFromBookings();
    await flushSyncQueue();
  }).catch(e => {
    console.warn('Firebase background init failed:', e.message);
  });
}

document.addEventListener('DOMContentLoaded', init);