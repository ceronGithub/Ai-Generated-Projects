// booking.js — booking form logic

const BOOKING_KEY = 'cal2026_bookings_v1';

/* ══════════════════════════════════════
   LOCAL STORAGE
══════════════════════════════════════ */
function loadBookingsLocal() {
  try {
    const raw = localStorage.getItem(BOOKING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveBookingsLocal(data) {
  try { localStorage.setItem(BOOKING_KEY, JSON.stringify(data)); }
  catch(e) { console.warn('localStorage error:', e); }
}

const Bookings = loadBookingsLocal();

/* ══════════════════════════════════════
   FORM STATE
══════════════════════════════════════ */
let _bkKey   = null;
let _bkDay   = null;
let _bkMonth = null;
let _bkYear  = null;
let _bkColor = null;
let _tourType = null;

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function pad2(n) { return String(n).padStart(2, '0'); }

function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

function to12hr(hhmm) {
  if (!hhmm || hhmm === '—') return '—';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

function nextDay(year, month, day) {
  const d = new Date(year, month, day + 1);
  return {
    key:   toKey(d.getFullYear(), d.getMonth(), d.getDate()),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
  };
}

/* Return a date N days forward from current booking date */
function addDays(n) {
  const d = new Date(_bkYear, _bkMonth, _bkDay + n);
  return {
    key:   toKey(d.getFullYear(), d.getMonth(), d.getDate()),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
  };
}

function formatDateLabel(year, month, day) {
  return `${MONTH_NAMES[month]} ${day}, ${year} (${DAY_NAMES[new Date(year,month,day).getDay()]})`;
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('bkToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

/* ══════════════════════════════════════
   TOUR TYPE CONFIG
   mins        — total duration in minutes
   daysOffset  — how many calendar days ahead
                 checkout falls (0=same, 1=next, 2=+2)
══════════════════════════════════════ */
function getTourConfig(tourType) {
  switch (tourType) {
    case 'Day Tour':   return { mins: 10 * 60, daysOffset: 0 };
    case 'Night Tour': return { mins: 10 * 60, daysOffset: 1 };
    case 'Over-Night': return { mins: 21 * 60, daysOffset: 1 };
    case '3D2N':       return { mins: 42 * 60, daysOffset: 2 }; // 21+21 hrs, checkout day 3
    case 'Half Day':   return { mins:  5 * 60, daysOffset: 0 };
    default:           return { mins: 10 * 60, daysOffset: 0 };
  }
}

/* ══════════════════════════════════════
   TIME-SLOT RULES
   8:00–11:00   → morning   → all types ok  → cell yellow
   11:30–13:59  → afternoon → no Day Tour   → cell red
   14:00+       → evening   → no Day Tour   → cell red
══════════════════════════════════════ */
function getTimeSlot(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const mins = h * 60 + m;

  if (mins >= 8 * 60 && mins <= 11 * 60) {
    return {
      slot:       'morning',
      available:  ['Day Tour', 'Night Tour', 'Over-Night', '3D2N'],
      restricted: [],
      cellClass:  'slot-morning-taken',
      canAdd:     true,
      banner:     '🌤 Morning slot (8AM–11AM): All tour types available.',
    };
  }
  if (mins >= 11 * 60 + 30 && mins <= 13 * 60 + 59) {
    return {
      slot:       'afternoon',
      available:  ['Night Tour', 'Over-Night', '3D2N'],
      restricted: ['Day Tour'],
      cellClass:  'slot-full',
      canAdd:     false,
      banner:     '🌆 Afternoon slot (11:30AM–2PM): Night Tour, Over-Night & 3 Days 2 Nights only.',
    };
  }
  if (mins >= 14 * 60) {
    return {
      slot:       'evening',
      available:  ['Night Tour', 'Over-Night', '3D2N'],
      restricted: ['Day Tour'],
      cellClass:  'slot-full',
      canAdd:     false,
      banner:     '🌙 Evening slot (2PM+): Night Tour, Over-Night & 3 Days 2 Nights only. All check out next day or later.',
    };
  }
  // 11:00–11:30 transition
  return {
    slot:       'morning',
    available:  ['Day Tour', 'Night Tour', 'Over-Night', '3D2N'],
    restricted: [],
    cellClass:  'slot-morning-taken',
    canAdd:     true,
    banner:     '🌤 Morning slot: All tour types available.',
  };
}

/* ══════════════════════════════════════
   CHECKOUT CONSTRAINT
   Scans all existing bookings to find any
   whose checkout date falls on the date
   being opened. The LATEST checkout time
   among those becomes the earliest allowed
   check-in for new bookings on that date.

   Example:
     Feb 2 Overnight checkout → Feb 3 at 15:00
     → Opening Feb 3 form: check-in must be ≥ 15:00
       Only Night Tour / Over-Night / 3D2N available
       (Day Tour ends same day, would conflict)
══════════════════════════════════════ */

/* Returns { time: 'HH:MM', time12: '3:00 PM', sources: [...names] } or null */
function getCheckoutConstraintForDate(dateKey) {
  let latestMins = -1;
  let latestTime = '';
  const sources  = [];

  Object.keys(Bookings).forEach(checkinKey => {
    (Bookings[checkinKey] || []).forEach(b => {
      const coDate = (b.booking && b.booking.checkoutDate) || b.checkoutDate || '';
      const coTime = (b.booking && b.booking.checkoutTime) || b.checkoutTime || '';
      if (coDate !== dateKey || !coTime) return;

      const [h, m] = coTime.split(':').map(Number);
      const mins   = h * 60 + m;
      if (mins > latestMins) {
        latestMins = mins;
        latestTime = coTime;
      }
      const guestName = (b.guest && b.guest.name) || b.guestName || 'Guest';
      const tour      = (b.booking && b.booking.tourType) || b.tourType || '';
      sources.push(`${guestName} (${tour} check-out)`);
    });
  });

  if (latestMins < 0) return null;
  return { time: latestTime, time12: to12hr(latestTime), mins: latestMins, sources };
}

/* ── State: constraint for currently open form ── */
let _checkinConstraint = null;  // { time, time12, mins, sources } | null

/* Apply constraint to the form: set min on time input, show banner,
   block tours that cannot be used after the constraint time.        */
function applyCheckoutConstraint(constraint) {
  _checkinConstraint = constraint;

  // Remove any existing constraint banner
  const old = document.getElementById('bkConstraintBanner');
  if (old) old.remove();

  // Reset time input min
  const timeInput = document.getElementById('bkCheckinTime');
  if (timeInput) timeInput.min = constraint ? constraint.time : '';

  if (!constraint) return;

  // Build and inject the constraint banner above the check-in time field
  const banner = document.createElement('div');
  banner.id = 'bkConstraintBanner';
  banner.style.cssText =
    'background:linear-gradient(135deg,#fff3e0,#ffe8cc);' +
    'border:1.5px solid #ff9800;border-radius:10px;' +
    'padding:10px 14px;margin-bottom:10px;' +
    'font-size:12px;font-weight:700;color:#7a3800;' +
    'display:flex;gap:8px;align-items:flex-start;line-height:1.5;';

  const sourceText = constraint.sources.slice(0, 2).join(', ') +
    (constraint.sources.length > 2 ? ` +${constraint.sources.length - 2} more` : '');

  banner.innerHTML =
    `<span style="font-size:16px;flex-shrink:0;">🔔</span>` +
    `<span>Previous booking checks out at <b>${constraint.time12}</b> on this date` +
    ` <span style="font-size:10px;opacity:0.75;">(${sourceText})</span>.<br>` +
    `Check-in must be <b>${constraint.time12} or later</b>. ` +
    `Day Tour unavailable (guests still checking out).</span>`;

  // Insert before the check-in time field
  const ciField = document.getElementById('bkCheckinTime');
  if (ciField && ciField.parentNode) {
    ciField.parentNode.insertBefore(banner, ciField);
  }

  // Disable Day Tour — it's same-day, so it would overlap with checkout
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    if (btn.dataset.type === 'Day Tour') {
      btn.classList.add('bk-tour-unavailable');
      btn.disabled = true;
      if (_tourType === 'Day Tour') {
        btn.classList.remove('selected');
        _tourType = null;
        document.getElementById('bkCheckoutDisplay').textContent = '—';
        document.getElementById('bkCheckoutTime').textContent    = '—';
        document.getElementById('bkDuration').textContent        = '—';
      }
    }
  });
}

/* Validate that entered check-in time respects constraint */
function validateCheckinConstraint(hhmm) {
  if (!_checkinConstraint || !hhmm) return null;
  const [h, m]  = hhmm.split(':').map(Number);
  const enteredMins = h * 60 + m;
  if (enteredMins < _checkinConstraint.mins) {
    return `Check-in must be ${_checkinConstraint.time12} or later (previous guest checkout time).`;
  }
  return null;
}

function applyTimeSlotToForm(hhmm) {
  const slot = getTimeSlot(hhmm);

  // Remove existing time-slot banner (constraint banner stays)
  const existing = document.getElementById('bkTimeSlotBanner');
  if (existing) existing.remove();

  // Re-enable all buttons, then re-apply both layers of restrictions
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.classList.remove('bk-tour-unavailable');
    btn.disabled = false;
  });

  // Layer 1: checkout constraint — always block Day Tour when constrained
  if (_checkinConstraint) {
    document.querySelectorAll('.bk-tour-btn').forEach(btn => {
      if (btn.dataset.type === 'Day Tour' || btn.dataset.type === 'Half Day') {
        btn.classList.add('bk-tour-unavailable');
        btn.disabled = true;
        if (_tourType === btn.dataset.type) {
          btn.classList.remove('selected');
          _tourType = null;
          document.getElementById('bkCheckoutDisplay').textContent = '—';
          document.getElementById('bkCheckoutTime').textContent    = '—';
          document.getElementById('bkDuration').textContent        = '—';
        }
      }
    });

    // Show inline time error if entered time is too early
    if (hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      const enteredMins = h * 60 + m;
      const errEl = document.getElementById('errCheckinTime');
      if (errEl) {
        if (enteredMins < _checkinConstraint.mins) {
          errEl.textContent = '⚠️ Must be ' + _checkinConstraint.time12 + ' or later — previous guest checks out then.';
        } else if (errEl.textContent.includes('previous guest')) {
          errEl.textContent = '';
        }
      }
    }
  }

  if (!slot) return;

  // Layer 2: time-slot rules — additive on top of constraint restrictions
  const tourSection = document.querySelector('.bk-tour-options');
  if (tourSection) {
    const banner = document.createElement('div');
    banner.id        = 'bkTimeSlotBanner';
    banner.className = 'bk-time-slot-banner ' + (slot.slot === 'morning' ? 'morning' : 'afternoon');
    const icon = slot.slot === 'morning' ? '🌤' : slot.slot === 'afternoon' ? '🌆' : '🌙';
    banner.innerHTML = `<span style="font-size:16px;flex-shrink:0;">${icon}</span><span>${slot.banner}</span>`;
    tourSection.parentNode.insertBefore(banner, tourSection);
  }

  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    const type = btn.dataset.type;
    if (slot.restricted.includes(type)) {
      btn.classList.add('bk-tour-unavailable');
      btn.disabled = true;
      if (_tourType === type) {
        btn.classList.remove('selected');
        _tourType = null;
        document.getElementById('bkCheckoutDisplay').textContent = '—';
        document.getElementById('bkCheckoutTime').textContent    = '—';
        document.getElementById('bkDuration').textContent        = '—';
      }
    }
  });
}

