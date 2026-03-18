// background.js — shared storage declarations
// All booking logic lives in booking.js (loaded after this file)

const BOOKING_KEY = 'cal2026_bookings_v1';

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

// In-memory bookings cache { 'YYYY-MM-DD': [ bookingObj, ... ] }
// Populated by initFirebase(), persisted via saveBookingsLocal()
const Bookings = loadBookingsLocal();