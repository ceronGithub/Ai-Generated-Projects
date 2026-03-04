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

// In-memory cache  { 'YYYY-MM-DD': [ bookingObj, ... ] }
const Bookings = loadBookingsLocal();

/* ══════════════════════════════════════
   FORM STATE
══════════════════════════════════════ */
let _bkKey             = null;
let _bkDay             = null;
let _bkMonth           = null;
let _bkYear            = null;
let _bkColor           = null;
let _tourType          = null;
let _editFbId          = null;
let _editOrigCreatedAt = null;

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function pad2(n) { return String(n).padStart(2, '0'); }

function toMins(hhmm) {
  if (!hhmm) return -1;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

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

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
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

/* ══════════════════════════════════════════════════════
   CHECK-IN TIME SLOT RULES
   ─────────────────────────────────────────────────────
   SLOT A  08:00 – 11:00  → Day Tour ✅  Night Tour ✅  Over-Night ✅
                            checkout: same day (Day), same day (Night), next day (OVN)
                            cell color: YELLOW  |  "New Booking" btn: VISIBLE

   SLOT B  11:30 – 14:00  → Day Tour ✗   Night Tour ✅  Over-Night ✅
                            checkout: same day for BOTH Night & OVN
                            cell color: RED  |  "New Booking" btn: HIDDEN

   SLOT C  14:01 +        → Day Tour ✗   Night Tour ✅  Over-Night ✅
                            checkout: NEXT day for BOTH Night & OVN
                            cell color: RED  |  "New Booking" btn: HIDDEN

   Outside 08:00–open    → nothing available (too early / invalid)
══════════════════════════════════════════════════════ */
const SLOT_NONE = 'none';
const SLOT_A    = 'A';   // 08:00–11:00
const SLOT_B    = 'B';   // 11:30–14:00
const SLOT_C    = 'C';   // 14:01+

function getTimeSlot(hhmm) {
  const mins = toMins(hhmm);
  if (mins < 0)            return SLOT_NONE;
  if (mins < 8 * 60)       return SLOT_NONE;        // before 8 AM
  if (mins <= 11 * 60)     return SLOT_A;            // 08:00–11:00
  if (mins < 11 * 60 + 30) return SLOT_NONE;        // 11:01–11:29 gap — treat as none
  if (mins <= 14 * 60)     return SLOT_B;            // 11:30–14:00
  return SLOT_C;                                     // 14:01+
}

function getTourAvailability(slot) {
  if (slot === SLOT_A) return { 'Day Tour': true,  'Night Tour': true,  'Over-Night': true  };
  if (slot === SLOT_B) return { 'Day Tour': false, 'Night Tour': true,  'Over-Night': true  };
  if (slot === SLOT_C) return { 'Day Tour': false, 'Night Tour': true,  'Over-Night': true  };
  return                       { 'Day Tour': false, 'Night Tour': false, 'Over-Night': false };
}

/* Is checkout on the next calendar day for a given tour type + slot? */
function isCheckoutNextDay(tourType, slot) {
  if (tourType === 'Day Tour')    return false;                   // always same day
  if (tourType === 'Night Tour')  return slot === SLOT_C;         // next day only for slot C
  if (tourType === 'Over-Night')  return (slot === SLOT_A || slot === SLOT_C); // next day for A & C
  return false;
}

/* Duration in minutes for each tour type */
function getTourDuration(tourType) {
  if (tourType === 'Day Tour')   return 10 * 60;  // 10 hrs
  if (tourType === 'Night Tour') return 10 * 60;  // 10 hrs
  if (tourType === 'Over-Night') return 21 * 60;  // 21 hrs
  return 10 * 60;
}

/* ══════════════════════════════════════
   UPDATE TOUR BUTTON AVAILABILITY
══════════════════════════════════════ */
function updateTourAvailability() {
  const hhmm  = getVal('bkCheckinTime');
  const slot  = getTimeSlot(hhmm);
  const avail = getTourAvailability(slot);
  const hint  = document.getElementById('bkTourHint');

  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    const type      = btn.dataset.type;
    const available = avail[type];
    btn.disabled    = !available;
    btn.classList.toggle('bk-tour-btn--locked', !available);

    // Deselect if current selection is no longer valid
    if (!available && _tourType === type) {
      btn.classList.remove('selected');
      _tourType = null;
      document.getElementById('bkCheckoutDisplay').textContent = '—';
      document.getElementById('bkCheckoutTime').textContent    = '—';
      document.getElementById('bkDuration').textContent        = '—';
    }
  });

  // Hint message
  if (hint) {
    if (slot === SLOT_NONE && hhmm) {
      if (toMins(hhmm) < 8 * 60) {
        hint.textContent = '⛔ Too early — check-in opens at 8:00 AM.';
        hint.className   = 'bk-tour-hint bk-tour-hint--error';
      } else {
        hint.textContent = '⛔ 11:01–11:29 is a gap period — try 11:30 AM or later.';
        hint.className   = 'bk-tour-hint bk-tour-hint--error';
      }
    } else if (slot === SLOT_NONE) {
      hint.textContent = '🕐 Enter check-in time to see available tour types.';
      hint.className   = 'bk-tour-hint bk-tour-hint--neutral';
    } else if (slot === SLOT_A) {
      hint.textContent = '✅ 8:00–11:00 AM — Day Tour, Night Tour & Over-Night available.';
      hint.className   = 'bk-tour-hint bk-tour-hint--success';
    } else if (slot === SLOT_B) {
      hint.textContent = '🌙 11:30 AM–2:00 PM — Night Tour & Over-Night only. Check-out: same day.';
      hint.className   = 'bk-tour-hint bk-tour-hint--warning';
    } else if (slot === SLOT_C) {
      hint.textContent = '🌙 After 2:00 PM — Night Tour & Over-Night only. Check-out: next day.';
      hint.className   = 'bk-tour-hint bk-tour-hint--warning';
    }
  }

  // Update cell color on calendar
  _applyDayCellSlotColor(slot);

  // Recalc checkout if tour type already selected
  if (_tourType) calcCheckout();
}

