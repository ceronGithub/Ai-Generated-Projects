// ============================================================
// STREETWISE PH — Firebase Config
// ✏️  Replace the values below with your Firebase credentials
// console.firebase.google.com → Project Settings → Your Apps → </>
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ✏️ PASTE YOUR FIREBASE CONFIG HERE ──────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyApXwj06EXN59jMiDcSb8bT3kOQuBdOiMA",
  authDomain: "streetwiseph-backup-f4daf.firebaseapp.com",
  projectId: "streetwiseph-backup-f4daf",
  storageBucket: "streetwiseph-backup-f4daf.firebasestorage.app",
  messagingSenderId: "727265220414",
  appId: "1:727265220414:web:75b79754d1b8e7fcfabe6f"
};
// ─────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
export default app;
