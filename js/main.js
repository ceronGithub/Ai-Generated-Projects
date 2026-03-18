// ============================================================
// STREETWISE PH — pages/main.js  (ZERO external imports)
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
    t.style.opacity = "0"; t.style.transform = "translateX(100%)"; t.style.transition = "all .3s";
    setTimeout(function() { t.remove(); }, 300);
  }, ms);
};

window.formatPrice = function(n) {
  return "₱" + parseFloat(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.formatDate = function(ts) {
  if (!ts) return "—";
  var d = ts && ts.toDate ? ts.toDate() : new Date(ts);
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

window.addEventListener("cartUpdated", window.updateCartBadge);

// ── Navbar ─────────────────────────────────────────────────
function initNavbar() {
  var nav = document.querySelector(".navbar");
  if (nav) window.addEventListener("scroll", function() { nav.classList.toggle("scrolled", window.scrollY > 40); });

  var hamburger  = document.getElementById("nav-hamburger");
  var mobileMenu = document.getElementById("mobile-menu");
  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", function() {
      mobileMenu.classList.toggle("open");
      document.body.style.overflow = mobileMenu.classList.contains("open") ? "hidden" : "";
    });
  }

  var page = window.location.pathname.split("/").pop() || "index.html";
  var links = document.querySelectorAll(".nav-link");
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute("href") === page) links[i].classList.add("active");
  }

  var closes = document.querySelectorAll(".modal-close");
  for (var j = 0; j < closes.length; j++) {
    closes[j].addEventListener("click", function() {
      var overlay = this.closest(".modal-overlay");
      if (overlay) { overlay.classList.remove("active"); document.body.style.overflow = ""; }
    });
  }

  document.addEventListener("click", function(e) {
    if (e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("active");
      document.body.style.overflow = "";
    }
  });

  var logoutBtn = document.getElementById("nav-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function() {
      import("../firebase/auth.js").then(function(m) {
        m.logoutUser().catch(function() {});
      }).catch(function() {});
      window.showToast("Logged out.", "info");
      setTimeout(function() { window.location.href = "index.html"; }, 600);
    });
  }
}

// ── Auth state ─────────────────────────────────────────────
function initAuth() {
  import("../firebase/auth.js").then(function(m) {
    m.onAuthChange(function(user) {
      var loginBtn  = document.getElementById("nav-login-btn");
      var userEl    = document.getElementById("nav-user");
      var ownerLink = document.getElementById("nav-owner-link");
      if (user) {
        m.getCurrentProfile(user.uid).then(function(p) {
          if (loginBtn) loginBtn.classList.add("hidden");
          if (userEl) {
            userEl.classList.remove("hidden");
            var av = userEl.querySelector(".nav-user-avatar");
            var nm = userEl.querySelector(".nav-user-name");
            if (av) av.textContent = ((p && p.fullName) || user.email || "U")[0].toUpperCase();
            if (nm) nm.textContent = (p && p.fullName) || user.email || "";
          }
          if (ownerLink && p && p.role === "owner") ownerLink.classList.remove("hidden");
        }).catch(function() {});
      } else {
        if (loginBtn) loginBtn.classList.remove("hidden");
        if (userEl) userEl.classList.add("hidden");
        if (ownerLink) ownerLink.classList.add("hidden");
      }
    });
  }).catch(function(err) {
    console.warn("Firebase auth not available:", err.message);
  });
}

// ── Login form ─────────────────────────────────────────────
function initLoginForm() {
  var form = document.getElementById("signin-form");
  if (!form) return;
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    var btn = form.querySelector("button[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Signing in..."; }
    var email    = (document.getElementById("si-email") || {}).value || "";
    var password = (document.getElementById("si-password") || {}).value || "";
    import("../firebase/auth.js").then(function(m) {
      return m.loginUser(email, password);
    }).then(function(result) {
      window.showToast("Welcome back!", "success");
      window.closeModal("login-modal");
      setTimeout(function() {
        var role = result && result.profile && result.profile.role;
        window.location.href = role === "owner" ? "dashboard.html" : "index.html";
      }, 600);
    }).catch(function() {
      window.showToast("Invalid email or password.", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
    });
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  initNavbar();
  initAuth();
  initLoginForm();
  window.updateCartBadge();
  // Hide loader
  setTimeout(function() {
    var l = document.getElementById("page-loader");
    if (l) { l.style.opacity = "0"; l.style.transition = "opacity .4s"; setTimeout(function() { l.style.display = "none"; }, 500); }
  }, 800);
});
