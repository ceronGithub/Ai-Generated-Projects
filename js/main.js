// ============================================================
// STREETWISE PH — js/main.js  (used by index.html)
// ============================================================
import { logoutUser, loginUser, onAuthChange } from "./firebase/f_auth.js";

// ── Globals ────────────────────────────────────────────────
window.showToast = function(msg, type, ms) {
  type = type || "info"; ms = ms || 3500;
  var c = document.getElementById("toast-container");
  if (!c) { c = document.createElement("div"); c.id = "toast-container"; document.body.appendChild(c); }
  var t = document.createElement("div");
  t.className = "toast " + type; t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() {
    t.style.opacity = "0"; t.style.transform = "translateX(100%)";
    t.style.transition = "all .3s"; setTimeout(function() { t.remove(); }, 300);
  }, ms);
};

window.formatPrice = function(n) {
  return "₱" + parseFloat(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.formatDate = function(ts) {
  if (!ts) return "—";
  var d = (ts && ts.toDate) ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

window.openModal = function(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.add("active"); document.body.style.overflow = "hidden"; }
};

window.closeModal = function(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove("active"); document.body.style.overflow = ""; }
};

window.updateCartBadge = function() {
  try {
    var cart  = JSON.parse(localStorage.getItem("swph_cart") || "[]");
    var count = cart.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);
    var badge = document.getElementById("cart-badge");
    if (!badge) return;
    badge.textContent = count || "";
    badge.style.display = count > 0 ? "flex" : "none";
  } catch(e) {}
};

window.hideLoader = function() {
  var l = document.getElementById("page-loader");
  if (l) { l.style.opacity = "0"; l.style.transition = "opacity .4s"; setTimeout(function() { l.style.display = "none"; }, 500); }
};

// ── Auth navbar ────────────────────────────────────────────
// FIX: Cache last known auth state so DOMContentLoaded can re-apply it
// if Firebase resolved before the DOM was ready (common on cached sessions).
var _lastAuthProfile = undefined; // undefined = not yet resolved; null = logged out

window.updateNavAuth = function(profile) {
  _lastAuthProfile = profile; // always cache, even null
  var loginBtn  = document.getElementById("nav-login-btn");
  var userEl    = document.getElementById("nav-user");
  var ownerLink = document.getElementById("nav-owner-link");
  if (!loginBtn) return; // DOM not ready — DOMContentLoaded will retry
  if (profile) {
    loginBtn.classList.add("hidden");
    if (userEl) {
      userEl.classList.remove("hidden");
      var av = document.getElementById("nav-avatar") || userEl.querySelector(".nav-user-avatar");
      var nm = document.getElementById("nav-user-name") || userEl.querySelector(".nav-user-name");
      var displayName = profile.fullName
        || (profile.user && profile.user.email)
        || profile.email
        || "Owner";
      if (av) av.textContent = displayName[0].toUpperCase();
      if (nm) nm.textContent = displayName;
    }
    if (ownerLink && profile.role === "owner") ownerLink.classList.remove("hidden");
  } else {
    loginBtn.classList.remove("hidden");
    if (userEl)    userEl.classList.add("hidden");
    if (ownerLink) ownerLink.classList.add("hidden");
  }
};

window.addEventListener("cartUpdated", window.updateCartBadge);

// ── Auth listener — registered immediately at module load ──
// Fires once with current auth state when Firebase SDK initialises.
// May fire before or after DOMContentLoaded — both cases handled below.
onAuthChange(function(profile) {
  window.updateNavAuth(profile);
});

// ── DOM Ready ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  // FIX: Re-apply auth state if Firebase already resolved before DOM was ready
  if (_lastAuthProfile !== undefined) {
    window.updateNavAuth(_lastAuthProfile);
  }

  var nav = document.querySelector(".navbar");
  if (nav) window.addEventListener("scroll", function() { nav.classList.toggle("scrolled", window.scrollY > 40); });

  var hb = document.getElementById("nav-hamburger");
  var mm = document.getElementById("mobile-menu");
  if (hb && mm) {
    hb.addEventListener("click", function() {
      mm.classList.toggle("open");
      document.body.style.overflow = mm.classList.contains("open") ? "hidden" : "";
    });
  }

  var page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach(function(l) {
    if (l.getAttribute("href") === page) l.classList.add("active");
  });

  document.querySelectorAll(".modal-close").forEach(function(b) {
    b.addEventListener("click", function() {
      var o = b.closest(".modal-overlay");
      if (o) { o.classList.remove("active"); document.body.style.overflow = ""; }
    });
  });
  document.addEventListener("click", function(e) {
    if (e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("active"); document.body.style.overflow = "";
    }
  });

  // ── Logout — skip on dashboard (it has its own listener) ─
  var isDashboard = page === "dashboard.html";
  var logoutBtn   = document.getElementById("nav-logout");
  if (logoutBtn && !isDashboard) {
    logoutBtn.addEventListener("click", function() {
      logoutUser()
        .then(function() {
          window.updateNavAuth(null);
          window.showToast("Logged out.", "info");
          setTimeout(function() { window.location.href = "index.html"; }, 600);
        })
        .catch(function(err) {
          console.error("Logout error:", err);
          window.location.href = "index.html";
        });
    });
  }

  window.updateCartBadge();
  setTimeout(window.hideLoader, 500);
});