// ============================================================
// STREETWISE PH — auth.js | Firebase Authentication
// Owner-only login. No public registration.
// ============================================================

import { auth, db } from "./config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Login ──────────────────────────────────────────────────
export async function loginUser(email, password) {
  const cred    = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getCurrentProfile(cred.user.uid);
  return { user: cred.user, profile };
}

// ── Logout ─────────────────────────────────────────────────
export async function logoutUser() {
  await signOut(auth);
}

// ── Get profile from Firestore ─────────────────────────────
export async function getCurrentProfile(uid = null) {
  const id   = uid || auth.currentUser?.uid;
  if (!id) return null;
  const snap = await getDoc(doc(db, "users", id));
  return snap.exists() ? snap.data() : null;
}

// ── Auth state listener ────────────────────────────────────
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Is owner ──────────────────────────────────────────────
export async function isOwner() {
  const profile = await getCurrentProfile();
  return profile?.role === "owner";
}