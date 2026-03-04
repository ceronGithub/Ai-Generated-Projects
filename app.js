// app.js — entry point: wires navigation and initializes the app

function setupNavigation() {
  document.getElementById('btnPrev').addEventListener('click', () => {
    AppState.currentMonth--;
    if (AppState.currentMonth < 0) {
      AppState.currentMonth = 11;
      // Optionally allow year wrap — stays on 2026 here
    }
    renderCalendar();
    renderMonthList();
  });

  document.getElementById('btnNext').addEventListener('click', () => {
    AppState.currentMonth++;
    if (AppState.currentMonth > 11) {
      AppState.currentMonth = 0;
    }
    renderCalendar();
    renderMonthList();
  });

  document.getElementById('btnToday').addEventListener('click', () => {
    const t = AppState.today;
    // Only jump if within 2026
    if (t.getFullYear() === AppState.year) {
      AppState.currentMonth = t.getMonth();
    } else {
      AppState.currentMonth = 0;
    }
    renderCalendar();
    renderMonthList();
  });
}

function init() {
  // Set initial month to today's month if we're in 2026, else Jan
  const t = AppState.today;
  AppState.currentMonth = t.getFullYear() === AppState.year ? t.getMonth() : 0;

  renderTodayWidget();
  renderMonthList();
  renderCalendar();
  renderUpcoming();
  setupModalListeners();
  setupNavigation();
}

document.addEventListener('DOMContentLoaded', init);