function applyTimeSlotsToCell(key, cellEl) {
  cellEl.classList.remove('slot-morning-taken', 'slot-full');
  const list = Bookings[key] || [];
  if (!list.length) return;

  let hasEvening = false, hasAfternoon = false, hasMorning = false;
  let hasMultiNight = false;

  list.forEach(b => {
    const ci   = (b.booking && b.booking.checkinTime) || b.checkinTime || '';
    const tour = (b.booking && b.booking.tourType)    || b.tourType    || '';
    const slot = getTimeSlot(ci);
    if (slot) {
      if (slot.slot === 'evening')   hasEvening   = true;
      if (slot.slot === 'afternoon') hasAfternoon = true;
      if (slot.slot === 'morning')   hasMorning   = true;
    }
    // Over-Night and 3D2N always force checkin day to RED regardless of time
    if (tour === 'Over-Night' || tour === '3D2N') hasMultiNight = true;
  });

  if (hasEvening || hasAfternoon || hasMultiNight) cellEl.classList.add('slot-full');
  else if (hasMorning)                             cellEl.classList.add('slot-morning-taken');
}

/*
  Build a lookup map of stay-over days.

  RULES:
  Over-Night (offset=1):
    checkin      → 🔴 red   (handled by applyTimeSlotsToCell)
    day+1        → 🟡 yellow  { color:'yellow', tour:'overnight' }

  3D2N (offset=2):
    checkin      → 🔴 red   (handled by applyTimeSlotsToCell)
    day+1        → 🔴 red    { color:'red',    tour:'3d2n' }
    day+2        → 🟡 yellow  { color:'yellow', tour:'3d2n' }

  Returns:  { 'YYYY-MM-DD': { color: 'red'|'yellow', tour: 'overnight'|'3d2n' } }
  Priority: red > yellow if two bookings conflict on same day.
*/
function buildStayoverMap() {
  const map = {};
  const src = Bookings;

  function setDay(key, color, tour) {
    const existing = map[key];
    // red always wins over yellow
    if (!existing || (existing.color === 'yellow' && color === 'red')) {
      map[key] = { color, tour };
    }
  }

  Object.keys(src).forEach(checkinKey => {
    const list = src[checkinKey] || [];
    list.forEach(b => {
      const tour   = (b.booking && b.booking.tourType) || b.tourType || '';
      const offset = (b.booking && b.booking.checkoutDaysOffset != null)
                      ? b.booking.checkoutDaysOffset
                      : getTourConfig(tour).daysOffset;

      // Only Over-Night and 3D2N get downstream tags
      if (tour !== 'Over-Night' && tour !== '3D2N') return;
      if (offset < 1) return;

      const parts = checkinKey.split('-');
      const cy = parseInt(parts[0]), cm = parseInt(parts[1]) - 1, cd = parseInt(parts[2]);

      if (tour === 'Over-Night') {
        // day+1 → yellow (checkout day)
        const d1 = new Date(cy, cm, cd + 1);
        setDay(toKey(d1.getFullYear(), d1.getMonth(), d1.getDate()), 'yellow', 'overnight');
      }

      if (tour === '3D2N') {
        // day+1 → red (still occupied, day 2 of stay)
        const d1 = new Date(cy, cm, cd + 1);
        setDay(toKey(d1.getFullYear(), d1.getMonth(), d1.getDate()), 'red', '3d2n');
        // day+2 → yellow (checkout day, day 3)
        const d2 = new Date(cy, cm, cd + 2);
        setDay(toKey(d2.getFullYear(), d2.getMonth(), d2.getDate()), 'yellow', '3d2n');
      }
    });
  });

  return map;
}

/* ══════════════════════════════════════
   DATE EVENT INFO
══════════════════════════════════════ */
function getDateEventInfo(year, month, day) {
  const key    = toKey(year, month, day);
  const dow    = new Date(year, month, day).getDay();
  const events = AppState.events[key] || [];
  if (events.length > 0) return { type: 'holiday', icon: '🎉', label: events[0] };
  if (dow === 0 || dow === 6) return { type: 'weekend', icon: '🌅', label: `Weekend — ${dow === 0 ? 'Sunday' : 'Saturday'}` };
  return { type: 'weekday', icon: '📅', label: `Weekday — ${DAY_NAMES[dow]}` };
}

/* ══════════════════════════════════════
   COMPILE BOOKING JSON
══════════════════════════════════════ */
function compileBookingJSON(pax, extraPax, pets, total, downpayment,
    ciTime, coTime, checkoutOffset, durationMins,
    ratePerHead, ratePerPet, baseTotal, headCharge, petCharge) {

  ratePerHead = ratePerHead || 0;
  ratePerPet  = ratePerPet  || 0;
  baseTotal   = baseTotal   || total;
  headCharge  = headCharge  || 0;
  petCharge   = petCharge   || 0;

  const coDate = addDays(checkoutOffset);

  return {
    id:        Date.now(),
    createdAt: new Date().toISOString(),
    dateKey:   _bkKey,
    guest: {
      name:       getVal('bkGuestName').trim(),
      email:      getVal('bkGuestEmail').trim(),
      phone:      getVal('bkGuestPhone').trim(),
      pax, extraPax, totalPax: pax + extraPax, pets,
      ratePerHead, ratePerPet,
    },
    payment: {
      date:              getVal('bkPaymentDate'),
      mode:              'BDO Bank Transfer',
      baseTotal, headCharge, petCharge,
      additionalCharges: headCharge + petCharge,
      total, downpayment,
      balance:           total - downpayment,
    },
    booking: {
      tourType:           _tourType,
      checkinDate:        _bkKey,
      checkinDateLabel:   formatDateLabel(_bkYear, _bkMonth, _bkDay),
      checkoutDate:       coDate.key,
      checkoutDateLabel:  coDate.label,
      checkinTime:        ciTime,
      checkinTime12:      to12hr(ciTime),
      checkoutTime:       coTime,
      checkoutTime12:     to12hr(coTime),
      durationHrs:        durationMins / 60,
      checkoutDaysOffset: checkoutOffset,
    },
    dayInfo: getDateEventInfo(_bkYear, _bkMonth, _bkDay),
  };
}

