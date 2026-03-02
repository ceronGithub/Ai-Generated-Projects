// =============================================
// datetime-widget.js
// Live clock (12-hr), current date, and day
// type detector (Holiday / Weekend / Weekday)
// Philippine public holidays included.
// =============================================

const DateTimeWidget = (() => {

  // ── Philippine Public Holidays (static + movable) ──────────────────────────
  // Format: 'MM-DD' for fixed dates.
  // Movable (like Holy Week) are recalculated per year.
  const FIXED_HOLIDAYS = {
    '01-01': { name: "New Year's Day",          emoji: '🎆' },
    '02-25': { name: 'EDSA People Power',        emoji: '🕊️' },
    '04-09': { name: 'Araw ng Kagitingan',        emoji: '🎖️' },
    '05-01': { name: 'Labor Day',                 emoji: '⚒️' },
    '06-12': { name: 'Independence Day',          emoji: '🇵🇭' },
    '08-21': { name: 'Ninoy Aquino Day',          emoji: '✊' },
    '08-26': { name: 'National Heroes Day',       emoji: '🦸' },  // last Mon Aug — approximated
    '11-01': { name: "All Saints' Day",           emoji: '🕯️' },
    '11-02': { name: "All Souls' Day",            emoji: '🕯️' },
    '11-30': { name: 'Bonifacio Day',             emoji: '⚔️' },
    '12-08': { name: 'Feast of Immaculate Conception', emoji: '⛪' },
    '12-24': { name: 'Christmas Eve',             emoji: '🎄' },
    '12-25': { name: 'Christmas Day',             emoji: '🎅' },
    '12-30': { name: 'Rizal Day',                 emoji: '📜' },
    '12-31': { name: "New Year's Eve",            emoji: '🎇' },
  };

  // Easter-based movable feasts (offset from Easter Sunday)
  // Offset: Maundy Thursday = -3, Good Friday = -2, Black Saturday = -1, Easter = 0
  const MOVABLE_OFFSETS = {
    '-3': { name: 'Maundy Thursday', emoji: '✝️' },
    '-2': { name: 'Good Friday',     emoji: '✝️' },
    '-1': { name: 'Black Saturday',  emoji: '✝️' },
  };

  // ── Compute Easter (Anonymous Gregorian algorithm) ─────────────────────────
  function easterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
    const day   = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  // ── Get movable holidays for a given year ──────────────────────────────────
  function getMovableHolidays(year) {
    const easter = easterDate(year);
    const result = {};
    for (const [offset, info] of Object.entries(MOVABLE_OFFSETS)) {
      const d = new Date(easter);
      d.setDate(d.getDate() + parseInt(offset));
      const key = pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      result[key] = info;
    }
    return result;
  }

  // ── Eid ul-Fitr / Eid ul-Adha (approximation via Islamic calendar) ─────────
  // We use a simple lookup for common years; exact dates require a full
  // Hijri conversion — here we provide a best-effort approximation.
  const EID_DATES = {
    // 'YYYY-MM-DD': info
    '2024-04-10': { name: 'Eid ul-Fitr',  emoji: '🌙' },
    '2024-06-17': { name: 'Eid ul-Adha',  emoji: '🌙' },
    '2025-03-31': { name: 'Eid ul-Fitr',  emoji: '🌙' },
    '2025-06-07': { name: 'Eid ul-Adha',  emoji: '🌙' },
    '2026-03-20': { name: 'Eid ul-Fitr',  emoji: '🌙' },
    '2026-05-27': { name: 'Eid ul-Adha',  emoji: '🌙' },
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  function pad(n) { return String(n).padStart(2, '0'); }

  function getHolidayInfo(date) {
    const year  = date.getFullYear();
    const mmdd  = pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    const iso   = `${year}-${mmdd}`;

    // Fixed
    if (FIXED_HOLIDAYS[mmdd]) return FIXED_HOLIDAYS[mmdd];

    // Movable (Holy Week)
    const movable = getMovableHolidays(year);
    if (movable[mmdd]) return movable[mmdd];

    // Eid approximation
    if (EID_DATES[iso]) return EID_DATES[iso];

    return null;
  }

  // ── Day type ──────────────────────────────────────────────────────────────
  const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_FULL    = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];

  function getDayInfo(date) {
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const holiday = getHolidayInfo(date);

    if (holiday) {
      return {
        type: 'holiday',
        label: holiday.name,
        emoji: holiday.emoji,
        cssClass: 'is-holiday',
      };
    }
    if (dow === 0 || dow === 6) {
      return {
        type: 'weekend',
        label: WEEKDAY_NAMES[dow],
        emoji: dow === 0 ? '☀️' : '🌤️',
        cssClass: 'is-weekend',
      };
    }
    return {
      type: 'weekday',
      label: WEEKDAY_NAMES[dow],
      emoji: ['📋','💼','📊','🖥️','🔭'][dow - 1] || '📅',
      cssClass: '',
    };
  }

  // ── Format 12-hr time ─────────────────────────────────────────────────────
  function formatTime12(date) {
    let h = date.getHours();
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    // Return parts separately so colon can blink
    return { h: String(h), m, s, ampm };
  }

  // ── Format date string ─────────────────────────────────────────────────────
  function formatDate(date) {
    const d   = date.getDate();
    const mon = MONTH_NAMES[date.getMonth()];
    const yr  = date.getFullYear();
    return `${d} ${mon} ${yr}`;
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const elDayPill  = document.getElementById('hw-day');
  const elDayIcon  = document.getElementById('hw-day-icon');
  const elDayValue = document.getElementById('hw-day-value');
  const elClockVal = document.getElementById('hw-clock-value');
  const elDateVal  = document.getElementById('hw-date-value');

  let lastDayKey = null; // avoid re-computing day info every second

  // ── Tick ──────────────────────────────────────────────────────────────────
  function tick() {
    const now = new Date();

    // ── Clock ──
    const { h, m, s, ampm } = formatTime12(now);
    elClockVal.innerHTML =
      `${h}<span class="colon-blink">:</span>${m}<span class="colon-blink">:</span>${s} <span style="font-size:0.58rem;letter-spacing:0.1em;opacity:0.8;">${ampm}</span>`;

    // ── Date ──
    elDateVal.textContent = formatDate(now);

    // ── Day / Holiday (only recalc once per day) ──
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    if (todayKey !== lastDayKey) {
      lastDayKey = todayKey;
      const info = getDayInfo(now);

      elDayIcon.textContent  = info.emoji;
      elDayValue.textContent = info.label;

      // Reset classes
      elDayPill.classList.remove('is-holiday','is-weekend');
      if (info.cssClass) elDayPill.classList.add(info.cssClass);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    tick();                           // immediate first render
    setInterval(tick, 1000);          // update every second
  }

  return { init };
})();

DateTimeWidget.init();