/* ══════════════════════════════════════
   APPLY DAY-CELL SLOT COLOR ON CALENDAR
   Yellow = Slot A (still accepting, some tours)
   Red    = Slot B or C (limited, no new-booking btn)
══════════════════════════════════════ */
function _applyDayCellSlotColor(slot) {
  if (!_bkKey) return;
  const cell = _getDayCell(_bkKey);
  if (!cell) return;
  cell.classList.remove('slot-yellow', 'slot-red');
  if (slot === SLOT_A) cell.classList.add('slot-yellow');
  if (slot === SLOT_B || slot === SLOT_C) cell.classList.add('slot-red');
}

function _getDayCell(key) {
  const cells = document.querySelectorAll('#yearGrid .day-cell:not(.other-month)');
  for (const cell of cells) {
    const numEl = cell.querySelector('.day-num');
    if (!numEl) continue;
    const cardEl = cell.closest('.month-card');
    if (!cardEl) continue;
    const mEl = cardEl.querySelector('.month-name');
    if (!mEl) continue;
    const month = MONTH_NAMES.indexOf(mEl.textContent);
    const cellKey = toKey(AppState.year, month, parseInt(numEl.textContent));
    if (cellKey === key) return cell;
  }
  return null;
}

/* ══════════════════════════════════════
   COMPILE BOOKING JSON
══════════════════════════════════════ */
function compileBookingJSON(pax, extraPax, pets, total, downpayment, ciTime, coTime, isNextDay, durationMins) {
  const nd = nextDay(_bkYear, _bkMonth, _bkDay);
  return {
    id:        _editFbId ? (_editOrigCreatedAt ? undefined : Date.now()) : Date.now(),
    createdAt: _editOrigCreatedAt || new Date().toISOString(),
    dateKey:   _bkKey,
    guest: {
      name:     getVal('bkGuestName').trim(),
      email:    getVal('bkGuestEmail').trim(),
      phone:    getVal('bkGuestPhone').trim(),
      pax, extraPax, totalPax: pax + extraPax, pets,
    },
    payment: {
      date:        getVal('bkPaymentDate'),
      mode:        'BDO Bank Transfer',
      total, downpayment,
      balance:     total - downpayment,
    },
    booking: {
      tourType:           _tourType,
      checkinDate:        _bkKey,
      checkinDateLabel:   formatDateLabel(_bkYear, _bkMonth, _bkDay),
      checkoutDate:       isNextDay ? nd.key   : _bkKey,
      checkoutDateLabel:  isNextDay ? nd.label : formatDateLabel(_bkYear, _bkMonth, _bkDay),
      checkinTime:        ciTime,
      checkinTime12:      to12hr(ciTime),
      checkoutTime:       coTime,
      checkoutTime12:     to12hr(coTime),
      durationHrs:        durationMins / 60,
    },
    dayInfo: getDateEventInfo(_bkYear, _bkMonth, _bkDay),
  };
}