/* ══════════════════════════════════════
   OPEN / CLOSE FORM
══════════════════════════════════════ */
function openBookingForm(key, day, month, year, color) {
  _bkKey = key; _bkDay = day; _bkMonth = month; _bkYear = year;
  _bkColor = color; _tourType = null;

  document.getElementById('bkColorPill').style.background =
    `linear-gradient(180deg, ${color.accent}, ${color.light})`;
  document.getElementById('bkHeaderDate').textContent = formatDateLabel(year, month, day);

  const ev = getDateEventInfo(year, month, day);
  document.getElementById('bkEventIcon').textContent  = ev.icon;
  document.getElementById('bkEventLabel').textContent = ev.label;
  document.getElementById('bkEventBadge').className   = 'bk-event-badge is-' + ev.type;

  resetBookingForm();

  document.getElementById('bkCheckinDisplay').textContent = formatDateLabel(year, month, day);
  const t = AppState.today;
  document.getElementById('bkPaymentDate').value =
    `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`;

  document.getElementById('bkCheckoutDisplay').textContent = '—';
  document.getElementById('bkCheckoutTime').textContent    = '—';
  document.getElementById('bkDuration').textContent        = '—';

  // Check if a previous booking checks out on this date → constrain check-in time
  // Must run AFTER resetBookingForm so constraint banners are injected fresh
  const constraint = getCheckoutConstraintForDate(key);
  applyCheckoutConstraint(constraint);

  document.querySelectorAll('.bk-section-title').forEach(el => {
    el.style.color = color.accent; el.style.borderColor = color.light;
  });
  document.getElementById('bkBtnSave').style.background =
    `linear-gradient(135deg, ${color.accent}, ${color.light})`;

  // Restore any saved draft for this date
  checkAndRestoreDraft(key);

  document.getElementById('bookingOverlay').classList.add('open');
}

function closeBookingForm() {
  document.getElementById('bookingOverlay').classList.remove('open');
}

function resetBookingForm() {
  ['bkGuestName','bkGuestEmail','bkGuestPhone','bkPax','bkExtraPax',
   'bkRatePerHead','bkPets','bkRatePerPet','bkTotal','bkDownpayment','bkCheckinTime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('bk-error'); }
  });
  ['errGuestName','errGuestEmail','errGuestPhone','errPax',
   'errPaymentDate','errTotal','errDownpayment','errCheckinTime','errTourType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  document.getElementById('bkTotalPax').textContent = '—';
  document.getElementById('bkBalance').textContent  = '—';
  document.getElementById('bkBalance').className    = 'bk-auto bk-balance';
  document.getElementById('bkAdditional').textContent  = '—';
  document.getElementById('bkFinalTotal').textContent  = '—';
  document.getElementById('bkAdditionalWrap').style.display = 'none';
  document.getElementById('bkFinalTotalWrap').style.display = 'none';
  _tourType = null;
  _checkinConstraint = null;

  const banner = document.getElementById('bkTimeSlotBanner');
  if (banner) banner.remove();
  const constraintBanner = document.getElementById('bkConstraintBanner');
  if (constraintBanner) constraintBanner.remove();
  const timeInput = document.getElementById('bkCheckinTime');
  if (timeInput) { timeInput.min = ''; timeInput.max = ''; }
  const hint = document.getElementById('bkCheckinTimeHint');
  if (hint) hint.remove();
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.classList.remove('bk-tour-unavailable', 'selected');
    btn.disabled = false;
  });
}

/* ══════════════════════════════════════
   LIVE CALCULATIONS
══════════════════════════════════════ */
function calcTotalPax() {
  const v = (parseInt(getVal('bkPax'))||0) + (parseInt(getVal('bkExtraPax'))||0);
  document.getElementById('bkTotalPax').textContent = v || '—';
}

function calcBalance() {
  const baseTotal   = parseFloat(getVal('bkTotal'))       || 0;
  const dp          = parseFloat(getVal('bkDownpayment')) || 0;
  const totalPax    = (parseInt(getVal('bkPax'))||0) + (parseInt(getVal('bkExtraPax'))||0);
  const ratePerHead = parseFloat(getVal('bkRatePerHead')) || 0;
  const totalPets   = parseInt(getVal('bkPets'))           || 0;
  const ratePerPet  = parseFloat(getVal('bkRatePerPet'))  || 0;

  const headCharge = totalPax  > 0 && ratePerHead > 0 ? totalPax  * ratePerHead : 0;
  const petCharge  = totalPets > 0 && ratePerPet  > 0 ? totalPets * ratePerPet  : 0;
  const additional = headCharge + petCharge;
  const finalTotal = baseTotal + additional;

  const addWrap = document.getElementById('bkAdditionalWrap');
  const ftWrap  = document.getElementById('bkFinalTotalWrap');
  const addEl   = document.getElementById('bkAdditional');
  const ftEl    = document.getElementById('bkFinalTotal');

  if (additional > 0) {
    addWrap.style.display = '';
    ftWrap.style.display  = '';
    const parts = [];
    if (headCharge > 0) parts.push(`${totalPax} pax × ₱${ratePerHead.toLocaleString('en-PH')} = ₱${headCharge.toLocaleString('en-PH',{minimumFractionDigits:2})}`);
    if (petCharge  > 0) parts.push(`${totalPets} pet${totalPets>1?'s':''} × ₱${ratePerPet.toLocaleString('en-PH')} = ₱${petCharge.toLocaleString('en-PH',{minimumFractionDigits:2})}`);
    addEl.textContent = `+ ₱${additional.toLocaleString('en-PH',{minimumFractionDigits:2})}  (${parts.join('  •  ')})`;
    ftEl.textContent  = `₱ ${finalTotal.toLocaleString('en-PH',{minimumFractionDigits:2})}`;
  } else {
    addWrap.style.display = 'none';
    ftWrap.style.display  = 'none';
  }

  const el = document.getElementById('bkBalance');
  if (!baseTotal && !dp) { el.textContent = '—'; el.className = 'bk-auto bk-balance'; return; }
  const bal = finalTotal - dp;
  el.textContent = `₱ ${bal.toLocaleString('en-PH',{minimumFractionDigits:2})}`;
  el.className   = 'bk-auto bk-balance ' + (bal < 0 ? 'negative' : bal === 0 ? 'zero' : 'positive');
}

function calcCheckout() {
  if (!_tourType) return;

  const ci   = getVal('bkCheckinTime');
  const slot = getTimeSlot(ci);
  const cfg  = getTourConfig(_tourType);

  // Night Tour: afternoon slot → same day checkout, evening → next day
  let daysOffset = cfg.daysOffset;
  if (_tourType === 'Night Tour' && slot) {
    daysOffset = slot.slot === 'afternoon' ? 0 : 1;
  }

  const durationMins = cfg.mins;
  const coDate = addDays(daysOffset);

  document.getElementById('bkCheckoutDisplay').textContent =
    daysOffset === 0
      ? formatDateLabel(_bkYear, _bkMonth, _bkDay)
      : coDate.label;

  if (ci) {
    const co = addMinutesToTime(ci, durationMins);
    document.getElementById('bkCheckoutTime').textContent = to12hr(co);
    document.getElementById('bkDuration').textContent =
      `${durationMins/60} hrs (${to12hr(ci)} → ${to12hr(co)})` +
      (daysOffset > 0 ? ` +${daysOffset} day${daysOffset > 1 ? 's' : ''}` : '');
  } else {
    document.getElementById('bkCheckoutTime').textContent = `(+${durationMins/60} hrs from check-in)`;
    document.getElementById('bkDuration').textContent =
      `${durationMins/60} hrs` + (daysOffset > 0 ? ` +${daysOffset} day${daysOffset > 1 ? 's' : ''}` : '');
  }
}

/* ══════════════════════════════════════
   TOUR TYPE BUTTONS
══════════════════════════════════════ */

/* Auto-set time + restrict range by tour type:
   Day Tour   -> default 08:00, min 08:00, max 11:59
   Night Tour -> default 12:00, min 12:00, max 22:00
   Others     -> no restriction
*/
function applyTourTimeConstraints(tourType) {
  const timeInput = document.getElementById('bkCheckinTime');
  if (!timeInput) return;

  const existingHint = document.getElementById('bkCheckinTimeHint');
  if (existingHint) existingHint.remove();

  if (tourType === 'Day Tour') {
    timeInput.min = '08:00';
    timeInput.max = '11:59';
    const cur = timeInput.value;
    if (!cur || cur < '08:00' || cur > '11:59') timeInput.value = '08:00';
    _insertTimeHint(timeInput, '\u23f0 Day Tour: 8:00 AM \u2013 11:59 AM only');
    calcCheckout();
  } else if (tourType === 'Night Tour') {
    timeInput.min = '12:00';
    timeInput.max = '22:00';
    const cur = timeInput.value;
    if (!cur || cur < '12:00' || cur > '22:00') timeInput.value = '12:00';
    _insertTimeHint(timeInput, '\ud83c\udf19 Night Tour: 12:00 PM \u2013 10:00 PM only');
    calcCheckout();
  } else {
    timeInput.min = '';
    timeInput.max = '';
  }
}

