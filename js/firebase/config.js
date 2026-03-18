// ============================================================
// STREETWISE PH — Firebase Config
// ✏️  Replace the values below with your Firebase credentials
// console.firebase.google.com → Project Settings → Your Apps → </>
// ============================================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✏️ PASTE YOUR FIREBASE CONFIG HERE ──────────────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ─────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
export default app;
