// data.js — state, constants, localStorage

const STORAGE_KEY = 'cal2026_events_v2';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Each month's accent color (matches theme.css CSS vars)
const MONTH_COLORS = [
  { accent: '#ff6b8a', light: '#ffd6df', tint: '#fff0f3' }, // Jan
  { accent: '#ff8c42', light: '#ffd9c0', tint: '#fff4ec' }, // Feb
  { accent: '#f4c430', light: '#faedb0', tint: '#fffbec' }, // Mar
  { accent: '#3cb771', light: '#b8f0ce', tint: '#f0fff4' }, // Apr
  { accent: '#29b5e8', light: '#b0e4f8', tint: '#f0faff' }, // May
  { accent: '#7c6af4', light: '#d0caff', tint: '#f3f0ff' }, // Jun
  { accent: '#e040c8', light: '#f8b8ef', tint: '#fff0fb' }, // Jul
  { accent: '#ff6347', light: '#ffcec4', tint: '#fff5f0' }, // Aug
  { accent: '#00b8a9', light: '#aaeeea', tint: '#f0fffe' }, // Sep
  { accent: '#62c82a', light: '#caf2b0', tint: '#f2fff0' }, // Oct
  { accent: '#ff9900', light: '#ffdfa0', tint: '#fff8f0' }, // Nov
  { accent: '#4e8af4', light: '#c0d4ff', tint: '#f0f4ff' }, // Dec
];

// Default holiday/special events
const DEFAULT_EVENTS = {
  '2026-01-01': ["New Year's Day 🎉"],
  '2026-02-14': ['Valentine\'s Day 💕'],
  '2026-03-08': ['Women\'s Day 🌸'],
  '2026-03-17': ['St. Patrick\'s Day 🍀'],
  '2026-04-05': ['Easter 🐣'],
  '2026-05-01': ['Labour Day 🌷'],
  '2026-05-10': ['Mother\'s Day 💐'],
  '2026-06-21': ['Summer Solstice ☀️'],
  '2026-07-04': ['Independence Day 🎆'],
  '2026-09-07': ['Labor Day 🇺🇸'],
  '2026-10-31': ['Halloween 🎃'],
  '2026-11-26': ['Thanksgiving 🦃'],
  '2026-12-24': ['Christmas Eve 🌟'],
  '2026-12-25': ['Christmas Day 🎄'],
  '2026-12-31': ["New Year's Eve 🥂"],
};

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_EVENTS };
  } catch { return { ...DEFAULT_EVENTS }; }
}

function saveEvents(events) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }
  catch(e) { console.warn('Storage error:', e); }
}

function toKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

const AppState = {
  year: 2026,
  events: loadEvents(),
  today: new Date(),
};