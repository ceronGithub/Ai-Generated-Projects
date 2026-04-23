/* booking.js — Booking form logic: date, time, tour type, MOP, validation */
(function () {

  // ── State ──
  let selectedTour = '';   // 'Day tour' | 'Night tour' | 'Over Night' | '3D 2N'
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
  };

  // ── Tour type buttons ──
  document.querySelectorAll('.tour-btn[data-tour]').forEach(btn => {
    btn.addEventListener('click', () => {
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
  inp.extraTimeExt.addEventListener('input', () => updateCalculations());
  inp.downPayment.addEventListener('input', () => updateCalculations());
  inp.balance.addEventListener('input', () => updateCalculations());

  // ── Date + Time listeners ──
  inp.checkinDate.addEventListener('change', () => { updateDateDisplay(); updateCheckout(); });
  inp.checkinTime.addEventListener('change', () => { updateDateDisplay(); updateCheckout(); });

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

    const totalMins = hh * 60 + mm + getEffectiveHrs() * 60;
    const outH = Math.floor(totalMins / 60) % 24;
    const outM = totalMins % 60;
    const label = selectedTour === '3D 2N' ? '21 hrs + 21 hrs' : `${selectedHrs} hrs`;
    checkoutDis.textContent = `Check-out: ${fmt(outH, outM)} (${label} from ${fmt(hh, mm)})`;
  }

  // ── Proceed button ──
  btnProceed.addEventListener('click', () => {
    errorEl.textContent = '';

    // Validate all fields
    const missing = [];
    if (!inp.guestName.value.trim())   missing.push('Guest Name');
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

    // Check-in / check-out times
    const [hh, mm]   = inp.checkinTime.value.split(':').map(Number);
    const totalMins  = hh * 60 + mm + getEffectiveHrs() * 60;
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
    if (!val) return '\u2014';
    const d = new Date(val + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

})();