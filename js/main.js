// ============================================================
// STREETWISE PH — main.js | Core Utilities
// ============================================================

// ── SAFETY: Force hide loader after 3s no matter what ──────
window.addEventListener("load", () => {
  setTimeout(() => {
    const loader = document.getElementById("page-loader");
    if (loader) { loader.style.opacity = "0"; setTimeout(() => loader.remove(), 400); }
  }, 3000);
});

// ── Toast ──────────────────────────────────────────────────
window.showToast = function(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ── Format price ───────────────────────────────────────────
window.formatPrice = function(amount) {
  return "₱" + parseFloat(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
};

// ── Format date ────────────────────────────────────────────
window.formatDate = function(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

// ── Modal helpers ──────────────────────────────────────────
window.openModal  = id => { document.getElementById(id)?.classList.add("active");    document.body.style.overflow = "hidden"; };
window.closeModal = id => { document.getElementById(id)?.classList.remove("active"); document.body.style.overflow = ""; };
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("active");
    document.body.style.overflow = "";
  }
});

// ── Cart badge (works without Firebase) ───────────────────
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

// ── Hide loader ────────────────────────────────────────────
function hideLoader() {
  const loader = document.getElementById("page-loader");
  if (loader) { loader.classList.add("hidden"); setTimeout(() => loader.remove(), 400); }
}
window.hideLoader = hideLoader;

// ── Navbar scroll ──────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;
  window.addEventListener("scroll", () => navbar.classList.toggle("scrolled", window.scrollY > 40));
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
  // Close modal buttons
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      const overlay = btn.closest(".modal-overlay");
      if (overlay) { overlay.classList.remove("active"); document.body.style.overflow = ""; }
    });
  });
}

// ── Update nav with auth state ─────────────────────────────
window.updateNavAuth = function(profile) {
  const loginBtn  = document.getElementById("nav-login-btn");
  const userEl    = document.getElementById("nav-user");
  const ownerLink = document.getElementById("nav-owner-link");
  if (!loginBtn) return;
  if (profile) {
    loginBtn.classList.add("hidden");
    if (userEl) {
      userEl.classList.remove("hidden");
      const avatar = userEl.querySelector(".nav-user-avatar");
      const name   = userEl.querySelector(".nav-user-name");
      if (avatar) avatar.textContent = (profile.fullName || profile.email || "U")[0].toUpperCase();
      if (name)   name.textContent   = profile.fullName || profile.email || "";
    }
    if (ownerLink && profile.role === "owner") ownerLink.classList.remove("hidden");
  } else {
    loginBtn.classList.remove("hidden");
    if (userEl)    userEl.classList.add("hidden");
    if (ownerLink) ownerLink.classList.add("hidden");
  }
};

// ── Init on DOM ready ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  updateCartBadge();

  // Hide loader after short delay (fallback if Firebase loads fine)
  setTimeout(hideLoader, 500);

  // Try to init Firebase auth state — gracefully
  import("./firebase/config.js")
    .then(({ auth }) => {
      return import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
        .then(({ onAuthStateChanged }) => {
          return import("./firebase/auth.js").then(({ getCurrentProfile }) => {
            onAuthStateChanged(auth, async user => {
              if (user) {
                const profile = await getCurrentProfile(user.uid);
                window.updateNavAuth({ ...profile, email: user.email });
              } else {
                window.updateNavAuth(null);
              }
            });
          });
        });
    })
    .catch(err => {
      // Firebase not configured yet — show a helpful message in console
      console.warn("⚠️ Firebase not connected yet. Open js/firebase/config.js and paste your credentials.");
      console.warn(err.message);
    });

  // Logout button
  document.getElementById("nav-logout")?.addEventListener("click", async () => {
    try {
      const { logoutUser } = await import("./firebase/auth.js");
      await logoutUser();
      showToast("Logged out.", "info");
      setTimeout(() => window.location.href = "index.html", 600);
    } catch {}
  });
});