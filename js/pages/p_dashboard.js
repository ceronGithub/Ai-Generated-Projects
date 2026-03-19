// ============================================================
// STREETWISE PH — dashboard.js (Owner Dashboard)
// ============================================================
import { onAuthChange, logout } from '../firebase/f_auth.js';
import { getProducts, addProduct, updateProduct, deleteProduct, getCategories } from '../firebase/f_products.js';
import { getOrders, getRecentOrders, updateOrderStatus, getOrder } from '../firebase/f_orders.js';
import { getInventory, getLowStock, setStock } from '../firebase/inventory.js';
import { getSalesOverview, getSalesByDate, getSalesByProduct, getSalesByCategory } from '../firebase/f_sales.js';
import { getComments, deleteComment } from '../firebase/f_comments.js';
import { exportPDF, exportExcel, exportWord, exportPPT } from '../utils/export.js';
import { formatPrice, formatDate, showToast, openModal, closeModal, getFirstDayOfMonth, getTodayDate, statusBadge, hideLoader } from '../utils/helpers.js';

// ── Auth guard ─────────────────────────────────────────────
onAuthChange(async state => {
  hideLoader();
  if (!state || state.role !== 'owner') {
    document.getElementById('login-gate')?.classList.remove('hidden');
    document.getElementById('dashboard-content')?.classList.add('hidden');
  } else {
    document.getElementById('login-gate')?.classList.add('hidden');
    document.getElementById('dashboard-content')?.classList.remove('hidden');
    document.getElementById('owner-name').textContent      = state.user.email?.split('@')[0] || 'Owner';
    document.getElementById('owner-name-dash').textContent = state.user.email?.split('@')[0] || 'Owner';
    document.getElementById('current-date').textContent    = new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    loadDashboardStats();
    loadRecentOrdersTable();
  }
});

// ── Login form ─────────────────────────────────────────────
document.getElementById('login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('login-submit');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const { login } = await import('../firebase/f_auth.js');
    const { role }  = await login(document.getElementById('login-username').value, document.getElementById('login-password').value);
    if (role !== 'owner') throw new Error('Access denied. Owner only.');
    showToast('Welcome back!', 'success');
    setTimeout(() => window.location.reload(), 600);
  } catch(err) {
    showToast(err.message.includes('Access denied') ? 'Access denied. Owner only.' : 'Invalid credentials.', 'error');
    btn.disabled = false; btn.textContent = 'Sign In to Dashboard';
  }
});

document.getElementById('nav-logout')?.addEventListener('click', async () => { await logout(); window.location.href = 'index.html'; });

// ── Dashboard stats ────────────────────────────────────────
async function loadDashboardStats() {
  const data = await getSalesOverview(getFirstDayOfMonth(), getTodayDate());
  document.getElementById('stat-revenue').textContent  = formatPrice(data.totalRevenue);
  document.getElementById('stat-orders').textContent   = data.totalOrders;
  document.getElementById('stat-today').textContent    = formatPrice(data.todayRevenue);
  document.getElementById('stat-pending').textContent  = data.pendingOrders;
}

// ── Recent orders ──────────────────────────────────────────
async function loadRecentOrdersTable() {
  const orders = await getRecentOrders(10);
  const tbody  = document.getElementById('recent-orders-body');
  if (!tbody) return;
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span style="font-family:var(--font-display)">${o.orderNumber}</span></td>
      <td>${o.customerInfo?.name || 'Guest'}</td>
      <td>${formatPrice(o.total)}</td>
      <td><span class="badge badge-${statusBadge(o.orderStatus)}">${o.orderStatus}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="viewOrderModal('${o.id}')">View</button></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No orders yet.</td></tr>';
}

