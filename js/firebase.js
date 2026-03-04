// firebase.js — Firebase client (replace FIREBASE_CONFIG with your project values)

/* ══════════════════════════════════════════════════
   FIREBASE CONFIG
   → Go to Firebase Console > Project Settings > Your Apps
   → Copy your firebaseConfig object and paste it below.
══════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD1l0ppLiZBG6f33qUMYAmcloScvv9eMRw",
  authDomain:        "victorias-haven-book-record.firebaseapp.com",
  projectId:         "victorias-haven-book-record",
  storageBucket:     "victorias-haven-book-record.firebasestorage.app",
  messagingSenderId: "338197629106",
  appId:             "1:338197629106:web:f739ab41e0900d831121ab",
  measurementId:     "G-EX34HHKS60",
};

/* ══════════════════════════════════════════════════
   LAZY CLIENT — initialised on first use
══════════════════════════════════════════════════ */
let _db = null;

function getDb() {
  if (_db) return _db;
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase SDK not loaded. Check CDN script tags in index.html.');
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  _db = firebase.firestore();
  return _db;
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
  lbl.textContent = online ? 'Firebase ✓' : 'Offline — local only';
}

/* ══════════════════════════════════════════════════
   HELPER — 24h → 12h
══════════════════════════════════════════════════ */
function _fmt12(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

/* ══════════════════════════════════════════════════
   FLATTEN Firestore doc → in-memory booking object
══════════════════════════════════════════════════ */
function flattenRow(row) {
  const rj  = (typeof row.raw_json === 'object' && row.raw_json) ? row.raw_json : {};

  return {
    sbId:      row.id,   // kept as alias so existing UI code still works
    id:        row.id,
    dateKey:   row.date_key,
    createdAt: row.created_at,

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
   FB — all Firestore operations
══════════════════════════════════════════════════ */
const FB = {

  async insert(row) {
    const db  = getDb();
    const ref = await db.collection('bookings').add({
      ...row,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return [{ id: ref.id, ...row }];
  },

  async fetchAll() {
    const db      = getDb();
    const snap    = await db.collection('bookings')
      .orderBy('checkin_date', 'asc')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateById(fbId, row) {
    const db = getDb();
    await db.collection('bookings').doc(fbId).update({
      ...row,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return [{ id: fbId, ...row }];
  },

  async deleteById(fbId) {
    const db = getDb();
    await db.collection('bookings').doc(fbId).delete();
  },
};

/* ══════════════════════════════════════════════════
   INIT — fetch all from Firestore → fill Bookings{}
══════════════════════════════════════════════════ */
async function initFirebase() {
  setDbStatus(false, 0);
  try {
    const rows = await FB.fetchAll();

    // wipe cache — Firestore is source of truth
    Object.keys(Bookings).forEach(k => delete Bookings[k]);

    rows.forEach(row => {
      const key = row.date_key;
      if (!Bookings[key]) Bookings[key] = [];
      Bookings[key].push(flattenRow({ id: row.id, ...row }));
    });

    saveBookingsLocal(Bookings);
    setDbStatus(true, rows.length);
    console.log(`✅ Firebase — ${rows.length} booking(s) loaded.`);
    if (rows.length) console.table(rows.map(r => ({
      id: r.id, date: r.date_key, guest: r.guest_name, tour: r.tour_type,
    })));

  } catch (e) {
    setDbStatus(false, Object.values(Bookings).flat().length);
    console.error('❌ Firebase init error:', e.message);
  }
}

/* ══════════════════════════════════════════════════
   REFRESH — re-fetch then re-render
══════════════════════════════════════════════════ */
async function refreshFromFirebase() {
  await initFirebase();
  renderAllMonths();
  applyBookingIndicators();
}