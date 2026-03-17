// ============================================================
// STREETWISE PH - shop.js | Product Listing, Filters, Search
// ============================================================
let currentPage = 1, currentCategory = '', currentSearch = '', currentSort = 'newest';

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="flex-center" style="grid-column:1/-1;padding:60px"><div class="spinner"></div></div>';
  const params = new URLSearchParams({ action: 'list', page: currentPage, category: currentCategory, search: currentSearch });
  try {
    const res  = await fetch(`php/controllers/products.php?${params}`);
    const data = await res.json();
    if (!data.success || !data.products.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-secondary)"><p style="font-size:3rem;margin-bottom:16px">◈</p><p>No products found.</p></div>';
      return;
    }
    grid.innerHTML = data.products.map(renderProductCard).join('');
    renderPagination(data.pages);
    document.getElementById('results-count').textContent = `${data.total} items`;
  } catch { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--danger)">Failed to load products.</div>'; }
}

function renderProductCard(p) {
  const discount = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  const imgHtml  = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">` : `<div class="product-img-placeholder">◈</div>`;
  const stockClass = (p.total_stock > 0 && p.total_stock <= 5) ? '<p class="product-stock-low">Only ' + p.total_stock + ' left</p>' : '';
  return `
  <div class="product-card">
    <div class="product-img-wrap">
      ${imgHtml}
      <div class="product-badges">
        ${p.is_featured ? '<span class="badge badge-accent">Featured</span>' : ''}
        ${discount > 0 ? `<span class="badge badge-danger">-${discount}%</span>` : ''}
        ${p.total_stock == 0 ? '<span class="badge badge-muted">Sold Out</span>' : ''}
      </div>
      <div class="product-actions">
        <button class="product-quick-add" onclick="quickAddToCart(${p.id})" ${p.total_stock == 0 ? 'disabled' : ''}>Add to Cart</button>
      </div>
    </div>
    <div class="product-info">
      <p class="product-category">${p.category_name || ''}</p>
      <h3 class="product-name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
      <div class="product-price">
        <span class="price-current">${formatPrice(p.price)}</span>
        ${p.original_price ? `<span class="price-original">${formatPrice(p.original_price)}</span>` : ''}
      </div>
      ${stockClass}
    </div>
  </div>`;
}

function renderPagination(totalPages) {
  const wrap = document.getElementById('pagination');
  if (!wrap || totalPages <= 1) { if(wrap) wrap.innerHTML=''; return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="changePage(${currentPage-1})">‹</button>`;
  for (let i = 1; i <= totalPages; i++) html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
  if (currentPage < totalPages) html += `<button class="page-btn" onclick="changePage(${currentPage+1})">›</button>`;
  wrap.innerHTML = html;
}

function changePage(p) { currentPage = p; loadProducts(); window.scrollTo({top:200,behavior:'smooth'}); }

async function quickAddToCart(productId) {
  const body = new URLSearchParams({ action: 'add', product_id: productId, quantity: 1 });
  const res  = await fetch('php/controllers/cart.php', { method: 'POST', body });
  const data = await res.json();
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) updateCartBadge();
}

async function loadCategories() {
  const res  = await fetch('php/controllers/products.php?action=categories');
  const data = await res.json();
  const list = document.getElementById('category-filters');
  if (!list || !data.categories) return;
  list.innerHTML = `<label class="filter-option"><input type="radio" name="cat" value="" checked onchange="setCategory('')"> All</label>` +
    data.categories.map(c => `<label class="filter-option"><input type="radio" name="cat" value="${c.slug}" onchange="setCategory('${c.slug}')"> ${c.name}</label>`).join('');
}

function setCategory(slug) { currentCategory = slug; currentPage = 1; loadProducts(); }

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadProducts();
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { currentSearch = e.target.value; currentPage = 1; loadProducts(); }, 400);
    });
  }
});
