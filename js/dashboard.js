// ============================================================
// STREETWISE PH - dashboard.js | Owner Dashboard + Inventory
// ============================================================

// ── Auth Guard ─────────────────────────────────────────────
async function ownerGuard() {
  const res  = await fetch('php/controllers/auth.php?action=status');
  const data = await res.json();
  if (!data.logged_in || data.user.role !== 'owner') {
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    return false;
  }
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('dashboard-content').classList.remove('hidden');
  document.getElementById('owner-name').textContent = data.user.name || 'Owner';
  return true;
}

// ── Login Form ─────────────────────────────────────────────
async function handleDashboardLogin(e) {
  e.preventDefault();
  const body = new URLSearchParams({ action: 'login', username: document.getElementById('login-username').value, password: document.getElementById('login-password').value });
  const btn  = document.getElementById('login-submit');
  btn.disabled = true; btn.textContent = 'Signing in...';
  const res  = await fetch('php/controllers/auth.php', { method: 'POST', body });
  const data = await res.json();
  if (data.success && data.role === 'owner') {
    showToast('Welcome back!', 'success');
    setTimeout(() => window.location.reload(), 600);
  } else {
    showToast(data.message || 'Access denied.', 'error');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

// ── Dashboard Stats ────────────────────────────────────────
async function loadDashboardStats() {
  const res  = await fetch('php/controllers/sales.php?action=overview');
  const data = await res.json();
  if (!data.success) return;
  const o = data.overview, t = data.today;
  setStatCard('stat-revenue',  formatPrice(o.total_revenue || 0), null);
  setStatCard('stat-orders',   o.total_orders || 0, null);
  setStatCard('stat-today',    formatPrice(t.revenue || 0), null);
  setStatCard('stat-pending',  data.pending_orders || 0, null);
}

function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Recent Orders ──────────────────────────────────────────
async function loadRecentOrders() {
  const res  = await fetch('php/controllers/sales.php?action=recent_orders');
  const data = await res.json();
  const tbody = document.getElementById('recent-orders-body');
  if (!tbody || !data.orders) return;
  tbody.innerHTML = data.orders.map(o => `
    <tr>
      <td><span style="font-family:var(--font-display)">${o.order_number}</span></td>
      <td>${o.guest_name || 'Guest'}</td>
      <td>${formatPrice(o.total)}</td>
      <td><span class="badge badge-${statusBadge(o.order_status)}">${o.order_status}</span></td>
      <td>${formatDate(o.created_at)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="viewOrder(${o.id})">View</button></td>
    </tr>`).join('');
}

function statusBadge(s) {
  return { pending:'warning', confirmed:'info', processing:'info', shipped:'accent', delivered:'success', cancelled:'danger' }[s] || 'muted';
}

// ── Inventory ──────────────────────────────────────────────
async function loadInventory() {
  const res  = await fetch('php/controllers/inventory.php?action=list');
  const data = await res.json();
  const tbody = document.getElementById('inventory-body');
  if (!tbody || !data.inventory) return;
  tbody.innerHTML = data.inventory.map(i => {
    const pct   = Math.min(100, Math.round((i.quantity / (i.low_stock_threshold * 4)) * 100));
    const cls   = i.quantity <= 0 ? 'danger' : i.quantity <= i.low_stock_threshold ? 'warning' : '';
    return `
    <tr>
      <td>${i.product_name}</td>
      <td>${i.category || '—'}</td>
      <td>${i.size || '—'}</td>
      <td>${i.color || '—'}</td>
      <td>
        <span style="font-weight:500;color:${i.quantity==0?'var(--danger)':i.quantity<=i.low_stock_threshold?'var(--warning)':'var(--text-primary)'}">${i.quantity}</span>
        <div class="stock-bar"><div class="stock-bar-fill ${cls}" style="width:${pct}%"></div></div>
      </td>
      <td><button class="btn btn-sm btn-outline" onclick="editStock(${i.id}, ${i.quantity})">Edit</button></td>
    </tr>`;
  }).join('');
}

function editStock(id, currentQty) {
  const newQty = prompt(`Update stock quantity (current: ${currentQty}):`, currentQty);
  if (newQty === null || isNaN(newQty)) return;
  fetch('php/controllers/inventory.php', { method: 'POST', body: new URLSearchParams({ action: 'update', id, quantity: parseInt(newQty) }) })
    .then(r => r.json()).then(d => { showToast(d.message, d.success ? 'success' : 'error'); if (d.success) loadInventory(); });
}

// ── Products Management ────────────────────────────────────
async function loadProductsAdmin() {
  const res  = await fetch('php/controllers/products.php?action=list&page=1');
  const data = await res.json();
  const tbody = document.getElementById('products-admin-body');
  if (!tbody || !data.products) return;
  tbody.innerHTML = data.products.map(p => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">${p.image_url?`<img src="${p.image_url}" style="width:40px;height:52px;object-fit:cover;border-radius:4px">`:''}<span>${p.name}</span></div></td>
      <td>${p.category_name || '—'}</td>
      <td>${formatPrice(p.price)}</td>
      <td><span style="font-weight:500">${p.total_stock || 0}</span></td>
      <td><span class="badge badge-${p.is_active?'success':'muted'}">${p.is_active?'Active':'Hidden'}</span></td>
      <td style="display:flex;gap:6px;padding:14px 16px">
        <button class="btn btn-sm btn-outline" onclick="openEditProduct(${p.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Remove</button>
      </td>
    </tr>`).join('');
}

async function deleteProduct(id) {
  if (!confirm('Remove this product?')) return;
  const res  = await fetch('php/controllers/products.php', { method: 'POST', body: new URLSearchParams({ action: 'delete', id }) });
  const data = await res.json();
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) loadProductsAdmin();
}

async function openAddProduct() {
  await loadCategoriesSelect();
  document.getElementById('product-form-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  document.getElementById('product-form-id').value = '';
  openModal('product-modal');
}

async function openEditProduct(id) {
  await loadCategoriesSelect();
  const res  = await fetch(`php/controllers/products.php?action=single&id=${id}`);
  const data = await res.json();
  if (!data.success) return;
  const p = data.product;
  document.getElementById('product-form-title').textContent = 'Edit Product';
  document.getElementById('product-form-id').value       = p.id;
  document.getElementById('pf-name').value               = p.name;
  document.getElementById('pf-category').value           = p.category_id;
  document.getElementById('pf-price').value              = p.price;
  document.getElementById('pf-original-price').value     = p.original_price || '';
  document.getElementById('pf-description').value        = p.description;
  document.getElementById('pf-sizes').value              = (p.sizes || []).join(',');
  document.getElementById('pf-colors').value             = (p.colors || []).join(',');
  document.getElementById('pf-featured').checked         = p.is_featured == 1;
  document.getElementById('pf-active').checked           = p.is_active == 1;
  openModal('product-modal');
}

async function loadCategoriesSelect() {
  const res  = await fetch('php/controllers/products.php?action=categories');
  const data = await res.json();
  const sel  = document.getElementById('pf-category');
  if (!sel || !data.categories) return;
  sel.innerHTML = data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function submitProductForm(e) {
  e.preventDefault();
  const id   = document.getElementById('product-form-id').value;
  const body = new URLSearchParams({ action: id ? 'update' : 'add', id: id || '', name: document.getElementById('pf-name').value, category_id: document.getElementById('pf-category').value, price: document.getElementById('pf-price').value, original_price: document.getElementById('pf-original-price').value, description: document.getElementById('pf-description').value, sizes: document.getElementById('pf-sizes').value, colors: document.getElementById('pf-colors').value });
  if (document.getElementById('pf-featured').checked) body.append('is_featured','1');
  if (document.getElementById('pf-active').checked)   body.append('is_active','1');
  const res  = await fetch('php/controllers/products.php', { method: 'POST', body });
  const data = await res.json();
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) { closeModal('product-modal'); loadProductsAdmin(); }
}

// ── Tabs ───────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.remove('hidden');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  if (tabId === 'tab-inventory') loadInventory();
  if (tabId === 'tab-products')  loadProductsAdmin();
  if (tabId === 'tab-orders')    loadRecentOrders();
}

// ── View Order ─────────────────────────────────────────────
async function viewOrder(id) {
  const res  = await fetch(`php/controllers/orders.php?action=single&id=${id}`);
  const data = await res.json();
  if (!data.success) return;
  const o    = data.order;
  const body = document.getElementById('order-detail-body');
  if (!body) return;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div><p class="form-label">Order Number</p><p>${o.order_number}</p></div>
      <div><p class="form-label">Status</p><span class="badge badge-${statusBadge(o.order_status)}">${o.order_status}</span></div>
      <div><p class="form-label">Customer</p><p>${o.guest_name}</p></div>
      <div><p class="form-label">Phone</p><p>${o.guest_phone}</p></div>
      <div style="grid-column:1/-1"><p class="form-label">Address</p><p>${o.shipping_address}</p></div>
    </div>
    <p class="form-label" style="margin-bottom:12px">Items</p>
    ${(o.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:.875rem"><span>${i.product_name} ${i.size?'('+i.size+')':''} × ${i.quantity}</span><span>${formatPrice(i.total_price)}</span></div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding:16px 0 0;font-weight:500"><span>Total</span><span style="color:var(--accent)">${formatPrice(o.total)}</span></div>
    <div style="margin-top:20px">
      <p class="form-label">Update Status</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['pending','confirmed','processing','shipped','delivered','cancelled'].map(s=>`<button class="btn btn-sm ${s===o.order_status?'btn-primary':'btn-outline'}" onclick="updateOrderStatus(${o.id},'${s}')">${s}</button>`).join('')}
      </div>
    </div>`;
  openModal('order-modal');
}

async function updateOrderStatus(orderId, status) {
  const res  = await fetch('php/controllers/orders.php', { method: 'POST', body: new URLSearchParams({ action: 'update_status', id: orderId, status }) });
  const data = await res.json();
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) { closeModal('order-modal'); loadRecentOrders(); loadDashboardStats(); }
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await ownerGuard();
  if (!ok) {
    document.getElementById('login-form')?.addEventListener('submit', handleDashboardLogin);
    return;
  }
  await loadDashboardStats();
  await loadRecentOrders();
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.getElementById('add-product-btn')?.addEventListener('click', openAddProduct);
  document.getElementById('product-form')?.addEventListener('submit', submitProductForm);
});
