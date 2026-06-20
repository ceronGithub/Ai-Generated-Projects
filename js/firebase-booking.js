/* ═══════════════════════════════════════════════════════════════════════════
   firebase-booking.js  —  Auto-Booking Bridge
   ───────────────────────────────────────────────────────────────────────────
   PURPOSE:
     When the user clicks "Send" in the mailer, this module automatically
     creates a booking record in Victoria's Haven Calendar Firebase database.
     It also polls the database every 60 seconds to detect external changes.

   DATABASE:
     https://official-victorias-haven-book-default-rtdb.asia-southeast1.firebasedatabase.app
     Path: /bookings  (matches calendar project's FIREBASE_CONFIG.bookingsPath)

   TOUR TYPE LOGIC  (mirrors booking.js exactly):
     Day tour   → 10 hrs, same-day checkout
     Night tour → 10 hrs, next-day checkout
     Over Night → 21 hrs, next-day checkout
     3D 2N      → 42 hrs (21+21), checkout 2 days later

   FIELD ALIGNMENT  (mailer → calendar DB schema):
     bGuestName   → guest.name
     bEmailTo     → guest.email
     bPhoneNumber → guest.phone
     bTotalPax    → guest.totalPax
     bExtraPax    → guest.extraPax
     bSmallPetQty → combined into guest.pets (small + big)
     bBigPetQty   → combined into guest.pets
     bCheckinDate → booking.checkinDate  +  dateKey
     bCheckinTime → booking.checkinTime
     selectedTour → booking.tourType
     bDownPayment → payment.downpayment
     bBalance     → payment.balance
     finalTotal   → payment.total
     bDatePayment → payment.date
     selectedMop  → payment.mode
     dayOfWeek    → dayInfo.type / icon / label
═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────────── */
  const DB_URL = 'https://official-victorias-haven-book-default-rtdb.asia-southeast1.firebasedatabase.app';
  const BOOKINGS = '/bookings';
  const POLL_MS = 60 * 1000; // 60 seconds

  const MONTHS_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ── Tour type hour map (same logic as booking.js) ───────────────────── */
  const TOUR_HRS = {
    'Day tour': 10,
    'Night tour': 10,
    'Over-Night': 21,
    '3D2N': 42,   // 21 + 21
  };

  /* ── Normalize tourType variants to canonical form ───────────────────── */
  /* Canonical names must match bookkeeping project exactly:               */
  /*   Over-Night  (hyphen, no space)                                      */
  /*   3D2N        (no space)                                              */
  function normalizeTourType(t) {
    if (!t) return t;
    const map = {
      'over night': 'Over-Night',
      'overnight': 'Over-Night',
      'over-night': 'Over-Night',
      'day tour': 'Day tour',
      'night tour': 'Night tour',
      '3d2n': '3D2N',
      '3 days 2 nights': '3D2N',
      '3d 2n': '3D2N',
    };
    return map[t.toLowerCase().trim()] || t;
  }

  /* ── Convert 12hr "4:00 PM" → 24hr "HH:MM" for consistent storage ───── */
  function to24hr(t) {
    if (!t) return t;
    if (/^\d{2}:\d{2}$/.test(t)) return t;          // already HH:MM
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return t;
    let h = parseInt(m[1]);
    const period = m[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }

  /* ── dayInfo resolver (mirrors calendar project's logic) ─────────────── */
  function resolveDayInfo(dateObj) {
    const dow = dateObj.getDay();
    const HOLIDAYS_PH = [
      [0, 1], [1, 25], [3, 9], [4, 1], [5, 12], [7, 21], [7, 26], [10, 1], [10, 30], [11, 25], [11, 30]
    ];
    const isHoliday = HOLIDAYS_PH.some(([m, d]) =>
      m === dateObj.getMonth() && d === dateObj.getDate()
    );
    if (isHoliday) return { type: 'holiday', icon: '🎉', label: 'Holiday' };
    if (dow === 0) return { type: 'sunday', icon: '☀️', label: 'Sunday' };
    if (dow === 6) return { type: 'saturday', icon: '🌿', label: 'Saturday' };
    return { type: 'weekday', icon: '📅', label: '' };
  }

  /* ── Format date label  e.g. "Thursday, Apr 24, 2026" ───────────────── */
  function formatDateLabel(dateObj) {
    const dow = DAY_NAMES[dateObj.getDay()];
    const mon = MONTHS_FULL[dateObj.getMonth()].slice(0, 3);
    return `${dow}, ${mon} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  }

  /* ── Format YYYY-MM-DD ───────────────────────────────────────────────── */
  function toKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /* ── 12-hr time format ───────────────────────────────────────────────── */
  function fmt12(h, m) {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  /* ── Compute checkout date from check-in + hours ─────────────────────── */
  function computeCheckout(checkinDateStr, checkinTimeStr, tourType) {
    const normalType = normalizeTourType(tourType);
    const hrs = TOUR_HRS[normalType] || 10;
    const start = new Date(checkinDateStr + 'T00:00:00');
    // Normalize time to 24hr before splitting (handles "4:00 PM" from older records)
    const time24 = to24hr(checkinTimeStr) || checkinTimeStr;
    const [hh, mm] = time24.split(':').map(Number);
    const totalMin = hh * 60 + mm + hrs * 60;
    const daysOver = Math.floor(totalMin / (24 * 60));
    const outH = Math.floor(totalMin / 60) % 24;
    const outM = totalMin % 60;
    const checkout = new Date(start);
    checkout.setDate(checkout.getDate() + daysOver);
    return { checkout, checkoutTime: fmt12(outH, outM), checkinTime: fmt12(hh, mm) };
  }

  /* ── Read all form fields from the mailer booking form ───────────────── */
  function readFormValues() {
    const g = id => document.getElementById(id);

    // Tour type — read the active .tour-btn[data-tour]
    const tourBtn = document.querySelector('.tour-btn[data-tour].active');
    const tourType = tourBtn ? tourBtn.dataset.tour : '';

    // Mode of payment — active .tour-btn[data-mop]
    const mopBtn = document.querySelector('.tour-btn[data-mop].active');
    const mop = mopBtn ? mopBtn.dataset.mop : '';

    return {
      guestName: (g('bGuestName')?.value || '').trim(),
      email: (g('bEmailTo')?.value || '').trim(),
      phone: (g('bPhoneNumber')?.value || '').trim(),
      totalPax: parseInt(g('bTotalPax')?.value) || 0,
      extraPax: parseInt(g('bExtraPax')?.value) || 0,
      smallPets: parseInt(g('bSmallPetQty')?.value) || 0,
      bigPets: parseInt(g('bBigPetQty')?.value) || 0,
      checkinDate: g('bCheckinDate')?.value || '',
      checkinTime: g('bCheckinTime')?.value || '',
      downPayment: parseFloat(g('bDownPayment')?.value) || 0,
      balance: parseFloat(g('bBalance')?.value) || 0,
      finalTotal: parseFloat(g('bFinalTotal')?.value) || 0,
      datePayment: g('bDatePayment')?.value || '',
      refNumber: (g('bRefNumber')?.value || '').trim(),
      tourType,
      mop,
    };
  }

  /* ── Build the Firebase record  (matches calendar schema exactly) ─────── */
  function buildRecord(v) {
    const checkinDateObj = new Date(v.checkinDate + 'T00:00:00');
    const canonicalTour = normalizeTourType(v.tourType);
    const { checkout, checkoutTime, checkinTime } = computeCheckout(
      v.checkinDate, v.checkinTime, canonicalTour
    );

    const pax = v.totalPax;
    const extraPax = v.extraPax;
    const totalPax = pax + extraPax;
    const pets = v.smallPets + v.bigPets;
    const total = v.finalTotal || (v.downPayment + v.balance);
    const dateKey = toKey(checkinDateObj);

    return {
      dateKey,
      createdAt: new Date().toISOString(),

      guest: {
        name: v.guestName,
        email: v.email,
        phone: v.phone,
        pax,
        extraPax,
        totalPax,
        pets,
      },

      booking: {
        tourType: canonicalTour,
        checkinDate: dateKey,
        checkoutDate: toKey(checkout),
        checkinDateLabel: formatDateLabel(checkinDateObj),
        checkoutDateLabel: formatDateLabel(checkout),
        checkinTime,
        checkoutTime,
      },

      payment: {
        date: v.datePayment,
        mode: v.mop,
        total,
        downpayment: v.downPayment,
        balance: v.balance,
        refNumber: v.refNumber,
      },

      dayInfo: resolveDayInfo(checkinDateObj),

      // source tag so you know this came from the mailer
      _source: 'mailer',
    };
  }

  /* ── POST record to Firebase REST API ───────────────────────────────── */
  async function pushToFirebase(record) {
    const res = await fetch(`${DB_URL}${BOOKINGS}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
    return json.name; // Firebase auto-key e.g. "-OQ..."
  }

  /* ── GET all bookings count for polling change detection ────────────── */
  async function fetchBookingCount() {
    const res = await fetch(`${DB_URL}${BOOKINGS}.json?shallow=true`);
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json ? Object.keys(json).length : 0;
  }

  /* ── Final double-booking guard (last line of defense) ───────────────
     booking.js already re-checks availability right when "Proceed" is
     clicked, but there's still a real gap after that: the email actually
     sends (a few seconds), THEN this script waits another 3.2s before
     writing to Firebase at all. In that combined window, someone else's
     booking could land first. This re-checks the EXACT window the record
     is about to claim, one more time, immediately before the write. */
  async function hasDoubleBookingConflict(record) {
    const res  = await fetch(`${DB_URL}${BOOKINGS}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || typeof data !== 'object') return false;

    const TURNOVER_GAP_MIN = 60; // same 1-hour turnover gap used everywhere else

    function toWindow(dateStr, timeStr, tourType) {
      const time24 = to24hr(timeStr) || timeStr;
      const [hh, mm] = time24.split(':').map(Number);
      const hrs = TOUR_HRS[normalizeTourType(tourType)] || 10;
      const startMs = new Date(dateStr + 'T00:00:00').getTime() + (hh * 60 + mm) * 60000;
      const endMs   = startMs + hrs * 60 * 60000;
      return { startMs, endMs };
    }

    const candidate = toWindow(record.booking.checkinDate, record.booking.checkinTime, record.booking.tourType);
    const candidateStart = candidate.startMs - TURNOVER_GAP_MIN * 60000;
    const candidateEnd   = candidate.endMs   + TURNOVER_GAP_MIN * 60000;

    return Object.values(data).some(row => {
      if (!row || typeof row !== 'object') return false;
      const b = row.booking || {};
      const existingDate = b.checkinDate || row.dateKey || '';
      if (!existingDate || !b.checkinTime) return false;

      const existing = toWindow(existingDate, b.checkinTime, b.tourType);
      return existing.startMs < candidateEnd && existing.endMs > candidateStart;
    });
  }

  /* ── Show status toast (reuses mailer's #sentToast if available) ─────── */
  function showStatus(msg, isError = false) {
    console[isError ? 'error' : 'log'](`[firebase-booking] ${msg}`);
    const toast = document.getElementById('sentToast');
    if (!toast) return;
    // Save and restore the toast's current text so we don't clobber email toast
    const prev = toast.textContent;
    toast.textContent = msg;
    toast.style.background = isError ? 'rgba(239,68,68,0.1)' : 'rgba(52,199,89,0.1)';
    toast.style.borderColor = isError ? 'rgba(239,68,68,0.3)' : 'rgba(52,199,89,0.3)';
    toast.style.color = isError ? '#ef4444' : '#22c55e';
    toast.classList.add('show');
    setTimeout(() => {
      toast.textContent = prev;
      toast.classList.remove('show');
    }, 4000);
  }

  /* ── Main: hook into Send button ─────────────────────────────────────── */
  function hookSendButton() {
    const btnSend = document.getElementById('btnSend');
    if (!btnSend) {
      console.warn('[firebase-booking] #btnSend not found — retrying in 500ms');
      setTimeout(hookSendButton, 500);
      return;
    }

    // Wrap the existing click listener — run AFTER email.js sends
    // We use a capture listener so we run last (after bubble)
    btnSend.addEventListener('click', async () => {
      // Wait for email.js to finish its own validation + sending (~3s)
      // We check window._bookingDetails which booking.js sets on Proceed
      await new Promise(r => setTimeout(r, 3200));

      const v = readFormValues();

      // Validate minimum required fields
      if (!v.guestName || !v.checkinDate || !v.tourType || !v.checkinTime) {
        console.warn('[firebase-booking] Incomplete form — booking not saved to DB');
        return;
      }

      try {
        const record = buildRecord(v);

        // Final guard: re-check one more time, immediately before writing.
        // This is the closest possible check to the actual database write,
        // closing the race window left open by the email-send delay above.
        const conflictExists = await hasDoubleBookingConflict(record);
        if (conflictExists) {
          showStatus('⛔ Not saved — this slot was just booked by someone else. Please check the calendar and re-book.', true);
          console.warn('[firebase-booking] Double-booking conflict detected — write aborted', record.booking);
          return;
        }

        const fbKey = await pushToFirebase(record);
        showStatus(`✅ Booking saved to calendar DB (${fbKey})`, false);
        console.log('[firebase-booking] Record pushed:', fbKey, record);

        // Refresh the main booking calendar immediately so the newly booked
        // date(s) show as blocked/partial right away — no page reload needed.
        if (typeof window.refreshMainCalendarDates === 'function') {
          window.refreshMainCalendarDates();
        }
      } catch (err) {
        showStatus(`⚠️ DB booking failed: ${err.message}`, true);
        console.error('[firebase-booking] Push error:', err);
      }
    }, false);

    console.log('[firebase-booking] ✅ Hooked into #btnSend');
  }

  /* ── 60-second poller  ───────────────────────────────────────────────── */
  let _lastCount = -1;
  let _pollTimer = null;

  async function poll() {
    try {
      const count = await fetchBookingCount();
      if (_lastCount === -1) {
        _lastCount = count;
        console.log(`[firebase-booking] Poller started — ${count} bookings in DB`);
        return;
      }
      if (count !== _lastCount) {
        console.log(`[firebase-booking] 🔄 DB changed: ${_lastCount} → ${count} bookings`);
        showStatus(`📅 Calendar DB updated (${count} bookings)`, false);
        _lastCount = count;

        // Keep the on-screen calendar in sync with bookings created elsewhere
        // (another tab, another device) — not just the ones made on this page.
        if (typeof window.refreshMainCalendarDates === 'function') {
          window.refreshMainCalendarDates();
        }
      }
    } catch (e) {
      console.warn('[firebase-booking] Poll error:', e.message);
    }
  }

  function startPoller() {
    poll(); // immediate first check
    _pollTimer = setInterval(poll, POLL_MS);
    console.log('[firebase-booking] ⏱ Polling DB every 60 seconds');
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  function init() {
    hookSendButton();
    startPoller();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();