// sidebar.js — renders sidebar month list and upcoming events

function renderMonthList() {
  const ul = document.getElementById('monthList');
  ul.innerHTML = '';

  MONTH_NAMES.forEach((name, idx) => {
    const li = document.createElement('li');
    li.textContent = name;
    if (idx === AppState.currentMonth) li.classList.add('active');

    li.addEventListener('click', () => {
      AppState.currentMonth = idx;
      renderCalendar();
    });

    ul.appendChild(li);
  });
}

function updateSidebarActive(month) {
  const items = document.querySelectorAll('.month-nav li');
  items.forEach((li, idx) => {
    li.classList.toggle('active', idx === month);
  });
}

function renderUpcoming() {
  const ul    = document.getElementById('upcomingList');
  ul.innerHTML = '';

  const items = getUpcomingEvents(7);

  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'upcoming-item';
    li.innerHTML = '<div class="up-date">—</div>No upcoming events';
    ul.appendChild(li);
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'upcoming-item';
    li.innerHTML = `<div class="up-date">${item.date}</div>${item.label}`;
    ul.appendChild(li);
  });
}

function renderTodayWidget() {
  const t = AppState.today;
  document.getElementById('todayDayName').textContent = DAY_NAMES[t.getDay()].slice(0, 3);
  document.getElementById('todayDayNum').textContent  = t.getDate();
  document.getElementById('todayMonth').textContent   = MONTH_NAMES[t.getMonth()].slice(0, 3) + ' ' + t.getFullYear();
}
