// app.js — entry point

function renderTodayBadge() {
  const t   = AppState.today;
  const el  = document.getElementById('todayBadge');
  const dow = DAY_NAMES[t.getDay()];
  const mon = MONTH_NAMES[t.getMonth()].slice(0, 3);
  el.textContent = `Today — ${dow}, ${mon} ${t.getDate()}, ${t.getFullYear()}`;
}

function init() {
  renderTodayBadge();
  renderAllMonths();
  setupModalListeners();
}

document.addEventListener('DOMContentLoaded', init);