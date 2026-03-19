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
  apiKey: "AIzaSyBK2OCIjgBolmwPo8qUfQjmDRVFIzzZ4IM",
  authDomain: "streetwise-migs.firebaseapp.com",
  databaseURL: "https://streetwise-migs-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "streetwise-migs",
  storageBucket: "streetwise-migs.firebasestorage.app",
  messagingSenderId: "150651729107",
  appId: "1:150651729107:web:9a30da9f7129203054d026"
};
// ─────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
export default app;
