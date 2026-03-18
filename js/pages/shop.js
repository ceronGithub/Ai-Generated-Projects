// ============================================================
// STREETWISE PH — shop.js
// ============================================================
import './main.js';
import { initAuth } from './main.js';
import { getProducts, getCategories } from '../firebase/products.js';
import { addToCart } from '../firebase/cart.js';
import { formatPrice, showToast } from '../utils/helpers.js';

initAuth();

let currentPage = 1, currentCategory = '', currentSearch = '';

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="flex-center" style="grid-column:1/-1;padding:60px"><div class="spinner"></div></div>';
  try {
    const { products, total, pages } = await getProducts({ category: currentCategory, search: currentSearch, page: currentPage });
    document.getElementById('results-count').textContent = `${total} items`;
    if (!products.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-secondary)"><p style="font-size:3rem">◈</p><p>No products found.</p></div>'; return; }
    grid.innerHTML = products.map(p => {
      const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
      return `
      <div class="product-card">
        <div class="product-img-wrap">
          ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy">` : '<div class="product-img-placeholder">◈</div>'}
          <div class="product-badges">
            ${p.isFeatured ? '<span class="badge badge-accent">Featured</span>' : ''}
            ${discount > 0 ? `<span class="badge badge-danger">-${discount}%</span>` : ''}
          </div>
          <div class="product-actions"><button class="product-quick-add" onclick="quickAdd('${p.id}','${p.name}',${p.price},'${p.imageUrl||''}')">Add to Cart</button></div>
        </div>
        <div class="product-info">
          <p class="product-category">${p.categoryName || ''}</p>
          <h3 class="product-name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${p.originalPrice ? `<span class="price-original">${formatPrice(p.originalPrice)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    renderPagination(pages);
  } catch(e) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--danger)">Failed to load products.</div>'; }
}

function renderPagination(totalPages) {
  const wrap = document.getElementById('pagination');
  if (!wrap || totalPages <= 1) { if(wrap) wrap.innerHTML=''; return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="changePage(${currentPage-1})">‹</button>`;
  for (let i=1; i<=totalPages; i++) html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
  if (currentPage < totalPages) html += `<button class="page-btn" onclick="changePage(${currentPage+1})">›</button>`;
  wrap.innerHTML = html;
}

window.changePage = p => { currentPage = p; loadProducts(); window.scrollTo({top:200,behavior:'smooth'}); };
window.quickAdd   = (id, name, price, imageUrl) => { addToCart({ productId:id, name, price, imageUrl, size:'', color:'', quantity:1 }); showToast('Added to cart!', 'success'); };

async function loadCategories() {
  const cats = await getCategories();
  const list = document.getElementById('category-filters');
  if (!list) return;
  list.innerHTML = `<label class="filter-option"><input type="radio" name="cat" value="" checked onchange="setCategory('')"> All</label>` +
    cats.map(c => `<label class="filter-option"><input type="radio" name="cat" value="${c.slug}" onchange="setCategory('${c.slug}')"> ${c.name}</label>`).join('');
}

window.setCategory = slug => { currentCategory = slug; currentPage = 1; loadProducts(); };

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadProducts();
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => { currentSearch = e.target.value; currentPage = 1; loadProducts(); }, 400); });
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('cat')) setTimeout(() => window.setCategory(urlParams.get('cat')), 300);
});
