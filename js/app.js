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
  // Re-apply booking dot indicator to the rebuilt card
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
  renderAllMonths();          // calendar.js — builds all 12 month cards
  applyBookingIndicators();   // booking.js  — marks cells with saved bookings
  setupModalListeners();      // modal.js    — legacy modal wiring (safe no-ops)
  setupBookingListeners();    // booking.js  — booking form events
}

document.addEventListener('DOMContentLoaded', init);