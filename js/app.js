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
  // Always ensure card is visible after rebuild
  card.style.opacity  = '1';
  card.style.transform = 'translateY(0) scale(1)';
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
  setupAnalyticsListeners();

  // Load bookings from Firebase, then force cards visible + refresh indicators
  await initFirebase();
  document.querySelectorAll('.month-card').forEach(card => {
    card.style.opacity   = '1';
    card.style.animation = 'none';
    card.style.transform = 'translateY(0) scale(1)';
  });
  applyBookingIndicators();
}

document.addEventListener('DOMContentLoaded', init);