/* ══════════════════════════════════════
   OPEN / CLOSE FORM  (new booking)
══════════════════════════════════════ */
function openBookingForm(key, day, month, year, color) {
  _bkKey = key; _bkDay = day; _bkMonth = month; _bkYear = year;
  _bkColor = color; _tourType = null;
  _editFbId = null; _editOrigCreatedAt = null;

  document.getElementById('bkColorPill').style.background =
    `linear-gradient(180deg, ${color.accent}, ${color.light})`;
  document.getElementById('bkHeaderLabel').textContent = 'New Booking';
  document.getElementById('bkHeaderDate').textContent  = formatDateLabel(year, month, day);

  const ev = getDateEventInfo(year, month, day);
  document.getElementById('bkEventIcon').textContent  = ev.icon;
  document.getElementById('bkEventLabel').textContent = ev.label;
  document.getElementById('bkEventBadge').className   = 'bk-event-badge is-' + ev.type;

  resetBookingForm();
  setFormReadonly(false);

  document.getElementById('bkCheckinDisplay').textContent = formatDateLabel(year, month, day);
  const t = AppState.today;
  setVal('bkPaymentDate', `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`);

  document.querySelectorAll('.bk-tour-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('bkCheckoutDisplay').textContent = '—';
  document.getElementById('bkCheckoutTime').textContent    = '—';
  document.getElementById('bkDuration').textContent        = '—';

  _applyColor(color);

  document.getElementById('bkBtnSave').style.display = '';
  document.getElementById('bkBtnSave').innerHTML     = '<span>Confirm Booking</span><span class="bk-btn-arrow">→</span>';
  document.getElementById('bkBtnCancel').textContent = 'Cancel';

  document.getElementById('bookingOverlay').classList.add('open');
}

/* ══════════════════════════════════════
   OPEN EDIT FORM  (prefill existing)
══════════════════════════════════════ */
function openEditForm(b, key, day, month, year, color) {
  _bkKey   = key; _bkDay = day; _bkMonth = month; _bkYear = year;
  _bkColor = color;
  _editFbId          = b.sbId || null;
  _editOrigCreatedAt = b.createdAt || null;

  const name     = b.guest?.name          || b.guestName    || '';
  const email    = b.guest?.email         || b.guestEmail   || '';
  const phone    = b.guest?.phone         || b.guestPhone   || '';
  const pax      = b.guest?.pax           ?? b.pax          ?? '';
  const extraPax = b.guest?.extraPax      ?? b.extraPax     ?? '';
  const pets     = b.guest?.pets          ?? b.pets         ?? '';
  const payDate  = b.payment?.date        || b.paymentDate  || '';
  const total    = b.payment?.total       ?? b.total        ?? '';
  const dp       = b.payment?.downpayment ?? b.downpayment  ?? '';
  const tourType = b.booking?.tourType    || b.tourType     || '';
  const ciTime   = b.booking?.checkinTime || b.checkinTime  || '';
  const ciLabel  = b.booking?.checkinDateLabel  || b.checkinDateLabel  || formatDateLabel(year, month, day);
  const coLabel  = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const coTime   = b.booking?.checkoutTime || b.checkoutTime || '';
  const dur      = b.booking?.durationHrs ?? null;

  document.getElementById('bkColorPill').style.background =
    `linear-gradient(180deg, ${color.accent}, ${color.light})`;
  document.getElementById('bkHeaderLabel').textContent = 'Edit Booking';
  document.getElementById('bkHeaderDate').textContent  = formatDateLabel(year, month, day);

  const ev = getDateEventInfo(year, month, day);
  document.getElementById('bkEventIcon').textContent  = ev.icon;
  document.getElementById('bkEventLabel').textContent = ev.label;
  document.getElementById('bkEventBadge').className   = 'bk-event-badge is-' + ev.type;

  resetBookingForm();
  setFormReadonly(false);

  setVal('bkGuestName',   name);
  setVal('bkGuestEmail',  email);
  setVal('bkGuestPhone',  phone);
  setVal('bkPax',         pax);
  setVal('bkExtraPax',    extraPax);
  setVal('bkPets',        pets);
  calcTotalPax();

  setVal('bkPaymentDate', payDate);
  setVal('bkTotal',       total);
  setVal('bkDownpayment', dp);
  calcBalance();

  document.getElementById('bkCheckinDisplay').textContent  = ciLabel;
  document.getElementById('bkCheckoutDisplay').textContent = coLabel;
  setVal('bkCheckinTime', ciTime);

  _tourType = tourType;
  updateTourAvailability();
  document.querySelectorAll('.bk-tour-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.type === tourType);
  });

  if (coTime) document.getElementById('bkCheckoutTime').textContent = to12hr(coTime);
  if (dur !== null) {
    document.getElementById('bkDuration').textContent =
      ciTime && coTime ? `${dur} hrs (${to12hr(ciTime)} → ${to12hr(coTime)})` : `${dur} hrs`;
  }

  _applyColor(color);

  document.getElementById('bkBtnSave').style.display = '';
  document.getElementById('bkBtnSave').innerHTML     = '<span>Save Changes</span><span class="bk-btn-arrow">→</span>';
  document.getElementById('bkBtnCancel').textContent = 'Cancel';

  document.getElementById('bookingOverlay').classList.add('open');
}

