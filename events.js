// events.js — add, delete, and persist calendar events

function addEvent(key, text) {
  text = text.trim();
  if (!text) return false;

  if (!AppState.events[key]) {
    AppState.events[key] = [];
  }
  AppState.events[key].push(text);
  saveEvents(AppState.events);
  return true;
}

function deleteEvent(key, index) {
  if (!AppState.events[key]) return;
  AppState.events[key].splice(index, 1);
  if (AppState.events[key].length === 0) {
    delete AppState.events[key];
  }
  saveEvents(AppState.events);
}

function getEventsForKey(key) {
  return AppState.events[key] || [];
}

// Returns all events sorted by date (for sidebar upcoming list)
function getUpcomingEvents(limit = 6) {
  const today = AppState.today;
  const todayStr = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  return Object.entries(AppState.events)
    .filter(([key]) => key >= todayStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([key, evts]) => ({
      key,
      label: evts[0] + (evts.length > 1 ? ` +${evts.length - 1}` : ''),
      date: formatKeyAsDate(key)
    }));
}

// "2026-03-15" → "Mar 15"
function formatKeyAsDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}
