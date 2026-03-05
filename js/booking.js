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

function applyTimeSlotToForm(hhmm) {
  const slot = getTimeSlot(hhmm);

  const existing = document.getElementById('bkTimeSlotBanner');
  if (existing) existing.remove();

  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.classList.remove('bk-tour-unavailable');
    btn.disabled = false;
  });

  if (!slot) return;

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
  list.forEach(b => {
    const ci   = (b.booking && b.booking.checkinTime) || b.checkinTime || '';
    const slot = getTimeSlot(ci);
    if (!slot) return;
    if (slot.slot === 'evening')   hasEvening   = true;
    if (slot.slot === 'afternoon') hasAfternoon = true;
    if (slot.slot === 'morning')   hasMorning   = true;
  });

  if (hasEvening || hasAfternoon) cellEl.classList.add('slot-full');
  else if (hasMorning)            cellEl.classList.add('slot-morning-taken');
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
  document.getElementById('bkAdditional').textContent  = '—';
  document.getElementById('bkFinalTotal').textContent  = '—';
  document.getElementById('bkAdditionalWrap').style.display = 'none';
  document.getElementById('bkFinalTotalWrap').style.display = 'none';
  _tourType = null;

  const banner = document.getElementById('bkTimeSlotBanner');
  if (banner) banner.remove();
  document.querySelectorAll('.bk-tour-btn').forEach(btn => {
    btn.classList.remove('bk-tour-unavailable');
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
    email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Invalid email format.' : '');
  err('bkGuestPhone', 'errGuestPhone', !getVal('bkGuestPhone').trim() ? 'Required.' : '');
  err('bkPax',        'errPax',        parseInt(getVal('bkPax')) < 1  ? 'Min 1.' : '');
  err('bkPaymentDate','errPaymentDate',!getVal('bkPaymentDate')       ? 'Required.' : '');
  err('bkTotal',      'errTotal',      parseFloat(getVal('bkTotal')) <= 0 ? 'Required.' : '');
  err('bkDownpayment','errDownpayment',getVal('bkDownpayment') === ''  ? 'Required.' : '');
  err('bkCheckinTime','errCheckinTime',!getVal('bkCheckinTime')        ? 'Required.' : '');

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

    closeBookingForm();

    if (fbSaved) {
      showToast(editFbKey
        ? `✏️ Updated: ${bookingJSON.guest.name} ☁️`
        : `✅ Saved: ${bookingJSON.guest.name} ☁️`);
      try { await refreshFromFirebase(); } catch(e) { console.warn('Refresh error:', e.message); }
    } else {
      showToast(`💾 Saved locally: ${bookingJSON.guest.name} (Firebase offline)`);
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

  const slotFull = (Bookings[key] || []).some(b => {
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
      'font-size:11px;font-weight:700;color:#a01030;background:#fff0f0;' +
      'border:1.5px solid #ff8080;border-radius:8px;padding:8px 12px;margin-top:8px;text-align:center;';
    addNewBtn.parentNode.appendChild(slotNote);
  }
  slotNote.style.display = slotFull ? '' : 'none';
  if (slotFull) slotNote.textContent = '🔴 Afternoon/evening slot booked — no new bookings for this date.';

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
    showToast('🗑 Booking deleted.');
    onDelete();
    applyBookingIndicators();
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
    const mEl = card.querySelector('.month-name');
    if (!mEl) return;
    const month = MONTH_NAMES.indexOf(mEl.textContent);
    const key   = toKey(AppState.year, month, parseInt(numEl.textContent));
    cell.classList.toggle('has-booking', !!(Bookings[key]?.length > 0));
    applyTimeSlotsToCell(key, cell);
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
  document.getElementById('bkPax').addEventListener('input',         () => { calcTotalPax(); calcBalance(); });
  document.getElementById('bkExtraPax').addEventListener('input',    () => { calcTotalPax(); calcBalance(); });
  document.getElementById('bkRatePerHead').addEventListener('input', calcBalance);
  document.getElementById('bkPets').addEventListener('input',         calcBalance);
  document.getElementById('bkRatePerPet').addEventListener('input',   calcBalance);
  document.getElementById('bkTotal').addEventListener('input',        calcBalance);
  document.getElementById('bkDownpayment').addEventListener('input',  calcBalance);
  document.getElementById('bkCheckinTime').addEventListener('change', () => {
    calcCheckout();
    applyTimeSlotToForm(document.getElementById('bkCheckinTime').value);
  });
  setupTourButtons();
}