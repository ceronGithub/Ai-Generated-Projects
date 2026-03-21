// ============================================================
// STREETWISE PH — js/main.js  (used by index.html)
// NO top-level imports — Firebase loaded dynamically only
// ============================================================

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
    badge.textContent = count > 99 ? "99+" : (count || "");
    if (count > 0) {
      badge.classList.remove("hidden");
      badge.style.display = "flex";
    } else {
      badge.classList.add("hidden");
      badge.style.display = "none";
    }
  } catch(e) {}
};

window.hideLoader = function() {
  var l = document.getElementById("page-loader");
  if (l) { l.style.opacity = "0"; l.style.transition = "opacity .4s"; setTimeout(function() { l.style.display = "none"; }, 500); }
};

window.updateNavAuth = function(profile) {
  var loginBtn  = document.getElementById("nav-login-btn");
  var userEl    = document.getElementById("nav-user");
  var ownerLink = document.getElementById("nav-owner-link");
  if (!loginBtn) return;
  if (profile) {
    loginBtn.classList.add("hidden");
    if (userEl) {
      userEl.classList.remove("hidden");
      var av = userEl.querySelector(".nav-user-avatar");
      var nm = userEl.querySelector(".nav-user-name");
      var name = profile.fullName || (profile.user && profile.user.email) || profile.email || "Owner";
      if (av) av.textContent = name[0].toUpperCase();
      if (nm) nm.textContent = name;
    }
    if (ownerLink && profile.role === "owner") ownerLink.classList.remove("hidden");
  } else {
    loginBtn.classList.remove("hidden");
    if (userEl)    userEl.classList.add("hidden");
    if (ownerLink) ownerLink.classList.add("hidden");
  }
};

window.addEventListener("cartUpdated", window.updateCartBadge);

// ── DOM Ready ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {

  // ── Navbar scroll ─────────────────────────────────────
  var nav = document.querySelector(".navbar");
  if (nav) window.addEventListener("scroll", function() { nav.classList.toggle("scrolled", window.scrollY > 40); });

  // ── Hamburger menu ────────────────────────────────────
  var hb = document.getElementById("nav-hamburger");
  var mm = document.getElementById("mobile-menu");
  if (hb && mm) {
    hb.addEventListener("click", function() {
      mm.classList.toggle("open");
      document.body.style.overflow = mm.classList.contains("open") ? "hidden" : "";
    });
  }

  // ── Active nav link ───────────────────────────────────
  var page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach(function(l) {
    if (l.getAttribute("href") === page) l.classList.add("active");
  });

  // ── Modal close buttons ───────────────────────────────
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

  window.updateCartBadge();
  setTimeout(window.hideLoader, 500);

  // ── Firebase auth — loaded dynamically ───────────────
  // Loaded AFTER DOM is ready so failures don't block hamburger/navbar
  import("./firebase/f_auth.js").then(function(m) {
    m.onAuthChange(function(profile) {
      window.updateNavAuth(profile);
    });

    // ── Logout button ────────────────────────────────
    var isDashboard = page === "dashboard.html";
    var logoutBtn   = document.getElementById("nav-logout");
    if (logoutBtn && !isDashboard) {
      logoutBtn.addEventListener("click", function() {
        m.logoutUser().then(function() {
          window.updateNavAuth(null);
          window.showToast("Logged out.", "info");
          setTimeout(function() { window.location.href = "index.html"; }, 600);
        }).catch(function() {
          window.location.href = "index.html";
        });
      });
    }
  }).catch(function(err) {
    console.warn("Firebase auth not available:", err.message);
  });

});