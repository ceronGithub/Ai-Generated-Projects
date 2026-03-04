// booking.js — booking form logic + Supabase integration

const BOOKING_KEY = 'cal2026_bookings_v1';

/* ══════════════════════════════════════
   LOCAL STORAGE FALLBACK
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

// In-memory bookings cache: { 'YYYY-MM-DD': [ bookingObj, ... ] }
const Bookings = loadBookingsLocal();

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let _bkKey    = null;
let _bkDay    = null;
let _bkMonth  = null;
let _bkYear   = null;
let _bkColor  = null;
let _tourType = null;

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
══════════════════════════════════════ */
function getDateEventInfo(year, month, day) {
  const key    = toKey(year, month, day);
  const dow    = new Date(year, month, day).getDay();
  const events = AppState.events[key] || [];
  if (events.length > 0) {
    return { type: 'holiday', icon: '🎉', label: events[0] };
  }
  if (dow === 0 || dow === 6) {
    return { type: 'weekend', icon: '🌅', label: `Weekend — ${dow === 0 ? 'Sunday' : 'Saturday'}` };
  }
  return { type: 'weekday', icon: '📅', label: `Weekday — ${DAY_NAMES[dow]}` };
}

/* ══════════════════════════════════════
   COMPILE FULL BOOKING JSON
   Single structured payload — stored as
   raw_json in Supabase and used locally.
══════════════════════════════════════ */
function compileBookingJSON(fields) {
  const { pax, extraPax, pets, total, downpayment,
          ciTime, coTime, isNextDay, durationMins } = fields;

  const nd = nextDay(_bkYear, _bkMonth, _bkDay);

  return {
    // ── Meta ──────────────────────────
    id:        Date.now(),
    createdAt: new Date().toISOString(),
    dateKey:   _bkKey,

    // ── Guest ─────────────────────────
    guest: {
      name:     document.getElementById('bkGuestName').value.trim(),
      email:    document.getElementById('bkGuestEmail').value.trim(),
      phone:    document.getElementById('bkGuestPhone').value.trim(),
      pax,
      extraPax,
      totalPax: pax + extraPax,
      pets,
    },

    // ── Payment ───────────────────────
    payment: {
      date:        document.getElementById('bkPaymentDate').value,
      mode:        'BDO Bank Transfer',
      total,
      downpayment,
      balance:     total - downpayment,
    },

    // ── Booking ───────────────────────
    booking: {
      tourType:           _tourType,
      checkinDate:        _bkKey,
      checkinDateLabel:   formatDateLabel(_bkYear, _bkMonth, _bkDay),
      checkoutDate:       isNextDay ? nd.key  : _bkKey,
      checkoutDateLabel:  isNextDay ? nd.label : formatDateLabel(_bkYear, _bkMonth, _bkDay),
      checkinTime:        ciTime,
      checkinTime12:      to12hr(ciTime),
      checkoutTime:       coTime,
      checkoutTime12:     to12hr(coTime),
      durationHrs:        durationMins / 60,
    },

    // ── Day info ──────────────────────
    dayInfo: getDateEventInfo(_bkYear, _bkMonth, _bkDay),
  };
}