function _insertTimeHint(timeInput, msg) {
  const hint = document.createElement('div');
  hint.id = 'bkCheckinTimeHint';
  hint.style.cssText = 'font-size:11px;font-weight:700;color:#7c6af4;margin-top:4px;';
  hint.textContent = msg;
  timeInput.parentNode.appendChild(hint);
}

function setupTourButtons() {
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bk-tour-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _tourType = btn.dataset.type;
      document.getElementById('errTourType').textContent = '';
      applyTourTimeConstraints(_tourType);
      calcCheckout();
      scheduleDraftSave();
    });
  });
}

/* ══════════════════════════════════════
   VALIDATION
══════════════════════════════════════ */
function validate() {
  let ok = true;
  function err(fieldId, errId, msg) {
    const el = document.getElementById(fieldId);
    const er = document.getElementById(errId);
    if (msg) { if(er) er.textContent = msg; if(el) el.classList.add('bk-error'); ok = false; }
    else      { if(er) er.textContent = '';  if(el) el.classList.remove('bk-error'); }
  }
  err('bkGuestName',  'errGuestName',  !getVal('bkGuestName').trim()  ? 'Required.' : '');
  const email = getVal('bkGuestEmail').trim();
  err('bkGuestEmail', 'errGuestEmail',
    email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Invalid email format.' : '');
  err('bkGuestPhone', 'errGuestPhone', !getVal('bkGuestPhone').trim() ? 'Required.' : '');
  err('bkPax',        'errPax',        parseInt(getVal('bkPax')) < 1  ? 'Min 1.' : '');
  err('bkPaymentDate','errPaymentDate',!getVal('bkPaymentDate')       ? 'Required.' : '');
  err('bkTotal',      'errTotal',      parseFloat(getVal('bkTotal')) <= 0 ? 'Required.' : '');
  err('bkDownpayment','errDownpayment',getVal('bkDownpayment') === ''  ? 'Required.' : '');
  err('bkCheckinTime','errCheckinTime',!getVal('bkCheckinTime') ? 'Required.' : '');

  // Checkout constraint — check-in must be after previous booking's checkout
  const ciVal = getVal('bkCheckinTime');
  const constraintErr = validateCheckinConstraint(ciVal);
  if (constraintErr) {
    err('bkCheckinTime', 'errCheckinTime', constraintErr);
  }

  const te = document.getElementById('errTourType');
  if (!_tourType) {
    if (te) te.textContent = 'Select tour type.';
    ok = false;
  } else {
    const ciVal = getVal('bkCheckinTime');
    const slot  = getTimeSlot(ciVal);
    if (slot && slot.restricted.includes(_tourType)) {
      if (te) te.textContent =
        `${_tourType} is not available for this check-in time. Choose: ${slot.available.join(', ')}.`;
      ok = false;
    } else {
      if (te) te.textContent = '';
    }
  }
  return ok;
}

/* ══════════════════════════════════════
   SAVE BOOKING
══════════════════════════════════════ */
async function saveBooking() {
  if (!validate()) return;

  const btn = document.getElementById('bkBtnSave');
  btn.disabled  = true;
  btn.innerHTML = '<span>Saving…</span>';

  // Snapshot state now — btn.disabled=true means _bkKey etc. can't change mid-save
  const savedKey   = _bkKey;
  const savedMonth = _bkMonth;
  const savedYear  = _bkYear;
  const savedDay   = _bkDay;
  const savedTour  = _tourType;

  try {
    const pax         = parseInt(getVal('bkPax'))          || 0;
    const extraPax    = parseInt(getVal('bkExtraPax'))      || 0;
    const ratePerHead = parseFloat(getVal('bkRatePerHead')) || 0;
    const pets        = parseInt(getVal('bkPets'))          || 0;
    const ratePerPet  = parseFloat(getVal('bkRatePerPet'))  || 0;
    const baseTotal   = parseFloat(getVal('bkTotal'))       || 0;
    const headCharge  = (pax + extraPax) > 0 && ratePerHead > 0 ? (pax + extraPax) * ratePerHead : 0;
    const petCharge   = pets > 0 && ratePerPet > 0 ? pets * ratePerPet : 0;
    const total       = baseTotal + headCharge + petCharge;
    const downpayment = parseFloat(getVal('bkDownpayment')) || 0;
    const ciTime      = getVal('bkCheckinTime');

    const ciSlot   = getTimeSlot(ciTime);
    const cfg      = getTourConfig(savedTour);
    let daysOffset = cfg.daysOffset;
    // Night Tour: afternoon slot → same-day checkout; morning/evening → next day
    if (savedTour === 'Night Tour' && ciSlot) {
      daysOffset = ciSlot.slot === 'afternoon' ? 0 : 1;
    }

    const durationMins = cfg.mins;
    const coTime       = addMinutesToTime(ciTime, durationMins);

    const bookingJSON = compileBookingJSON(
      pax, extraPax, pets, total, downpayment,
      ciTime, coTime, daysOffset, durationMins,
      ratePerHead, ratePerPet, baseTotal, headCharge, petCharge
    );

    // Handle EDIT — read and clear edit markers before any await
    const editFbKey = btn._editFbKey || null;
    const editKey   = btn._editKey   || null;
    btn._editFbKey = null; btn._editLocalIdx = null; btn._editKey = null;

    if (editFbKey) {
      try { await FB.deleteByKey(editFbKey); } catch(e) { console.warn('Edit-delete:', e.message); }
    }
    if (editKey && Bookings[editKey]) {
      Bookings[editKey] = Bookings[editKey].filter(bk => bk.fbKey !== editFbKey);
      if (!Bookings[editKey].length) delete Bookings[editKey];
    }

    // Save to Firebase (non-fatal — always falls back to local)
    let fbKey = null, fbSaved = false;
    try {
      fbKey   = await FB.insert(bookingJSON);
      fbSaved = true;
    } catch (fbErr) {
      console.error('❌ Firebase error:', fbErr.message);
      if (fbErr.isPermission) showToast('⚠️ Firebase rules may be expired — check ⚙️ Rules tab', 5000);
    }

    // Always save locally
    const entry = { ...bookingJSON, fbKey };
    if (!Bookings[savedKey]) Bookings[savedKey] = [];
    Bookings[savedKey].push(entry);
    saveBookingsLocal(Bookings);

    // Clear the draft for this date — booking is now confirmed
    clearDraft(savedKey);

    closeBookingForm();

    if (fbSaved) {
      showToast(editFbKey
        ? `✏️ Updated: ${bookingJSON.guest.name} ☁️`
        : `✅ Saved: ${bookingJSON.guest.name} ☁️`);
      try { await refreshFromFirebase(); } catch(e) { console.warn('Refresh error:', e.message); }
    } else {
      // Firebase offline — enqueue for later auto-sync
      if (!editFbKey) enqueueSync(bookingJSON);
      showToast(`💾 Saved locally: ${bookingJSON.guest.name} — will sync when online`, 4000);
      try { refreshMonth(savedMonth); } catch(e) {}
      applyBookingIndicators();
    }

  } catch (unexpectedErr) {
    // Catch any unexpected sync/async error so the button always gets re-enabled
    console.error('❌ saveBooking unexpected error:', unexpectedErr);
    showToast('❌ Save failed: ' + unexpectedErr.message, 5000);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<span>Confirm Booking</span><span class="bk-btn-arrow">→</span>';
  }
}

/* ══════════════════════════════════════
   STAYOVER CARD
   Read-only summary for a booking that
   started on a previous date and is still
   occupying the currently-viewed date.
══════════════════════════════════════ */
function buildStayoverCard(b, checkinKey, color, viewingKey) {
  const card = document.createElement('div');

  const name     = b.guest?.name       || b.guestName  || '—';
  const email    = b.guest?.email      || b.guestEmail || '';
  const phone    = b.guest?.phone      || b.guestPhone || '';
  const totalPax = b.guest?.totalPax   || b.totalPax   || '—';
  const pets     = b.guest?.pets       ?? b.pets       ?? 0;
  const total    = b.payment?.total    ?? b.total      ?? 0;
  const balance  = b.payment?.balance  ?? b.balance    ?? 0;
  const dp       = b.payment?.downpayment ?? b.downpayment ?? 0;
  const tourType = b.booking?.tourType || b.tourType   || '—';
  const ciLabel  = b.booking?.checkinDateLabel  || checkinKey || '—';
  const coLabel  = b.booking?.checkoutDateLabel || '—';
  const coDate   = b.booking?.checkoutDate || b.checkoutDate || '';
  const ciTime   = b.booking?.checkinTime  || b.checkinTime  || '';
  const coTime   = b.booking?.checkoutTime || b.checkoutTime || '';
  const durationHrs = b.booking?.durationHrs ?? '—';

  // ── Compute which day of the stay we are viewing ──
  const is3D2N    = tourType === '3D2N';
  const isOvernight = tourType === 'Over-Night';
  let stayDay = 1; // default (shouldn't display day 1 here — that's the checkin date)
  if (viewingKey) {
    const [cy, cm, cd] = checkinKey.split('-').map(Number);
    const [vy, vm, vd] = viewingKey.split('-').map(Number);
    const checkinMs  = new Date(cy, cm - 1, cd).getTime();
    const viewingMs  = new Date(vy, vm - 1, vd).getTime();
    stayDay = Math.round((viewingMs - checkinMs) / 86400000) + 1;
  }

  // Total days in stay
  const totalDays = is3D2N ? 3 : isOvernight ? 2 : 2;
  const isCheckoutDay = viewingKey && viewingKey === coDate;

  // ── Colour theme based on day ──
  // Day 1 (checkin) = red (never shown as stayover card, but just in case)
  // Day 2 of 3D2N   = red  (still fully occupied)
  // Last day         = yellow (checkout day)
  const isRedDay = !isCheckoutDay && stayDay < totalDays;
  const accentColor  = isRedDay ? '#e04060' : '#e0b800';
  const accentBg     = isRedDay
    ? 'linear-gradient(135deg,#fff0f2,#ffd6df)'
    : 'linear-gradient(135deg,#fffbe0,#fff3b0)';
  const badgeBg      = isRedDay ? '#e04060' : '#e0b800';
  const borderColor  = isRedDay ? '#ff8080' : '#e0b800';
  const dayIcon      = is3D2N ? '🏕' : '🌙';
  const dayLabel     = isCheckoutDay
    ? `${dayIcon} Day ${stayDay} of ${totalDays} — Checkout Day`
    : `${dayIcon} Day ${stayDay} of ${totalDays} — Staying Over`;

  card.className = 'bk-summary-card bk-stayover-card';
  card.style.cssText =
    `border-left:4px solid ${borderColor}!important;` +
    `background:${accentBg}!important;`;

  // ── Day-of-stay progress bar ──
  const progress = document.createElement('div');
  progress.className = 'bk-stayover-progress';
  progress.innerHTML = Array.from({ length: totalDays }, (_, i) => {
    const dayNum  = i + 1;
    const isDone  = dayNum < stayDay;
    const isCurr  = dayNum === stayDay;
    const isLast  = dayNum === totalDays;
    const dotColor = isDone  ? '#bbb'
                   : isCurr && !isLast ? '#e04060'
                   : isCurr && isLast  ? '#e0b800'
                   : '#ddd';
    return `<span class="bk-stayover-dot" style="background:${dotColor};` +
           `${isCurr ? 'transform:scale(1.4);box-shadow:0 0 0 3px '+dotColor+'44;' : ''}` +
           `" title="Day ${dayNum}${isLast?' (checkout)':''}"></span>` +
           (i < totalDays - 1 ? `<span class="bk-stayover-dot-line"></span>` : '');
  }).join('');

  // ── Day label strip ──
  const dayStrip = document.createElement('div');
  dayStrip.className = 'bk-stayover-day-label';
  dayStrip.style.cssText =
    `color:${accentColor};background:${accentBg};` +
    `border-bottom:1px solid ${borderColor}44;`;
  dayStrip.innerHTML =
    `<span>${dayLabel}</span>` +
    `<span style="font-size:10px;opacity:0.7;font-weight:600;">${ciLabel} → ${coLabel}</span>`;

  card.appendChild(progress);
  card.appendChild(dayStrip);

  // ── Header ──
  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';
  const nameEl = document.createElement('div');
  nameEl.className = 'bk-summary-name'; nameEl.textContent = name;
  const badge = document.createElement('span');
  badge.className = 'bk-summary-badge bk-stayover-badge';
  badge.textContent = tourType;
  badge.style.background = badgeBg;
  hdr.append(nameEl, badge);
  card.appendChild(hdr);

  // ── Info rows ──
  const rows = [
    email || phone ? [`📧 ${email || '—'}`, `📞 ${phone || '—'}`] : null,
    [`👥 ${totalPax} Pax${pets ? `  🐾 ${pets} Pets` : ''}`,
     `💳 ₱${Number(total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
    [`🕐 ${to12hr(ciTime)} → ${to12hr(coTime)}  (${durationHrs} hrs)`],
    [`💰 DP: ₱${Number(dp).toLocaleString('en-PH',{minimumFractionDigits:2})}`,
     `💰 Balance: ₱${Number(balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
  ];

  rows.filter(Boolean).forEach(items => {
    const row = document.createElement('div');
    row.className = 'bk-summary-row';
    items.filter(Boolean).forEach(text => {
      const el = document.createElement('div');
      el.className = 'bk-summary-item'; el.textContent = text;
      row.appendChild(el);
    });
    card.appendChild(row);
  });

  // ── Actions ──
  const actions = document.createElement('div');
  actions.className = 'bk-summary-actions';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'bk-action-btn bk-action-view';
  viewBtn.textContent = '👁 View Full Details';
  viewBtn.style.flex = '1';
  viewBtn.addEventListener('click', () => openViewModal(b, color));

  const originBtn = document.createElement('button');
  originBtn.className = 'bk-action-btn';
  originBtn.style.cssText = `background:#fff4e0;color:#9a5a00;border:1.5px solid #ffcc80;`;
  originBtn.textContent = `📅 See ${ciLabel}`;
  originBtn.addEventListener('click', () => {
    closeBookingList();
    const parts = checkinKey.split('-');
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
    openBookingList(checkinKey, d, m, y, color);
  });

  actions.append(viewBtn, originBtn);
  card.appendChild(actions);

  return card;
}


function openBookingList(key, day, month, year, color) {
  const list = Bookings[key] || [];
  document.getElementById('bkListTitle').textContent = `${MONTH_NAMES[month]} ${day}, ${year}`;

  const body = document.getElementById('bkListBody');
  body.innerHTML = '';
  const inner = document.createElement('div');
  inner.className = 'bk-list-body-inner';

  // ── Stayover section: bookings from previous dates still occupying this date ──
  const stayoverEntries = getStayingOverBookings(key);
  if (stayoverEntries.length > 0) {
    const stayoverHeader = document.createElement('div');
    stayoverHeader.className = 'bk-stayover-section-header';
    // Pick the right icon/label based on tour type of first stayover entry
    const firstTour = (stayoverEntries[0]?.booking?.booking?.tourType) ||
                      (stayoverEntries[0]?.booking?.tourType) || '';
    const sIcon  = firstTour === '3D2N' ? '🏕' : '🌙';
    const sLabel = firstTour === '3D2N'
      ? 'Staying Over — 3 Days 2 Nights (checked in earlier)'
      : 'Staying Over — checked in on a previous date';
    stayoverHeader.innerHTML =
      `<span class="bk-stayover-section-icon">${sIcon}</span>` +
      `<span>${sLabel}</span>`;
    inner.appendChild(stayoverHeader);

    stayoverEntries.forEach(({ booking: b, checkinKey }) => {
      inner.appendChild(buildStayoverCard(b, checkinKey, color, key));
    });

    if (list.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'bk-stayover-divider';
      divider.innerHTML = `<span>New bookings for this date</span>`;
      inner.appendChild(divider);
    }
  }

  // ── Direct bookings for this date ──
  if (!list.length && !stayoverEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'bk-list-empty'; empty.textContent = 'No bookings yet for this date.';
    inner.appendChild(empty);
  } else {
    list.forEach((b, idx) => {
      inner.appendChild(buildSummaryCard(b, key, idx, color, () => {
        openBookingList(key, day, month, year, color);
        refreshMonth(month);
      }));
    });
  }

  body.appendChild(inner);

  const addNewBtn = document.getElementById('bkListAddNew');
  addNewBtn.onclick = () => { closeBookingList(); openBookingForm(key, day, month, year, color); };
  addNewBtn.style.background = `linear-gradient(135deg, ${color.accent}, ${color.light})`;

  // ── Block new bookings when a multi-night stay is still mid-stay (not yet checkout day) ──
  // e.g. 3D2N: Feb2→Feb4. On Feb3, checkoutDate='2026-02-04' > key='2026-02-03' → fully blocked.
  // On Feb4 (checkout day), checkoutDate === key → allowed (after checkout time).
  const midStayBlock = stayoverEntries.some(({ booking: b }) => {
    const coDate = (b.booking && b.booking.checkoutDate) || b.checkoutDate || '';
    return coDate > key; // still mid-stay — not yet checkout day
  });

  const slotFull = midStayBlock || (Bookings[key] || []).some(b => {
    const ci   = (b.booking && b.booking.checkinTime) || b.checkinTime || '';
    const slot = getTimeSlot(ci);
    return slot && !slot.canAdd;
  });
  addNewBtn.style.display = slotFull ? 'none' : '';

  let slotNote = document.getElementById('bkListSlotNote');
  if (!slotNote) {
    slotNote = document.createElement('div');
    slotNote.id = 'bkListSlotNote';
    slotNote.style.cssText =
      'font-size:11px;font-weight:700;color:#7a3800;background:#fff4e0;' +
      'border:1.5px solid #ff9800;border-radius:8px;padding:8px 12px;margin-top:8px;text-align:center;';
    addNewBtn.parentNode.appendChild(slotNote);
  }
  slotNote.style.display = slotFull ? '' : 'none';
  if (midStayBlock) {
    // Figure out tour type for message
    const midEntry   = stayoverEntries.find(({ booking: b }) => {
      const coDate = (b.booking && b.booking.checkoutDate) || b.checkoutDate || '';
      return coDate > key;
    });
    const midTour    = midEntry
      ? ((midEntry.booking.booking && midEntry.booking.booking.tourType) || midEntry.booking.tourType || 'multi-night')
      : 'multi-night';
    const coDateLbl  = midEntry
      ? ((midEntry.booking.booking && midEntry.booking.booking.checkoutDateLabel) || midEntry.booking.checkoutDateLabel || '')
      : '';
    slotNote.style.cssText =
      'font-size:11px;font-weight:700;color:#7a3800;background:#fff4e0;' +
      'border:1.5px solid #ff9800;border-radius:8px;padding:10px 14px;margin-top:8px;text-align:center;';
    slotNote.innerHTML =
      `🏕 <b>${midTour}</b> guests are still checked in.` +
      (coDateLbl ? ` Checkout: <b>${coDateLbl}</b>.` : '') +
      ` No new bookings allowed on this date.`;
  } else if (slotFull) {
    slotNote.style.cssText =
      'font-size:11px;font-weight:700;color:#a01030;background:#fff0f0;' +
      'border:1.5px solid #ff8080;border-radius:8px;padding:8px 12px;margin-top:8px;text-align:center;';
    slotNote.textContent = '🔴 Afternoon/evening slot booked — no new bookings for this date.';
  }

  document.getElementById('bkListOverlay').classList.add('open');
}

function closeBookingList() {
  document.getElementById('bkListOverlay').classList.remove('open');
}

function buildSummaryCard(b, key, idx, color, onDelete) {
  const card = document.createElement('div');
  card.className = 'bk-summary-card';

  const name     = b.guest?.name       || b.guestName       || '—';
  const email    = b.guest?.email      || b.guestEmail      || '—';
  const phone    = b.guest?.phone      || b.guestPhone      || '—';
  const totalPax = b.guest?.totalPax   || b.totalPax        || '—';
  const pets     = b.guest?.pets       ?? b.pets            ?? 0;
  const total    = b.payment?.total    ?? b.total           ?? 0;
  const balance  = b.payment?.balance  ?? b.balance         ?? 0;
  const tourType = b.booking?.tourType || b.tourType        || '—';
  const ciTime   = b.booking?.checkinTime  || b.checkinTime  || '';
  const coTime   = b.booking?.checkoutTime || b.checkoutTime || '';
  const coLabel  = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const fbKey    = b.fbKey || null;

  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';
  const nameEl = document.createElement('div');
  nameEl.className = 'bk-summary-name'; nameEl.textContent = name;
  const badge = document.createElement('span');
  badge.className = 'bk-summary-badge'; badge.textContent = tourType;
  badge.style.background = color.accent;
  hdr.append(nameEl, badge);

  const rows = [
    [`📧 ${email}`, `📞 ${phone}`],
    [`👥 ${totalPax} Pax`, pets ? `🐾 ${pets} Pets` : null, `💳 ₱${Number(total).toLocaleString('en-PH',{minimumFractionDigits:2})}`],
    [`🕐 ${to12hr(ciTime)} → ${to12hr(coTime)}`, `📅 Out: ${coLabel}`],
    [`💰 Balance: ₱${Number(balance).toLocaleString('en-PH',{minimumFractionDigits:2})}`],
    fbKey ? [`🔗 FB: ${fbKey}`] : null,
  ];

  rows.filter(Boolean).forEach(items => {
    const row = document.createElement('div');
    row.className = 'bk-summary-row';
    items.filter(Boolean).forEach(text => {
      const el = document.createElement('div');
      el.className = 'bk-summary-item'; el.textContent = text;
      row.appendChild(el);
    });
    card.appendChild(row);
  });

  const actions = document.createElement('div');
  actions.className = 'bk-summary-actions';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'bk-action-btn bk-action-view'; viewBtn.textContent = '👁 View';
  viewBtn.addEventListener('click', () => openViewModal(b, color));

  const editBtn = document.createElement('button');
  editBtn.className = 'bk-action-btn bk-action-edit'; editBtn.textContent = '✏️ Edit';
  editBtn.addEventListener('click', () => { closeBookingList(); openEditForm(b, key, color); });

  const delBtn = document.createElement('button');
  delBtn.className = 'bk-action-btn bk-action-del'; delBtn.textContent = '🗑 Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete booking for ${name}?`)) return;
    if (fbKey) {
      try { await FB.deleteByKey(fbKey); }
      catch(e) { console.error('Delete error:', e.message); }
    }
    if (Bookings[key]) {
      Bookings[key] = Bookings[key].filter(bk => bk.fbKey !== fbKey);
      if (!Bookings[key].length) delete Bookings[key];
      saveBookingsLocal(Bookings);
    }
    // Immediately strip all tagging classes from this date's cell
    document.querySelectorAll('#yearGrid .day-cell:not(.other-month)').forEach(cell => {
      const numEl = cell.querySelector('.day-num');
      if (!numEl) return;
      const card = cell.closest('.month-card');
      if (!card) return;
      const mEl = card.querySelector('.month-name');
      if (!mEl) return;
      const month = MONTH_NAMES.indexOf(mEl.textContent);
      const cellKey = toKey(AppState.year, month, parseInt(numEl.textContent));
      if (cellKey === key) {
        cell.classList.remove(
          'has-booking',
          'slot-full',
          'slot-morning-taken',
          'slot-stayover',
          'slot-stayover-3d2n',
          'slot-stayover-red',
          'slot-checkout-pending'
        );
        delete cell.dataset.checkoutTime;
      }
    });
    showToast('🗑 Booking deleted.');
    onDelete();
    applyBookingIndicators();
    location.reload();
  });

  actions.append(viewBtn, editBtn, delBtn);
  card.insertBefore(hdr, card.firstChild);
  card.appendChild(actions);
  return card;
}

/* ══════════════════════════════════════
   VIEW MODAL
══════════════════════════════════════ */
function openViewModal(b, color) {
  const overlay = document.getElementById('bkViewOverlay');
  if (!overlay) return;

  const name    = b.guest?.name  || '—';
  const email   = b.guest?.email || '—';
  const phone   = b.guest?.phone || '—';
  const pax     = b.guest?.totalPax   ?? '—';
  const pets    = b.guest?.pets       ?? 0;
  const rph     = b.guest?.ratePerHead ?? 0;
  const rpp     = b.guest?.ratePerPet  ?? 0;
  const baseT   = b.payment?.baseTotal ?? b.payment?.total ?? 0;
  const headC   = b.payment?.headCharge ?? 0;
  const petC    = b.payment?.petCharge  ?? 0;
  const total   = b.payment?.total    ?? 0;
  const dp      = b.payment?.downpayment ?? 0;
  const balance = b.payment?.balance  ?? 0;
  const tourType= b.booking?.tourType || '—';
  const ciLabel = b.booking?.checkinDateLabel  || b.dateKey || '—';
  const coLabel = b.booking?.checkoutDateLabel || '—';
  const ciTime  = b.booking?.checkinTime12  || to12hr(b.booking?.checkinTime  || '');
  const coTime  = b.booking?.checkoutTime12 || to12hr(b.booking?.checkoutTime || '');
  const dur     = b.booking?.durationHrs ?? '—';

  document.getElementById('bkViewTitle').textContent = name;
  document.getElementById('bkViewColorPill').style.background =
    `linear-gradient(180deg, ${color.accent}, ${color.light})`;

  document.getElementById('bkViewBody').innerHTML = `
    <div class="bk-view-grid">
      <div class="bk-view-section">
        <p class="bk-view-section-title" style="color:${color.accent};">👤 Guest</p>
        <div class="bk-view-row"><span>Name</span><span>${name}</span></div>
        <div class="bk-view-row"><span>Email</span><span>${email}</span></div>
        <div class="bk-view-row"><span>Phone</span><span>${phone}</span></div>
        <div class="bk-view-row"><span>Pax</span><span>${pax}</span></div>
        ${pets ? `<div class="bk-view-row"><span>Pets</span><span>${pets}</span></div>` : ''}
        ${rph  ? `<div class="bk-view-row"><span>Rate/Head</span><span>₱${Number(rph).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>` : ''}
        ${rpp  ? `<div class="bk-view-row"><span>Rate/Pet</span><span>₱${Number(rpp).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>` : ''}
      </div>
      <div class="bk-view-section">
        <p class="bk-view-section-title" style="color:${color.accent};">📅 Booking</p>
        <div class="bk-view-row"><span>Tour Type</span><span>${tourType}</span></div>
        <div class="bk-view-row"><span>Check-in</span><span>${ciLabel}</span></div>
        <div class="bk-view-row"><span>Check-in Time</span><span>${ciTime}</span></div>
        <div class="bk-view-row"><span>Check-out</span><span>${coLabel}</span></div>
        <div class="bk-view-row"><span>Check-out Time</span><span>${coTime}</span></div>
        <div class="bk-view-row"><span>Duration</span><span>${dur} hrs</span></div>
      </div>
      <div class="bk-view-section bk-view-section-full">
        <p class="bk-view-section-title" style="color:${color.accent};">💳 Payment</p>
        <div class="bk-view-row"><span>Base Total</span><span>₱${Number(baseT).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
        ${headC ? `<div class="bk-view-row"><span>Head Charges</span><span>+ ₱${Number(headC).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>` : ''}
        ${petC  ? `<div class="bk-view-row"><span>Pet Charges</span><span>+ ₱${Number(petC).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>` : ''}
        <div class="bk-view-row bk-view-total"><span>Total</span><span>₱${Number(total).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
        <div class="bk-view-row"><span>Downpayment</span><span>₱${Number(dp).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
        <div class="bk-view-row ${balance > 0 ? 'bk-view-balance-due' : 'bk-view-balance-ok'}">
          <span>Balance</span><span>₱${Number(balance).toLocaleString('en-PH',{minimumFractionDigits:2})} ${balance === 0 ? '✅' : ''}</span>
        </div>
      </div>
    </div>`;

  overlay.classList.add('open');
}

function closeViewModal() {
  const overlay = document.getElementById('bkViewOverlay');
  if (overlay) overlay.classList.remove('open');
}

/* ══════════════════════════════════════
   EDIT FORM
══════════════════════════════════════ */
function openEditForm(b, key, color) {
  const day   = parseInt((b.dateKey || key).split('-')[2]);
  const month = parseInt((b.dateKey || key).split('-')[1]) - 1;
  const year  = parseInt((b.dateKey || key).split('-')[0]);
  openBookingForm(key, day, month, year, color);

  const fill = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  fill('bkGuestName',   b.guest?.name);
  fill('bkGuestEmail',  b.guest?.email);
  fill('bkGuestPhone',  b.guest?.phone);
  fill('bkPax',         b.guest?.pax);
  fill('bkExtraPax',    b.guest?.extraPax || 0);
  fill('bkRatePerHead', b.guest?.ratePerHead || '');
  fill('bkPets',        b.guest?.pets || '');
  fill('bkRatePerPet',  b.guest?.ratePerPet || '');
  fill('bkTotal',       b.payment?.baseTotal ?? b.payment?.total);
  fill('bkDownpayment', b.payment?.downpayment);
  fill('bkPaymentDate', b.payment?.date);
  fill('bkCheckinTime', b.booking?.checkinTime);

  const tour = b.booking?.tourType || b.tourType || '';
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.type === tour);
  });
  _tourType = tour;
  applyTourTimeConstraints(_tourType);

  calcTotalPax(); calcBalance(); calcCheckout();
  applyTimeSlotToForm(b.booking?.checkinTime || '');

  const saveBtn      = document.getElementById('bkBtnSave');
  saveBtn._editFbKey = b.fbKey || null;
  saveBtn._editKey   = key;
  saveBtn.innerHTML  = '<span>Update Booking</span><span class="bk-btn-arrow">→</span>';
}

/* ══════════════════════════════════════
   CALENDAR INTEGRATION
══════════════════════════════════════ */
/* ══════════════════════════════════════
   STAYOVER LOOKUP
   Returns all bookings from other dates
   that are still occupying 'dateKey'
   (i.e. checkoutDate >= dateKey and
         checkinDate  <  dateKey)
══════════════════════════════════════ */
function getStayingOverBookings(dateKey) {
  const results = [];
  Object.keys(Bookings).forEach(checkinKey => {
    if (checkinKey >= dateKey) return; // only bookings that started BEFORE this date
    (Bookings[checkinKey] || []).forEach(b => {
      const coDate = (b.booking && b.booking.checkoutDate) || b.checkoutDate || '';
      // Booking spans this date if checkoutDate >= dateKey (still here today or leaving today)
      if (!coDate || coDate < dateKey) return;
      results.push({ booking: b, checkinKey });
    });
  });
  return results;
}

function openModal(key, day, month, year, color) {
  const directBookings  = Bookings[key]?.length > 0;
  const stayoverEntries = getStayingOverBookings(key);

  // Open list if there are direct bookings OR stayover bookings from previous dates
  if (directBookings || stayoverEntries.length > 0) {
    openBookingList(key, day, month, year, color);
  } else {
    openBookingForm(key, day, month, year, color);
  }
}

function applyBookingIndicators() {
  // Build stayover map once for all cells (Over-Night / 3D2N downstream days)
  const stayoverMap = buildStayoverMap();

  // Build checkout-constraint map: dateKey → latest checkout time (HH:MM)
  // These are days where a previous booking checks out — new bookings must start after that time
  const checkoutConstraintMap = {};
  Object.keys(Bookings).forEach(checkinKey => {
    (Bookings[checkinKey] || []).forEach(b => {
      const coDate = (b.booking && b.booking.checkoutDate) || b.checkoutDate || '';
      const coTime = (b.booking && b.booking.checkoutTime) || b.checkoutTime || '';
      if (!coDate || !coTime) return;
      // Only mark if checkout date differs from checkin date (multi-day booking)
      if (coDate === checkinKey) return;
      if (!checkoutConstraintMap[coDate]) {
        checkoutConstraintMap[coDate] = coTime;
      } else {
        // Keep the latest checkout time
        const existing = checkoutConstraintMap[coDate];
        const [eh, em] = existing.split(':').map(Number);
        const [nh, nm] = coTime.split(':').map(Number);
        if (nh * 60 + nm > eh * 60 + em) checkoutConstraintMap[coDate] = coTime;
      }
    });
  });

  document.querySelectorAll('#yearGrid .day-cell:not(.other-month)').forEach(cell => {
    const numEl = cell.querySelector('.day-num');
    if (!numEl) return;
    const card = cell.closest('.month-card');
    if (!card) return;
    const mEl = card.querySelector('.month-name');
    if (!mEl) return;
    const month = MONTH_NAMES.indexOf(mEl.textContent);
    const key   = toKey(AppState.year, month, parseInt(numEl.textContent));

    // 1. has-booking dot
    cell.classList.toggle('has-booking', !!(Bookings[key]?.length > 0));

    // 2. Checkin day: red (slot-full) or yellow (slot-morning-taken)
    applyTimeSlotsToCell(key, cell);

    // 3. Stay-over days from overnight/3D2N bookings
    cell.classList.remove('slot-stayover', 'slot-stayover-3d2n', 'slot-stayover-red');
    if (!cell.classList.contains('slot-full') && !cell.classList.contains('slot-morning-taken')) {
      const stay = stayoverMap[key];
      if (stay) {
        if (stay.color === 'red') {
          cell.classList.add('slot-stayover-red');
          if (stay.tour === '3d2n') cell.classList.add('slot-stayover-3d2n');
        } else {
          cell.classList.add('slot-stayover');
          if (stay.tour === '3d2n') cell.classList.add('slot-stayover-3d2n');
        }
      }
    }

    // 4. Checkout-constraint day: partial availability (previous guest still checking out)
    //    Only apply if no stronger indicator already shown (slot-full, slot-stayover-red)
    cell.classList.remove('slot-checkout-pending');
    const constraintTime = checkoutConstraintMap[key];
    if (constraintTime &&
        !cell.classList.contains('slot-full') &&
        !cell.classList.contains('slot-stayover-red') &&
        !cell.classList.contains('slot-morning-taken')) {
      cell.classList.add('slot-checkout-pending');
      cell.dataset.checkoutTime = to12hr(constraintTime);
    } else {
      delete cell.dataset.checkoutTime;
    }
  });
}

/* ══════════════════════════════════════
   LISTENERS
══════════════════════════════════════ */
function setupBookingListeners() {
  document.getElementById('bookingClose').addEventListener('click', closeBookingForm);
  document.getElementById('bkBtnCancel').addEventListener('click', closeBookingForm);
  document.getElementById('bookingOverlay').addEventListener('click', e => {
    if (e.target.id === 'bookingOverlay') closeBookingForm();
  });
  document.getElementById('bkListClose').addEventListener('click', closeBookingList);
  document.getElementById('bkListOverlay').addEventListener('click', e => {
    if (e.target.id === 'bkListOverlay') closeBookingList();
  });
  const vo = document.getElementById('bkViewOverlay');
  if (vo) {
    document.getElementById('bkViewClose')?.addEventListener('click', closeViewModal);
    vo.addEventListener('click', e => { if (e.target.id === 'bkViewOverlay') closeViewModal(); });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeBookingForm(); closeBookingList(); closeViewModal(); }
  });
  document.getElementById('bkBtnSave').addEventListener('click', saveBooking);
  document.getElementById('bkPax').addEventListener('input',         () => { calcTotalPax(); calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkExtraPax').addEventListener('input',    () => { calcTotalPax(); calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkRatePerHead').addEventListener('input', () => { calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkPets').addEventListener('input',         () => { calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkRatePerPet').addEventListener('input',   () => { calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkTotal').addEventListener('input',        () => { calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkDownpayment').addEventListener('input',  () => { calcBalance(); scheduleDraftSave(); });
  document.getElementById('bkCheckinTime').addEventListener('change', () => {
    calcCheckout();
    applyTimeSlotToForm(document.getElementById('bkCheckinTime').value);
    scheduleDraftSave();
  });
  // Draft save on text fields
  ['bkGuestName','bkGuestEmail','bkGuestPhone'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', scheduleDraftSave);
  });
  setupTourButtons();
}

/* ══════════════════════════════════════════════════════════════
   AUTO-SAVE DRAFT SYSTEM
   ──────────────────────────────────────────────────────────────
   • Every field change debounce-saves a draft to localStorage
   • Draft key: 'bk_draft_<YYYY-MM-DD>'
   • On openBookingForm → restore draft if present (show notice)
   • On Confirm Booking → clear draft for that date
   • On Cancel / close → draft kept (so user doesn't lose work)
   • Sync queue: if Firebase offline at save time, booking is
     queued in localStorage 'bk_sync_queue' and auto-uploaded
     the next time Firebase comes online
══════════════════════════════════════════════════════════════ */

const DRAFT_PREFIX = 'bk_draft_';
const SYNC_QUEUE_KEY = 'bk_sync_queue';

let _draftTimer = null;

/* ── Collect all current form values into an object ── */
function collectDraft() {
  return {
    savedAt:     new Date().toISOString(),
    dateKey:     _bkKey,
    tourType:    _tourType,
    guestName:   getVal('bkGuestName'),
    guestEmail:  getVal('bkGuestEmail'),
    guestPhone:  getVal('bkGuestPhone'),
    pax:         getVal('bkPax'),
    extraPax:    getVal('bkExtraPax'),
    ratePerHead: getVal('bkRatePerHead'),
    pets:        getVal('bkPets'),
    ratePerPet:  getVal('bkRatePerPet'),
    total:       getVal('bkTotal'),
    downpayment: getVal('bkDownpayment'),
    paymentDate: getVal('bkPaymentDate'),
    checkinTime: getVal('bkCheckinTime'),
  };
}

/* ── Save draft to localStorage (debounced 600ms) ── */
function scheduleDraftSave() {
  if (_draftTimer) clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    if (!_bkKey) return;
    try {
      const draft = collectDraft();
      // Only save if at least one meaningful field is filled
      const hasMeaningful = draft.guestName || draft.guestPhone || draft.total || draft.checkinTime;
      if (!hasMeaningful) return;
      localStorage.setItem(DRAFT_PREFIX + _bkKey, JSON.stringify(draft));
      showDraftIndicator('saving');
      setTimeout(() => showDraftIndicator('saved'), 400);
    } catch(e) { console.warn('Draft save error:', e); }
  }, 600);
}

/* ── Restore draft fields into form ── */
function restoreDraft(draft) {
  const fill = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  fill('bkGuestName',   draft.guestName);
  fill('bkGuestEmail',  draft.guestEmail);
  fill('bkGuestPhone',  draft.guestPhone);
  fill('bkPax',         draft.pax);
  fill('bkExtraPax',    draft.extraPax);
  fill('bkRatePerHead', draft.ratePerHead);
  fill('bkPets',        draft.pets);
  fill('bkRatePerPet',  draft.ratePerPet);
  fill('bkTotal',       draft.total);
  fill('bkDownpayment', draft.downpayment);
  fill('bkPaymentDate', draft.paymentDate);
  fill('bkCheckinTime', draft.checkinTime);

  if (draft.tourType) {
    document.querySelectorAll('.bk-tour-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.type === draft.tourType);
    });
    _tourType = draft.tourType;
    applyTourTimeConstraints(_tourType);
  }

  calcTotalPax();
  calcBalance();
  if (_tourType && draft.checkinTime) {
    calcCheckout();
    applyTimeSlotToForm(draft.checkinTime);
  }
  // Re-apply checkout constraint (draft restore may have set a time; re-validate it)
  if (_checkinConstraint) applyCheckoutConstraint(_checkinConstraint);
}

