/* datetime.js — Date, Day, Event detection + Live Clock */
(function () {

  const HOLIDAYS = [
    { month: 0,  day: 1,  name: "New Year's Day" },
    { month: 1,  day: 25, name: "People Power Day" },
    { month: 3,  day: 9,  name: "Araw ng Kagitingan" },
    { month: 4,  day: 1,  name: "Labor Day" },
    { month: 5,  day: 12, name: "Independence Day" },
    { month: 7,  day: 21, name: "Ninoy Aquino Day" },
    { month: 7,  day: 26, name: "National Heroes Day" },
    { month: 10, day: 1,  name: "All Saints Day" },
    { month: 10, day: 30, name: "Bonifacio Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 30, name: "Rizal Day" },
  ];

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function getHoliday(date) {
    return HOLIDAYS.find(h => h.month === date.getMonth() && h.day === date.getDate()) || null;
  }

  function updateDate() {
    const now     = new Date();
    const dow     = now.getDay();
    const holiday = getHoliday(now);

    document.getElementById('dateDisplay').textContent =
      `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    document.getElementById('dayDisplay').textContent = DAYS[dow];

    const iconEl  = document.getElementById('eventIcon');
    const labelEl = document.getElementById('eventLabel');
    if (holiday) {
      iconEl.textContent  = '🎉';
      labelEl.textContent = holiday.name;
      labelEl.className   = 'event-label holiday';
    } else if (dow === 0 || dow === 6) {
      iconEl.textContent  = '🌿';
      labelEl.textContent = 'Weekend';
      labelEl.className   = 'event-label weekend';
    } else {
      iconEl.textContent  = '💼';
      labelEl.textContent = 'Weekday';
      labelEl.className   = 'event-label weekday';
    }
  }

  // ── Live clock (12-hr format) ──
  function updateClock() {
    const now    = new Date();
    let   h      = now.getHours();
    const m      = String(now.getMinutes()).padStart(2, '0');
    const s      = String(now.getSeconds()).padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const el = document.getElementById('timeDisplay');
    if (el) el.textContent = `${h}:${m}:${s} ${period}`;
  }

  updateDate();
  updateClock();

  // Refresh date at midnight
  function scheduleNextMidnight() {
    const now = new Date();
    const ms  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    setTimeout(() => { updateDate(); scheduleNextMidnight(); }, ms);
  }
  scheduleNextMidnight();

  // Tick clock every second
  setInterval(updateClock, 1000);

})();