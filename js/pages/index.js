// ============================================================
// STREETWISE PH — index.js (Homepage)
// ============================================================
import './main.js';
import { initAuth } from './main.js';
import { getFeatured } from '../firebase/products.js';
import { formatPrice } from '../utils/helpers.js';

initAuth();

// ── Hero slider ────────────────────────────────────────────
(function() {
  let current = 0;
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');
  function goTo(i) {
    slides[current]?.classList.remove('active'); dots[current]?.classList.remove('active');
    current = (i + slides.length) % slides.length;
    slides[current]?.classList.add('active'); dots[current]?.classList.add('active');
  }
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
  if (slides.length) { goTo(0); setInterval(() => goTo(current + 1), 6000); }
})();

// ── Load featured products ─────────────────────────────────
async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  try {
    const products = await getFeatured();
    if (!products.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">No featured products yet.</p>'; return; }
    grid.innerHTML = products.map(p => productCard(p)).join('');
  } catch { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--danger)">Failed to load products.</p>'; }
}

function productCard(p) {
  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  return `
  <div class="product-card">
    <div class="product-img-wrap">
      ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy">` : '<div class="product-img-placeholder">◈</div>'}
      <div class="product-badges">
        <span class="badge badge-accent">Featured</span>
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
}

window.quickAdd = function(id, name, price, imageUrl) {
  const { addToCart } = require('../firebase/cart.js');
};

// Use dynamic import for quickAdd
window.quickAdd = async function(id, name, price, imageUrl) {
  const { addToCart } = await import('../firebase/cart.js');
  addToCart({ productId: id, name, price, imageUrl, size: '', color: '', quantity: 1 });
  const { showToast } = await import('../utils/helpers.js');
  showToast('Added to cart!', 'success');
};

loadFeatured();