// ── View order modal ───────────────────────────────────────
window.viewOrderModal = async (id) => {
  const o    = await getOrder(id);
  const body = document.getElementById('order-detail-body');
  if (!body || !o) return;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div><p class="form-label">Order Number</p><p>${o.orderNumber}</p></div>
      <div><p class="form-label">Status</p><span class="badge badge-${statusBadge(o.orderStatus)}">${o.orderStatus}</span></div>
      <div><p class="form-label">Customer</p><p>${o.customerInfo?.name}</p></div>
      <div><p class="form-label">Phone</p><p>${o.customerInfo?.phone}</p></div>
      <div style="grid-column:1/-1"><p class="form-label">Address</p><p>${o.customerInfo?.address}</p></div>
    </div>
    <p class="form-label" style="margin-bottom:12px">Items</p>
    ${(o.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:.875rem"><span>${i.name} ${i.size?'('+i.size+')':''} × ${i.quantity}</span><span>${formatPrice(i.price*i.quantity)}</span></div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding:16px 0 0;font-weight:500"><span>Total</span><span style="color:var(--accent)">${formatPrice(o.total)}</span></div>
    <div style="margin-top:20px"><p class="form-label">Update Status</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${['pending','confirmed','processing','shipped','delivered','cancelled'].map(s=>`<button class="btn btn-sm ${s===o.orderStatus?'btn-primary':'btn-outline'}" onclick="changeOrderStatus('${o.id}','${s}')">${s}</button>`).join('')}
    </div></div>`;
  openModal('order-modal');
};

window.changeOrderStatus = async (id, status) => {
  await updateOrderStatus(id, status);
  showToast('Order status updated.', 'success');
  closeModal('order-modal');
  loadRecentOrdersTable();
  loadDashboardStats();
};

// ── Tabs ───────────────────────────────────────────────────
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.remove('hidden');
  document.querySelector(`.sidebar-link[data-tab="${tabId}"]`)?.classList.add('active');
  if (tabId === 'tab-inventory') loadInventoryTable();
  if (tabId === 'tab-products')  loadProductsTable();
  if (tabId === 'tab-orders')    loadRecentOrdersTable();
  if (tabId === 'tab-sales')     loadSalesTab();
  if (tabId === 'tab-comments')  loadCommentsAdmin();
};

// ── Inventory ──────────────────────────────────────────────
async function loadInventoryTable() {
  const items = await getInventory();
  const tbody = document.getElementById('inventory-body');
  if (!tbody) return;
  tbody.innerHTML = items.map(i => {
    const pct = Math.min(100, Math.round((i.quantity / ((i.lowStockThreshold||5) * 4)) * 100));
    const cls = i.quantity <= 0 ? 'danger' : i.quantity <= (i.lowStockThreshold||5) ? 'warning' : '';
    return `<tr>
      <td>${i.productId}</td><td>${i.size||'—'}</td><td>${i.color||'—'}</td>
      <td><span style="font-weight:500;color:${i.quantity==0?'var(--danger)':i.quantity<=(i.lowStockThreshold||5)?'var(--warning)':'var(--text-primary)'}">${i.quantity}</span>
        <div class="stock-bar"><div class="stock-bar-fill ${cls}" style="width:${pct}%"></div></div></td>
      <td><button class="btn btn-sm btn-outline" onclick="editStock('${i.id}',${i.quantity})">Edit</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">No inventory data.</td></tr>';
}

window.editStock = async (id, current) => {
  const newQty = prompt(`Update stock (current: ${current}):`, current);
  if (newQty === null || isNaN(newQty)) return;
  const parts = id.split('_');
  await setStock(parts[0], parts[1]||'', parts[2]||'', parseInt(newQty));
  showToast('Stock updated.', 'success');
  loadInventoryTable();
};

// ── Products management ────────────────────────────────────
async function loadProductsTable() {
  const { products } = await getProducts({ page:1 });
  const tbody = document.getElementById('products-admin-body');
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">${p.imageUrl?`<img src="${p.imageUrl}" style="width:40px;height:52px;object-fit:cover;border-radius:4px">`:''}<span>${p.name}</span></div></td>
      <td>${p.categoryName||'—'}</td>
      <td>${formatPrice(p.price)}</td>
      <td><span class="badge badge-${p.isActive?'success':'muted'}">${p.isActive?'Active':'Hidden'}</span></td>
      <td style="display:flex;gap:6px;padding:14px 16px">
        <button class="btn btn-sm btn-outline" onclick="openEditProduct('${p.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="removeProduct('${p.id}')">Remove</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">No products yet.</td></tr>';
}

window.removeProduct = async (id) => {
  if (!confirm('Remove this product?')) return;
  await deleteProduct(id);
  showToast('Product removed.', 'success');
  loadProductsTable();
};

window.openAddProduct = async () => {
  await loadCategorySelect();
  document.getElementById('product-form-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  document.getElementById('product-form-id').value = '';
  openModal('product-modal');
};

window.openEditProduct = async (id) => {
  await loadCategorySelect();
  const { getProduct } = await import('../firebase/f_products.js');
  const p = await getProduct(id);
  if (!p) return;
  document.getElementById('product-form-title').textContent = 'Edit Product';
  document.getElementById('product-form-id').value      = p.id;
  document.getElementById('pf-name').value              = p.name;
  document.getElementById('pf-category').value          = p.categoryId || '';
  document.getElementById('pf-price').value             = p.price;
  document.getElementById('pf-original-price').value    = p.originalPrice || '';
  document.getElementById('pf-description').value       = p.description || '';
  document.getElementById('pf-sizes').value             = (p.sizes||[]).join(',');
  document.getElementById('pf-colors').value            = (p.colors||[]).join(',');
  document.getElementById('pf-featured').checked        = !!p.isFeatured;
  document.getElementById('pf-active').checked          = p.isActive !== false;
  openModal('product-modal');
};

async function loadCategorySelect() {
  const cats = await getCategories();
  const sel  = document.getElementById('pf-category');
  if (!sel) return;
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

document.getElementById('product-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const id   = document.getElementById('product-form-id').value;
  const cats = await getCategories();
  const catId = document.getElementById('pf-category').value;
  const cat   = cats.find(c => c.id === catId);
  const data  = {
    name:          document.getElementById('pf-name').value,
    categoryId:    catId,
    categoryName:  cat?.name || '',
    categorySlug:  cat?.slug || '',
    price:         parseFloat(document.getElementById('pf-price').value),
    originalPrice: parseFloat(document.getElementById('pf-original-price').value) || null,
    description:   document.getElementById('pf-description').value,
    sizes:         document.getElementById('pf-sizes').value.split(',').map(s=>s.trim()).filter(Boolean),
    colors:        document.getElementById('pf-colors').value.split(',').map(s=>s.trim()).filter(Boolean),
    isFeatured:    document.getElementById('pf-featured').checked,
    isActive:      document.getElementById('pf-active').checked,
  };
  try {
    if (id) await updateProduct(id, data); else await addProduct(data);
    showToast(id ? 'Product updated.' : 'Product added.', 'success');
    closeModal('product-modal');
    loadProductsTable();
  } catch(err) { showToast(err.message, 'error'); }
});

// ── Sales tab ──────────────────────────────────────────────
async function loadSalesTab() {
  const from = document.getElementById('date-from')?.value || getFirstDayOfMonth();
  const to   = document.getElementById('date-to')?.value   || getTodayDate();
  const [overview, byDate, byProduct, byCategory] = await Promise.all([
    getSalesOverview(from, to), getSalesByDate(from, to),
    getSalesByProduct(from, to), getSalesByCategory(from, to)
  ]);
  document.getElementById('s-stat-revenue').textContent = formatPrice(overview.totalRevenue);
  document.getElementById('s-stat-orders').textContent  = overview.totalOrders;
  document.getElementById('s-stat-avg').textContent     = formatPrice(overview.avgOrder);
  document.getElementById('s-stat-today').textContent   = formatPrice(overview.todayRevenue);
  renderRevenueChart(byDate);
  renderProductChart(byProduct);
  const tbody = document.getElementById('category-table-body');
  if (tbody) tbody.innerHTML = byCategory.map(d=>`<tr><td>${d.category}</td><td>${d.unitsSold}</td><td>${formatPrice(d.revenue)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">No data.</td></tr>';
  window._salesData = { overview, byDate, byProduct, from, to };
}

let revenueChart = null, productChart = null;
function renderRevenueChart(data) {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx || !window.Chart) return;
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, { type:'line', data: { labels: data.map(d=>d.date), datasets:[{ label:'Revenue (₱)', data:data.map(d=>d.revenue), borderColor:'#c9a96e', backgroundColor:'rgba(201,169,110,0.08)', borderWidth:2, fill:true, tension:.4, pointBackgroundColor:'#c9a96e', pointRadius:4 }] }, options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#a09888',font:{size:11}}}, y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#a09888',font:{size:11},callback:v=>'₱'+v.toLocaleString()}} } } });
}
function renderProductChart(data) {
  const ctx = document.getElementById('product-chart');
  if (!ctx || !window.Chart) return;
  if (productChart) productChart.destroy();
  productChart = new Chart(ctx, { type:'bar', data: { labels:data.map(d=>d.productName.length>18?d.productName.slice(0,18)+'…':d.productName), datasets:[{ label:'Revenue (₱)', data:data.map(d=>d.revenue), backgroundColor:'rgba(201,169,110,0.7)', borderColor:'#c9a96e', borderWidth:1, borderRadius:4 }] }, options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:{color:'#a09888',font:{size:11}}}, y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#a09888',font:{size:11},callback:v=>'₱'+v.toLocaleString()}} } } });
}

document.getElementById('apply-dates')?.addEventListener('click', loadSalesTab);

document.querySelectorAll('[data-export]').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = window._salesData;
    if (!d) { showToast('Load sales data first.','error'); return; }
    const fmt = btn.dataset.export;
    if (fmt==='pdf')   exportPDF(d.overview, d.byDate, d.byProduct, d.from, d.to);
    if (fmt==='excel') exportExcel(d.overview, d.byDate, d.byProduct, d.from, d.to);
    if (fmt==='word')  exportWord(d.overview, d.byDate, d.byProduct, d.from, d.to);
    if (fmt==='ppt')   exportPPT(d.overview, d.byDate, d.byProduct, d.from, d.to);
  });
});

// ── Comments admin ─────────────────────────────────────────
async function loadCommentsAdmin() {
  const comments = await getComments();
  const wrap     = document.getElementById('comments-admin-list');
  if (!wrap) return;
  wrap.innerHTML = comments.map(c => `
    <div style="padding:16px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:start">
      <div>
        <p style="font-weight:500;font-size:.875rem;margin-bottom:4px">${c.userName||c.guestName||'Guest'} <span style="color:var(--accent);margin-left:8px">${'★'.repeat(c.rating||5)}</span></p>
        <p style="font-size:.875rem;color:var(--text-secondary)">${c.content}</p>
        <p style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${formatDate(c.createdAt)}</p>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteCommentAdmin('${c.id}')">Delete</button>
    </div>`).join('') || '<p style="text-align:center;color:var(--text-muted);padding:32px">No comments yet.</p>';
}

window.deleteCommentAdmin = async (id) => {
  if (!confirm('Delete this comment?')) return;
  await deleteComment(id);
  showToast('Comment deleted.', 'success');
  loadCommentsAdmin();
};

document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));