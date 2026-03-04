// supabase.js — Supabase client + all database operations

const SUPABASE_URL  = 'https://bibexftewatiaytyiepn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYmV4ZnRld2F0aWF5dHlpZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDgzOTgsImV4cCI6MjA4ODE4NDM5OH0.itFdCVwI3anEK7HBQGn9VbvQxAzZC5HeZQRZFHg-CTk';

/* ══════════════════════════════════════
   SUPABASE REST HELPERS
   Uses fetch() directly — no npm needed.
   Works from file:// in the browser.
══════════════════════════════════════ */

const SB = {

  _headers() {
    return {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Prefer':        'return=representation',
    };
  },

  /* Insert one booking row */
  async insert(row) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method:  'POST',
      headers: this._headers(),
      body:    JSON.stringify(row),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase insert failed: ${err}`);
    }
    return await res.json();
  },

  /* Fetch all bookings for a specific date_key */
  async fetchByDate(dateKey) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?date_key=eq.${encodeURIComponent(dateKey)}&order=created_at.asc`,
      { method: 'GET', headers: this._headers() }
    );
    if (!res.ok) throw new Error(`Supabase fetch failed: ${await res.text()}`);
    return await res.json(); // array of rows
  },

  /* Fetch ALL bookings (used on init to populate Bookings cache) */
  async fetchAll() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?order=created_at.asc`,
      { method: 'GET', headers: this._headers() }
    );
    if (!res.ok) throw new Error(`Supabase fetchAll failed: ${await res.text()}`);
    return await res.json();
  },

  /* Delete a booking by its supabase row id */
  async deleteById(sbId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${sbId}`,
      { method: 'DELETE', headers: this._headers() }
    );
    if (!res.ok) throw new Error(`Supabase delete failed: ${await res.text()}`);
  },
};

/* ══════════════════════════════════════
   DB STATUS INDICATOR
══════════════════════════════════════ */
let _dbOnline = false;

function setDbStatus(online) {
  _dbOnline = online;
  const dot = document.getElementById('dbStatusDot');
  const lbl = document.getElementById('dbStatusLabel');
  if (!dot || !lbl) return;
  dot.className = 'db-dot ' + (online ? 'online' : 'offline');
  lbl.textContent = online ? 'Supabase Connected' : 'Offline (local only)';
}

/* ══════════════════════════════════════
   INIT — load all bookings from Supabase
   into the in-memory Bookings cache on startup
══════════════════════════════════════ */
async function initSupabase() {
  try {
    const rows = await SB.fetchAll();
    // Populate Bookings cache (keyed by date_key)
    rows.forEach(row => {
      const key = row.date_key;
      if (!Bookings[key]) Bookings[key] = [];
      // Reconstruct booking object from DB row
      const booking = dbRowToBooking(row);
      // Avoid duplicates if localStorage also has the same entry
      const exists = Bookings[key].some(b => b.sbId === row.id);
      if (!exists) Bookings[key].push(booking);
    });
    setDbStatus(true);
    console.log(`✅ Supabase loaded ${rows.length} bookings.`);
  } catch(e) {
    setDbStatus(false);
    console.warn('⚠️ Supabase unavailable, using localStorage only.', e.message);
  }
}

/* ══════════════════════════════════════
   CONVERTERS
══════════════════════════════════════ */

/* Booking object → Supabase row (snake_case) */
function bookingToDbRow(b) {
  return {
    date_key:             b.dateKey,
    guest_name:           b.guestName,
    guest_email:          b.guestEmail,
    guest_phone:          b.guestPhone,
    pax:                  b.pax,
    extra_pax:            b.extraPax,
    total_pax:            b.totalPax,
    pets:                 b.pets,
    payment_date:         b.paymentDate,
    payment_mode:         b.paymentMode,
    total:                b.total,
    downpayment:          b.downpayment,
    balance:              b.balance,
    checkin_date:         b.checkinDate,
    checkout_date:        b.checkoutDate,
    checkin_date_label:   b.checkinDateLabel,
    checkout_date_label:  b.checkoutDateLabel,
    tour_type:            b.tourType,
    checkin_time:         b.checkinTime,
    checkout_time:        b.checkoutTime,
    raw_json:             b,   // full JSON blob stored in jsonb column
  };
}

/* Supabase row → booking object (camelCase) */
function dbRowToBooking(row) {
  return {
    sbId:               row.id,           // supabase PK
    id:                 row.id,
    dateKey:            row.date_key,
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
    checkinDate:        row.checkin_date,
    checkoutDate:       row.checkout_date,
    checkinDateLabel:   row.checkin_date_label,
    checkoutDateLabel:  row.checkout_date_label,
    tourType:           row.tour_type,
    checkinTime:        row.checkin_time,
    checkoutTime:       row.checkout_time,
    createdAt:          row.created_at,
  };
}
