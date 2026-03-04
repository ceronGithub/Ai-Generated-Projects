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

  // Header
  const header = document.createElement('div');
  header.className = 'month-header';
  header.style.background = `linear-gradient(135deg, ${color.tint} 0%, #fff 100%)`;
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