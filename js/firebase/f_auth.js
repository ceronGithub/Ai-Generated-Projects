// ============================================================
// STREETWISE PH — auth.js | Firebase Authentication
// ============================================================

import { auth, db } from "./f_config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Login ─────────────────────────────────────────────────
// Exported as both loginUser and login to support all pages
export async function loginUser(email, password) {
  const cred    = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getCurrentProfile(cred.user.uid);
  return { user: cred.user, profile };
}
export const login = loginUser; // alias used by dashboard.js

// ── Logout ────────────────────────────────────────────────
// Exported as both logoutUser and logout to support all pages
export async function logoutUser() {
  await signOut(auth);
}
export const logout = logoutUser; // alias used by dashboard.js

// ── Get profile from Firestore ────────────────────────────
export async function getCurrentProfile(uid) {
  const id = uid || auth.currentUser?.uid;
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

// ── Auth state listener ───────────────────────────────────
// Fetches the Firestore profile (including role) and passes
// a merged { user, ...profile } object to the callback
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { callback(null); return; }
    try {
      const profile = await getCurrentProfile(user.uid);
      callback(profile ? { user, ...profile } : { user });
    } catch {
      callback({ user });
    }
  });
}

// ── Is owner ─────────────────────────────────────────────
export async function isOwner() {
  const profile = await getCurrentProfile();
  return profile?.role === "owner";
}