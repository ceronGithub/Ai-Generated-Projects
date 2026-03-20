// ============================================================
// STREETWISE PH — helpers.js | Shared Utilities
// ============================================================

export function formatPrice(amount) {
  return "₱" + parseFloat(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

export function formatDate(val) {
  if (!val) return "—";
  const d = val?.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function showToast(message, type = "info", duration = 3500) {
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
}

export function hideLoader() {
  const loader = document.getElementById("page-loader");
  if (loader) {
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    setTimeout(() => loader.remove(), 500);
  }
}

export function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

export function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

export function getFirstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export function statusBadge(status) {
  const map = {
    pending:    "warning",
    confirmed:  "info",
    processing: "info",
    shipped:    "info",
    delivered:  "success",
    cancelled:  "danger"
  };
  return map[status] || "muted";
}