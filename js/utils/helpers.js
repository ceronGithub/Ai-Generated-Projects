// ============================================================
// STREETWISE PH — Global Helpers
// ============================================================

export function formatPrice(amount) {
  return '₱' + parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(val) {
  if (!val) return '—';
  const d = val?.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = 'all .3s ease'; setTimeout(() => toast.remove(), 300); }, duration);
}

export function openModal(id)  { document.getElementById(id)?.classList.add('active'); document.body.style.overflow = 'hidden'; }
export function closeModal(id) { document.getElementById(id)?.classList.remove('active'); document.body.style.overflow = ''; }

export function hideLoader() {
  const l = document.getElementById('page-loader');
  if (l) { l.classList.add('hidden'); setTimeout(() => l.remove(), 400); }
}

export function getFirstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

export function getTodayDate() { return new Date().toISOString().split('T')[0]; }

export function statusBadge(s) {
  return { pending:'warning', confirmed:'info', processing:'info', shipped:'accent', delivered:'success', cancelled:'danger' }[s] || 'muted';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) { e.target.classList.remove('active'); document.body.style.overflow = ''; }
  if (e.target.classList.contains('modal-close')) {
    const o = e.target.closest('.modal-overlay');
    if (o) { o.classList.remove('active'); document.body.style.overflow = ''; }
  }
});
