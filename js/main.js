// ============================================================
// STREETWISE PH - main.js | Navbar, Auth State, Toast, Utilities
// ============================================================

const API = {
  auth:      'php/controllers/auth.php',
  products:  'php/controllers/products.php',
  cart:      'php/controllers/cart.php',
  orders:    'php/controllers/orders.php',
  inventory: 'php/controllers/inventory.php',
  sales:     'php/controllers/sales.php',
  comments:  'php/controllers/comments.php',
};

// ── Toast ──────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = 'all 0.3s ease'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── Auth State ─────────────────────────────────────────────
async function checkAuthState() {
  try {
    const res  = await fetch(`${API.auth}?action=status`);
    const data = await res.json();
    updateNavAuth(data);
    return data;
  } catch { return { logged_in: false, user: { role: 'guest' } }; }
}

function updateNavAuth(data) {
  const loginBtn  = document.getElementById('nav-login-btn');
  const userEl    = document.getElementById('nav-user');
  const logoutBtn = document.getElementById('nav-logout');
  const ownerLink = document.getElementById('nav-owner-link');
  if (!loginBtn) return;
  if (data.logged_in) {
    loginBtn.classList.add('hidden');
    if (userEl) {
      userEl.classList.remove('hidden');
      const avatar = userEl.querySelector('.nav-user-avatar');
      const name   = userEl.querySelector('.nav-user-name');
      if (avatar) avatar.textContent = (data.user.name || 'U')[0].toUpperCase();
      if (name)   name.textContent   = data.user.name || data.user.username;
    }
    if (ownerLink && data.user.role === 'owner') ownerLink.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    if (userEl) userEl.classList.add('hidden');
    if (ownerLink) ownerLink.classList.add('hidden');
  }
}

// ── Cart Badge ─────────────────────────────────────────────
async function updateCartBadge() {
  try {
    const res  = await fetch(`${API.cart}?action=count`);
    const data = await res.json();
    const badge = document.getElementById('cart-badge');
    if (badge) {
      badge.textContent = data.count || '';
      badge.style.display = data.count > 0 ? 'flex' : 'none';
    }
  } catch {}
}

// ── Navbar Scroll ──────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });
  // Mobile menu
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
  }
  // Active link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) link.classList.add('active');
  });
}

// ── Logout ─────────────────────────────────────────────────
async function handleLogout() {
  const res  = await fetch(API.auth, { method: 'POST', body: new URLSearchParams({ action: 'logout' }) });
  const data = await res.json();
  if (data.success) { showToast('Logged out.', 'info'); setTimeout(() => window.location.href = 'index.html', 800); }
}

// ── Modal Helpers ──────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); document.body.style.overflow = ''; }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ── Format Currency ────────────────────────────────────────
function formatPrice(amount) {
  return '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Date Format ────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Page Loader ────────────────────────────────────────────
function hideLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 400); }
}

// ── Init on DOMContentLoaded ───────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  await checkAuthState();
  await updateCartBadge();
  hideLoader();
  // Logout button
  document.getElementById('nav-logout')?.addEventListener('click', handleLogout);
  // Close modal buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
    });
  });
});