/* ══════════════════════════════════════
   OPEN VIEW FORM  (read-only)
══════════════════════════════════════ */
function openViewForm(b, key, day, month, year, color) {
  openEditForm(b, key, day, month, year, color);
  document.getElementById('bkHeaderLabel').textContent = 'View Booking';
  setFormReadonly(true);
  document.getElementById('bkBtnSave').style.display = 'none';
  document.getElementById('bkBtnCancel').textContent  = 'Close';
}

/* ══════════════════════════════════════
   READONLY TOGGLE
══════════════════════════════════════ */
function setFormReadonly(readonly) {
  document.querySelectorAll('#bookingModal input, #bookingModal select, #bookingModal textarea')
    .forEach(el => { el.readOnly = readonly; el.disabled = readonly; });
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.disabled = readonly;
    btn.style.pointerEvents = readonly ? 'none' : '';
    btn.style.opacity       = readonly ? '0.65' : '';
  });
  document.getElementById('bookingModal').classList.toggle('bk-modal--readonly', readonly);
}

/* ══════════════════════════════════════
   APPLY COLOR THEME TO FORM
══════════════════════════════════════ */
function _applyColor(color) {
  document.querySelectorAll('.bk-section-title').forEach(el => {
    el.style.color = color.accent; el.style.borderColor = color.light;
  });
  document.getElementById('bkBtnSave').style.background =
    `linear-gradient(135deg, ${color.accent}, ${color.light})`;
}

function closeBookingForm() {
  document.getElementById('bookingOverlay').classList.remove('open');
  document.getElementById('bookingModal').classList.remove('bk-modal--readonly');
  _editFbId = null; _editOrigCreatedAt = null;
}

