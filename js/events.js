// events.js — add, delete, query events

function addEvent(key, text) {
  text = text.trim();
  if (!text) return false;
  if (!AppState.events[key]) AppState.events[key] = [];
  AppState.events[key].push(text);
  saveEvents(AppState.events);
  return true;
}

function deleteEvent(key, index) {
  if (!AppState.events[key]) return;
  AppState.events[key].splice(index, 1);
  if (AppState.events[key].length === 0) delete AppState.events[key];
  saveEvents(AppState.events);
}

function getEventsForKey(key) {
  return AppState.events[key] || [];
}

function formatKeyAsDate(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}