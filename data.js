// data.js — application state and localStorage persistence

const STORAGE_KEY = 'calendar_2026_events';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Default events pre-loaded for the year
const DEFAULT_EVENTS = {
  '2026-01-01': ["New Year's Day 🎉"],
  '2026-02-14': ['Valentine\'s Day 💛'],
  '2026-03-08': ['International Women\'s Day'],
  '2026-04-05': ['Easter Sunday 🐣'],
  '2026-05-01': ['Labour Day'],
  '2026-06-21': ['Summer Solstice ☀️'],
  '2026-07-04': ['Independence Day 🇺🇸'],
  '2026-09-07': ['Labor Day (US)'],
  '2026-10-31': ['Halloween 🎃'],
  '2026-11-26': ['Thanksgiving 🦃'],
  '2026-12-24': ['Christmas Eve 🌟'],
  '2026-12-25': ['Christmas Day 🎄'],
  '2026-12-31': ["New Year's Eve 🥂"],
};

// Load events from localStorage or fall back to defaults
function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_EVENTS };
  } catch {
    return { ...DEFAULT_EVENTS };
  }
}

// Save events to localStorage
function saveEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn('Storage unavailable:', e);
  }
}

// Build a dateKey string "YYYY-MM-DD"
function toKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// App state object (shared across modules)
const AppState = {
  year: 2026,
  currentMonth: 0,        // 0-indexed
  events: loadEvents(),
  today: new Date(),
};