function resetBookingForm() {
  ['bkGuestName','bkGuestEmail','bkGuestPhone','bkPax','bkExtraPax',
   'bkPets','bkTotal','bkDownpayment','bkCheckinTime'].forEach(id => {
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
  _tourType = null;
  updateTourAvailability();
}

/* ══════════════════════════════════════
   LIVE CALCULATIONS
══════════════════════════════════════ */
function calcTotalPax() {
  const v = (parseInt(getVal('bkPax'))||0) + (parseInt(getVal('bkExtraPax'))||0);
  document.getElementById('bkTotalPax').textContent = v || '—';
}

function calcBalance() {
  const total = parseFloat(getVal('bkTotal')) || 0;
  const dp    = parseFloat(getVal('bkDownpayment')) || 0;
  const el    = document.getElementById('bkBalance');
  if (!total && !dp) { el.textContent = '—'; el.className = 'bk-auto bk-balance'; return; }
  const bal = total - dp;
  el.textContent = `₱ ${bal.toLocaleString('en-PH',{minimumFractionDigits:2})}`;
  el.className   = 'bk-auto bk-balance ' + (bal < 0 ? 'negative' : bal === 0 ? 'zero' : 'positive');
}

function calcCheckout() {
  if (!_tourType) return;
  const ci           = getVal('bkCheckinTime');
  const slot         = getTimeSlot(ci);
  const nextDay_flag = isCheckoutNextDay(_tourType, slot);
  const durationMins = getTourDuration(_tourType);
  const nd           = nextDay(_bkYear, _bkMonth, _bkDay);

  document.getElementById('bkCheckoutDisplay').textContent =
    nextDay_flag ? nd.label : formatDateLabel(_bkYear, _bkMonth, _bkDay);

  if (ci) {
    const co = addMinutesToTime(ci, durationMins);
    document.getElementById('bkCheckoutTime').textContent = to12hr(co);
    document.getElementById('bkDuration').textContent     =
      `${durationMins/60} hrs (${to12hr(ci)} → ${to12hr(co)})`;
  } else {
    document.getElementById('bkCheckoutTime').textContent = `(+${durationMins/60} hrs from check-in)`;
    document.getElementById('bkDuration').textContent     = `${durationMins/60} hrs`;
  }
}

/* ══════════════════════════════════════
   TOUR TYPE BUTTONS
══════════════════════════════════════ */
function setupTourButtons() {
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('.bk-tour-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _tourType = btn.dataset.type;
      document.getElementById('errTourType').textContent = '';
      calcCheckout();
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
  err('bkGuestName',  'errGuestName',  !getVal('bkGuestName').trim()       ? 'Required.' : '');
  const email = getVal('bkGuestEmail').trim();
  err('bkGuestEmail', 'errGuestEmail',
    !email ? 'Required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Invalid email.' : '');
  err('bkGuestPhone', 'errGuestPhone', !getVal('bkGuestPhone').trim()      ? 'Required.' : '');
  err('bkPax',        'errPax',        parseInt(getVal('bkPax')) < 1       ? 'Min 1.' : '');
  err('bkPaymentDate','errPaymentDate',!getVal('bkPaymentDate')            ? 'Required.' : '');
  err('bkTotal',      'errTotal',      parseFloat(getVal('bkTotal')) <= 0  ? 'Required.' : '');
  err('bkDownpayment','errDownpayment',getVal('bkDownpayment') === ''      ? 'Required.' : '');
  err('bkCheckinTime','errCheckinTime',!getVal('bkCheckinTime')            ? 'Required.' : '');
  const te = document.getElementById('errTourType');
  if (!_tourType) { if(te) te.textContent = 'Select tour type.'; ok = false; }
  else            { if(te) te.textContent = ''; }
  return ok;
}

/* ══════════════════════════════════════
   SAVE BOOKING  (create OR update)
══════════════════════════════════════ */
async function saveBooking() {
  if (!validate()) return;

  const btn = document.getElementById('bkBtnSave');
  btn.disabled  = true;
  btn.innerHTML = '<span>Saving…</span>';

  const pax          = parseInt(getVal('bkPax'))          || 0;
  const extraPax     = parseInt(getVal('bkExtraPax'))      || 0;
  const pets         = parseInt(getVal('bkPets'))          || 0;
  const total        = parseFloat(getVal('bkTotal'))       || 0;
  const downpayment  = parseFloat(getVal('bkDownpayment')) || 0;
  const ciTime       = getVal('bkCheckinTime');
  const slot         = getTimeSlot(ciTime);
  const nextDay_flag = isCheckoutNextDay(_tourType, slot);
  const durationMins = getTourDuration(_tourType);
  const coTime       = addMinutesToTime(ciTime, durationMins);

  const bookingJSON = compileBookingJSON(
    pax, extraPax, pets, total, downpayment,
    ciTime, coTime, nextDay_flag, durationMins
  );

  const dbRow = {
    date_key:            bookingJSON.dateKey,
    guest_name:          bookingJSON.guest.name,
    guest_email:         bookingJSON.guest.email,
    guest_phone:         bookingJSON.guest.phone,
    pax:                 bookingJSON.guest.pax,
    extra_pax:           bookingJSON.guest.extraPax,
    total_pax:           bookingJSON.guest.totalPax,
    pets:                bookingJSON.guest.pets,
    payment_date:        bookingJSON.payment.date,
    payment_mode:        bookingJSON.payment.mode,
    total:               bookingJSON.payment.total,
    downpayment:         bookingJSON.payment.downpayment,
    balance:             bookingJSON.payment.balance,
    checkin_date:        bookingJSON.booking.checkinDate,
    checkout_date:       bookingJSON.booking.checkoutDate,
    checkin_date_label:  bookingJSON.booking.checkinDateLabel,
    checkout_date_label: bookingJSON.booking.checkoutDateLabel,
    tour_type:           bookingJSON.booking.tourType,
    checkin_time:        bookingJSON.booking.checkinTime,
    checkout_time:       bookingJSON.booking.checkoutTime,
    raw_json:            bookingJSON,
  };

  let fbId    = _editFbId;
  let fbSaved = false;
  const isEdit = !!_editFbId;

  try {
    if (isEdit) {
      await FB.updateById(fbId, dbRow);
      fbSaved = true;
    } else {
      const result = await FB.insert(dbRow);
      fbId    = result?.[0]?.id ?? null;
      fbSaved = true;
    }
  } catch (fbErr) {
    console.error('❌ Firebase error:', fbErr.message);
  }

  const entry = { ...bookingJSON, sbId: fbId };
  if (isEdit) {
    if (Bookings[_bkKey]) {
      const idx = Bookings[_bkKey].findIndex(b => b.sbId === fbId);
      if (idx > -1) Bookings[_bkKey][idx] = entry;
      else          Bookings[_bkKey].push(entry);
    }
  } else {
    if (!Bookings[_bkKey]) Bookings[_bkKey] = [];
    Bookings[_bkKey].push(entry);
  }
  saveBookingsLocal(Bookings);
  closeBookingForm();

  if (fbSaved) {
    showToast(isEdit ? `✏️ Updated: ${bookingJSON.guest.name} ☁️` : `✅ Saved: ${bookingJSON.guest.name} ☁️`);
    await refreshFromFirebase();
  } else {
    showToast(`💾 Saved locally: ${bookingJSON.guest.name} — check Firebase setup`);
    refreshMonth(_bkMonth);
    applyBookingIndicators();
  }

  btn.disabled  = false;
  btn.innerHTML = '<span>Confirm Booking</span><span class="bk-btn-arrow">→</span>';
}

/* ══════════════════════════════════════
   BOOKING LIST
   Hides "+ New Booking" for Slot B & C
   (date is already full / late check-in)
══════════════════════════════════════ */
function openBookingList(key, day, month, year, color) {
  const list = Bookings[key] || [];
  document.getElementById('bkListTitle').textContent = `${MONTH_NAMES[month]} ${day}, ${year}`;

  const body = document.getElementById('bkListBody');
  body.innerHTML = '';
  const inner = document.createElement('div');
  inner.className = 'bk-list-body-inner';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className   = 'bk-list-empty';
    empty.textContent = 'No bookings yet for this date.';
    inner.appendChild(empty);
  } else {
    list.forEach((b, idx) => {
      inner.appendChild(buildSummaryCard(b, key, idx, color, day, month, year, () => {
        openBookingList(key, day, month, year, color);
        refreshMonth(month);
      }));
    });
  }

  body.appendChild(inner);

  // Determine if "+ New Booking" should be shown based on the latest booking's check-in time
  const latestCiTime = _getLatestCheckinTime(key);
  const slot         = getTimeSlot(latestCiTime);
  const hideAddNew   = (slot === SLOT_B || slot === SLOT_C);

  const addNewBtn = document.getElementById('bkListAddNew');
  const footer    = addNewBtn.closest('.bk-list-footer');

  if (hideAddNew) {
    addNewBtn.style.display = 'none';
    // Show a notice instead
    let notice = footer.querySelector('.bk-slot-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'bk-slot-notice';
      footer.appendChild(notice);
    }
    notice.textContent = slot === SLOT_B
      ? '🔴 Check-in is 11:30 AM–2:00 PM — this date is no longer accepting new bookings.'
      : '🔴 Check-in is after 2:00 PM — this date is no longer accepting new bookings.';
    notice.style.display = '';
  } else {
    addNewBtn.style.display = '';
    addNewBtn.onclick = () => {
      closeBookingList();
      openBookingForm(key, day, month, year, color);
    };
    addNewBtn.style.background = `linear-gradient(135deg, ${color.accent}, ${color.light})`;
    const notice = footer.querySelector('.bk-slot-notice');
    if (notice) notice.style.display = 'none';
  }

  document.getElementById('bkListOverlay').classList.add('open');
}

function _getLatestCheckinTime(key) {
  const list = Bookings[key] || [];
  if (!list.length) return null;
  // Return the check-in time of the most recently created booking
  return list[list.length - 1]?.booking?.checkinTime
      || list[list.length - 1]?.checkinTime
      || null;
}

function closeBookingList() {
  document.getElementById('bkListOverlay').classList.remove('open');
}

/* ══════════════════════════════════════
   SUMMARY CARD  (Edit / View / Delete)
══════════════════════════════════════ */
function buildSummaryCard(b, key, idx, color, day, month, year, onDelete) {
  const card = document.createElement('div');
  card.className = 'bk-summary-card';

  const name     = b.guest?.name          || b.guestName  || '—';
  const email    = b.guest?.email         || b.guestEmail  || '—';
  const phone    = b.guest?.phone         || b.guestPhone  || '—';
  const totalPax = b.guest?.totalPax      || b.totalPax    || '—';
  const pets     = b.guest?.pets          ?? b.pets        ?? 0;
  const total    = b.payment?.total       ?? b.total       ?? 0;
  const balance  = b.payment?.balance     ?? b.balance     ?? 0;
  const tourType = b.booking?.tourType    || b.tourType    || '—';
  const ciTime   = b.booking?.checkinTime  || b.checkinTime  || '';
  const coTime   = b.booking?.checkoutTime || b.checkoutTime || '';
  const coLabel  = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const fbId     = b.sbId || null;

  // Slot badge on the card
  const slot      = getTimeSlot(ciTime);
  const slotLabel = { A: '🟡 Morning', B: '🔴 Midday', C: '🔴 Afternoon', none: '' }[slot] || '';

  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';

  const nameEl = document.createElement('div');
  nameEl.className   = 'bk-summary-name';
  nameEl.textContent = name;

  const badge = document.createElement('span');
  badge.className        = 'bk-summary-badge';
  badge.textContent      = tourType;
  badge.style.background = color.accent;

  hdr.append(nameEl, badge);
  card.appendChild(hdr);

  const rows = [
    slotLabel ? [`⏰ Slot: ${slotLabel}`] : null,
    [`📧 ${email}`, `📞 ${phone}`],
    [`👥 ${totalPax} Pax`, pets ? `🐾 ${pets} Pets` : null, `💳 ₱${Number(total).toLocaleString()}`],
    [`🕐 ${to12hr(ciTime)} → ${to12hr(coTime)}`, `📅 Out: ${coLabel}`],
    [`💰 Balance: ₱${Number(balance).toLocaleString('en-PH',{minimumFractionDigits:2})}`],
    fbId ? [`🔗 ID: ${fbId}`] : null,
  ];

  rows.filter(Boolean).forEach(items => {
    const row = document.createElement('div');
    row.className = 'bk-summary-row';
    items.filter(Boolean).forEach(text => {
      const el = document.createElement('div');
      el.className   = 'bk-summary-item';
      el.textContent = text;
      row.appendChild(el);
    });
    card.appendChild(row);
  });

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'bk-card-actions';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'bk-card-btn bk-card-btn--view';
  viewBtn.innerHTML = '👁 View';
  viewBtn.addEventListener('click', () => { closeBookingList(); openViewForm(b, key, day, month, year, color); });

  const editBtn = document.createElement('button');
  editBtn.className = 'bk-card-btn bk-card-btn--edit';
  editBtn.innerHTML = '✏️ Edit';
  editBtn.addEventListener('click', () => { closeBookingList(); openEditForm(b, key, day, month, year, color); });

  const delBtn = document.createElement('button');
  delBtn.className = 'bk-card-btn bk-card-btn--delete';
  delBtn.innerHTML = '🗑 Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete booking for ${name}?`)) return;
    if (fbId) { try { await FB.deleteById(fbId); } catch(e) { console.error('Delete error:', e.message); } }
    showToast('🗑 Booking deleted.');
    await refreshFromFirebase();
    onDelete();
  });

  actions.append(viewBtn, editBtn, delBtn);
  card.appendChild(actions);
  return card;
}

