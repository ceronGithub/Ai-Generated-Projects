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
   One structured object — also stored as
   raw_json stored in Firebase for future queries.
══════════════════════════════════════ */
function compileBookingJSON(pax, extraPax, pets, total, downpayment, ciTime, coTime, isNextDay, durationMins, ratePerHead, ratePerPet, baseTotal, headCharge, petCharge) {
  ratePerHead = ratePerHead || 0; ratePerPet = ratePerPet || 0;
  baseTotal   = baseTotal   || total; headCharge = headCharge || 0; petCharge = petCharge || 0;
  const nd = nextDay(_bkYear, _bkMonth, _bkDay);
  return {
    id:        Date.now(),
    createdAt: new Date().toISOString(),
    dateKey:   _bkKey,
    guest: {
      name:     getVal('bkGuestName').trim(),
      email:    getVal('bkGuestEmail').trim(),
      phone:    getVal('bkGuestPhone').trim(),
      pax, extraPax, totalPax: pax + extraPax, pets,
      ratePerHead, ratePerPet,
    },
    payment: {
      date:        getVal('bkPaymentDate'),
      mode:        'BDO Bank Transfer',
      baseTotal, headCharge, petCharge,
      additionalCharges: headCharge + petCharge,
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

  document.querySelectorAll('.bk-tour-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('bkCheckoutDisplay').textContent = '—';
  document.getElementById('bkCheckoutTime').textContent    = '—';
  document.getElementById('bkDuration').textContent        = '—';

  document.querySelectorAll('.bk-section-title').forEach(el => {
    el.style.color = color.accent; el.style.borderColor = color.light;
  });
  document.getElementById('bkBtnSave').style.background =
    `linear-gradient(135deg, ${color.accent}, ${color.light})`;

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
  document.getElementById('bkAdditional').textContent   = '—';
  document.getElementById('bkFinalTotal').textContent   = '—';
  document.getElementById('bkAdditionalWrap').style.display  = 'none';
  document.getElementById('bkFinalTotalWrap').style.display  = 'none';
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
  const baseTotal    = parseFloat(getVal('bkTotal'))        || 0;
  const dp           = parseFloat(getVal('bkDownpayment'))  || 0;
  const totalPax     = (parseInt(getVal('bkPax'))||0) + (parseInt(getVal('bkExtraPax'))||0);
  const ratePerHead  = parseFloat(getVal('bkRatePerHead'))  || 0;
  const totalPets    = parseInt(getVal('bkPets'))            || 0;
  const ratePerPet   = parseFloat(getVal('bkRatePerPet'))   || 0;

  // Calculate additional charges
  const headCharge   = totalPax  > 0 && ratePerHead > 0 ? totalPax  * ratePerHead : 0;
  const petCharge    = totalPets > 0 && ratePerPet  > 0 ? totalPets * ratePerPet  : 0;
  const additional   = headCharge + petCharge;
  const finalTotal   = baseTotal + additional;

  // Show / hide additional charges block
  const addWrap  = document.getElementById('bkAdditionalWrap');
  const ftWrap   = document.getElementById('bkFinalTotalWrap');
  const addEl    = document.getElementById('bkAdditional');
  const ftEl     = document.getElementById('bkFinalTotal');

  if (additional > 0) {
    addWrap.style.display = '';
    ftWrap.style.display  = '';
    let breakdown = [];
    if (headCharge > 0) breakdown.push(`${totalPax} pax × ₱${ratePerHead.toLocaleString('en-PH')} = ₱${headCharge.toLocaleString('en-PH',{minimumFractionDigits:2})}`);
    if (petCharge  > 0) breakdown.push(`${totalPets} pet${totalPets>1?'s':''} × ₱${ratePerPet.toLocaleString('en-PH')} = ₱${petCharge.toLocaleString('en-PH',{minimumFractionDigits:2})}`);
    addEl.textContent = '+ ₱' + additional.toLocaleString('en-PH',{minimumFractionDigits:2}) + '  (' + breakdown.join('  •  ') + ')';
    ftEl.textContent  = '₱ ' + finalTotal.toLocaleString('en-PH',{minimumFractionDigits:2});
  } else {
    addWrap.style.display = 'none';
    ftWrap.style.display  = 'none';
  }

  // Balance uses finalTotal
  const el  = document.getElementById('bkBalance');
  if (!baseTotal && !dp) { el.textContent = '—'; el.className = 'bk-auto bk-balance'; return; }
  const bal = finalTotal - dp;
  el.textContent = '₱ ' + bal.toLocaleString('en-PH',{minimumFractionDigits:2});
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
    document.getElementById('bkDuration').textContent =
      `${durationMins/60} hrs`;
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
   SAVE BOOKING
══════════════════════════════════════ */
async function saveBooking() {
  if (!validate()) return;

  const btn = document.getElementById('bkBtnSave');
  btn.disabled  = true;
  btn.innerHTML = '<span>Saving…</span>';

  // ── 1. Read form values ──────────────────────────
  const pax          = parseInt(getVal('bkPax'))          || 0;
  const extraPax     = parseInt(getVal('bkExtraPax'))      || 0;
  const ratePerHead  = parseFloat(getVal('bkRatePerHead')) || 0;
  const pets         = parseInt(getVal('bkPets'))          || 0;
  const ratePerPet   = parseFloat(getVal('bkRatePerPet'))  || 0;
  const baseTotal    = parseFloat(getVal('bkTotal'))       || 0;
  const headCharge   = (pax + extraPax) > 0 && ratePerHead > 0 ? (pax + extraPax) * ratePerHead : 0;
  const petCharge    = pets > 0 && ratePerPet > 0 ? pets * ratePerPet : 0;
  const total        = baseTotal + headCharge + petCharge;
  const downpayment  = parseFloat(getVal('bkDownpayment')) || 0;
  const ciTime      = getVal('bkCheckinTime');
  const isNextDay   = (_tourType === 'Night Tour' || _tourType === 'Over-Night');
  const durationMins= _tourType === 'Over-Night' ? 21*60 : 10*60;
  const coTime      = addMinutesToTime(ciTime, durationMins);

  // ── 2. Compile JSON ──────────────────────────────
  const bookingJSON = compileBookingJSON(
    pax, extraPax, pets, total, downpayment,
    ciTime, coTime, isNextDay, durationMins,
    ratePerHead, ratePerPet, baseTotal, headCharge, petCharge
  );

  // ── 3. Check if this is an EDIT (delete old first) ──
  const saveBtn    = document.getElementById('bkBtnSave');
  const editFbKey  = saveBtn._editFbKey  || null;
  const editKey    = saveBtn._editKey    || null;
  // Clear edit markers
  saveBtn._editFbKey = null; saveBtn._editLocalIdx = null; saveBtn._editKey = null;

  if (editFbKey) {
    try { await FB.deleteByKey(editFbKey); } catch(e) { console.warn('Edit-delete:', e.message); }
  }
  if (editKey && Bookings[editKey]) {
    Bookings[editKey] = Bookings[editKey].filter(bk => bk.fbKey !== editFbKey);
    if (!Bookings[editKey].length) delete Bookings[editKey];
  }

  // ── 4. Save to Firebase ─────────────────────────
  let fbKey   = null;
  let fbSaved = false;

  try {
    console.log('📤 Inserting to Firebase:', bookingJSON);
    fbKey   = await FB.insert(bookingJSON);
    fbSaved = true;
    console.log('📥 Firebase key:', fbKey);
  } catch (fbErr) {
    console.error('❌ Firebase error:', fbErr.message);
  }

  // ── 5. Always save locally ───────────────────────
  const entry = { ...bookingJSON, fbKey };
  if (!Bookings[_bkKey]) Bookings[_bkKey] = [];
  Bookings[_bkKey].push(entry);
  saveBookingsLocal(Bookings);

  // ── 6. Close & notify ───────────────────────────
  closeBookingForm();

  if (fbSaved) {
    showToast(editFbKey ? `✏️ Updated: ${bookingJSON.guest.name} ☁️` : `✅ Saved: ${bookingJSON.guest.name} ☁️`);
    await refreshFromFirebase();
  } else {
    showToast(`💾 Saved locally: ${bookingJSON.guest.name} (Firebase offline)`);
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
  const card  = document.createElement('div');
  card.className = 'bk-summary-card';

  const name        = b.guest?.name       || b.guestName       || '—';
  const email       = b.guest?.email      || b.guestEmail      || '—';
  const phone       = b.guest?.phone      || b.guestPhone      || '—';
  const totalPax    = b.guest?.totalPax   || b.totalPax        || '—';
  const pets        = b.guest?.pets       ?? b.pets            ?? 0;
  const total       = b.payment?.total    ?? b.total           ?? 0;
  const balance     = b.payment?.balance  ?? b.balance         ?? 0;
  const tourType    = b.booking?.tourType || b.tourType        || '—';
  const ciTime      = b.booking?.checkinTime  || b.checkinTime  || '';
  const coTime      = b.booking?.checkoutTime || b.checkoutTime || '';
  const coLabel     = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const fbKey       = b.fbKey || null;

  // ── Header: name + tour badge ──
  const hdr = document.createElement('div');
  hdr.className = 'bk-summary-card-header';

  const nameEl = document.createElement('div');
  nameEl.className = 'bk-summary-name'; nameEl.textContent = name;

  const badge = document.createElement('span');
  badge.className = 'bk-summary-badge'; badge.textContent = tourType;
  badge.style.background = color.accent;

  hdr.append(nameEl, badge);
  card.appendChild(hdr);

  // ── Info rows ──
  const rows = [
    [`📧 ${email}`, `📞 ${phone}`],
    [`👥 ${totalPax} Pax`, pets ? `🐾 ${pets} Pets` : null, `💳 ₱${Number(total).toLocaleString()}`],
    [`🕐 ${to12hr(ciTime)} → ${to12hr(coTime)}`, `📅 Out: ${coLabel}`],
    [`💰 Balance: ₱${Number(balance).toLocaleString('en-PH',{minimumFractionDigits:2})}`],
    fbKey ? [`🔗 ID: ${fbKey}`] : null,
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

  // ── Action buttons: View | Edit | Delete ──
  const actions = document.createElement('div');
  actions.className = 'bk-summary-actions';

  // VIEW button
  const viewBtn = document.createElement('button');
  viewBtn.className = 'bk-action-btn bk-action-view';
  viewBtn.innerHTML = '👁 View';
  viewBtn.addEventListener('click', () => openViewModal(b, color));

  // EDIT button
  const editBtn = document.createElement('button');
  editBtn.className = 'bk-action-btn bk-action-edit';
  editBtn.innerHTML = '✏️ Edit';
  editBtn.addEventListener('click', () => {
    closeBookingList();
    openEditForm(b, key, idx, color);
  });

  // DELETE button
  const delBtn = document.createElement('button');
  delBtn.className = 'bk-action-btn bk-action-delete';
  delBtn.innerHTML = '🗑 Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete booking for ${name}?`)) return;
    delBtn.disabled = true;
    delBtn.textContent = 'Deleting…';
    if (fbKey) {
      try { await FB.deleteByKey(fbKey); }
      catch(e) { console.error('Delete error:', e.message); }
    }
    // Also remove from local cache
    if (Bookings[key]) {
      Bookings[key] = Bookings[key].filter(bk => bk.fbKey !== fbKey && bk.id !== b.id);
      if (!Bookings[key].length) delete Bookings[key];
      saveBookingsLocal(Bookings);
    }
    showToast('🗑 Booking deleted.');
    await refreshFromFirebase();
    onDelete();
  });

  actions.append(viewBtn, editBtn, delBtn);
  card.appendChild(actions);

  return card;
}

/* ── VIEW MODAL (read-only detail) ── */
function openViewModal(b, color) {
  const existing = document.getElementById('bkViewOverlay');
  if (existing) existing.remove();

  const name      = b.guest?.name       || b.guestName       || '—';
  const email     = b.guest?.email      || b.guestEmail      || '—';
  const phone     = b.guest?.phone      || b.guestPhone      || '—';
  const pax       = b.guest?.pax        || b.pax             || 0;
  const extraPax  = b.guest?.extraPax   || b.extraPax        || 0;
  const totalPax  = b.guest?.totalPax   || b.totalPax        || '—';
  const pets      = b.guest?.pets       ?? b.pets            ?? 0;
  const rph       = b.guest?.ratePerHead|| 0;
  const rpp       = b.guest?.ratePerPet || 0;
  const payDate   = b.payment?.date     || b.paymentDate     || '—';
  const payMode   = b.payment?.mode     || b.paymentMode     || '—';
  const baseTotal = b.payment?.baseTotal|| b.payment?.total  || b.total || 0;
  const addCharge = b.payment?.additionalCharges || 0;
  const total     = b.payment?.total    ?? b.total           ?? 0;
  const dp        = b.payment?.downpayment ?? b.downpayment  ?? 0;
  const balance   = b.payment?.balance  ?? b.balance         ?? 0;
  const tourType  = b.booking?.tourType || b.tourType        || '—';
  const ciLabel   = b.booking?.checkinDateLabel  || b.checkinDateLabel  || '—';
  const coLabel   = b.booking?.checkoutDateLabel || b.checkoutDateLabel || '—';
  const ciTime    = b.booking?.checkinTime12  || to12hr(b.booking?.checkinTime  || b.checkinTime  || '');
  const coTime    = b.booking?.checkoutTime12 || to12hr(b.booking?.checkoutTime || b.checkoutTime || '');
  const fbKey     = b.fbKey || '—';

  function row(label, value) {
    return `<div class="bk-view-row"><span class="bk-view-label">${label}</span><span class="bk-view-val">${value}</span></div>`;
  }

  document.body.insertAdjacentHTML('beforeend', `
  <div id="bkViewOverlay" class="bk-overlay open" style="z-index:3000;">
    <div class="bk-modal" style="max-width:580px;">
      <div class="bk-modal-header">
        <div class="bk-header-left">
          <div class="bk-color-pill" style="background:linear-gradient(180deg,${color.accent},${color.light})"></div>
          <div>
            <span class="bk-header-label">Booking Details</span>
            <h2 class="bk-header-date">${name}</h2>
          </div>
        </div>
        <div class="bk-header-right">
          <span class="bk-summary-badge" style="background:${color.accent}">${tourType}</span>
          <button class="bk-close" onclick="document.getElementById('bkViewOverlay').remove()">×</button>
        </div>
      </div>
      <div class="bk-body bk-view-body">
        <div class="bk-section">
          <div class="bk-section-title" style="color:${color.accent};border-color:${color.light}">
            <span class="bk-section-icon">👤</span> Guest Information
          </div>
          <div class="bk-view-grid">
            ${row('Name', name)}${row('Email', email)}${row('Phone', phone)}
            ${row('Pax', pax)}${row('Extra Pax', extraPax)}${row('Total Pax', totalPax)}
            ${row('Pets', pets)}${rph ? row('Rate / Head', '₱' + Number(rph).toLocaleString('en-PH')) : ''}
            ${rpp ? row('Rate / Pet', '₱' + Number(rpp).toLocaleString('en-PH')) : ''}
          </div>
        </div>
        <div class="bk-section">
          <div class="bk-section-title" style="color:${color.accent};border-color:${color.light}">
            <span class="bk-section-icon">💳</span> Payment
          </div>
          <div class="bk-view-grid">
            ${row('Date', payDate)}${row('Mode', payMode)}
            ${row('Base Total', '₱' + Number(baseTotal).toLocaleString('en-PH', {minimumFractionDigits:2}))}
            ${addCharge > 0 ? row('Additional', '₱' + Number(addCharge).toLocaleString('en-PH', {minimumFractionDigits:2})) : ''}
            ${row('Total', '₱' + Number(total).toLocaleString('en-PH', {minimumFractionDigits:2}))}
            ${row('Downpayment', '₱' + Number(dp).toLocaleString('en-PH', {minimumFractionDigits:2}))}
            ${row('Balance', '₱' + Number(balance).toLocaleString('en-PH', {minimumFractionDigits:2}))}
          </div>
        </div>
        <div class="bk-section">
          <div class="bk-section-title" style="color:${color.accent};border-color:${color.light}">
            <span class="bk-section-icon">🏡</span> Booking
          </div>
          <div class="bk-view-grid">
            ${row('Tour Type', tourType)}
            ${row('Check-in', ciLabel)}${row('Check-in Time', ciTime)}
            ${row('Check-out', coLabel)}${row('Check-out Time', coTime)}
            ${row('Firebase ID', '<code style="font-size:10px;color:#9996b0">' + fbKey + '</code>')}
          </div>
        </div>
      </div>
      <div class="bk-footer">
        <button class="bk-btn-cancel" onclick="document.getElementById('bkViewOverlay').remove()">Close</button>
      </div>
    </div>
  </div>`);
}

/* ── EDIT FORM (pre-fill booking form) ── */
function openEditForm(b, key, idx, color) {
  // Parse out date parts from key YYYY-MM-DD
  const [year, month1, day] = key.split('-').map(Number);
  openBookingForm(key, day, month1 - 1, year, color);

  // Pre-fill after a tick so the form is rendered
  setTimeout(() => {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    s('bkGuestName',   b.guest?.name       || b.guestName   || '');
    s('bkGuestEmail',  b.guest?.email      || b.guestEmail  || '');
    s('bkGuestPhone',  b.guest?.phone      || b.guestPhone  || '');
    s('bkPax',         b.guest?.pax        || b.pax         || '');
    s('bkExtraPax',    b.guest?.extraPax   || b.extraPax    || '');
    s('bkRatePerHead', b.guest?.ratePerHead|| 0);
    s('bkPets',        b.guest?.pets       ?? b.pets        ?? '');
    s('bkRatePerPet',  b.guest?.ratePerPet || 0);
    s('bkPaymentDate', b.payment?.date     || b.paymentDate || '');
    s('bkTotal',       b.payment?.baseTotal|| b.payment?.total || b.total || '');
    s('bkDownpayment', b.payment?.downpayment ?? b.downpayment ?? '');
    s('bkCheckinTime', b.booking?.checkinTime || b.checkinTime || '');
    calcTotalPax(); calcBalance();

    // Select the tour type button
    const tt = b.booking?.tourType || b.tourType || '';
    document.querySelectorAll('.bk-tour-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.type === tt);
    });
    _tourType = tt;
    calcCheckout();

    // Mark this as an edit (store original fbKey to delete on save)
    document.getElementById('bkBtnSave')._editFbKey = b.fbKey || null;
    document.getElementById('bkBtnSave')._editLocalIdx = idx;
    document.getElementById('bkBtnSave')._editKey = key;
  }, 50);
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
  document.getElementById('bkPax').addEventListener('input', () => { calcTotalPax(); calcBalance(); });
  document.getElementById('bkExtraPax').addEventListener('input', () => { calcTotalPax(); calcBalance(); });
  document.getElementById('bkRatePerHead').addEventListener('input', calcBalance);
  document.getElementById('bkPets').addEventListener('input', calcBalance);
  document.getElementById('bkRatePerPet').addEventListener('input', calcBalance);
  document.getElementById('bkTotal').addEventListener('input', calcBalance);
  document.getElementById('bkDownpayment').addEventListener('input', calcBalance);
  document.getElementById('bkCheckinTime').addEventListener('change', calcCheckout);
  setupTourButtons();
}