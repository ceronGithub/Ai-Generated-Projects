/* ═══════════════════════════════════════════════════════════════
   firebase-config.js  —  YOUR FIREBASE CONNECTION SETTINGS
   ═══════════════════════════════════════════════════════════════

   ✏️  ONLY EDIT THIS FILE when you need to change the database.
   ⛔  Do NOT touch firebase.js — all connection logic lives there.

   HOW TO FIND YOUR DATABASE URL:
   ─────────────────────────────────────────────────────────────
   1. Go to https://console.firebase.google.com
   2. Open your project → Realtime Database → Data tab
   3. Copy the URL shown at the very top of the data panel
      Format: https://YOUR-PROJECT-rtdb.REGION.firebasedatabase.app
   ─────────────────────────────────────────────────────────────   */

const FIREBASE_CONFIG = {

  // 🔴 Paste your Firebase Realtime Database URL here
  databaseURL: 'https://official-victorias-haven-book-default-rtdb.asia-southeast1.firebasedatabase.app',

  // 📁 Root node where bookings are stored (do not change unless you know what you're doing)
  bookingsPath: '/bookings',

};

/* ─────────────────────────────────────────────────────────────
   DO NOT EDIT BELOW THIS LINE
   ───────────────────────────────────────────────────────────── */

// Validate on load — warn early if misconfigured
(function _validateConfig() {
  const url = FIREBASE_CONFIG.databaseURL || '';
  if (!url || url.includes('YOUR-PROJECT') || url.includes('YOUR_PROJECT')) {
    console.warn(
      '⚠️ firebase-config.js: databaseURL is not set.\n' +
      '   Open js/firebase-config.js and paste your Firebase Realtime Database URL.'
    );
  } else if (!url.startsWith('https://')) {
    console.warn('⚠️ firebase-config.js: databaseURL must start with https://');
  } else {
    console.log('🔥 Firebase config loaded — URL:', url);
  }
})();