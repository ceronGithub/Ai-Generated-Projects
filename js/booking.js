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
let _bkKey      = null;
let _bkDay      = null;
let _bkMonth    = null;
let _bkYear     = null;
let _bkColor    = null;
let _tourType   = null;
let _editFbId   = null;   // non-null when editing an existing booking
let _editOrigCreatedAt = null;

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

  // Header
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

  // Footer: show Save, hide Edit action
  document.getElementById('bkBtnSave').style.display = '';
  document.getElementById('bkBtnSave').innerHTML     = '<span>Confirm Booking</span><span class="bk-btn-arrow">→</span>';
  document.getElementById('bkBtnCancel').textContent = 'Cancel';

  document.getElementById('bookingOverlay').classList.add('open');
}

/* ══════════════════════════════════════
   OPEN EDIT FORM  (prefill existing)
══════════════════════════════════════ */
function openEditForm(b, key, day, month, year, color) {
  _bkKey   = key;  _bkDay = day; _bkMonth = month; _bkYear = year;
  _bkColor = color;
  _editFbId         = b.sbId || null;
  _editOrigCreatedAt = b.createdAt || null;

  const name     = b.guest?.name       || b.guestName    || '';
  const email    = b.guest?.email      || b.guestEmail   || '';
  const phone    = b.guest?.phone      || b.guestPhone   || '';
  const pax      = b.guest?.pax        ?? b.pax          ?? '';
  const extraPax = b.guest?.extraPax   ?? b.extraPax     ?? '';
  const pets     = b.guest?.pets       ?? b.pets         ?? '';
  const payDate  = b.payment?.date     || b.paymentDate  || '';
  const total    = b.payment?.total    ?? b.total        ?? '';
  const dp       = b.payment?.downpayment ?? b.downpayment ?? '';
  const tourType = b.booking?.tourType || b.tourType     || '';
  const ciTime   = b.booking?.checkinTime || b.checkinTime || '';
  const ciLabel  = b.booking?.checkinDateLabel || b.checkinDateLabel || formatDateLabel(year, month, day);
  const coLabel  = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const coTime   = b.booking?.checkoutTime || b.checkoutTime || '';
  const dur      = b.booking?.durationHrs ?? null;

  // Header
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

  // Prefill guest
  setVal('bkGuestName',    name);
  setVal('bkGuestEmail',   email);
  setVal('bkGuestPhone',   phone);
  setVal('bkPax',          pax);
  setVal('bkExtraPax',     extraPax);
  setVal('bkPets',         pets);
  calcTotalPax();

  // Prefill payment
  setVal('bkPaymentDate',  payDate);
  setVal('bkTotal',        total);
  setVal('bkDownpayment',  dp);
  calcBalance();

  // Prefill booking
  document.getElementById('bkCheckinDisplay').textContent  = ciLabel;
  document.getElementById('bkCheckoutDisplay').textContent = coLabel;
  setVal('bkCheckinTime', ciTime);

  // Tour type button
  _tourType = tourType;
  document.querySelectorAll('.bk-tour-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.type === tourType);
  });

  // Checkout time & duration
  if (coTime) {
    document.getElementById('bkCheckoutTime').textContent = to12hr(coTime);
  }
  if (dur !== null) {
    document.getElementById('bkDuration').textContent =
      ciTime && coTime
        ? `${dur} hrs (${to12hr(ciTime)} → ${to12hr(coTime)})`
        : `${dur} hrs`;
  }

  _applyColor(color);

  // Footer: Save button = "Save Changes"
  document.getElementById('bkBtnSave').style.display = '';
  document.getElementById('bkBtnSave').innerHTML     = '<span>Save Changes</span><span class="bk-btn-arrow">→</span>';
  document.getElementById('bkBtnCancel').textContent = 'Cancel';

  document.getElementById('bookingOverlay').classList.add('open');
}

