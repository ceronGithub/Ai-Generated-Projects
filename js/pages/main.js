// ============================================================
// STREETWISE PH — main.js (shared across all pages)
// ============================================================
import { onAuthChange, logout } from '../firebase/auth.js';
import { updateCartBadge } from '../firebase/cart.js';
import { showToast, hideLoader } from '../utils/helpers.js';

// Make showToast global for inline HTML calls
window.showToast = showToast;

// ── Navbar scroll ──────────────────────────────────────────
export function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (navbar) window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 40));
  const hamburger  = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
  }
  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    await logout();
    showToast('Logged out.', 'info');
    setTimeout(() => window.location.href = 'index.html', 600);
  });
}

// ── Auth state → update nav UI ─────────────────────────────
export function initAuth(onUser = null) {
  onAuthChange(state => {
    const loginBtn  = document.getElementById('nav-login-btn');
    const userEl    = document.getElementById('nav-user');
    const ownerLink = document.getElementById('nav-owner-link');
    if (state) {
      loginBtn?.classList.add('hidden');
      userEl?.classList.remove('hidden');
      const avatar = document.getElementById('nav-avatar');
      const name   = document.getElementById('nav-user-name');
      if (avatar) avatar.textContent = (state.user.email || 'U')[0].toUpperCase();
      if (name)   name.textContent   = state.user.displayName || state.user.email?.split('@')[0];
      if (ownerLink && state.role === 'owner') ownerLink.classList.remove('hidden');
    } else {
      loginBtn?.classList.remove('hidden');
      userEl?.classList.add('hidden');
      if (ownerLink) ownerLink.classList.add('hidden');
    }
    if (onUser) onUser(state);
  });
}

// ── Login form handler ─────────────────────────────────────
export function initLoginForm() {
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = signinForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Signing in...';
      try {
        const { login } = await import('../firebase/auth.js');
        const { user, role } = await login(document.getElementById('si-email').value, document.getElementById('si-password').value);
        showToast('Welcome back!', 'success');
        document.getElementById('login-modal')?.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => { if (role === 'owner') window.location.href = 'owner-dashboard.html'; else window.location.reload(); }, 600);
      } catch (err) {
        showToast(err.message.includes('invalid') || err.message.includes('password') ? 'Invalid email or password.' : err.message, 'error');
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    });
  }
  if (signupForm) {
    signupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = signupForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Creating account...';
      try {
        const { register } = await import('../firebase/auth.js');
        await register(document.getElementById('su-email').value, document.getElementById('su-password').value, document.getElementById('su-name').value, document.getElementById('su-username').value);
        showToast('Account created! You can now sign in.', 'success');
        switchLoginTab('signin');
        signupForm.reset();
      } catch (err) {
        showToast(err.message, 'error');
      }
      btn.disabled = false; btn.textContent = 'Create Account';
    });
  }
}

// ── Switch login tab ───────────────────────────────────────
window.switchLoginTab = function(tab) {
  document.getElementById('signin-form')?.classList.toggle('hidden', tab !== 'signin');
  document.getElementById('signup-form')?.classList.toggle('hidden', tab !== 'signup');
  document.getElementById('tab-signin-btn')?.classList.toggle('active', tab === 'signin');
  document.getElementById('tab-signup-btn')?.classList.toggle('active', tab === 'signup');
};

// ── Init on load ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  updateCartBadge();
  initLoginForm();
  setTimeout(hideLoader, 500);
});
