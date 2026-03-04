// booking.js — booking form logic

const BOOKING_KEY = 'cal2026_bookings_v1';

/* ══════════════════════════════════════
   STORAGE
══════════════════════════════════════ */
function loadBookings() {
  try {
    const raw = localStorage.getItem(BOOKING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveBookings(data) {
  try { localStorage.setItem(BOOKING_KEY, JSON.stringify(data)); }
  catch(e) { console.warn('Booking storage error:', e); }
}

// bookings stored as { 'YYYY-MM-DD': [ {...bookingObj}, ... ] }
const Bookings = loadBookings();

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let _bkKey    = null;   // date key e.g. "2026-03-04"
let _bkDay    = null;
let _bkMonth  = null;
let _bkYear   = null;
let _bkColor  = null;
let _tourType = null;   // "Day Tour" | "Night Tour" | "Over-Night"

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function pad2(n) { return String(n).padStart(2, '0'); }

function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${pad2(nh)}:${pad2(nm)}`;
}

function to12hr(hhmm) {
  if (!hhmm || hhmm === '—') return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hh     = h % 12 || 12;
  return `${hh}:${pad2(m)} ${ampm}`;
}

function nextDay(year, month, day) {
  const d = new Date(year, month, day + 1);
  return {
    year:  d.getFullYear(),
    month: d.getMonth(),
    day:   d.getDate(),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    key:   toKey(d.getFullYear(), d.getMonth(), d.getDate()),
  };
}

function formatDateLabel(year, month, day) {
  const d = new Date(year, month, day);
  return `${MONTH_NAMES[month]} ${day}, ${year} (${DAY_NAMES[d.getDay()]})`;
}

function showToast(msg, duration = 2800) {
  const toast = document.getElementById('bkToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}


/* ══════════════════════════════════════
   DATE EVENT INFO
   Returns { type, icon, label } for any date.
   type: "holiday" | "weekend" | "weekday"
══════════════════════════════════════ */
function getDateEventInfo(year, month, day) {
  const key = toKey(year, month, day);
  const dow = new Date(year, month, day).getDay(); // 0=Sun 6=Sat

  // Check holidays from AppState.events (loaded from data.js DEFAULT_EVENTS + user events)
  const events = AppState.events[key] || [];
  if (events.length > 0) {
    // Strip emoji from first event name for cleaner label
    const rawLabel = events[0];
    return { type: 'holiday', icon: '🎉', label: rawLabel };
  }

  // Weekend check
  if (dow === 0 || dow === 6) {
    const dayName = dow === 0 ? 'Sunday' : 'Saturday';
    return { type: 'weekend', icon: '🌅', label: `Weekend — ${dayName}` };
  }

  // Weekday
  return { type: 'weekday', icon: '📅', label: `Weekday — ${DAY_NAMES[dow]}` };
}

/* ══════════════════════════════════════
   OPEN BOOKING FORM
══════════════════════════════════════ */
function openBookingForm(key, day, month, year, color) {
  _bkKey   = key;
  _bkDay   = day;
  _bkMonth = month;
  _bkYear  = year;
  _bkColor = color;
  _tourType = null;

  // Set header
  document.getElementById('bkColorPill').style.background =
    `linear-gradient(180deg, ${color.accent}, ${color.light})`;
  document.getElementById('bkHeaderDate').textContent = formatDateLabel(year, month, day);

  // Set event badge (Holiday / Weekend / Weekday)
  const evInfo  = getDateEventInfo(year, month, day);
  const badge   = document.getElementById('bkEventBadge');
  const iconEl  = document.getElementById('bkEventIcon');
  const labelEl = document.getElementById('bkEventLabel');
  iconEl.textContent  = evInfo.icon;
  labelEl.textContent = evInfo.label;
  badge.className = 'bk-event-badge is-' + evInfo.type;

  // Reset form
  resetBookingForm();

  // Pre-fill check-in date display
  document.getElementById('bkCheckinDisplay').textContent = formatDateLabel(year, month, day);

  // Pre-fill payment date to today
  const t = AppState.today;
  document.getElementById('bkPaymentDate').value =
    `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`;

  // Reset tour buttons
  document.querySelectorAll('.bk-tour-btn').forEach(b => b.classList.remove('selected'));

  // Reset checkout fields
  document.getElementById('bkCheckoutDisplay').textContent = '—';
  document.getElementById('bkCheckoutTime').textContent    = '—';
  document.getElementById('bkDuration').textContent        = '—';

  // Apply accent color to section titles
  const accent = color.accent;
  document.querySelectorAll('.bk-section-title').forEach(el => {
    el.style.color       = accent;
    el.style.borderColor = color.light;
  });
  document.getElementById('bkBtnSave').style.background =
    `linear-gradient(135deg, ${accent}, ${color.light})`;

  document.getElementById('bookingOverlay').classList.add('open');
}

function closeBookingForm() {
  document.getElementById('bookingOverlay').classList.remove('open');
}

function resetBookingForm() {
  ['bkGuestName','bkGuestEmail','bkGuestPhone',
   'bkPax','bkExtraPax','bkPets',
   'bkTotal','bkDownpayment','bkCheckinTime'].forEach(id => {
    document.getElementById(id).value = '';
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('bk-error'); }
  });
  ['errGuestName','errGuestEmail','errGuestPhone','errPax',
   'errPaymentDate','errTotal','errDownpayment','errCheckinTime','errTourType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  document.getElementById('bkTotalPax').textContent  = '—';
  document.getElementById('bkBalance').textContent   = '—';
  document.getElementById('bkBalance').className     = 'bk-auto bk-balance';
  _tourType = null;
}

/* ══════════════════════════════════════
   LIVE CALCULATIONS
══════════════════════════════════════ */
function calcTotalPax() {
  const pax   = parseInt(document.getElementById('bkPax').value) || 0;
  const extra = parseInt(document.getElementById('bkExtraPax').value) || 0;
  const total = pax + extra;
  document.getElementById('bkTotalPax').textContent = total > 0 ? total : '—';
}

function calcBalance() {
  const total = parseFloat(document.getElementById('bkTotal').value) || 0;
  const dp    = parseFloat(document.getElementById('bkDownpayment').value) || 0;
  const el    = document.getElementById('bkBalance');
  if (!total && !dp) { el.textContent = '—'; el.className = 'bk-auto bk-balance'; return; }
  const bal   = total - dp;
  el.textContent = `₱ ${bal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  el.className   = 'bk-auto bk-balance ' + (bal < 0 ? 'negative' : bal === 0 ? 'zero' : 'positive');
}

function calcCheckout() {
  if (!_tourType) return;

  const checkinVal = document.getElementById('bkCheckinTime').value; // "HH:MM"

  // Determine duration minutes
  // Day Tour:     10 hours = 600 min
  // Night Tour:   21 hours from check-in → check-out next day
  // Over-Night:   21 hours from check-in → check-out next day
  const isOvernight = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
  const durationMins = isOvernight ? 21 * 60 : 10 * 60;

  // Check-out date
  const nd = nextDay(_bkYear, _bkMonth, _bkDay);

  if (isOvernight) {
    document.getElementById('bkCheckoutDisplay').textContent = nd.label;
  } else {
    // Day tour: same day check-out
    document.getElementById('bkCheckoutDisplay').textContent = formatDateLabel(_bkYear, _bkMonth, _bkDay);
  }

  // Check-out time
  if (checkinVal) {
    const checkoutHHMM = addMinutesToTime(checkinVal, durationMins);
    document.getElementById('bkCheckoutTime').textContent = to12hr(checkoutHHMM);
    document.getElementById('bkDuration').textContent =
      `${durationMins / 60} hrs (${to12hr(checkinVal)} → ${to12hr(checkoutHHMM)})`;
  } else {
    // Show default checkout times based on tour type
    if (_tourType === 'Day Tour') {
      document.getElementById('bkCheckoutTime').textContent = '(+10 hrs from check-in time)';
    } else {
      document.getElementById('bkCheckoutTime').textContent = '(+21 hrs from check-in time)';
    }
    document.getElementById('bkDuration').textContent =
      isOvernight ? '21 hrs (overnight)' : '10 hrs (day tour)';
  }
}

/* ══════════════════════════════════════
   TOUR TYPE SELECTION
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

  function setErr(fieldId, errId, msg) {
    const el = document.getElementById(fieldId);
    const er = document.getElementById(errId);
    if (msg) {
      er.textContent = msg;
      el.classList.add('bk-error');
      ok = false;
    } else {
      er.textContent = '';
      el.classList.remove('bk-error');
    }
  }

  const name  = document.getElementById('bkGuestName').value.trim();
  const email = document.getElementById('bkGuestEmail').value.trim();
  const phone = document.getElementById('bkGuestPhone').value.trim();
  const pax   = document.getElementById('bkPax').value.trim();
  const payDt = document.getElementById('bkPaymentDate').value.trim();
  const total = document.getElementById('bkTotal').value.trim();
  const dp    = document.getElementById('bkDownpayment').value.trim();
  const ciTime = document.getElementById('bkCheckinTime').value.trim();

  setErr('bkGuestName',  'errGuestName',  !name  ? 'Guest name is required.' : '');
  setErr('bkGuestEmail', 'errGuestEmail',
    !email ? 'Email is required.' :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '');
  setErr('bkGuestPhone', 'errGuestPhone', !phone ? 'Phone number is required.' : '');
  setErr('bkPax',        'errPax',        !pax || parseInt(pax) < 1 ? 'Pax must be at least 1.' : '');
  setErr('bkPaymentDate','errPaymentDate',!payDt ? 'Date of payment is required.' : '');
  setErr('bkTotal',      'errTotal',      !total || parseFloat(total) <= 0 ? 'Total amount is required.' : '');
  setErr('bkDownpayment','errDownpayment',dp === '' ? 'Downpayment is required.' : '');
  setErr('bkCheckinTime','errCheckinTime',!ciTime ? 'Check-in time is required.' : '');

  // Tour type
  if (!_tourType) {
    document.getElementById('errTourType').textContent = 'Please select a tour type.';
    ok = false;
  } else {
    document.getElementById('errTourType').textContent = '';
  }

  return ok;
}

/* ══════════════════════════════════════
   SAVE BOOKING
══════════════════════════════════════ */
function saveBooking() {
  if (!validate()) return;

  const pax   = parseInt(document.getElementById('bkPax').value) || 0;
  const extra = parseInt(document.getElementById('bkExtraPax').value) || 0;
  const total = parseFloat(document.getElementById('bkTotal').value) || 0;
  const dp    = parseFloat(document.getElementById('bkDownpayment').value) || 0;
  const ciTime = document.getElementById('bkCheckinTime').value;

  const isOvernight = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
  const durationMins = isOvernight ? 21 * 60 : 10 * 60;
  const coTime = addMinutesToTime(ciTime, durationMins);

  const nd = nextDay(_bkYear, _bkMonth, _bkDay);

  const booking = {
    id:            Date.now(),
    guestName:     document.getElementById('bkGuestName').value.trim(),
    guestEmail:    document.getElementById('bkGuestEmail').value.trim(),
    guestPhone:    document.getElementById('bkGuestPhone').value.trim(),
    pax,
    extraPax:      parseInt(document.getElementById('bkExtraPax').value) || 0,
    totalPax:      pax + extra,
    pets:          parseInt(document.getElementById('bkPets').value) || 0,
    paymentDate:   document.getElementById('bkPaymentDate').value,
    paymentMode:   'BDO Bank Transfer',
    total,
    downpayment:   dp,
    balance:       total - dp,
    checkinDate:   _bkKey,
    checkinDateLabel: formatDateLabel(_bkYear, _bkMonth, _bkDay),
    tourType:      _tourType,
    checkoutDate:  isOvernight ? nd.key : _bkKey,
    checkoutDateLabel: isOvernight ? nd.label : formatDateLabel(_bkYear, _bkMonth, _bkDay),
    checkinTime:   ciTime,
    checkoutTime:  coTime,
    createdAt:     new Date().toISOString(),
  };

  if (!Bookings[_bkKey]) Bookings[_bkKey] = [];
  Bookings[_bkKey].push(booking);
  saveBookings(Bookings);

  closeBookingForm();
  refreshMonth(_bkMonth);
  showToast(`✅ Booking saved for ${booking.guestName}!`);
}

/* ══════════════════════════════════════
   BOOKING LIST (view saved bookings)
══════════════════════════════════════ */
function openBookingList(key, day, month, year, color) {
  const list = Bookings[key] || [];

  document.getElementById('bkListTitle').textContent =
    `${MONTH_NAMES[month]} ${day}, ${year}`;

  const body = document.getElementById('bkListBody');
  body.innerHTML = '';

  const inner = document.createElement('div');
  inner.className = 'bk-list-body-inner';

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'bk-list-empty';
    empty.textContent = 'No bookings yet for this date.';
    inner.appendChild(empty);
  } else {
    list.forEach((b, idx) => {
      const card = buildSummaryCard(b, key, idx, color, () => {
        openBookingList(key, day, month, year, color); // refresh
        refreshMonth(month);
      });
      inner.appendChild(card);
    });
  }

  body.appendChild(inner);

  // "Add new booking" button
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

function buildSummaryCard(b, key, idx, color, onDelete) {
  const card = document.createElement('div');
  card.className = 'bk-summary-card';

  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';

  const name = document.createElement('div');
  name.className   = 'bk-summary-name';
  name.textContent = b.guestName;

  const badge = document.createElement('span');
  badge.className      = 'bk-summary-badge';
  badge.textContent    = b.tourType;
  badge.style.background = color.accent;

  hdr.appendChild(name);
  hdr.appendChild(badge);

  const rows = [
    [`📧 ${b.guestEmail}`, `📞 ${b.guestPhone}`],
    [`👥 ${b.totalPax} Pax`, b.pets ? `🐾 ${b.pets} Pets` : null, `💳 ₱${b.total.toLocaleString()}`],
    [`🕐 ${to12hr(b.checkinTime)} → ${to12hr(b.checkoutTime)}`, `📅 Out: ${b.checkoutDateLabel}`],
    [`💰 Balance: ₱${b.balance.toLocaleString('en-PH',{minimumFractionDigits:2})}`],
  ];

  rows.forEach(rowItems => {
    const row = document.createElement('div');
    row.className = 'bk-summary-row';
    rowItems.filter(Boolean).forEach(text => {
      const item = document.createElement('div');
      item.className   = 'bk-summary-item';
      item.textContent = text;
      row.appendChild(item);
    });
    card.appendChild(row);
  });

  // Delete button
  const del = document.createElement('button');
  del.className   = 'bk-summary-del';
  del.textContent = '×';
  del.title       = 'Delete booking';
  del.addEventListener('click', () => {
    if (confirm(`Delete booking for ${b.guestName}?`)) {
      Bookings[key].splice(idx, 1);
      if (!Bookings[key].length) delete Bookings[key];
      saveBookings(Bookings);
      onDelete();
      showToast('🗑 Booking deleted.');
    }
  });

  card.insertBefore(hdr, card.firstChild);
  card.appendChild(del);
  return card;
}


/* ══════════════════════════════════════
   CALENDAR INTEGRATION
   openModal is called by calendar.js cell clicks.
══════════════════════════════════════ */
function openModal(key, day, month, year, color) {
  const existing = Bookings[key] || [];
  if (existing.length > 0) {
    openBookingList(key, day, month, year, color);
  } else {
    openBookingForm(key, day, month, year, color);
  }
}

/* ══════════════════════════════════════
   BOOKING INDICATORS ON CELLS
   Called from app.js after renderAllMonths(),
   safe because buildMonthCard already ran.
══════════════════════════════════════ */
function applyBookingIndicators() {
  const grid = document.getElementById('yearGrid');
  if (!grid) return;
  grid.querySelectorAll('.day-cell:not(.other-month)').forEach(cell => {
    const numEl = cell.querySelector('.day-num');
    if (!numEl) return;
    const card = cell.closest('.month-card');
    if (!card) return;
    const monthNameEl = card.querySelector('.month-name');
    if (!monthNameEl) return;
    const month = MONTH_NAMES.indexOf(monthNameEl.textContent);
    const day   = parseInt(numEl.textContent);
    const key   = toKey(AppState.year, month, day);
    if (Bookings[key] && Bookings[key].length > 0) {
      cell.classList.add('has-booking');
    }
  });
}

/* ══════════════════════════════════════
   SETUP LISTENERS
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