/* ══════════════════════════════════════
   OPEN VIEW FORM  (read-only)
══════════════════════════════════════ */
function openViewForm(b, key, day, month, year, color) {
  // Re-use edit logic to prefill, then lock fields
  openEditForm(b, key, day, month, year, color);

  document.getElementById('bkHeaderLabel').textContent = 'View Booking';
  setFormReadonly(true);

  // Footer: hide Save, just Close
  document.getElementById('bkBtnSave').style.display = 'none';
  document.getElementById('bkBtnCancel').textContent  = 'Close';
}

/* ══════════════════════════════════════
   READONLY TOGGLE
══════════════════════════════════════ */
function setFormReadonly(readonly) {
  const inputs = document.querySelectorAll(
    '#bookingModal input, #bookingModal select, #bookingModal textarea'
  );
  inputs.forEach(el => {
    el.readOnly  = readonly;
    el.disabled  = readonly;
  });
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.disabled = readonly;
    btn.style.pointerEvents = readonly ? 'none' : '';
    btn.style.opacity = readonly ? '0.65' : '';
  });
  // Visual cue on the modal
  const modal = document.getElementById('bookingModal');
  modal.classList.toggle('bk-modal--readonly', readonly);
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
  const isNextDay    = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
  const durationMins = _tourType === 'Over-Night' ? 21*60 : 10*60;
  const nd           = nextDay(_bkYear, _bkMonth, _bkDay);

  document.getElementById('bkCheckoutDisplay').textContent =
    isNextDay ? nd.label : formatDateLabel(_bkYear, _bkMonth, _bkDay);

  if (ci) {
    const co = addMinutesToTime(ci, durationMins);
    document.getElementById('bkCheckoutTime').textContent = to12hr(co);
    document.getElementById('bkDuration').textContent =
      `${durationMins/60} hrs (${to12hr(ci)} → ${to12hr(co)})`;
  } else {
    document.getElementById('bkCheckoutTime').textContent =
      `(+${durationMins/60} hrs from check-in time)`;
    document.getElementById('bkDuration').textContent = `${durationMins/60} hrs`;
  }
}

/* ══════════════════════════════════════
   TOUR TYPE BUTTONS
══════════════════════════════════════ */
function setupTourButtons() {
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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
  err('bkGuestName',  'errGuestName',  !getVal('bkGuestName').trim()  ? 'Required.' : '');
  const email = getVal('bkGuestEmail').trim();
  err('bkGuestEmail', 'errGuestEmail',
    !email ? 'Required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Invalid email.' : '');
  err('bkGuestPhone', 'errGuestPhone', !getVal('bkGuestPhone').trim() ? 'Required.' : '');
  err('bkPax',        'errPax',        parseInt(getVal('bkPax')) < 1  ? 'Min 1.' : '');
  err('bkPaymentDate','errPaymentDate',!getVal('bkPaymentDate')       ? 'Required.' : '');
  err('bkTotal',      'errTotal',      parseFloat(getVal('bkTotal')) <= 0 ? 'Required.' : '');
  err('bkDownpayment','errDownpayment',getVal('bkDownpayment') === ''  ? 'Required.' : '');
  err('bkCheckinTime','errCheckinTime',!getVal('bkCheckinTime')        ? 'Required.' : '');
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
  const isNextDay    = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
  const durationMins = _tourType === 'Over-Night' ? 21*60 : 10*60;
  const coTime       = addMinutesToTime(ciTime, durationMins);

  const bookingJSON = compileBookingJSON(
    pax, extraPax, pets, total, downpayment,
    ciTime, coTime, isNextDay, durationMins
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
      console.log('📝 Updating Firebase doc:', fbId, dbRow);
      await FB.updateById(fbId, dbRow);
      fbSaved = true;
    } else {
      console.log('📤 Inserting to Firebase:', dbRow);
      const result = await FB.insert(dbRow);
      fbId    = result?.[0]?.id ?? null;
      fbSaved = true;
    }
  } catch (fbErr) {
    console.error('❌ Firebase error:', fbErr.message);
  }

  // Update local cache
  const entry = { ...bookingJSON, sbId: fbId };
  if (isEdit) {
    // Replace the existing entry in cache
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
    empty.className = 'bk-list-empty';
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
  document.getElementById('bkListAddNew').onclick = () => {
    closeBookingList();
    openBookingForm(key, day, month, year, color);
  };
  document.getElementById('bkListAddNew').style.background =
    `linear-gradient(135deg, ${color.accent}, ${color.light})`;
  document.getElementById('bkListOverlay').classList.add('open');
}

