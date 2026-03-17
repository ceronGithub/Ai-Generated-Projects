// ============================================================
// STREETWISE PH - sales.js | Sales Charts + Export
// ============================================================
let salesChart = null, productChart = null;

async function loadSalesData() {
  const from = document.getElementById('date-from')?.value || getFirstDayOfMonth();
  const to   = document.getElementById('date-to')?.value   || getTodayDate();
  const [overview, byDate, byProduct, byCategory] = await Promise.all([
    fetch(`php/controllers/sales.php?action=overview&from=${from}&to=${to}`).then(r=>r.json()),
    fetch(`php/controllers/sales.php?action=by_date&from=${from}&to=${to}`).then(r=>r.json()),
    fetch(`php/controllers/sales.php?action=by_product&from=${from}&to=${to}`).then(r=>r.json()),
    fetch(`php/controllers/sales.php?action=by_category&from=${from}&to=${to}`).then(r=>r.json()),
  ]);
  if (overview.success) renderOverviewCards(overview);
  if (byDate.success)   renderRevenueChart(byDate.data);
  if (byProduct.success)renderProductChart(byProduct.data);
  if (byCategory.success)renderCategoryTable(byCategory.data);
}

function renderOverviewCards(data) {
  const o = data.overview;
  document.getElementById('sales-total-revenue')?.setAttribute('data-value', o.total_revenue || 0);
  document.getElementById('sales-total-orders')?.setAttribute('data-value', o.total_orders || 0);
  document.getElementById('sales-avg-order')?.setAttribute('data-value', o.avg_order || 0);
  document.getElementById('sales-today-revenue')?.setAttribute('data-value', data.today?.revenue || 0);
  document.getElementById('s-stat-revenue').textContent = formatPrice(o.total_revenue || 0);
  document.getElementById('s-stat-orders').textContent  = o.total_orders || 0;
  document.getElementById('s-stat-avg').textContent     = formatPrice(o.avg_order || 0);
  document.getElementById('s-stat-today').textContent   = formatPrice(data.today?.revenue || 0);
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx || !window.Chart) return;
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.date).toLocaleDateString('en-PH', {month:'short',day:'numeric'})),
      datasets: [{
        label: 'Revenue (₱)', data: data.map(d => d.revenue),
        borderColor: '#c9a96e', backgroundColor: 'rgba(201,169,110,0.08)',
        borderWidth: 2, fill: true, tension: 0.4,
        pointBackgroundColor: '#c9a96e', pointRadius: 4, pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '₱' + parseFloat(ctx.raw).toLocaleString('en-PH', {minimumFractionDigits:2}) } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a09888', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a09888', font: { size: 11 }, callback: v => '₱' + v.toLocaleString() } }
      }
    }
  });
}

function renderProductChart(data) {
  const ctx = document.getElementById('product-chart');
  if (!ctx || !window.Chart) return;
  if (productChart) productChart.destroy();
  productChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.product_name.length > 18 ? d.product_name.slice(0,18)+'…' : d.product_name),
      datasets: [{
        label: 'Revenue (₱)', data: data.map(d => d.revenue),
        backgroundColor: 'rgba(201,169,110,0.7)', borderColor: '#c9a96e', borderWidth: 1, borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a09888', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a09888', font: { size: 11 }, callback: v => '₱' + v.toLocaleString() } }
      }
    }
  });
}

function renderCategoryTable(data) {
  const tbody = document.getElementById('category-table-body');
  if (!tbody) return;
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${d.category || 'Uncategorized'}</td>
      <td>${d.units_sold}</td>
      <td>${formatPrice(d.revenue)}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">No data for this period.</td></tr>';
}

// ── Export ─────────────────────────────────────────────────
function exportReport(format) {
  const from = document.getElementById('date-from')?.value || getFirstDayOfMonth();
  const to   = document.getElementById('date-to')?.value   || getTodayDate();
  const btn  = document.querySelector(`[data-export="${format}"]`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px"></div> Exporting...'; }
  window.location.href = `php/controllers/export.php?format=${format}&from=${from}&to=${to}`;
  setTimeout(() => { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } }, 3000);
}

// ── Helpers ────────────────────────────────────────────────
function getFirstDayOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function getTodayDate()       { const d = new Date(); return d.toISOString().split('T')[0]; }

document.addEventListener('DOMContentLoaded', () => {
  const fromEl = document.getElementById('date-from');
  const toEl   = document.getElementById('date-to');
  if (fromEl) fromEl.value = getFirstDayOfMonth();
  if (toEl)   toEl.value   = getTodayDate();
  loadSalesData();
  document.getElementById('apply-dates')?.addEventListener('click', loadSalesData);
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.dataset.label = btn.innerHTML;
    btn.addEventListener('click', () => exportReport(btn.dataset.export));
  });
});