/* ══════════════════════════════════════
   CALENDAR INTEGRATION
══════════════════════════════════════ */
function openModal(key, day, month, year, color) {
  (Bookings[key]?.length > 0)
    ? openBookingList(key, day, month, year, color)
    : openBookingForm(key, day, month, year, color);
}

function applyBookingIndicators() {
  document.querySelectorAll('#yearGrid .day-cell:not(.other-month)').forEach(cell => {
    const numEl = cell.querySelector('.day-num');
    if (!numEl) return;
    const cardEl = cell.closest('.month-card');
    if (!cardEl) return;
    const mEl = cardEl.querySelector('.month-name');
    if (!mEl) return;
    const month = MONTH_NAMES.indexOf(mEl.textContent);
    const key   = toKey(AppState.year, month, parseInt(numEl.textContent));
    const list  = Bookings[key] || [];

    cell.classList.toggle('has-booking', list.length > 0);

    // Re-apply slot color from the last booking's check-in time
    cell.classList.remove('slot-yellow', 'slot-red');
    if (list.length > 0) {
      const lastCi = list[list.length - 1]?.booking?.checkinTime
                  || list[list.length - 1]?.checkinTime || '';
      const slot = getTimeSlot(lastCi);
      if (slot === SLOT_A)                      cell.classList.add('slot-yellow');
      if (slot === SLOT_B || slot === SLOT_C)   cell.classList.add('slot-red');
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeBookingForm(); closeBookingList(); }
  });
  document.getElementById('bkBtnSave').addEventListener('click', saveBooking);
  document.getElementById('bkPax').addEventListener('input', calcTotalPax);
  document.getElementById('bkExtraPax').addEventListener('input', calcTotalPax);
  document.getElementById('bkTotal').addEventListener('input', calcBalance);
  document.getElementById('bkDownpayment').addEventListener('input', calcBalance);
  document.getElementById('bkCheckinTime').addEventListener('change', () => {
    updateTourAvailability();
    calcCheckout();
  });
  setupTourButtons();
}