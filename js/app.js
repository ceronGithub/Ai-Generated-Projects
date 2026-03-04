// app.js — entry point

function renderTodayBadge() {
  const t   = AppState.today;
  const el  = document.getElementById('todayBadge');
  const dow = DAY_NAMES[t.getDay()];
  const mon = MONTH_NAMES[t.getMonth()].slice(0, 3);
  el.textContent = `Today — ${dow}, ${mon} ${t.getDate()}, ${t.getFullYear()}`;
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

async function init() {
  renderTodayBadge();
  renderAllMonths();
  setupModalListeners();
  setupBookingListeners();

  // Load bookings from Firebase into cache, then refresh indicators
  await initFirebase();
  applyBookingIndicators();
}

document.addEventListener('DOMContentLoaded', init);