/* ── Clear draft for current date ── */
function clearDraft(key) {
  try { localStorage.removeItem(DRAFT_PREFIX + (key || _bkKey)); } catch(e) {}
  hideDraftIndicator();
}

/* ── Draft status indicator in form header ── */
function showDraftIndicator(state) {
  let el = document.getElementById('bkDraftIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bkDraftIndicator';
    el.style.cssText =
      'font-size:10px;font-weight:700;letter-spacing:0.4px;padding:3px 10px;' +
      'border-radius:20px;transition:all 0.3s ease;white-space:nowrap;';
    const header = document.getElementById('bkHeaderDate');
    if (header) header.parentNode.insertBefore(el, header.nextSibling);
  }
  if (state === 'saving') {
    el.textContent = '💾 Saving draft…';
    el.style.background = '#f0eeff'; el.style.color = '#7c6af4';
    el.style.opacity = '1';
  } else if (state === 'saved') {
    el.textContent = '✅ Draft saved';
    el.style.background = '#f0fff4'; el.style.color = '#2a9a5a';
    el.style.opacity = '1';
    setTimeout(() => { if (el) el.style.opacity = '0.4'; }, 2000);
  } else if (state === 'restored') {
    el.textContent = '📋 Draft restored — you can continue editing';
    el.style.background = '#fff8e0'; el.style.color = '#9a7800';
    el.style.opacity = '1';
  }
}