/* ══════════════════════════════════════
   OPEN BOOKING FORM
══════════════════════════════════════ */
function openBookingForm(key, day, month, year, color) {
  _bkKey    = key;
  _bkDay    = day;
  _bkMonth  = month;
  _bkYear   = year;
  _bkColor  = color;
  _tourType = null;

  document.getElementById('bkColorPill').style.background =
    `linear-gradient(180deg, ${color.accent}, ${color.light})`;
  document.getElementById('bkHeaderDate').textContent = formatDateLabel(year, month, day);

  const evInfo  = getDateEventInfo(year, month, day);
  const badge   = document.getElementById('bkEventBadge');
  document.getElementById('bkEventIcon').textContent  = evInfo.icon;
  document.getElementById('bkEventLabel').textContent = evInfo.label;
  badge.className = 'bk-event-badge is-' + evInfo.type;

  resetBookingForm();

  document.getElementById('bkCheckinDisplay').textContent = formatDateLabel(year, month, day);

  const t = AppState.today;
  document.getElementById('bkPaymentDate').value =
    `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`;

  document.querySelectorAll('.bk-tour-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('bkCheckoutDisplay').textContent = '—';
  document.getElementById('bkCheckoutTime').textContent    = '—';
  document.getElementById('bkDuration').textContent        = '—';

  const accent = color.accent;
  document.querySelectorAll('.bk-section-title').forEach(el => {
    el.style.color = accent; el.style.borderColor = color.light;
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
  const pax   = parseInt(document.getElementById('bkPax').value) || 0;
  const extra = parseInt(document.getElementById('bkExtraPax').value) || 0;
  document.getElementById('bkTotalPax').textContent = (pax + extra) || '—';
}

function calcBalance() {
  const total = parseFloat(document.getElementById('bkTotal').value) || 0;
  const dp    = parseFloat(document.getElementById('bkDownpayment').value) || 0;
  const el    = document.getElementById('bkBalance');
  if (!total && !dp) { el.textContent = '—'; el.className = 'bk-auto bk-balance'; return; }
  const bal = total - dp;
  el.textContent = `₱ ${bal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  el.className   = 'bk-auto bk-balance ' + (bal < 0 ? 'negative' : bal === 0 ? 'zero' : 'positive');
}

function calcCheckout() {
  if (!_tourType) return;
  const checkinVal   = document.getElementById('bkCheckinTime').value;
  const isNextDay    = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
  const durationMins = _tourType === 'Over-Night' ? 21 * 60 : 10 * 60;
  const nd           = nextDay(_bkYear, _bkMonth, _bkDay);

  document.getElementById('bkCheckoutDisplay').textContent =
    isNextDay ? nd.label : formatDateLabel(_bkYear, _bkMonth, _bkDay);

  if (checkinVal) {
    const coHHMM = addMinutesToTime(checkinVal, durationMins);
    document.getElementById('bkCheckoutTime').textContent = to12hr(coHHMM);
    document.getElementById('bkDuration').textContent =
      `${durationMins / 60} hrs (${to12hr(checkinVal)} → ${to12hr(coHHMM)})`;
  } else {
    document.getElementById('bkCheckoutTime').textContent =
      _tourType === 'Over-Night' ? '(+21 hrs from check-in time)' : '(+10 hrs from check-in time)';
    document.getElementById('bkDuration').textContent =
      _tourType === 'Over-Night' ? '21 hrs (overnight)' : '10 hrs';
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
  function setErr(fieldId, errId, msg) {
    const el = document.getElementById(fieldId);
    const er = document.getElementById(errId);
    if (msg) { er.textContent = msg; if (el) el.classList.add('bk-error'); ok = false; }
    else      { er.textContent = '';  if (el) el.classList.remove('bk-error'); }
  }
  setErr('bkGuestName',   'errGuestName',
    !document.getElementById('bkGuestName').value.trim() ? 'Guest name is required.' : '');
  const email = document.getElementById('bkGuestEmail').value.trim();
  setErr('bkGuestEmail',  'errGuestEmail',
    !email ? 'Email is required.' :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email.' : '');
  setErr('bkGuestPhone',  'errGuestPhone',
    !document.getElementById('bkGuestPhone').value.trim() ? 'Phone number is required.' : '');
  const pax = document.getElementById('bkPax').value.trim();
  setErr('bkPax',         'errPax',
    !pax || parseInt(pax) < 1 ? 'Pax must be at least 1.' : '');
  setErr('bkPaymentDate', 'errPaymentDate',
    !document.getElementById('bkPaymentDate').value.trim() ? 'Date of payment is required.' : '');
  const total = document.getElementById('bkTotal').value.trim();
  setErr('bkTotal',       'errTotal',
    !total || parseFloat(total) <= 0 ? 'Total amount is required.' : '');
  setErr('bkDownpayment', 'errDownpayment',
    document.getElementById('bkDownpayment').value.trim() === '' ? 'Downpayment is required.' : '');
  setErr('bkCheckinTime', 'errCheckinTime',
    !document.getElementById('bkCheckinTime').value.trim() ? 'Check-in time is required.' : '');
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
   1. Compile full JSON
   2. Push to Supabase (raw_json column + flat cols)
   3. Save to localStorage as backup
══════════════════════════════════════ */
async function saveBooking() {
  if (!validate()) return;

  const btn = document.getElementById('bkBtnSave');
  btn.disabled  = true;
  btn.innerHTML = '<span>Saving…</span>';

  try {
    const pax         = parseInt(document.getElementById('bkPax').value) || 0;
    const extraPax    = parseInt(document.getElementById('bkExtraPax').value) || 0;
    const pets        = parseInt(document.getElementById('bkPets').value) || 0;
    const total       = parseFloat(document.getElementById('bkTotal').value) || 0;
    const downpayment = parseFloat(document.getElementById('bkDownpayment').value) || 0;
    const ciTime      = document.getElementById('bkCheckinTime').value;
    const isNextDay   = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
    const durationMins = _tourType === 'Over-Night' ? 21 * 60 : 10 * 60;
    const coTime      = addMinutesToTime(ciTime, durationMins);

    // ── Step 1: Compile structured JSON ──
    const bookingJSON = compileBookingJSON({
      pax, extraPax, pets, total, downpayment,
      ciTime, coTime, isNextDay, durationMins,
    });

    // ── Step 2: Flat DB row for Supabase columns ──
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
      raw_json:            bookingJSON,   // ← full JSON blob
    };

    // ── Step 3: Save to Supabase ──
    let sbId = null;
    if (_dbOnline) {
      try {
        const result = await SB.insert(dbRow);
        sbId = result[0]?.id ?? null;
        console.log('☁️ Saved to Supabase id:', sbId);
      } catch(e) {
        console.warn('⚠️ Supabase save failed, saving locally.', e.message);
        setDbStatus(false);
      }
    }

    // ── Step 4: Always save to localStorage ──
    const localEntry = { ...bookingJSON, sbId };
    if (!Bookings[_bkKey]) Bookings[_bkKey] = [];
    Bookings[_bkKey].push(localEntry);
    saveBookingsLocal(Bookings);

    closeBookingForm();
    refreshMonth(_bkMonth);

    const dest = sbId ? '☁️ Supabase + 💾 Local' : '💾 Local only';
    showToast(`✅ Saved: ${bookingJSON.guest.name} (${dest})`);

  } catch(err) {
    console.error('Save error:', err);
    showToast('❌ Save failed. Check console.');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<span>Confirm Booking</span><span class="bk-btn-arrow">→</span>';
  }
}

/* ══════════════════════════════════════
   BOOKING LIST
══════════════════════════════════════ */
function openBookingList(key, day, month, year, color) {
  const list = Bookings[key] || [];
  document.getElementById('bkListTitle').textContent = `${MONTH_NAMES[month]} ${day}, ${year}`;

  const body  = document.getElementById('bkListBody');
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
      inner.appendChild(buildSummaryCard(b, key, idx, color, () => {
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

function buildSummaryCard(b, key, idx, color, onDelete) {
  const card = document.createElement('div');
  card.className = 'bk-summary-card';

  // Resolve both old flat shape and new nested JSON shape
  const guestName   = b.guest?.name       || b.guestName       || '—';
  const guestEmail  = b.guest?.email      || b.guestEmail      || '—';
  const guestPhone  = b.guest?.phone      || b.guestPhone      || '—';
  const totalPax    = b.guest?.totalPax   || b.totalPax        || '—';
  const pets        = b.guest?.pets       ?? b.pets            ?? 0;
  const total       = b.payment?.total    ?? b.total           ?? 0;
  const balance     = b.payment?.balance  ?? b.balance         ?? 0;
  const tourType    = b.booking?.tourType || b.tourType        || '—';
  const ciTime      = b.booking?.checkinTime  || b.checkinTime  || '';
  const coTime      = b.booking?.checkoutTime || b.checkoutTime || '';
  const coDateLabel = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const sbId        = b.sbId || null;

  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';
  const nameEl = document.createElement('div');
  nameEl.className   = 'bk-summary-name';
  nameEl.textContent = guestName;
  const badgeEl = document.createElement('span');
  badgeEl.className        = 'bk-summary-badge';
  badgeEl.textContent      = tourType;
  badgeEl.style.background = color.accent;
  hdr.appendChild(nameEl);
  hdr.appendChild(badgeEl);

  const rows = [
    [`📧 ${guestEmail}`, `📞 ${guestPhone}`],
    [`👥 ${totalPax} Pax`, pets ? `🐾 ${pets} Pets` : null, `💳 ₱${Number(total).toLocaleString()}`],
    [`🕐 ${to12hr(ciTime)} → ${to12hr(coTime)}`, `📅 Out: ${coDateLabel}`],
    [`💰 Balance: ₱${Number(balance).toLocaleString('en-PH', { minimumFractionDigits:2 })}`],
    sbId ? [`🔗 DB ID: ${sbId}`] : null,
  ];

  rows.filter(Boolean).forEach(rowItems => {
    const row = document.createElement('div');
    row.className = 'bk-summary-row';
    rowItems.filter(Boolean).forEach(text => {
      const item = document.createElement('div');
      item.className = 'bk-summary-item'; item.textContent = text;
      row.appendChild(item);
    });
    card.appendChild(row);
  });

  const del = document.createElement('button');
  del.className   = 'bk-summary-del';
  del.textContent = '×';
  del.title       = 'Delete booking';
  del.addEventListener('click', async () => {
    if (!confirm(`Delete booking for ${guestName}?`)) return;
    if (_dbOnline && sbId) {
      try { await SB.deleteById(sbId); }
      catch(e) { console.warn('⚠️ Supabase delete failed:', e.message); }
    }
    Bookings[key].splice(idx, 1);
    if (!Bookings[key].length) delete Bookings[key];
    saveBookingsLocal(Bookings);
    onDelete();
    showToast('🗑 Booking deleted.');
  });

  card.insertBefore(hdr, card.firstChild);
  card.appendChild(del);
  return card;
}

/* ══════════════════════════════════════
   CALENDAR INTEGRATION
══════════════════════════════════════ */
function openModal(key, day, month, year, color) {
  const existing = Bookings[key] || [];
  if (existing.length > 0) {
    openBookingList(key, day, month, year, color);
  } else {
    openBookingForm(key, day, month, year, color);
  }
}

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