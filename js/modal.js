// modal.js — event detail modal

let _activeKey   = null;
let _activeMonth = null;
let _activeColor = null;

function openModal(key, day, month, year, color) {
  _activeKey   = key;
  _activeMonth = month;
  _activeColor = color;

  const overlay  = document.getElementById('modalOverlay');
  const dateEl   = document.getElementById('modalDate');
  const colorBar = document.getElementById('modalColorBar');
  const inputEl  = document.getElementById('eventInput');
  const addBtn   = document.getElementById('eventAddBtn');

  const dow = new Date(year, month, day).getDay();
  dateEl.textContent = `${DAY_NAMES[dow]}, ${MONTH_NAMES[month]} ${day}`;
  colorBar.style.background = `linear-gradient(180deg, ${color.accent}, ${color.light})`;
  addBtn.style.background   = `linear-gradient(135deg, ${color.accent}, ${color.light})`;
  addBtn.style.color        = '#fff';

  renderModalEvents();
  overlay.classList.add('open');
  inputEl.value = '';
  setTimeout(() => inputEl.focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  _activeKey = _activeMonth = _activeColor = null;
}

function renderModalEvents() {
  const list = document.getElementById('modalEventList');
  list.innerHTML = '';
  const evts = getEventsForKey(_activeKey);

  if (evts.length === 0) {
    const empty = document.createElement('li');
    empty.className   = 'modal-empty';
    empty.textContent = 'No events yet — add one below ✨';
    list.appendChild(empty);
    return;
  }

  evts.forEach((evt, idx) => {
    const li  = document.createElement('li');
    li.className = 'modal-event-item';

    const dot = document.createElement('div');
    dot.className        = 'evt-dot-sm';
    dot.style.background = _activeColor.accent;

    const name = document.createElement('span');
    name.className   = 'evt-name';
    name.textContent = evt;

    const del = document.createElement('button');
    del.className   = 'evt-del';
    del.textContent = '×';
    del.title       = 'Remove event';
    del.addEventListener('click', () => {
      deleteEvent(_activeKey, idx);
      renderModalEvents();
      refreshMonth(_activeMonth);
    });

    li.appendChild(dot);
    li.appendChild(name);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function handleAddEvent() {
  const input = document.getElementById('eventInput');
  if (_activeKey && addEvent(_activeKey, input.value)) {
    input.value = '';
    renderModalEvents();
    refreshMonth(_activeMonth);
  }
}

function setupModalListeners() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.getElementById('eventAddBtn').addEventListener('click', handleAddEvent);
  document.getElementById('eventInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddEvent();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}