function hideDraftIndicator() {
  const el = document.getElementById('bkDraftIndicator');
  if (el) el.remove();
}

/* ── Check for draft on date open ── */
function checkAndRestoreDraft(key) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || !draft.savedAt) return false;
    restoreDraft(draft);
    showDraftIndicator('restored');
    return true;
  } catch(e) { return false; }
}

/* ══════════════════════════════════════════════════════════════
   FIREBASE SYNC QUEUE
   When Firebase is offline at save time, the booking JSON is
   pushed onto a queue. Next time initFirebase() succeeds, the
   queue is flushed automatically.
══════════════════════════════════════════════════════════════ */

function enqueueSync(bookingJSON) {
  try {
    const queue = getSyncQueue();
    queue.push({ bookingJSON, queuedAt: new Date().toISOString() });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log('📬 Queued for Firebase sync. Queue length:', queue.length);
  } catch(e) { console.warn('Sync queue error:', e); }
}

function getSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

async function flushSyncQueue() {
  const queue = getSyncQueue();
  if (!queue.length) return;

  console.log('🔄 Flushing sync queue —', queue.length, 'item(s)…');
  const failed = [];

  for (const item of queue) {
    try {
      const fbKey = await FB.insert(item.bookingJSON);
      // Update local Bookings with the new fbKey
      const key = item.bookingJSON.dateKey;
      if (Bookings[key]) {
        const local = Bookings[key].find(b => b.id === item.bookingJSON.id);
        if (local) local.fbKey = fbKey;
      }
      console.log('☁️ Synced queued booking:', item.bookingJSON.guest?.name, '→', fbKey);
    } catch(e) {
      console.warn('❌ Sync failed for queued item:', e.message);
      failed.push(item);
    }
  }

  if (failed.length) {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(failed));
    console.warn('⚠️', failed.length, 'item(s) remain in queue after flush.');
  } else {
    clearSyncQueue();
    saveBookingsLocal(Bookings);
    console.log('✅ Sync queue fully flushed.');
  }

  const queueCount = failed.length;
  if (queueCount === 0) {
    showToast('☁️ All offline bookings synced to Firebase!', 4000);
  }
}