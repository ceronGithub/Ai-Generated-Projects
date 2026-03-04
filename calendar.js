// calendar.js — renders the monthly calendar grid

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function isToday(year, month, day) {
  const t = AppState.today;
  return t.getFullYear() === year &&
         t.getMonth() === month &&
         t.getDate() === day;
}

function isWeekend(dayOfWeek) {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Render the grid for AppState.currentMonth
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calMonthTitle');

  const { year, currentMonth, events } = AppState;
  const month = currentMonth;

  // Update title with animation
  title.style.animation = 'none';
  void title.offsetWidth; // reflow
  title.style.animation = '';
  title.textContent = MONTH_NAMES[month];

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  // Prev month trailing days
  const prevMonthDays = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);

  // Total cells = at least 35 (5 rows × 7), maybe 42
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  // Force re-animate by replacing inner HTML
  grid.innerHTML = '';

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    let dayNum, cellMonth, cellYear;

    if (i < firstDay) {
      // Previous month
      dayNum    = prevMonthDays - firstDay + 1 + i;
      cellMonth = month - 1 < 0 ? 11 : month - 1;
      cellYear  = month - 1 < 0 ? year - 1 : year;
      cell.classList.add('other-month');
    } else if (i >= firstDay + daysInMonth) {
      // Next month
      dayNum    = i - (firstDay + daysInMonth) + 1;
      cellMonth = month + 1 > 11 ? 0 : month + 1;
      cellYear  = month + 1 > 11 ? year + 1 : year;
      cell.classList.add('other-month');
    } else {
      // Current month
      dayNum    = i - firstDay + 1;
      cellMonth = month;
      cellYear  = year;

      const key = toKey(cellYear, cellMonth, dayNum);
      const dow = (firstDay + dayNum - 1) % 7;

      if (isToday(cellYear, cellMonth, dayNum)) cell.classList.add('today');
      if (isWeekend(dow)) cell.classList.add('weekend');
      if (events[key] && events[key].length > 0) cell.classList.add('has-events');

      // Attach click → open modal
      cell.dataset.key   = key;
      cell.dataset.day   = dayNum;
      cell.dataset.month = cellMonth;
      cell.dataset.year  = cellYear;
      cell.addEventListener('click', () => openModal(key, dayNum, cellMonth, cellYear));
    }

    // Day number badge
    const numEl = document.createElement('div');
    numEl.className = 'day-num';
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    // Event chips (current month only)
    if (!cell.classList.contains('other-month')) {
      const key = toKey(cellYear, cellMonth, dayNum);
      renderEventChips(cell, key);
    }

    grid.appendChild(cell);
  }

  // Highlight active month in sidebar
  updateSidebarActive(month);
}

// Render event chips inside a day cell
function renderEventChips(cell, key) {
  const evts = AppState.events[key];
  if (!evts || evts.length === 0) return;

  const show = evts.slice(0, 2);
  show.forEach(evt => {
    const chip = document.createElement('div');
    chip.className = 'event-chip';
    chip.textContent = evt;
    cell.appendChild(chip);
  });

  if (evts.length > 2) {
    const more = document.createElement('div');
    more.className = 'event-more';
    more.textContent = `+${evts.length - 2} more`;
    cell.appendChild(more);
  }
}
