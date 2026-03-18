// ============================================================
// STREETWISE PH — pages/main.js
// Shared bootstrap for shop, product, cart, contact pages
// ============================================================

import { onAuthChange, getCurrentProfile, logoutUser } from "../firebase/auth.js";

// ── Globals ────────────────────────────────────────────────
window.showToast = function(msg, type="info", ms=3500) {
  let c = document.getElementById("toast-container");
  if (!c) { c = document.createElement("div"); c.id = "toast-container"; document.body.appendChild(c); }
  const t = document.createElement("div");
  t.className = `toast ${type}`; t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity="0"; t.style.transform="translateX(100%)"; t.style.transition="all .3s"; setTimeout(()=>t.remove(),300); }, ms);
};

window.formatPrice = n => "₱" + parseFloat(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
window.formatDate  = ts => { if(!ts) return "—"; const d=ts?.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}); };
window.openModal   = id => { document.getElementById(id)?.classList.add("active"); document.body.style.overflow="hidden"; };
window.closeModal  = id => { document.getElementById(id)?.classList.remove("active"); document.body.style.overflow=""; };

// ── Cart badge ─────────────────────────────────────────────
window.updateCartBadge = function() {
  try {
    const cart  = JSON.parse(localStorage.getItem("swph_cart")||"[]");
    const count = cart.reduce((s,i)=>s+(i.quantity||0),0);
    const badge = document.getElementById("cart-badge");
    if (!badge) return;
    badge.textContent = count||"";
    badge.style.display = count>0?"flex":"none";
  } catch {}
};
window.addEventListener("cartUpdated", window.updateCartBadge);

// ── Navbar ─────────────────────────────────────────────────
function initNavbar() {
  const nav = document.querySelector(".navbar");
  if (nav) window.addEventListener("scroll",()=>nav.classList.toggle("scrolled",window.scrollY>40));
  document.getElementById("nav-hamburger")?.addEventListener("click",()=>{
    const m=document.getElementById("mobile-menu");
    m?.classList.toggle("open");
    document.body.style.overflow=m?.classList.contains("open")?"hidden":"";
  });
  const page = window.location.pathname.split("/").pop()||"index.html";
  document.querySelectorAll(".nav-link").forEach(l=>{ if(l.getAttribute("href")===page) l.classList.add("active"); });
  document.querySelectorAll(".modal-close").forEach(b=>{
    b.addEventListener("click",()=>{ b.closest(".modal-overlay")?.classList.remove("active"); document.body.style.overflow=""; });
  });
  document.addEventListener("click",e=>{ if(e.target.classList.contains("modal-overlay")){ e.target.classList.remove("active"); document.body.style.overflow=""; } });
  document.getElementById("nav-logout")?.addEventListener("click",async()=>{
    try { await logoutUser(); } catch {}
    window.showToast("Logged out.","info");
    setTimeout(()=>window.location.href="index.html",600);
  });
}

// ── Auth state ─────────────────────────────────────────────
function initAuth() {
  onAuthChange(async user => {
    const loginBtn  = document.getElementById("nav-login-btn");
    const userEl    = document.getElementById("nav-user");
    const ownerLink = document.getElementById("nav-owner-link");
    if (user) {
      const p = await getCurrentProfile(user.uid);
      loginBtn?.classList.add("hidden");
      userEl?.classList.remove("hidden");
      const av = userEl?.querySelector(".nav-user-avatar");
      const nm = userEl?.querySelector(".nav-user-name");
      if (av) av.textContent = (p?.fullName||user.email||"U")[0].toUpperCase();
      if (nm) nm.textContent = p?.fullName||user.email||"";
      if (ownerLink&&p?.role==="owner") ownerLink.classList.remove("hidden");
    } else {
      loginBtn?.classList.remove("hidden");
      userEl?.classList.add("hidden");
      ownerLink?.classList.add("hidden");
    }
  });
}

// ── Login form ─────────────────────────────────────────────
function initLoginForm() {
  document.getElementById("signin-form")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const btn=e.target.querySelector("button[type=submit]");
    btn.disabled=true; btn.textContent="Signing in...";
    try {
      const { loginUser } = await import("../firebase/auth.js");
      const { profile }   = await loginUser(document.getElementById("si-email").value, document.getElementById("si-password").value);
      window.showToast("Welcome back!","success");
      document.getElementById("login-modal")?.classList.remove("active");
      document.body.style.overflow="";
      setTimeout(()=>{ window.location.href = profile?.role==="owner"?"dashboard.html":"index.html"; },600);
    } catch {
      window.showToast("Invalid email or password.","error");
      btn.disabled=false; btn.textContent="Sign In";
    }
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded",()=>{
  initNavbar(); initAuth(); initLoginForm(); window.updateCartBadge();
  setTimeout(()=>{
    const l=document.getElementById("page-loader");
    if(l){l.style.opacity="0";l.style.transition="opacity .4s";setTimeout(()=>l.style.display="none",500);}
  },800);
});
