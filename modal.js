// modal.js — controls the event detail/add modal

let _activeKey = null;

function openModal(key, day, month, year) {
  _activeKey = key;

  const overlay   = document.getElementById('modalOverlay');
  const dateEl    = document.getElementById('modalDate');
  const inputEl   = document.getElementById('eventInput');

  // Format date label
  const dow = new Date(year, month, day).getDay();
  dateEl.textContent = `${DAY_NAMES[dow]}, ${MONTH_NAMES[month]} ${day}`;

  renderModalEvents(key);
  overlay.classList.add('open');
  inputEl.value = '';
  inputEl.focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  _activeKey = null;
}

function renderModalEvents(key) {
  const list = document.getElementById('modalEventList');
  list.innerHTML = '';

  const evts = getEventsForKey(key);

  if (evts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'modal-empty';
    empty.textContent = 'No events — add one below';
    list.appendChild(empty);
    return;
  }

  evts.forEach((evt, idx) => {
    const li = document.createElement('li');
    li.className = 'modal-event-item';

    const name = document.createElement('span');
    name.className = 'evt-name';
    name.textContent = evt;

    const del = document.createElement('button');
    del.className = 'evt-del';
    del.textContent = '×';
    del.title = 'Delete event';
    del.addEventListener('click', () => {
      deleteEvent(key, idx);
      renderModalEvents(key);
      refreshAfterChange();
    });

    li.appendChild(name);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function setupModalListeners() {
  document.getElementById('modalClose').addEventListener('click', closeModal);

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  document.getElementById('eventAddBtn').addEventListener('click', handleAddEvent);

  document.getElementById('eventInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddEvent();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function handleAddEvent() {
  const input = document.getElementById('eventInput');
  const text  = input.value;

  if (_activeKey && addEvent(_activeKey, text)) {
    input.value = '';
    renderModalEvents(_activeKey);
    refreshAfterChange();
  }
}

// Called after any event mutation — refreshes grid + sidebar
function refreshAfterChange() {
  renderCalendar();
  renderUpcoming();
}
