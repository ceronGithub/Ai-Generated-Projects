/* booking.js — Booking form logic: date, time, tour type, MOP, validation */
(function () {

  // ── State ──
  let selectedTour = '';   // 'Day tour' | 'Night tour' | 'Over Night'
  let selectedHrs  = 0;    // 21 | 10
  let selectedMop  = '';   // 'GCash' | 'Maya' | 'Bank Transfer' | 'Cash'

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  // ── Elements ──
  const form        = document.getElementById('bookingForm');
  const compose     = document.getElementById('composeStep');
  const btnProceed  = document.getElementById('btnProceed');
  const btnBack     = document.getElementById('btnBack');
  const errorEl     = document.getElementById('bookingError');
  const dateDisplay = document.getElementById('bDateDisplay');
  const checkoutDis = document.getElementById('bCheckoutDisplay');

  const inp = {
    guestName:   document.getElementById('bGuestName'),
    checkinDate: document.getElementById('bCheckinDate'),
    checkinTime: document.getElementById('bCheckinTime'),
    downPayment: document.getElementById('bDownPayment'),
    balance:     document.getElementById('bBalance'),
    datePayment: document.getElementById('bDatePayment'),
    refNumber:   document.getElementById('bRefNumber'),
    emailTo:     document.getElementById('bEmailTo'),
  };

  // ── Tour type buttons ──
  document.querySelectorAll('.tour-btn[data-tour]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tour-btn[data-tour]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTour = btn.dataset.tour;
      updateDateDisplay();
    });
  });

  // ── Hours buttons ──
  document.querySelectorAll('.tour-btn[data-hrs]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tour-btn[data-hrs]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHrs = parseInt(btn.dataset.hrs);
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

  // ── Date display ──
  inp.checkinDate.addEventListener('change', updateDateDisplay);

  function updateDateDisplay() {
    const d = inp.checkinDate.value;
    if (!d || !selectedTour) {
      dateDisplay.textContent = !d ? 'Select a date and tour type' : 'Select a tour type';
      return;
    }
    const start = new Date(d + 'T00:00:00');
    const end   = new Date(start);

    if (selectedTour === 'Day tour') {
      // Same day
      dateDisplay.textContent = formatDateRange(start, start, selectedTour);
    } else {
      // Night tour or Overnight → end is next day
      end.setDate(end.getDate() + 1);
      dateDisplay.textContent = formatDateRange(start, end, selectedTour);
    }
  }

  function formatDateRange(start, end, label) {
    const s = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
    const e = `${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    if (start.toDateString() === end.toDateString()) {
      return `${s} - ${e} (${label})`;
    }
    return `${s} - ${e} (${label})`;
  }

  // ── Check-out time ──
  inp.checkinTime.addEventListener('change', updateCheckout);

  function updateCheckout() {
    const t = inp.checkinTime.value;
    if (!t || !selectedHrs) {
      checkoutDis.textContent = 'Check-out: — (select hours above)';
      return;
    }
    const [hh, mm] = t.split(':').map(Number);
    const total = hh * 60 + mm + selectedHrs * 60;
    const outH  = Math.floor(total / 60) % 24;
    const outM  = total % 60;
    const fmt   = (h, m) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12    = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${String(m).padStart(2,'0')} ${period}`;
    };
    checkoutDis.textContent = `Check-out: ${fmt(outH, outM)} (${selectedHrs} hrs from ${fmt(hh, mm)})`;
  }

  // ── Proceed button ──
  btnProceed.addEventListener('click', () => {
    errorEl.textContent = '';

    // Validate all fields
    const missing = [];
    if (!inp.guestName.value.trim())   missing.push('Guest Name');
    if (!inp.checkinDate.value)        missing.push('Date of Booking');
    if (!selectedTour)                 missing.push('Tour Type (Day/Night/Overnight)');
    if (!inp.checkinTime.value)        missing.push('Check-in Time');
    if (!selectedHrs)                  missing.push('Duration (21 hrs or 10 hrs)');
    if (!inp.downPayment.value)        missing.push('Down Payment');
    if (!inp.balance.value)            missing.push('Balance');
    if (!inp.datePayment.value)        missing.push('Date of Payment');
    if (!selectedMop)                  missing.push('Mode of Payment');
    if (!inp.refNumber.value.trim())   missing.push('Reference Number');
    if (!inp.emailTo.value.trim())     missing.push('Recipient Email');

    if (missing.length > 0) {
      errorEl.textContent = '⚠ Please fill in: ' + missing.join(', ');
      return;
    }
    if (!isValidEmail(inp.emailTo.value.trim())) {
      errorEl.textContent = '⚠ Please enter a valid email address';
      return;
    }

    // ── Build values ──
    const guestName  = inp.guestName.value.trim();
    const down       = '₱' + Number(inp.downPayment.value).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const balance    = '₱' + Number(inp.balance.value).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const datePay    = formatDisplayDate(inp.datePayment.value);
    const refNum     = inp.refNumber.value.trim();

    // Check-in / check-out times
    const [hh, mm]   = inp.checkinTime.value.split(':').map(Number);
    const totalMins  = hh * 60 + mm + selectedHrs * 60;
    const outH       = Math.floor(totalMins / 60) % 24;
    const outM       = totalMins % 60;
    const checkinStr  = fmt12(hh, mm);
    const checkoutStr = fmt12(outH, outM);

    // Date of booking string
    const start = new Date(inp.checkinDate.value + 'T00:00:00');
    const end   = new Date(start);
    if (selectedTour !== 'Day tour') end.setDate(end.getDate() + 1);
    const dateBooking = formatDateRange(start, end, selectedTour);

    // ── Build the email body message ──
    // Store booking details for email.js to use in HTML bold formatting
    window._bookingDetails = {
      guestName, checkinStr, checkoutStr, dateBooking,
      down, balance, datePay, mop: selectedMop, refNum
    };

    const message =
`Good day ${guestName},

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
`We kindly request an acknowledgment of this transaction.


Thank you very much and we officially welcome you to Victoria's Haven Private Resort!


Kind regards,


Victoria's Haven
+63 954 184 3179`;

    // ── Push to email fields ──
    document.getElementById('emailTo').value   = inp.emailTo.value.trim();
    document.getElementById('emailBody').value = message;

    // Store closing for email.js to append after images
    window._emailClosing = closing;

    // ── Switch to compose step ──
    form.style.display    = 'none';
    compose.style.display = '';
    window.scrollTo(0, 0);
  });

  // ── Back button ──
  btnBack.addEventListener('click', () => {
    compose.style.display = 'none';
    form.style.display    = '';
  });

  // ── Helpers ──
  function fmt12(h, m) {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12    = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2,'0')} ${period}`;
  }

  function formatDisplayDate(val) {
    if (!val) return '—';
    const d = new Date(val + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

})();