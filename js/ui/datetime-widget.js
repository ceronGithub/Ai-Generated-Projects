// =============================================
// datetime-widget.js
// Live cosmic header widgets:
//   🗓  EVENT   — Holiday name | Weekend | Weekday
//   🕐  CLOCK   — 12-hr ticking with blinking colon
//   📅  DATE    — Full calendar date
//
// Philippine Public Holidays (Regular + Special)
// Movable: Easter, National Heroes Day, CNY
// =============================================

const DateTimeWidget = (() => {

  // ─────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Clock face emoji sequence: 🕐=1…🕛=12
  const CLOCK_EMOJI = ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'];

  // ─────────────────────────────────────────────────
  // PH HOLIDAY ENGINE
  // ─────────────────────────────────────────────────

  /** ISO key: YYYY-MM-DD */
  function toKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function pad(n) { return String(n).padStart(2,'0'); }

  /** Anonymous Gregorian Easter algorithm */
  function calcEaster(Y) {
    const a=Y%19, b=Math.floor(Y/100), c=Y%100;
    const d=Math.floor(b/4), e=b%4;
    const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4), k=c%4;
    const l=(32+2*e+2*i-h-k)%7;
    const m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31);
    const day=((h+l-7*m+114)%31)+1;
    return new Date(Y, month-1, day);
  }

  /** Last occurrence of weekday (0=Sun) in 0-indexed month */
  function lastWeekdayOfMonth(year, month0, dow) {
    let d = new Date(year, month0+1, 0).getDate(); // last day
    while (new Date(year, month0, d).getDay() !== dow) d--;
    return d;
  }

  /** Chinese New Year dates (extend as needed) */
  const CNY_TABLE = {
    2020:[1,25], 2021:[2,12], 2022:[2,1],  2023:[1,22],
    2024:[2,10], 2025:[1,29], 2026:[2,17], 2027:[2,6],
    2028:[1,26], 2029:[2,13], 2030:[2,3],  2031:[1,23]
  };

  /**
   * Build a Map<YYYY-MM-DD, {name, type, emoji}>
   * type: 'regular' | 'special'
   */
  function buildHolidays(year) {
    const map = new Map();

    const add = (m, d, name, type='regular', emoji='🎌') => {
      map.set(`${year}-${pad(m)}-${pad(d)}`, { name, type, emoji });
    };

    // ── Fixed Regular Holidays ─────────────────────
    add(1,  1,  "New Year's Day",           'regular', '🎆');
    add(4,  9,  "Araw ng Kagitingan",        'regular', '🎖️');
    add(5,  1,  "Labor Day",                 'regular', '✊');
    add(6,  12, "Independence Day",          'regular', '🇵🇭');
    add(11, 30, "Bonifacio Day",             'regular', '⚔️');
    add(12, 25, "Christmas Day",             'regular', '🎄');
    add(12, 30, "Rizal Day",                 'regular', '🕯️');

    // ── Fixed Special Non-Working ──────────────────
    add(2,  25, "EDSA People Power",         'special', '✌️');
    add(8,  21, "Ninoy Aquino Day",           'special', '🕊️');
    add(11,  1, "All Saints' Day",            'special', '🕯️');
    add(11,  2, "All Souls' Day",             'special', '🌹');
    add(12,  8, "Immaculate Conception",      'special', '🌸');
    add(12, 24, "Christmas Eve",              'special', '🎁');
    add(12, 31, "New Year's Eve",             'special', '🥂');

    // ── Movable: National Heroes Day (last Mon of Aug) ──
    const nhdDay = lastWeekdayOfMonth(year, 7, 1); // month 7 = August
    add(8, nhdDay, "National Heroes Day",    'regular', '🏅');

    // ── Movable: Holy Week ─────────────────────────
    const easter = calcEaster(year);
    [
      [-3, 'Maundy Thursday', 'regular', '✝️'],
      [-2, 'Good Friday',     'regular', '⛪'],
      [-1, 'Black Saturday',  'special', '🕯️'],
    ].forEach(([offset, name, type, emoji]) => {
      const d = new Date(easter);
      d.setDate(d.getDate() + offset);
      map.set(toKey(d), { name, type, emoji });
    });

    // ── Movable: Chinese New Year ──────────────────
    const cny = CNY_TABLE[year];
    if (cny) add(cny[0], cny[1], "Chinese New Year", 'special', '🧧');

    return map;
  }

  // Cache so we don't rebuild every tick
  let _cachedYear = null;
  let _cachedHolidays = null;

  function getHolidays(year) {
    if (_cachedYear !== year) {
      _cachedHolidays = buildHolidays(year);
      _cachedYear = year;
    }
    return _cachedHolidays;
  }

  // ─────────────────────────────────────────────────
  // DAY INFO
  // ─────────────────────────────────────────────────
  /**
   * Returns { icon, label, value, state }
   * state: 'holiday' | 'special' | 'weekend' | 'weekday'
   */
  function getDayInfo(date) {
    const key = toKey(date);
    const holidays = getHolidays(date.getFullYear());
    const dow = date.getDay();

    if (holidays.has(key)) {
      const hol = holidays.get(key);
      return hol.type === 'regular'
        ? { icon: hol.emoji, label: 'HOLIDAY',  value: hol.name, state: 'holiday'  }
        : { icon: hol.emoji, label: 'SPECIAL',  value: hol.name, state: 'special'  };
    }
    if (dow === 0) return { icon: '🌅', label: 'WEEKEND', value: 'Sunday',    state: 'weekend' };
    if (dow === 6) return { icon: '🌄', label: 'WEEKEND', value: 'Saturday',  state: 'weekend' };

    // Weekday — add a little flavour
    const flavour = { 1:'💼', 2:'💼', 3:'💼', 4:'💼', 5:'🎉' }; // Friday gets confetti
    return { icon: flavour[dow] || '💼', label: 'WEEKDAY', value: DAYS[dow], state: 'weekday' };
  }

  // ─────────────────────────────────────────────────
  // TIME FORMATTER  (12-hr + blinking colon)
  // ─────────────────────────────────────────────────
  function format12hr(date, showColon) {
    let h  = date.getHours();
    const m  = pad(date.getMinutes());
    const s  = pad(date.getSeconds());
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const colon = showColon ? ':' : ' ';
    return `${h}${colon}${m}${colon}${s} ${ap}`;
  }

  function formatDate(date) {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  // ─────────────────────────────────────────────────
  // DOM HELPERS
  // ─────────────────────────────────────────────────
  let colonVisible = true;
  let lastSecond = -1;

  function tick() {
    const now = new Date();
    const sec = now.getSeconds();

    // Toggle colon each second
    if (sec !== lastSecond) {
      colonVisible = !colonVisible;
      lastSecond = sec;
    }

    // ── 1. EVENT / DAY widget ──────────────────────
    const info   = getDayInfo(now);
    const dayPill  = document.getElementById('hw-day');
    const dayIcon  = document.getElementById('hw-day-icon');
    const dayLabel = document.getElementById('hw-day-label') || document.querySelector('#hw-day .hw-label');
    const dayValue = document.getElementById('hw-day-value');

    if (dayPill) {
      // Remove old state classes
      dayPill.classList.remove('is-holiday','is-special','is-weekend','is-weekday');
      dayPill.classList.add(`is-${info.state}`);
    }
    if (dayIcon)  dayIcon.textContent  = info.icon;
    if (dayLabel) dayLabel.textContent = info.label;
    if (dayValue) dayValue.textContent = info.value;

    // ── 2. CLOCK widget ───────────────────────────
    const h12 = now.getHours() % 12 || 12;
    const clockIcon  = document.getElementById('hw-clock-icon');
    const clockValue = document.getElementById('hw-clock-value');

    if (clockIcon)  clockIcon.textContent  = CLOCK_EMOJI[h12 % 12];
    if (clockValue) {
      // Build time string with HTML spans for blinking colons
      let h   = now.getHours();
      const m = pad(now.getMinutes());
      const s = pad(now.getSeconds());
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      clockValue.innerHTML =
        `${h}<span class="colon-blink">:</span>${m}<span class="colon-blink">:</span>${s} <span style="font-size:0.6em;opacity:0.7;">${ap}</span>`;
    }

    // ── 3. DATE widget ────────────────────────────
    const dateValue = document.getElementById('hw-date-value');
    if (dateValue) dateValue.textContent = formatDate(now);

    // ── 4. Sync day-of-week pill (hw-dayname) ─────
    const dawnValue = document.getElementById('hw-dayname-value');
    if (dawnValue) dawnValue.textContent = DAYS[now.getDay()];
  }

  // ─────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────
  function init() {
    tick();
    setInterval(tick, 1000);
  }

  return { init };
})();

// Auto-start
document.addEventListener('DOMContentLoaded', () => DateTimeWidget.init());
// Also start immediately in case DOM is already ready
if (document.readyState !== 'loading') DateTimeWidget.init();