function closeBookingList() {
  document.getElementById('bkListOverlay').classList.remove('open');
}

/* ══════════════════════════════════════
   SUMMARY CARD  (with Edit / View / Delete)
══════════════════════════════════════ */
function buildSummaryCard(b, key, idx, color, day, month, year, onDelete) {
  const card = document.createElement('div');
  card.className = 'bk-summary-card';

  const name     = b.guest?.name       || b.guestName    || '—';
  const email    = b.guest?.email      || b.guestEmail   || '—';
  const phone    = b.guest?.phone      || b.guestPhone   || '—';
  const totalPax = b.guest?.totalPax   || b.totalPax     || '—';
  const pets     = b.guest?.pets       ?? b.pets         ?? 0;
  const total    = b.payment?.total    ?? b.total        ?? 0;
  const balance  = b.payment?.balance  ?? b.balance      ?? 0;
  const tourType = b.booking?.tourType || b.tourType     || '—';
  const ciTime   = b.booking?.checkinTime  || b.checkinTime  || '';
  const coTime   = b.booking?.checkoutTime || b.checkoutTime || '';
  const coLabel  = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const fbId     = b.sbId || null;

  // ── Header row ──
  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';

  const nameEl = document.createElement('div');
  nameEl.className = 'bk-summary-name';
  nameEl.textContent = name;

  const badge = document.createElement('span');
  badge.className = 'bk-summary-badge';
  badge.textContent = tourType;
  badge.style.background = color.accent;

  hdr.append(nameEl, badge);
  card.appendChild(hdr);

  // ── Info rows ──
  const rows = [
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
      el.className = 'bk-summary-item';
      el.textContent = text;
      row.appendChild(el);
    });
    card.appendChild(row);
  });

  // ── Action buttons row ──
  const actions = document.createElement('div');
  actions.className = 'bk-card-actions';

  // View button
  const viewBtn = document.createElement('button');
  viewBtn.className = 'bk-card-btn bk-card-btn--view';
  viewBtn.innerHTML = '👁 View';
  viewBtn.addEventListener('click', () => {
    closeBookingList();
    openViewForm(b, key, day, month, year, color);
  });

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'bk-card-btn bk-card-btn--edit';
  editBtn.innerHTML = '✏️ Edit';
  editBtn.style.setProperty('--edit-color', color.accent);
  editBtn.addEventListener('click', () => {
    closeBookingList();
    openEditForm(b, key, day, month, year, color);
  });

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'bk-card-btn bk-card-btn--delete';
  delBtn.innerHTML = '🗑 Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete booking for ${name}?`)) return;
    if (fbId) {
      try { await FB.deleteById(fbId); }
      catch(e) { console.error('Delete error:', e.message); }
    }
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
    const card = cell.closest('.month-card');
    if (!card) return;
    const mEl  = card.querySelector('.month-name');
    if (!mEl) return;
    const month = MONTH_NAMES.indexOf(mEl.textContent);
    const key   = toKey(AppState.year, month, parseInt(numEl.textContent));
    cell.classList.toggle('has-booking', !!(Bookings[key]?.length > 0));
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
  document.getElementById('bkCheckinTime').addEventListener('change', calcCheckout);
  setupTourButtons();
}