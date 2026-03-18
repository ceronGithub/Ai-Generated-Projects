// ============================================================
// STREETWISE PH — pages/main.js | Shared page bootstrap
// Loaded by: shop.html, product.html, cart.html, contact.html
// ============================================================

import { onAuthChange, getCurrentProfile, logoutUser } from "../firebase/auth.js";
import { hideLoader, showToast, formatPrice, formatDate } from "../utils/helpers.js";

// Make globals available to inline HTML onclick handlers
window.showToast   = showToast;
window.formatPrice = formatPrice;
window.formatDate  = formatDate;
window.hideLoader  = hideLoader;

window.openModal  = id => { document.getElementById(id)?.classList.add("active");    document.body.style.overflow = "hidden"; };
window.closeModal = id => { document.getElementById(id)?.classList.remove("active"); document.body.style.overflow = ""; };

// ── Cart badge ─────────────────────────────────────────────
function updateCartBadge() {
  try {
    const cart  = JSON.parse(localStorage.getItem("swph_cart") || "[]");
    const count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    const badge = document.getElementById("cart-badge");
    if (!badge) return;
    badge.textContent = count || "";
    badge.style.display = count > 0 ? "flex" : "none";
  } catch {}
}
window.updateCartBadge = updateCartBadge;
window.addEventListener("cartUpdated", updateCartBadge);

// ── Navbar scroll ──────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector(".navbar");
  if (navbar) window.addEventListener("scroll", () => navbar.classList.toggle("scrolled", window.scrollY > 40));

  const hamburger  = document.getElementById("nav-hamburger");
  const mobileMenu = document.getElementById("mobile-menu");
  hamburger?.addEventListener("click", () => {
    mobileMenu?.classList.toggle("open");
    document.body.style.overflow = mobileMenu?.classList.contains("open") ? "hidden" : "";
  });

  const page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach(l => {
    if (l.getAttribute("href") === page) l.classList.add("active");
  });

  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".modal-overlay")?.classList.remove("active");
      document.body.style.overflow = "";
    });
  });

  document.addEventListener("click", e => {
    if (e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("active");
      document.body.style.overflow = "";
    }
  });

  document.getElementById("nav-logout")?.addEventListener("click", async () => {
    try { await logoutUser(); } catch {}
    showToast("Logged out.", "info");
    setTimeout(() => window.location.href = "index.html", 600);
  });
}

// ── Auth state → update nav ────────────────────────────────
function initAuth() {
  onAuthChange(async user => {
    const loginBtn  = document.getElementById("nav-login-btn");
    const userEl    = document.getElementById("nav-user");
    const ownerLink = document.getElementById("nav-owner-link");

    if (user) {
      const profile = await getCurrentProfile(user.uid);
      loginBtn?.classList.add("hidden");
      userEl?.classList.remove("hidden");
      const avatar = userEl?.querySelector(".nav-user-avatar");
      const name   = userEl?.querySelector(".nav-user-name");
      if (avatar) avatar.textContent = (profile?.fullName || user.email || "U")[0].toUpperCase();
      if (name)   name.textContent   = profile?.fullName || user.email || "";
      if (ownerLink && profile?.role === "owner") ownerLink.classList.remove("hidden");
    } else {
      loginBtn?.classList.remove("hidden");
      userEl?.classList.add("hidden");
      ownerLink?.classList.add("hidden");
    }
  });
}

// ── Sign in form handler ───────────────────────────────────
function initLoginForm() {
  document.getElementById("signin-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Signing in...";
    try {
      const { loginUser } = await import("../firebase/auth.js");
      const { profile }   = await loginUser(
        document.getElementById("si-email").value,
        document.getElementById("si-password").value
      );
      showToast("Welcome back!", "success");
      document.getElementById("login-modal")?.classList.remove("active");
      document.body.style.overflow = "";
      setTimeout(() => {
        if (profile?.role === "owner") window.location.href = "dashboard.html";
        else window.location.reload();
      }, 600);
    } catch(err) {
      showToast("Invalid email or password.", "error");
      btn.disabled = false; btn.textContent = "Sign In";
    }
  });
}

// ── Init on DOM ready ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initAuth();
  initLoginForm();
  updateCartBadge();
  // Hide loader
  setTimeout(hideLoader, 500);
});