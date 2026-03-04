// supabase.js — Supabase client + always-fetch-from-DB strategy

const SUPABASE_URL  = 'https://bibexftewatiaytyiepn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYmV4ZnRld2F0aWF5dHlpZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDgzOTgsImV4cCI6MjA4ODE4NDM5OH0.itFdCVwI3anEK7HBQGn9VbvQxAzZC5HeZQRZFHg-CTk';

/* ══════════════════════════════════════════════════
   SUPABASE REST CLIENT
   Pure fetch() — no npm, works from file://
══════════════════════════════════════════════════ */
const SB = {

  _headers() {
    return {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Prefer':        'return=representation',
    };
  },

  /* INSERT one booking row */
  async insert(row) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method:  'POST',
      headers: this._headers(),
      body:    JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`Insert failed: ${await res.text()}`);
    return await res.json();
  },

  /* FETCH ALL rows, ordered by check-in date then created_at */
  async fetchAll() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?order=checkin_date.asc,created_at.asc`,
      { method: 'GET', headers: this._headers() }
    );
    if (!res.ok) throw new Error(`FetchAll failed: ${await res.text()}`);
    return await res.json(); // array of DB rows
  },

  /* DELETE by Supabase row id */
  async deleteById(sbId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${sbId}`,
      { method: 'DELETE', headers: this._headers() }
    );
    if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`);
  },
};

/* ══════════════════════════════════════════════════
   DB STATUS INDICATOR
══════════════════════════════════════════════════ */
let _dbOnline = false;

function setDbStatus(online, count) {
  _dbOnline = online;
  const dot = document.getElementById('dbStatusDot');
  const lbl = document.getElementById('dbStatusLabel');
  if (!dot || !lbl) return;
  dot.className   = 'db-dot ' + (online ? 'online' : 'offline');
  lbl.textContent = online
    ? `Supabase ✓ (${count ?? 0} booking${count !== 1 ? 's' : ''})`
    : 'Offline — local only';
}

/* ══════════════════════════════════════════════════
   FLATTEN DB ROW → booking object
   Reads from raw_json (the full compiled JSON blob)
   first, then falls back to flat DB columns.
   This ensures the nested guest/payment/booking
   structure is always available in the cache.
══════════════════════════════════════════════════ */
function flattenRow(row) {
  // Prefer raw_json if it exists (full structured payload)
  const rj = row.raw_json || {};

  return {
    // ── Identity ──────────────────────────────────
    sbId:      row.id,
    id:        row.id,
    dateKey:   row.date_key,
    createdAt: row.created_at,

    // ── Guest (nested + flat fallbacks) ───────────
    guest: rj.guest || {
      name:     row.guest_name,
      email:    row.guest_email,
      phone:    row.guest_phone,
      pax:      row.pax,
      extraPax: row.extra_pax,
      totalPax: row.total_pax,
      pets:     row.pets,
    },

    // ── Payment (nested + flat fallbacks) ─────────
    payment: rj.payment || {
      date:        row.payment_date,
      mode:        row.payment_mode,
      total:       parseFloat(row.total),
      downpayment: parseFloat(row.downpayment),
      balance:     parseFloat(row.balance),
    },

    // ── Booking (nested + flat fallbacks) ─────────
    booking: rj.booking || {
      tourType:           row.tour_type,
      checkinDate:        row.checkin_date,
      checkinDateLabel:   row.checkin_date_label,
      checkoutDate:       row.checkout_date,
      checkoutDateLabel:  row.checkout_date_label,
      checkinTime:        row.checkin_time,
      checkinTime12:      _fmt12(row.checkin_time),
      checkoutTime:       row.checkout_time,
      checkoutTime12:     _fmt12(row.checkout_time),
    },

    // ── Day info (nested + default fallback) ──────
    dayInfo: rj.dayInfo || { type: 'weekday', icon: '📅', label: '' },

    // ── Flat aliases (for backwards compat) ───────
    guestName:          row.guest_name,
    guestEmail:         row.guest_email,
    guestPhone:         row.guest_phone,
    pax:                row.pax,
    extraPax:           row.extra_pax,
    totalPax:           row.total_pax,
    pets:               row.pets,
    paymentDate:        row.payment_date,
    paymentMode:        row.payment_mode,
    total:              parseFloat(row.total),
    downpayment:        parseFloat(row.downpayment),
    balance:            parseFloat(row.balance),
    tourType:           row.tour_type,
    checkinDate:        row.checkin_date,
    checkoutDate:       row.checkout_date,
    checkinDateLabel:   row.checkin_date_label,
    checkoutDateLabel:  row.checkout_date_label,
    checkinTime:        row.checkin_time,
    checkoutTime:       row.checkout_time,
  };
}

/* ══════════════════════════════════════════════════
   INIT — Always fetch from Supabase.
   Clears in-memory cache and localStorage,
   then repopulates from DB rows keyed by date_key.
══════════════════════════════════════════════════ */
async function initSupabase() {
  setDbStatus(false, 0); // show connecting state

  try {
    const rows = await SB.fetchAll();

    // ── Clear everything — Supabase is source of truth ──
    Object.keys(Bookings).forEach(k => delete Bookings[k]);

    // ── Flatten each row and index by date_key ──
    rows.forEach(row => {
      const key     = row.date_key;
      const booking = flattenRow(row);
      if (!Bookings[key]) Bookings[key] = [];
      Bookings[key].push(booking);
    });

    // ── Sync localStorage to match Supabase ──
    saveBookingsLocal(Bookings);

    setDbStatus(true, rows.length);
    console.log(`✅ Supabase: loaded & flattened ${rows.length} bookings across ${Object.keys(Bookings).length} date(s).`);
    console.table(
      rows.map(r => ({
        date:     r.date_key,
        guest:    r.guest_name,
        tour:     r.tour_type,
        checkin:  r.checkin_time,
        checkout: r.checkout_time,
        total:    r.total,
        balance:  r.balance,
      }))
    );

  } catch(e) {
    // ── Fallback: use whatever is in localStorage ──
    setDbStatus(false, Object.values(Bookings).flat().length);
    console.warn('⚠️ Supabase unavailable. Loaded from localStorage.', e.message);
  }
}

/* ══════════════════════════════════════════════════
   REFRESH — re-fetch from Supabase and re-render
   calendar indicators. Call after save or delete.
══════════════════════════════════════════════════ */
async function refreshFromSupabase() {
  await initSupabase();
  applyBookingIndicators();
  // Re-render all 12 months to update booking dots
  renderAllMonths();
  applyBookingIndicators();
}

/* to12hr is defined in booking.js — used via flattenRow after booking.js loads */
function _fmt12(hhmm) {
  if (!hhmm || hhmm === '—' || hhmm === null) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hh     = h % 12 || 12;
  return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;
}