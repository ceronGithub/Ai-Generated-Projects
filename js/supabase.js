// supabase.js — Supabase client (lazy init, safe for file://)

const SUPABASE_URL  = 'https://bibexftewatiaytyiepn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYmV4ZnRld2F0aWF5dHlpZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDgzOTgsImV4cCI6MjA4ODE4NDM5OH0.itFdCVwI3anEK7HBQGn9VbvQxAzZC5HeZQRZFHg-CTk';

/* ══════════════════════════════════════════════════
   LAZY CLIENT — created on first use so we never
   crash at parse time if the CDN hasn't loaded yet.
══════════════════════════════════════════════════ */
let _client = null;

function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    throw new Error('Supabase SDK not loaded. Check CDN script tag.');
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

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
   SB — all Supabase operations
══════════════════════════════════════════════════ */
const SB = {

  async insert(row) {
    const db = getClient();
    const { data, error } = await db
      .from('bookings')
      .insert([row])
      .select();
    if (error) throw new Error(error.message + (error.details ? ' | ' + error.details : ''));
    return data;
  },

  async fetchAll() {
    const db = getClient();
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .order('checkin_date', { ascending: true })
      .order('created_at',   { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteById(sbId) {
    const db = getClient();
    const { error } = await db
      .from('bookings')
      .delete()
      .eq('id', sbId);
    if (error) throw new Error(error.message);
  },
};

/* ══════════════════════════════════════════════════
   HELPER — 24h → 12h (self-contained, no dependency)
══════════════════════════════════════════════════ */
function _fmt12(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

/* ══════════════════════════════════════════════════
   FLATTEN DB ROW → in-memory booking object
══════════════════════════════════════════════════ */
function flattenRow(row) {
  const rj = (typeof row.raw_json === 'object' && row.raw_json) ? row.raw_json : {};

  return {
    sbId:      row.id,
    id:        row.id,
    dateKey:   row.date_key,
    createdAt: row.created_at,

    // nested (used by booking form display)
    guest: rj.guest || {
      name:     row.guest_name,
      email:    row.guest_email,
      phone:    row.guest_phone,
      pax:      row.pax,
      extraPax: row.extra_pax,
      totalPax: row.total_pax,
      pets:     row.pets,
    },
    payment: rj.payment || {
      date:        row.payment_date,
      mode:        row.payment_mode,
      total:       +row.total       || 0,
      downpayment: +row.downpayment || 0,
      balance:     +row.balance     || 0,
    },
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
    dayInfo: rj.dayInfo || { type: 'weekday', icon: '📅', label: '' },

    // flat aliases for legacy code
    guestName:          row.guest_name,
    guestEmail:         row.guest_email,
    guestPhone:         row.guest_phone,
    pax:                row.pax,
    extraPax:           row.extra_pax,
    totalPax:           row.total_pax,
    pets:               row.pets,
    paymentDate:        row.payment_date,
    paymentMode:        row.payment_mode,
    total:              +row.total       || 0,
    downpayment:        +row.downpayment || 0,
    balance:            +row.balance     || 0,
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
   INIT — fetch all from Supabase → fill Bookings{}
══════════════════════════════════════════════════ */
async function initSupabase() {
  setDbStatus(false, 0);
  try {
    const rows = await SB.fetchAll();

    // wipe cache — Supabase is source of truth
    Object.keys(Bookings).forEach(k => delete Bookings[k]);

    rows.forEach(row => {
      const key = row.date_key;
      if (!Bookings[key]) Bookings[key] = [];
      Bookings[key].push(flattenRow(row));
    });

    saveBookingsLocal(Bookings);
    setDbStatus(true, rows.length);
    console.log(`✅ Supabase — ${rows.length} booking(s) loaded.`);
    if (rows.length) console.table(rows.map(r => ({
      id: r.id, date: r.date_key, guest: r.guest_name, tour: r.tour_type,
    })));

  } catch (e) {
    setDbStatus(false, Object.values(Bookings).flat().length);
    console.error('❌ Supabase init error:', e.message);
  }
}

/* ══════════════════════════════════════════════════
   REFRESH — re-fetch then re-render
══════════════════════════════════════════════════ */
async function refreshFromSupabase() {
  await initSupabase();
  renderAllMonths();
  applyBookingIndicators();
}