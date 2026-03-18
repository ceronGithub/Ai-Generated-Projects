// ============================================================
// STREETWISE PH — Firebase Config
// ============================================================
// HOW TO CONNECT:
// 1. Go to console.firebase.google.com
// 2. Your project → Project Settings → Your Apps → Web (</>)
// 3. Copy the firebaseConfig values and paste them below
// ============================================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✏️ REPLACE THESE WITH YOUR FIREBASE PROJECT VALUES
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── Check if config is filled in ──────────────────────────
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

if (!isConfigured) {
  console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.warn("⚠️  STREETWISE PH — Firebase not connected yet!");
  console.warn("   Open js/firebase/config.js and paste your credentials.");
  console.warn("   Follow SETUP.md for step-by-step instructions.");
  console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

let app, db, auth;

try {
  app  = initializeApp(firebaseConfig);
  db   = getFirestore(app);
  auth = getAuth(app);
} catch(e) {
  console.error("Firebase init error:", e.message);
}

export { app, db, auth };
export default app;