// modal.js — original event modal helpers (kept for compatibility).
// openModal() is now fully handled by booking.js.
// This file only manages the legacy modal overlay if present.

let _activeKey   = null;
let _activeMonth = null;
let _activeColor = null;

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
  _activeKey = _activeMonth = _activeColor = null;
}

function renderModalEvents() {
  const list = document.getElementById('modalEventList');
  if (!list || !_activeKey) return;
  list.innerHTML = '';
  const evts = getEventsForKey(_activeKey);
  if (evts.length === 0) {
    const empty = document.createElement('li');
    empty.className   = 'modal-empty';
    empty.textContent = 'No events yet ✨';
    list.appendChild(empty);
    return;
  }
  evts.forEach((evt, idx) => {
    const li  = document.createElement('li');
    li.className = 'modal-event-item';
    const dot = document.createElement('div');
    dot.className        = 'evt-dot-sm';
    dot.style.background = _activeColor ? _activeColor.accent : '#7c6af4';
    const name = document.createElement('span');
    name.className   = 'evt-name';
    name.textContent = evt;
    const del = document.createElement('button');
    del.className   = 'evt-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      deleteEvent(_activeKey, idx);
      renderModalEvents();
      refreshMonth(_activeMonth);
    });
    li.appendChild(dot); li.appendChild(name); li.appendChild(del);
    list.appendChild(li);
  });
}

function setupModalListeners() {
  // Safety: wire up legacy modal close if element exists
  const mc = document.getElementById('modalClose');
  if (mc) mc.addEventListener('click', closeModal);
  const mo = document.getElementById('modalOverlay');
  if (mo) mo.addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}