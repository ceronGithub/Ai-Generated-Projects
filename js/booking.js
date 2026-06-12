/* booking.js — Booking form logic: date, time, tour type, MOP, validation */
(function () {

  // ── State ──
  let selectedTour = '';   // 'Day tour' | 'Night tour' | 'Over Night' | '3D 2N'
  let selectedHrs  = 0;    // 21 | 10
  let selectedMop  = '';   // 'GCash' | 'Maya' | 'Bank Transfer' | 'Cash'

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  // ── Elements ──
  const form          = document.getElementById('bookingForm');
  const compose       = document.getElementById('composeStep');
  const btnProceed    = document.getElementById('btnProceed');
  const btnBack       = document.getElementById('btnBack');
  const errorEl       = document.getElementById('bookingError');
  const dateDisplay   = document.getElementById('bDateDisplay');
  const checkoutDis   = document.getElementById('bCheckoutDisplay');
  const tourTypeGroup = document.getElementById('tourTypeGroup');
  const btnDayTour    = document.getElementById('btnDayTour');

  const inp = {
    guestName:   document.getElementById('bGuestName'),
    phoneNumber: document.getElementById('bPhoneNumber'),
    totalPax:    document.getElementById('bTotalPax'),
    extraPax:    document.getElementById('bExtraPax'),
    perHead:     document.getElementById('bPerHead'),
    smallPetQty: document.getElementById('bSmallPetQty'),
    bigPetQty:   document.getElementById('bBigPetQty'),
    smallPetPrice: document.getElementById('bSmallPetPrice'),
    bigPetPrice:   document.getElementById('bBigPetPrice'),
    smallPetResult: document.getElementById('bSmallPetResult'),
    bigPetResult:   document.getElementById('bBigPetResult'),
    checkinDate: document.getElementById('bCheckinDate'),
    checkinTime: document.getElementById('bCheckinTime'),
    extraChargers: document.getElementById('bExtraChargers'),
    downPayment: document.getElementById('bDownPayment'),
    balance:     document.getElementById('bBalance'),
    packageTotal: document.getElementById('bPackageTotal'),
    finalTotal:  document.getElementById('bFinalTotal'),
    finalBalance: document.getElementById('bFinalBalance'),
    priceperhour:     document.getElementById('bPricePerHour'),
    extraTimeExt: document.getElementById('bExtraTimeExt'),
    datePayment: document.getElementById('bDatePayment'),
    refNumber:   document.getElementById('bRefNumber'),
    emailTo:     document.getElementById('bEmailTo'),
    phoneNumber: document.getElementById('bPhoneNumber'),
  };

  // -- Guest Name: block @ symbol (email entered by mistake) --
  inp.guestName.addEventListener('input', function () {
    if (this.value.includes('@')) {
      this.value = '';
      this.placeholder = '⚠ Email detected — please enter a name';
      setTimeout(() => { this.placeholder = 'Full name of guest'; }, 3000);
    }
  });

  // ── Tour button visibility + Day Tour enable/disable based on date & time ──
  // ── Tracks checkout time forced by an existing Firebase booking (null = free date) ──
  let _forcedCheckinMins = null; // set by autoSetCheckinFromExistingBooking, cleared on date change

  function updateTourButtons() {
    const dateVal = inp.checkinDate.value;

    // Show tour buttons only once a date is selected
    if (!dateVal) {
      tourTypeGroup.style.display = 'none';
      return;
    }
    tourTypeGroup.style.display = '';

    // Day Tour disable rule:
    // ONLY disable if an existing booking forces the check-in into PM (hour >= 12)
    // Never disable based on the tour's own default time — user must be free to switch tours
    if (_forcedCheckinMins !== null) {
      const forcedHour = Math.floor(_forcedCheckinMins / 60) % 24;
      if (forcedHour >= 12) {
        btnDayTour.classList.add('tour-disabled');
        btnDayTour.classList.remove('active');
        if (selectedTour === 'Day tour') {
          selectedTour = '';
          selectedHrs  = 0;
          document.querySelectorAll('.tour-btn[data-hrs]').forEach(b => b.classList.remove('active'));
        }
      } else {
        btnDayTour.classList.remove('tour-disabled');
      }
    } else {
      // Free date (no existing booking) — all tour types enabled
      btnDayTour.classList.remove('tour-disabled');
    }
  }

  // ── Default check-in times per tour type ──
  const TOUR_DEFAULT_TIME = {
    'Day tour':   '08:00',   // 8:00 AM
    'Night tour': '12:00',   // 12:00 PM
    'Over Night': '14:00',   // 2:00 PM
    '3D 2N':      '14:00',   // 2:00 PM
  };

  // ── Tour type buttons ──
  document.querySelectorAll('.tour-btn[data-tour]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Ignore if disabled
      if (btn.classList.contains('tour-disabled')) return;

      document.querySelectorAll('.tour-btn[data-tour]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTour = btn.dataset.tour;

      // Auto-select hours based on tour type
      // Day tour / Night tour → 10 hrs
      // Overnight / 3D 2N    → 21 hrs
      const autoHrs = (selectedTour === 'Day tour' || selectedTour === 'Night tour') ? 10 : 21;
      selectedHrs = autoHrs;
      document.querySelectorAll('.tour-btn[data-hrs]').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.hrs) === autoHrs);
      });

      // Auto-set check-in time default for the selected tour
      // Only set if no time is already set OR if it came from a previous tour selection
      const defaultTime = TOUR_DEFAULT_TIME[selectedTour];
      if (defaultTime) {
        inp.checkinTime.value = defaultTime;
      }

      updateTourButtons();
      updateDateDisplay();
      updateCheckout();
    });
  });

  // ── Hours buttons ──
  document.querySelectorAll('.tour-btn[data-hrs]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tour-btn[data-hrs]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHrs = parseInt(btn.dataset.hrs);
      updateDateDisplay();
      updateCheckout();
    });
  });

  // ── Mode of Payment buttons ──
  document.querySelectorAll('.tour-btn[data-mop]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tour-btn[data-mop]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMop = btn.dataset.mop;
    });
  });

  // ── Calculation listeners ──
  inp.perHead.addEventListener('input', () => updateCalculations());
  inp.extraPax.addEventListener('input', () => updateCalculations());
  inp.smallPetQty.addEventListener('input', () => updateCalculations());
  inp.bigPetQty.addEventListener('input', () => updateCalculations());
  inp.smallPetPrice.addEventListener('input', () => updateCalculations());
  inp.bigPetPrice.addEventListener('input', () => updateCalculations());
  inp.priceperhour.addEventListener('input', () => updateCalculations());
  inp.extraTimeExt.addEventListener('input', () => { updateCalculations(); updateCheckout(); });
  inp.downPayment.addEventListener('input', () => updateCalculations());
  inp.balance.addEventListener('input', () => updateCalculations());

  // ── Date + Time listeners ──
  inp.checkinDate.addEventListener('change', () => {
    _forcedCheckinMins = null; // reset forced time — new date, fresh state
    selectedTour = '';
    selectedHrs  = 0;
    document.querySelectorAll('.tour-btn[data-tour]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tour-btn[data-hrs]').forEach(b => b.classList.remove('active'));
    updateTourButtons();
    updateDateDisplay();
    updateCheckout();
    autoSetCheckinFromExistingBooking(inp.checkinDate.value);
  });
  inp.checkinTime.addEventListener('change', () => {
    updateTourButtons();
    updateDateDisplay();
    updateCheckout();
  });

  /* ── Firebase config (same DB as firebase-booking.js) ─────────────────── */
  const FB_DB_URL   = 'https://official-victorias-haven-book-default-rtdb.asia-southeast1.firebasedatabase.app';
  const FB_BOOKINGS = '/bookings';

  /* ── Tour hours map (mirrors firebase-booking.js) ──────────────────────── */
  const TOUR_HRS_MAP = {
    'Day tour':   10,
    'Night tour': 10,
    'Over Night': 21,
    'Over-Night': 21,
    '3D 2N':      42,
  };

  /* ── Convert 12hr string "4:00 PM" → total minutes since midnight ──────── */
  function time12ToMins(str) {
    if (!str) return null;
    // Handle 24hr format "HH:MM" stored by the calendar app
    const m24 = str.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
    // Handle 12hr format "H:MM AM/PM" stored by the mailer
    const m12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m12) return null;
    let h = parseInt(m12[1]), mins = parseInt(m12[2]);
    const period = m12[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + mins;
  }

  /* ── Convert total minutes → 24hr "HH:MM" for <input type="time"> ─────── */
  function minsTo24hrInput(totalMins) {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  /* ── Compute checkout minutes for a booking record ──────────────────────── */
  function getCheckoutMins(booking) {
    // Try using stored checkoutTime first
    if (booking.checkoutTime) {
      const m = time12ToMins(booking.checkoutTime);
      if (m !== null) return m;
    }
    // Fallback: compute from checkinTime + tourType hours
    const checkinMins = time12ToMins(booking.checkinTime);
    if (checkinMins === null) return null;
    const hrs = TOUR_HRS_MAP[booking.tourType] || 10;
    return checkinMins + hrs * 60; // may exceed 1440 — that's fine, we mod later
  }

  /* ── Show/hide auto-checkin notice ─────────────────────────────────────── */
  let _autoCheckinNotice = null;
  function showAutoCheckinNotice(msg) {
    if (!_autoCheckinNotice) {
      _autoCheckinNotice = document.createElement('div');
      _autoCheckinNotice.id = 'autoCheckinNotice';
      _autoCheckinNotice.style.cssText = [
        'margin-top:6px', 'padding:6px 10px', 'border-radius:6px',
        'font-size:0.78rem', 'background:rgba(52,199,89,0.12)',
        'border:1px solid rgba(52,199,89,0.35)', 'color:#22c55e',
        'display:none'
      ].join(';');
      inp.checkinTime.parentNode.insertBefore(_autoCheckinNotice, inp.checkinTime.nextSibling);
    }
    if (msg) {
      _autoCheckinNotice.textContent = msg;
      _autoCheckinNotice.style.display = 'block';
    } else {
      _autoCheckinNotice.style.display = 'none';
    }
  }

  /* ── Conflict Modal: show existing bookings on selected date ─────────────
     Renders a modal listing all conflicting bookings. Each card has two
     actions: Delete (removes record from Firebase) and Rebook (pre-fills
     the booking form with that guest's details for editing).
  ─────────────────────────────────────────────────────────────────────────── */
  /* ── Convert any time string (24hr "HH:MM" or 12hr "H:MM AM/PM") → 12hr display ── */
  function displayAs12hr(timeStr) {
    if (!timeStr || timeStr === '—') return timeStr;
    // Already 12hr format e.g. "4:00 PM"
    if (/\b(AM|PM)\b/i.test(timeStr)) return timeStr;
    // 24hr format "HH:MM"
    const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return timeStr;
    let h = parseInt(m[1]);
    const mins = m[2];
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mins} ${period}`;
  }

  /* ── Format YYYY-MM-DD → "Mon DD, YYYY" for date display in modal ─────── */
  function formatModalDate(dateStr) {
    if (!dateStr) return '—';
    const [y, mo, d] = dateStr.split('-').map(Number);
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                         'Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${MONTH_SHORT[mo - 1]} ${d}, ${y}`;
  }

  function buildConflictModal(dateStr, conflictRows) {
    // Remove any previous instance
    const prev = document.getElementById('conflictModal');
    if (prev) prev.remove();

    // Format display date  e.g. "May 24, 2026"
    const [y, mo, d] = dateStr.split('-').map(Number);
    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    const displayDate = `${MONTH_NAMES[mo - 1]} ${d}, ${y}`;

    // Build a card per conflicting booking
    const cardsHtml = conflictRows.map(({ fbKey, row }) => {
      const b = row.booking  || {};
      const g = row.guest    || {};
      const p = row.payment  || {};

      const name         = g.name      || '—';
      const email        = g.email     || '—';
      const phone        = g.phone     || '—';
      const pax          = g.totalPax  || g.pax || '—';
      const tourType     = b.tourType  || '—';
      // Times: convert 24hr stored values to 12hr display
      const checkinTime  = displayAs12hr(b.checkinTime  || '—');
      const checkoutTime = displayAs12hr(b.checkoutTime || '—');
      // Dates: use stored labels if available, else format from YYYY-MM-DD keys
      const checkinDate  = b.checkinDateLabel  || formatModalDate(b.checkinDate  || row.dateKey || '');
      const checkoutDate = b.checkoutDateLabel || formatModalDate(b.checkoutDate || '');
      const total        = p.total       != null ? `₱${Number(p.total).toLocaleString('en-PH',       { minimumFractionDigits: 2 })}` : '—';
      const dp           = p.downpayment != null ? `₱${Number(p.downpayment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';
      const bal          = p.balance     != null ? `₱${Number(p.balance).toLocaleString('en-PH',     { minimumFractionDigits: 2 })}` : '—';

      return `
        <div class="conflictCard" data-fbkey="${fbKey}">
          <div class="conflictCardHeader">
            <span class="conflictGuestName">${name}</span>
            <span class="conflictTourBadge">${tourType}</span>
          </div>
          <div class="conflictCardBody">
            <div class="conflictRow"><span class="conflictLabel">✉</span><span>${email}</span></div>
            <div class="conflictRow"><span class="conflictLabel">📞</span><span>${phone}</span></div>
            <div class="conflictRow"><span class="conflictLabel">👥</span><span>${pax} Pax</span></div>
            <div class="conflictRow conflictRowDates">
              <span class="conflictLabel">📅</span>
              <span>
                <span class="conflictDateChip">${checkinDate}</span>
                <span class="conflictTimePill">${checkinTime}</span>
                <span class="conflictArrow">→</span>
                <span class="conflictDateChip">${checkoutDate}</span>
                <span class="conflictTimePill">${checkoutTime}</span>
              </span>
            </div>
            <div class="conflictRow"><span class="conflictLabel">💰</span><span>${total} &nbsp;|&nbsp; DP: ${dp} &nbsp;|&nbsp; Bal: ${bal}</span></div>
          </div>
          <div class="conflictCardActions">
            <button class="conflictBtnDelete" data-fbkey="${fbKey}">🗑 Delete</button>
            <button class="conflictBtnRebook" data-fbkey="${fbKey}">🔁 Rebook</button>
          </div>
        </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'conflictModal';
    modal.className = 'conflictModalOverlay';
    modal.innerHTML = `
      <div class="conflictModalBox">
        <div class="conflictModalHeader">
          <span class="conflictModalTitle">📅 ${displayDate}</span>
          <span class="conflictModalSub">${conflictRows.length} existing booking${conflictRows.length > 1 ? 's' : ''} on this date</span>
        </div>
        <div class="conflictModalScroll">
          ${cardsHtml}
        </div>
        <button class="conflictBtnClose" id="conflictBtnClose">✕ Close</button>
      </div>`;

    document.body.appendChild(modal);

    // Close button
    document.getElementById('conflictBtnClose').addEventListener('click', () => modal.remove());

    // Overlay click closes modal
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    // ── Delete handler ──
    modal.querySelectorAll('.conflictBtnDelete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.fbkey;
        if (!key) return;
        const confirmed = confirm('Delete this booking permanently from the database?');
        if (!confirmed) return;

        btn.disabled = true;
        btn.textContent = '⏳ Deleting...';

        try {
          const res = await fetch(`${FB_DB_URL}${FB_BOOKINGS}/${key}.json`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          // Remove the card from the modal
          const card = modal.querySelector(`.conflictCard[data-fbkey="${key}"]`);
          if (card) card.remove();

          // If no more cards remain, close modal and re-run checkin check
          const remaining = modal.querySelectorAll('.conflictCard');
          if (remaining.length === 0) {
            modal.remove();
            autoSetCheckinFromExistingBooking(dateStr);
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = '🗑 Delete';
          alert(`Delete failed: ${err.message}`);
        }
      });
    });

    // ── Rebook handler: guided sub-modal with custom calendar — booked dates are disabled ──
    modal.querySelectorAll('.conflictBtnRebook').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key   = btn.dataset.fbkey;
        const found = conflictRows.find(r => r.fbKey === key);
        if (!found) return;

        const { row } = found;
        const g = row.guest    || {};
        const p = row.payment  || {};
        const b = row.booking  || {};

        // ── Fetch all booked date ranges from Firebase to block in calendar ──
        // Each booking may span multiple days (overnight / 3D2N), so we collect
        // every date from checkinDate through checkoutDate inclusive.
        let bookedDates = new Set();
        try {
          const res  = await fetch(`${FB_DB_URL}${FB_BOOKINGS}.json`);
          const data = await res.json();
          if (data && typeof data === 'object') {
            Object.values(data).forEach(r => {
              if (!r || typeof r !== 'object') return;
              const bk = r.booking || {};
              const ci = bk.checkinDate  || r.dateKey || '';
              const co = bk.checkoutDate || ci;
              if (!ci) return;
              // Walk from checkin to checkout and mark every date as booked
              const cur = new Date(ci + 'T00:00:00');
              const end = new Date(co + 'T00:00:00');
              while (cur <= end) {
                bookedDates.add(cur.toISOString().split('T')[0]);
                cur.setDate(cur.getDate() + 1);
              }
            });
          }
        } catch (_) { /* fail silently — calendar still works, no dates blocked */ }

        // ── Build sub-modal summary ──
        const summaryItems = [
          { icon: '👤', label: 'Guest',   val: g.name  || '—' },
          { icon: '📞', label: 'Phone',   val: g.phone || '—' },
          { icon: '✉',  label: 'Email',   val: g.email || '—' },
          { icon: '👥', label: 'Pax',     val: `${g.totalPax || g.pax || '—'}` },
          { icon: '🗺',  label: 'Tour',    val: b.tourType || '—' },
          { icon: '💰', label: 'DP',      val: p.downpayment != null ? `₱${Number(p.downpayment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—' },
          { icon: '💳', label: 'Balance', val: p.balance     != null ? `₱${Number(p.balance).toLocaleString('en-PH',     { minimumFractionDigits: 2 })}` : '—' },
        ].map(i => `
          <div class="rebookSummaryRow">
            <span class="rebookSummaryIcon">${i.icon}</span>
            <span class="rebookSummaryLabel">${i.label}</span>
            <span class="rebookSummaryVal">${i.val}</span>
          </div>`).join('');

        const subModal = document.createElement('div');
        subModal.id = 'rebookSubModal';
        subModal.className = 'rebookSubOverlay';
        subModal.innerHTML = `
          <div class="rebookSubBox">
            <div class="rebookSubHeader">
              <span class="rebookSubTitle">🔁 Rebook — ${g.name || 'Guest'}</span>
              <span class="rebookSubSub">Details carried over. Pick an available date.</span>
            </div>
            <div class="rebookSummary">${summaryItems}</div>
            <div class="rebookDateRow">
              <label class="rebookDateLabel">📅 New Check-in Date</label>
              <div class="rebookCalWrap">
                <div class="rebookCalNav">
                  <button class="rebookCalNavBtn" id="rebookCalPrev">‹</button>
                  <span class="rebookCalMonthLabel" id="rebookCalMonthLabel"></span>
                  <button class="rebookCalNavBtn" id="rebookCalNext">›</button>
                </div>
                <div class="rebookCalDayNames">
                  <span>Su</span><span>Mo</span><span>Tu</span><span>We</span>
                  <span>Th</span><span>Fr</span><span>Sa</span>
                </div>
                <div class="rebookCalGrid" id="rebookCalGrid"></div>
                <div class="rebookCalSelected" id="rebookCalSelected">No date selected</div>
              </div>
            </div>
            <div class="rebookSubActions">
              <button class="rebookSubBtnCancel" id="rebookSubBtnCancel">Cancel</button>
              <button class="rebookSubBtnConfirm" id="rebookSubBtnConfirm" disabled>Confirm Rebook →</button>
            </div>
          </div>`;

        document.body.appendChild(subModal);

        // ── Calendar state ──
        const today        = new Date();
        today.setHours(0,0,0,0);
        let   calYear      = today.getFullYear();
        let   calMonth     = today.getMonth();
        let   selectedDate = null; // YYYY-MM-DD string

        const MONTH_NAMES_CAL = ['January','February','March','April','May','June',
                                  'July','August','September','October','November','December'];

        /* Pad date parts to YYYY-MM-DD */
        function toYMD(y, m, d) {
          return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }

        /* Render the calendar grid for calYear / calMonth */
        function renderCalendar() {
          const label    = document.getElementById('rebookCalMonthLabel');
          const grid     = document.getElementById('rebookCalGrid');
          const selLabel = document.getElementById('rebookCalSelected');
          const confirmBtn = document.getElementById('rebookSubBtnConfirm');

          label.textContent = `${MONTH_NAMES_CAL[calMonth]} ${calYear}`;

          const firstDay  = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
          const daysInMo  = new Date(calYear, calMonth + 1, 0).getDate();

          let html = '';

          // Leading empty cells
          for (let i = 0; i < firstDay; i++) {
            html += `<span class="rebookCalCell rebookCalEmpty"></span>`;
          }

          for (let day = 1; day <= daysInMo; day++) {
            const ymd      = toYMD(calYear, calMonth, day);
            const dateObj  = new Date(ymd + 'T00:00:00');
            const isPast   = dateObj < today;
            const isBooked = bookedDates.has(ymd);
            const isSel    = ymd === selectedDate;
            const isToday  = ymd === toYMD(today.getFullYear(), today.getMonth(), today.getDate());

            let cls = 'rebookCalCell';
            if (isPast || isBooked) cls += ' rebookCalDisabled';
            else                    cls += ' rebookCalAvailable';
            if (isSel)              cls += ' rebookCalSelected';
            if (isToday && !isSel)  cls += ' rebookCalToday';
            if (isBooked)           cls += ' rebookCalBooked';

            const title = isBooked ? 'Already booked' : isPast ? 'Past date' : '';
            html += `<span class="${cls}" data-date="${ymd}" title="${title}">${day}</span>`;
          }

          grid.innerHTML = html;

          // Update selected label + confirm button
          if (selectedDate) {
            const [sy, sm, sd] = selectedDate.split('-').map(Number);
            selLabel.textContent = `✅ ${MONTH_NAMES_CAL[sm-1]} ${sd}, ${sy}`;
            selLabel.className   = 'rebookCalSelected rebookCalSelectedActive';
            confirmBtn.disabled  = false;
          } else {
            selLabel.textContent = 'No date selected';
            selLabel.className   = 'rebookCalSelected';
            confirmBtn.disabled  = true;
          }

          // Click handler on available day cells
          grid.querySelectorAll('.rebookCalAvailable').forEach(cell => {
            cell.addEventListener('click', () => {
              selectedDate = cell.dataset.date;
              renderCalendar();
            });
          });
        }

        renderCalendar();

        // Month navigation
        document.getElementById('rebookCalPrev').addEventListener('click', () => {
          calMonth--;
          if (calMonth < 0) { calMonth = 11; calYear--; }
          renderCalendar();
        });
        document.getElementById('rebookCalNext').addEventListener('click', () => {
          calMonth++;
          if (calMonth > 11) { calMonth = 0; calYear++; }
          renderCalendar();
        });

        // Cancel — remove sub-modal, leave conflict modal open
        document.getElementById('rebookSubBtnCancel').addEventListener('click', () => subModal.remove());
        subModal.addEventListener('click', e => { if (e.target === subModal) subModal.remove(); });

        // Confirm — pre-fill booking form and close both modals
        document.getElementById('rebookSubBtnConfirm').addEventListener('click', () => {
          if (!selectedDate) return;

          // ── Pre-fill ALL guest + payment fields from the existing booking ──
          if (inp.guestName   && g.name)               inp.guestName.value   = g.name;
          if (inp.phoneNumber && g.phone)               inp.phoneNumber.value = g.phone;
          if (inp.totalPax    && (g.totalPax || g.pax)) inp.totalPax.value    = g.totalPax || g.pax;
          if (inp.emailTo     && g.email)               inp.emailTo.value     = g.email;
          if (inp.downPayment && p.downpayment != null) inp.downPayment.value = p.downpayment;
          if (inp.balance     && p.balance     != null) inp.balance.value     = p.balance;

          // Set the new check-in date and fire change so tour buttons + auto-checkin refresh
          inp.checkinDate.value = selectedDate;
          inp.checkinDate.dispatchEvent(new Event('change'));

          subModal.remove();
          modal.remove();
          updateCalculations();

          // Scroll to form and highlight the date field briefly
          const formEl = document.getElementById('bookingForm');
          if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          inp.checkinDate.style.outline = '2px solid #34d399';
          setTimeout(() => { inp.checkinDate.style.outline = ''; }, 2500);
        });
      });
    });
  }

  /* ── Main: fetch ALL bookings, filter client-side for date, find latest checkout +1hr ── */
  async function autoSetCheckinFromExistingBooking(dateStr) {
    if (!dateStr) return;
    showAutoCheckinNotice('🔍 Checking existing bookings...');

    try {
      // Fetch ALL bookings without orderBy (no Firebase index rules needed)
      const res = await fetch(`${FB_DB_URL}${FB_BOOKINGS}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data || typeof data !== 'object') {
        // No data at all — clear time and notice
        inp.checkinTime.value = '';
        updateDateDisplay();
        updateCheckout();
        showAutoCheckinNotice('');
        return;
      }

      // Filter client-side: checkinDate OR checkoutDate matches selected date
      // This catches both: guests checking IN today, and overnight guests checking OUT today
      // Also store the Firebase key (fbKey) so Delete works
      const allBookings  = [];
      const conflictRows = [];
      Object.entries(data).forEach(([fbKey, row]) => {
        if (!row || typeof row !== 'object') return;
        const b = row.booking || {};
        const checkinDate  = b.checkinDate  || row.dateKey || '';
        const checkoutDate = b.checkoutDate || '';
        if (checkinDate === dateStr || checkoutDate === dateStr) {
          if (b.checkinTime || b.checkoutTime) {
            allBookings.push(b);
            conflictRows.push({ fbKey, row });
          }
        }
      });

      if (allBookings.length === 0) {
        // No existing bookings — free date, all tour types enabled
        _forcedCheckinMins = null;
        inp.checkinTime.value = '';
        updateTourButtons();
        updateDateDisplay();
        updateCheckout();
        showAutoCheckinNotice('✅ No existing bookings on this date — select a check-in time');
        setTimeout(() => showAutoCheckinNotice(''), 3000);
        return;
      }

      // Show conflict modal with all existing bookings on this date
      buildConflictModal(dateStr, conflictRows);

      // Find the latest checkout time across all matching bookings
      let latestCheckoutMins  = null;
      let latestCheckoutLabel = '';
      let bookingCount        = allBookings.length;

      allBookings.forEach(b => {
        let coMins = getCheckoutMins(b);
        if (coMins === null) return;
        coMins = coMins % (24 * 60);
        if (latestCheckoutMins === null || coMins > latestCheckoutMins) {
          latestCheckoutMins  = coMins;
          latestCheckoutLabel = fmt12(Math.floor(coMins / 60), coMins % 60);
        }
      });

      if (latestCheckoutMins === null) {
        _forcedCheckinMins = null;
        inp.checkinTime.value = '';
        updateTourButtons();
        updateDateDisplay();
        updateCheckout();
        showAutoCheckinNotice('');
        return;
      }

      // Add 1 hour gap after latest checkout, wrap midnight if needed
      const newCheckinMins  = (latestCheckoutMins + 60) % (24 * 60);
      const newCheckinValue = minsTo24hrInput(newCheckinMins);

      // Store forced mins so updateTourButtons knows this is DB-driven, not user-driven
      _forcedCheckinMins = newCheckinMins;

      // Pre-fill the check-in time input and refresh all displays
      inp.checkinTime.value = newCheckinValue;
      updateTourButtons();
      updateDateDisplay();
      updateCheckout();

      const h = Math.floor(newCheckinMins / 60);
      const m = newCheckinMins % 60;
      const countLabel = bookingCount === 1 ? '1 existing booking' : `${bookingCount} existing bookings`;
      showAutoCheckinNotice(
        `📅 ${countLabel} found — latest checkout at ${latestCheckoutLabel} — check-in auto-set to ${fmt12(h, m)} (+1 hr gap)`
      );

    } catch (err) {
      console.warn('[booking] autoSetCheckin error:', err.message);
      showAutoCheckinNotice('⚠️ Could not reach database — please set check-in time manually');
    }
  }

  // ── Update all calculations ──
  function updateCalculations() {
    // Pet calculations: Qty * Price
    const smallPetQty = parseFloat(inp.smallPetQty.value) || 0;
    const bigPetQty = parseFloat(inp.bigPetQty.value) || 0;
    const smallPetPrice = parseFloat(inp.smallPetPrice.value) || 0;
    const bigPetPrice = parseFloat(inp.bigPetPrice.value) || 0;

    const smallPetTotal = smallPetQty * smallPetPrice;
    const bigPetTotal = bigPetQty * bigPetPrice;

    inp.smallPetResult.value = smallPetTotal.toFixed(2);
    inp.bigPetResult.value = bigPetTotal.toFixed(2);

    // Extra Chargers: (Extra Pax * Per Head) + small pet + big pet + (extra time ext * price per hour)
    const perHead = parseFloat(inp.perHead.value) || 0;
    const extraPax = parseFloat(inp.extraPax.value) || 0;
    const extraTimeExt = parseFloat(inp.extraTimeExt.value) || 0;
    const priceperhour = parseFloat(inp.priceperhour.value) || 0;
    const extraChargers = (extraPax * perHead) + smallPetTotal + bigPetTotal + (extraTimeExt * priceperhour);
    inp.extraChargers.value = extraChargers.toFixed(2);

    // Package Total: Down Payment + Balance
    const downPayment = parseFloat(inp.downPayment.value) || 0;
    const balance = parseFloat(inp.balance.value) || 0;
    const packageTotal = downPayment + balance;
    inp.packageTotal.value = packageTotal.toFixed(2);

    // Final Total: Package Total + Extra Chargers
    const finalTotal = packageTotal + extraChargers;
    inp.finalTotal.value = finalTotal.toFixed(2);

    // Final Balance: Final Total - Down Payment
    const finalBalance = finalTotal - downPayment;
    inp.finalBalance.value = finalBalance.toFixed(2);
  }

  // ── Returns effective total hours for checkout calculation ──
  function getEffectiveHrs() {
    if (selectedTour === '3D 2N') return 42; // 21 + 21
    return selectedHrs;
  }

  // ── Date display ──
  function updateDateDisplay() {
    const d = inp.checkinDate.value;
    const t = inp.checkinTime.value;

    if (!d || !selectedTour) {
      dateDisplay.textContent = !d ? 'Select a date and tour type' : 'Select a tour type';
      return;
    }

    const start = new Date(d + 'T00:00:00');

    if (selectedTour === 'Day tour') {
      dateDisplay.textContent = formatDateRange(start, start, selectedTour);
      return;
    }

    // Compute end date from actual check-in time + hours so it's always accurate
    if (t && selectedHrs) {
      const [hh, mm]  = t.split(':').map(Number);
      const totalMins = hh * 60 + mm + getEffectiveHrs() * 60;
      const daysOver  = Math.floor(totalMins / (24 * 60));
      const end       = new Date(start);
      end.setDate(end.getDate() + daysOver);
      dateDisplay.textContent = formatDateRange(start, end, selectedTour);
    } else {
      // Fallback when time not yet selected — use safe default offsets
      const end = new Date(start);
      end.setDate(end.getDate() + (selectedTour === '3D 2N' ? 2 : 1));
      dateDisplay.textContent = formatDateRange(start, end, selectedTour);
    }
  }

  function formatDateRange(start, end, label) {
    const s = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
    const e = `${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    return `${s} - ${e} (${label})`;
  }

  // ── Check-out time ──
  // Computes checkout from check-in + tour hours + extra time extension (if provided)
  function updateCheckout() {
    const t = inp.checkinTime.value;
    if (!t || !selectedHrs) {
      checkoutDis.textContent = 'Check-out: — (select hours above)';
      return;
    }
    const [hh, mm] = t.split(':').map(Number);
    const fmt = (h, m) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12    = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${String(m).padStart(2,'0')} ${period}`;
    };

    // Extra time extension added on top of the base tour hours
    const extraTimeExt  = parseFloat(inp.extraTimeExt.value) || 0;
    const totalHrs      = getEffectiveHrs() + extraTimeExt;
    const totalMins     = hh * 60 + mm + totalHrs * 60;
    const outH          = Math.floor(totalMins / 60) % 24;
    const outM          = totalMins % 60;

    // Build label: base hours + extra extension (if any)
    let label = selectedTour === '3D 2N' ? '21 hrs + 21 hrs' : `${selectedHrs} hrs`;
    if (extraTimeExt > 0) label += ` + ${extraTimeExt} hr${extraTimeExt !== 1 ? 's' : ''} extension`;

    checkoutDis.textContent = `Check-out: ${fmt(outH, outM)} (${label} from ${fmt(hh, mm)})`;
  }

  // ── Proceed button ──
  btnProceed.addEventListener('click', () => {
    errorEl.textContent = '';

    // Validate all fields
    const missing = [];
    if (!inp.guestName.value.trim())   missing.push('Guest Name');
    if (!inp.phoneNumber.value.trim())   missing.push('Phone Number');
    if (!inp.totalPax.value)           missing.push('Total Pax');    
    if (!inp.checkinDate.value)        missing.push('Date of Booking');
    if (!selectedTour)                 missing.push('Tour Type (Day/Night/Overnight/3D 2N)');
    if (!inp.checkinTime.value)        missing.push('Check-in Time');
    if (!selectedHrs)                  missing.push('Duration (21 hrs or 10 hrs)');
    if (!inp.downPayment.value)        missing.push('Down Payment');
    if (!inp.balance.value)            missing.push('Balance');
    if (!inp.datePayment.value)        missing.push('Date of Payment');
    if (!selectedMop)                  missing.push('Mode of Payment');
    if (!inp.refNumber.value.trim())   missing.push('Reference Number');
    if (!inp.emailTo.value.trim())     missing.push('Recipient Email');

    if (missing.length > 0) {
      errorEl.textContent = '\u26a0 Please fill in: ' + missing.join(', ');
      return;
    }
    if (!isValidEmail(inp.emailTo.value.trim())) {
      errorEl.textContent = '\u26a0 Please enter a valid email address';
      return;
    }

    // ── Build values ──
    const guestName  = inp.guestName.value.trim();
    const down       = '\u20b1' + Number(inp.downPayment.value).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const balance    = '\u20b1' + Number(inp.balance.value).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const datePay    = formatDisplayDate(inp.datePayment.value);
    const refNum     = inp.refNumber.value.trim();

    // Check-in / check-out times — include extra time extension on top of base tour hours
    const [hh, mm]   = inp.checkinTime.value.split(':').map(Number);
    const extraTimeExt = parseFloat(inp.extraTimeExt.value) || 0;
    const totalMins  = hh * 60 + mm + (getEffectiveHrs() + extraTimeExt) * 60;
    const outH       = Math.floor(totalMins / 60) % 24;
    const outM       = totalMins % 60;
    const checkinStr  = fmt12(hh, mm);
    const checkoutStr = fmt12(outH, outM);

    // Date of booking string — computed from actual time, same logic as updateDateDisplay
    const start = new Date(inp.checkinDate.value + 'T00:00:00');
    let end;
    if (selectedTour === 'Day tour') {
      end = new Date(start);
    } else {
      const daysOver = Math.floor(totalMins / (24 * 60));
      end = new Date(start);
      end.setDate(end.getDate() + daysOver);
    }
    const dateBooking = formatDateRange(start, end, selectedTour);

    // ── Build the email body message ──
    const guestFirstName = guestName.split(' ')[0];

    window._bookingDetails = {
      guestName, guestFirstName, checkinStr, checkoutStr, dateBooking,
      down, balance, datePay, mop: selectedMop, refNum
    };

    const message =
`Good day ${guestFirstName},

This is to formally confirm that we have successfully processed your downpayment for your reservation at Victoria's Haven Resort.

BOOKING_DETAILS_PLACEHOLDER

Please see the details below for your reference:

Reservation Name: ${guestName}
Down payment Amount: ${down}
Remaining Balance: ${balance}
Date of Payment: ${datePay}
Mode of Payment: ${selectedMop}
Reference Number: ${refNum}`;

    const closing =
`




We kindly request an acknowledgment of this transaction.


Thank you very much and we officially welcome you to Victoria's Haven Private Resort!


Kind regards,


Victoria's Haven
+63 954 184 3179`;

    // ── Push to email fields ──
    document.getElementById('emailTo').value   = inp.emailTo.value.trim();
    document.getElementById('emailBody').value = message;

    window._emailClosing = closing;

    // ── Switch to compose step ──
    form.style.display    = 'none';
    compose.style.display = '';
    window.scrollTo(0, 0);
    setTimeout(() => {
      if (typeof window.refreshEmailPreview === 'function') window.refreshEmailPreview();
    }, 100);
  });

  // ── Init ──
  updateTourButtons();
  initMainCalendar();

  // Default Date of Payment to today
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm0   = String(today.getMonth() + 1).padStart(2, '0');
  const dd0   = String(today.getDate()).padStart(2, '0');
  if (inp.datePayment && !inp.datePayment.value) {
    inp.datePayment.value = `${yyyy}-${mm0}-${dd0}`;
  }

  // ── Back button ──
  btnBack.addEventListener('click', () => {
    compose.style.display = 'none';
    form.style.display    = '';
  });

  /* ── Main booking form calendar ────────────────────────────────────────────
     Replaces the native <input type="date"> with a custom dropdown calendar.
     Fetches all booked dates from Firebase on init and blocks them.
     Syncs selected value to the hidden #bCheckinDate input and fires 'change'
     so all existing listeners (tour buttons, auto-checkin, etc.) still work.
  ─────────────────────────────────────────────────────────────────────────── */
  function initMainCalendar() {
    const trigger      = document.getElementById('mainCalTrigger');
    const dropdown     = document.getElementById('mainCalDropdown');
    const triggerLabel = document.getElementById('mainCalTriggerLabel');
    const grid         = document.getElementById('mainCalGrid');
    const monthLabel   = document.getElementById('mainCalMonthLabel');
    const btnPrev      = document.getElementById('mainCalPrev');
    const btnNext      = document.getElementById('mainCalNext');
    if (!trigger || !dropdown || !grid) return;

    const MONTH_NAMES_MC = ['January','February','March','April','May','June',
                             'July','August','September','October','November','December'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calYear           = today.getFullYear();
    let calMonth          = today.getMonth();
    let selectedDate      = null;       // YYYY-MM-DD
    // fullyBookedDates: red — not clickable (checkout after 10 PM, or intermediate overnight day)
    // partialDates:     yellow — clickable (checkout ≤ 11 AM, afternoon slot still open)
    let fullyBookedDates  = new Set();
    let partialDates      = new Set();

    /* Pad to YYYY-MM-DD */
    function toYMD(y, m, d) {
      return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    /* Format YYYY-MM-DD → display label e.g. "May 24, 2026" */
    function toDisplayLabel(ymd) {
      const [y, m, d] = ymd.split('-').map(Number);
      return `${MONTH_NAMES_MC[m - 1]} ${d}, ${y}`;
    }

    /* Render the calendar grid for the current calYear / calMonth.
       Three date states:
       — Red   (mainCalBooked):   fully occupied, not clickable.
                                  Covers check-in days whose checkout > 10 PM
                                  and any intermediate day of a multi-night stay.
       — Yellow (mainCalPartial): checkout date whose checkout time ≤ 11 AM;
                                  afternoon slot (2 PM onward) is still open —
                                  clickable, no booking details shown.
       — White (mainCalAvailable): fully free, clickable.
    */
    function renderGrid() {
      monthLabel.textContent = `${MONTH_NAMES_MC[calMonth]} ${calYear}`;

      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMo = new Date(calYear, calMonth + 1, 0).getDate();
      const todayYMD = toYMD(today.getFullYear(), today.getMonth(), today.getDate());

      let html = '';

      // Leading blank cells
      for (let i = 0; i < firstDay; i++) {
        html += `<span class="mainCalCell mainCalEmpty"></span>`;
      }

      for (let day = 1; day <= daysInMo; day++) {
        const ymd     = toYMD(calYear, calMonth, day);
        const dateObj = new Date(ymd + 'T00:00:00');
        const isPast  = dateObj < today;
        const isFull  = fullyBookedDates.has(ymd);
        const isPartial = !isFull && partialDates.has(ymd);
        const isSel   = ymd === selectedDate;
        const isToday = ymd === todayYMD;

        let cls = 'mainCalCell';
        if (isPast) {
          cls += ' mainCalDisabled';
        } else if (isFull) {
          // Fully occupied — red, not clickable
          cls += ' mainCalDisabled mainCalBooked';
        } else if (isPartial) {
          // Checkout by 11 AM — yellow, still selectable
          cls += ' mainCalAvailable mainCalPartial';
        } else {
          cls += ' mainCalAvailable';
        }
        if (isSel)             cls += ' mainCalSelectedDay';
        if (isToday && !isSel) cls += ' mainCalToday';

        const title = isFull ? 'Fully booked' : isPartial ? 'Available after 2 PM' : isPast ? 'Past date' : '';
        html += `<span class="${cls}" data-date="${ymd}" title="${title}">${day}</span>`;
      }

      grid.innerHTML = html;

      // Attach click handlers to available cells (includes partial/yellow dates)
      grid.querySelectorAll('.mainCalAvailable').forEach(cell => {
        cell.addEventListener('click', () => {
          selectedDate = cell.dataset.date;

          // Sync hidden input and fire change so booking.js listeners react
          inp.checkinDate.value = selectedDate;
          inp.checkinDate.dispatchEvent(new Event('change'));

          // Update trigger label
          triggerLabel.textContent = toDisplayLabel(selectedDate);
          trigger.classList.add('mainCalTriggerActive');

          closeCalendar();
        });
      });
    }

    function openCalendar() {
      dropdown.style.display = 'block';
      trigger.classList.add('mainCalOpen');
      renderGrid();
    }

    function closeCalendar() {
      dropdown.style.display = 'none';
      trigger.classList.remove('mainCalOpen');
    }

    // Toggle open/close on trigger button click
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.style.display === 'none' ? openCalendar() : closeCalendar();
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
        closeCalendar();
      }
    });

    // Month navigation
    btnPrev.addEventListener('click', e => {
      e.stopPropagation();
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderGrid();
    });
    btnNext.addEventListener('click', e => {
      e.stopPropagation();
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderGrid();
    });

    /* Fetch all bookings from Firebase and classify each date:
       — fullyBookedDates: check-in day + all intermediate days of multi-night stay
                           PLUS checkout date when checkout time > 10 PM (22:00).
       — partialDates:     checkout date when checkout time ≤ 11 AM (660 mins);
                           an afternoon check-in is still possible that day.
       Rule of thumb matching the business standard:
         Check-in 2 PM, overnight checkout next day 11 AM.
         The checkout date (next day) is "partial/yellow" — open after 11 AM.
         The check-in date itself is "red" because that slot (2 PM–11 AM) is taken. */
    async function fetchBookedDates() {
      try {
        const res  = await fetch(`${FB_DB_URL}${FB_BOOKINGS}.json`);
        const data = await res.json();
        if (!data || typeof data !== 'object') return;

        // Helper: parse any stored time string → total minutes since midnight (null if unparseable)
        function parseStoredTimeMins(timeStr) {
          if (!timeStr) return null;
          // 24hr "HH:MM"
          const m24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
          if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
          // 12hr "H:MM AM/PM"
          const m12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!m12) return null;
          let h = parseInt(m12[1]);
          const mins = parseInt(m12[2]);
          const period = m12[3].toUpperCase();
          if (period === 'AM' && h === 12) h = 0;
          if (period === 'PM' && h !== 12) h += 12;
          return h * 60 + mins;
        }

        const CHECKOUT_LATE_THRESHOLD = 22 * 60;   // 10:00 PM — after this, date is fully blocked
        const CHECKOUT_MORNING_LIMIT  = 11 * 60;   // 11:00 AM — checkout by this time → partial/yellow

        Object.values(data).forEach(row => {
          if (!row || typeof row !== 'object') return;
          const b  = row.booking || {};
          const ci = b.checkinDate  || row.dateKey || '';
          const co = b.checkoutDate || ci;
          if (!ci) return;

          // Compute checkout time in minutes; fall back to tour-hours calculation if not stored
          let checkoutMins = parseStoredTimeMins(b.checkoutTime);
          if (checkoutMins === null) {
            const checkinMins = parseStoredTimeMins(b.checkinTime);
            if (checkinMins !== null) {
              const hrs = TOUR_HRS_MAP[b.tourType] || 10;
              checkoutMins = (checkinMins + hrs * 60) % (24 * 60);
            }
          }

          const checkinDateObj  = new Date(ci + 'T00:00:00');
          const checkoutDateObj = new Date(co + 'T00:00:00');

          // Walk every calendar day spanned by this booking
          const cur = new Date(checkinDateObj);
          while (cur <= checkoutDateObj) {
            const ymd         = cur.toISOString().split('T')[0];
            const isCheckinDay  = ymd === ci;
            const isCheckoutDay = ymd === co;

            if (isCheckinDay && isCheckoutDay && ci === co) {
              // Same-day booking (day tour / night tour) — mark fully occupied
              fullyBookedDates.add(ymd);
            } else if (isCheckoutDay && !isCheckinDay) {
              // This is the checkout date of a multi-day booking
              // Partial (yellow) if checkout ≤ 11 AM — afternoon slot still open
              // Fully blocked (red) if checkout > 10 PM — no room left that day
              if (checkoutMins !== null && checkoutMins <= CHECKOUT_MORNING_LIMIT) {
                // Only add to partial if not already fully booked by another booking
                if (!fullyBookedDates.has(ymd)) partialDates.add(ymd);
              } else {
                // Late checkout OR unknown time — treat as fully occupied
                fullyBookedDates.add(ymd);
                partialDates.delete(ymd);
              }
            } else {
              // Check-in day or intermediate day of multi-night stay — always fully blocked
              fullyBookedDates.add(ymd);
              partialDates.delete(ymd);
            }

            cur.setDate(cur.getDate() + 1);
          }
        });

        // Re-render if calendar is already open
        if (dropdown.style.display !== 'none') renderGrid();
      } catch (_) { /* fail silently — calendar works without blocked dates */ }
    }

    fetchBookedDates();
  }

  // ── Helpers ──
  function fmt12(h, m) {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12    = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2,'0')} ${period}`;
  }

  function formatDisplayDate(val) {
    if (!val) return '\u2014';
    const d = new Date(val + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

})();