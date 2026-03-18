// ============================================================
// STREETWISE PH — product.js
// ============================================================
import './main.js';
import { initAuth } from './main.js';
import { getProduct } from '../firebase/products.js';
import { getProductInventory } from '../firebase/inventory.js';
import { addToCart } from '../firebase/cart.js';
import { getComments, addComment } from '../firebase/comments.js';
import { formatPrice, formatDate, showToast } from '../utils/helpers.js';

initAuth();

let productData = null, selectedSize = '', selectedColor = '', quantity = 1;

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { window.location.href = 'shop.html'; return; }
  try {
    productData = await getProduct(id);
    if (!productData) { window.location.href = 'shop.html'; return; }
    document.title = `${productData.name} — Streetwise PH`;
    document.getElementById('breadcrumb-name').textContent = productData.name;
    document.getElementById('product-category').textContent = productData.categoryName || '';
    document.getElementById('product-name').textContent     = productData.name;
    document.getElementById('product-desc').textContent     = productData.description || '';
    const priceEl = document.getElementById('product-price');
    priceEl.innerHTML = `<span style="font-size:1.75rem;color:var(--accent)">${formatPrice(productData.price)}</span>`;
    if (productData.originalPrice) priceEl.innerHTML += ` <span class="price-original">${formatPrice(productData.originalPrice)}</span>`;
    const imgWrap = document.getElementById('product-main-img');
    if (imgWrap) imgWrap.innerHTML = productData.imageUrl ? `<img src="${productData.imageUrl}" alt="${productData.name}">` : '<div class="product-img-placeholder" style="height:100%">◈</div>';
    const inventory = await getProductInventory(id);
    renderSizes(productData.sizes || [], inventory);
    renderColors(productData.colors || []);
    await loadComments(id);
  } catch(e) { showToast('Failed to load product.', 'error'); }
}

function renderSizes(sizes, inventory) {
  const wrap = document.getElementById('size-options');
  if (!wrap || !sizes.length) { document.getElementById('size-selector')?.classList.add('hidden'); return; }
  wrap.innerHTML = sizes.map(s => {
    const inv     = inventory.find(i => i.size === s);
    const inStock = !inv || inv.quantity > 0;
    return `<button class="size-btn ${!inStock?'out-of-stock':''}" onclick="selectSize('${s}',this)" ${!inStock?'disabled':''}>${s}</button>`;
  }).join('');
}

function renderColors(colors) {
  const wrap = document.getElementById('color-options');
  if (!wrap || !colors.length) { document.getElementById('color-selector')?.classList.add('hidden'); return; }
  const map = { Black:'#1a1a1a', White:'#f5f5f5', Charcoal:'#3d3d3d', Grey:'#888', Olive:'#6b7645', 'Dusty Rose':'#c9897e', Cream:'#f0e8d8', Champagne:'#d4b896', Ivory:'#f5f0e0', 'Midnight Blue':'#1a2340', Tan:'#c9a96e' };
  wrap.innerHTML = colors.map(c => `<button class="color-btn" style="background:${map[c]||'#888'}" title="${c}" onclick="selectColor('${c}',this)"></button>`).join('');
}

window.selectSize  = (s,btn) => { selectedSize=s; document.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); };
window.selectColor = (c,btn) => { selectedColor=c; document.querySelectorAll('.color-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); document.getElementById('selected-color-name').textContent=c; };

async function loadComments(productId) {
  const comments = await getComments(productId);
  const wrap = document.getElementById('comments-list');
  if (!wrap) return;
  if (!comments.length) { wrap.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:32px 0">No reviews yet. Be the first!</p>'; return; }
  wrap.innerHTML = comments.map(c => `
    <div style="padding:20px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:32px;height:32px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem">${(c.userName||c.guestName||'G')[0]}</div>
        <div><p style="font-size:.875rem;font-weight:500">${c.userName||c.guestName||'Guest'}</p><p style="font-size:.75rem;color:var(--text-muted)">${formatDate(c.createdAt)}</p></div>
        <div class="stars" style="margin-left:auto">${'★'.repeat(c.rating||5)}${'☆'.repeat(5-(c.rating||5))}</div>
      </div>
      <p style="font-size:.9375rem;color:var(--text-secondary)">${c.content}</p>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadProduct();
  document.getElementById('qty-minus')?.addEventListener('click', () => { quantity=Math.max(1,quantity-1); document.getElementById('qty-input').value=quantity; });
  document.getElementById('qty-plus')?.addEventListener('click',  () => { quantity++; document.getElementById('qty-input').value=quantity; });
  document.getElementById('qty-input')?.addEventListener('change', e => { quantity=Math.max(1,parseInt(e.target.value)||1); e.target.value=quantity; });
  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    if (!productData) return;
    if ((productData.sizes||[]).length > 0 && !selectedSize)  { showToast('Please select a size.','error');  return; }
    if ((productData.colors||[]).length > 0 && !selectedColor){ showToast('Please select a color.','error'); return; }
    addToCart({ productId:productData.id, name:productData.name, price:productData.price, imageUrl:productData.imageUrl||'', size:selectedSize, color:selectedColor, quantity });
    showToast('Added to cart!', 'success');
  });
  document.getElementById('comment-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const content   = e.target.querySelector('[name="content"]').value;
    const guestName = e.target.querySelector('[name="guest_name"]').value;
    const rating    = parseInt(document.getElementById('rating-value')?.value || '5');
    try {
      await addComment({ content, guestName, productId: productData?.id, rating });
      showToast('Review posted!', 'success');
      e.target.reset();
      if (productData) loadComments(productData.id);
    } catch(err) { showToast(err.message, 'error'); }
  });
  document.querySelectorAll('.star-select span').forEach(star => {
    star.addEventListener('click', () => {
      const v = parseInt(star.dataset.v);
      document.getElementById('rating-value').value = v;
      document.querySelectorAll('.star-select span').forEach((s,i) => s.style.color = i < v ? 'var(--accent)' : 'var(--text-muted)');
    });
  });
});
