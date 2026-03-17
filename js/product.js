// ============================================================
// STREETWISE PH - product.js | Product Detail Page
// ============================================================
let selectedSize = '', selectedColor = '', quantity = 1, productData = null;

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id') || params.get('slug');
  if (!id) { window.location.href = 'shop.html'; return; }
  try {
    const res  = await fetch(`php/controllers/products.php?action=single&id=${id}`);
    const data = await res.json();
    if (!data.success) { window.location.href = 'shop.html'; return; }
    productData = data.product;
    renderProduct(data.product);
    renderComments(data.product.comments || []);
  } catch { showToast('Failed to load product.', 'error'); }
}

function renderProduct(p) {
  document.title = `${p.name} — Streetwise PH`;
  document.getElementById('product-category').textContent = p.category_name || '';
  document.getElementById('product-name').textContent     = p.name;
  document.getElementById('product-desc').textContent     = p.description;
  const priceEl = document.getElementById('product-price');
  priceEl.innerHTML = `<span class="price-current" style="font-size:1.75rem;color:var(--accent)">${formatPrice(p.price)}</span>`;
  if (p.original_price) priceEl.innerHTML += ` <span class="price-original">${formatPrice(p.original_price)}</span>`;
  // Main image
  const imgWrap = document.getElementById('product-main-img');
  if (imgWrap) imgWrap.innerHTML = p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div class="product-img-placeholder" style="height:100%">◈</div>`;
  // Sizes
  const sizesWrap = document.getElementById('size-options');
  if (sizesWrap && p.sizes?.length) {
    sizesWrap.innerHTML = p.sizes.map(s => {
      const inv   = p.inventory?.find(i => i.size === s);
      const inStock = !inv || inv.quantity > 0;
      return `<button class="size-btn ${!inStock ? 'out-of-stock' : ''}" onclick="selectSize('${s}', this)" ${!inStock ? 'disabled' : ''}>${s}</button>`;
    }).join('');
  }
  // Colors
  const colorsWrap = document.getElementById('color-options');
  if (colorsWrap && p.colors?.length) {
    const colorMap = { Black:'#1a1a1a', White:'#f5f5f5', Charcoal:'#3d3d3d', Grey:'#888', Olive:'#6b7645', 'Dusty Rose':'#c9897e', Cream:'#f0e8d8', Champagne:'#d4b896', Ivory:'#f5f0e0', 'Midnight Blue':'#1a2340', Tan:'#c9a96e' };
    colorsWrap.innerHTML = p.colors.map(c => `<button class="color-btn" style="background:${colorMap[c]||'#888'}" title="${c}" onclick="selectColor('${c}', this)"></button>`).join('');
  }
}

function selectSize(size, btn) {
  selectedSize = size;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function selectColor(color, btn) {
  selectedColor = color;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function changeQty(delta) {
  quantity = Math.max(1, quantity + delta);
  const input = document.getElementById('qty-input');
  if (input) input.value = quantity;
}

async function addToCart() {
  if (!productData) return;
  const sizes  = productData.sizes  || [];
  const colors = productData.colors || [];
  if (sizes.length > 0 && !selectedSize)  { showToast('Please select a size.',  'error'); return; }
  if (colors.length > 0 && !selectedColor){ showToast('Please select a color.', 'error'); return; }
  const body = new URLSearchParams({ action: 'add', product_id: productData.id, size: selectedSize, color: selectedColor, quantity });
  const res  = await fetch('php/controllers/cart.php', { method: 'POST', body });
  const data = await res.json();
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) updateCartBadge();
}

function renderComments(comments) {
  const wrap = document.getElementById('comments-list');
  if (!wrap) return;
  if (!comments.length) { wrap.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:32px 0">No reviews yet. Be the first!</p>'; return; }
  wrap.innerHTML = comments.map(c => `
    <div style="padding:20px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:32px;height:32px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem">${(c.user_name||c.guest_name||'G')[0]}</div>
        <div>
          <p style="font-size:.875rem;font-weight:500">${c.user_name || c.guest_name || 'Guest'}</p>
          <p style="font-size:.75rem;color:var(--text-muted)">${formatDate(c.created_at)}</p>
        </div>
        <div class="stars" style="margin-left:auto">${'★'.repeat(c.rating||5)}${'☆'.repeat(5-(c.rating||5))}</div>
      </div>
      <p style="font-size:.9375rem;color:var(--text-secondary)">${c.content}</p>
    </div>`).join('');
}

async function submitComment(e) {
  e.preventDefault();
  const form = e.target;
  const body = new FormData(form);
  body.append('action', 'add');
  body.append('product_id', productData?.id || '');
  const res  = await fetch('php/controllers/comments.php', { method: 'POST', body });
  const data = await res.json();
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) { form.reset(); loadProduct(); }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProduct();
  document.getElementById('qty-minus')?.addEventListener('click', () => changeQty(-1));
  document.getElementById('qty-plus')?.addEventListener('click',  () => changeQty(1));
  document.getElementById('add-to-cart-btn')?.addEventListener('click', addToCart);
  document.getElementById('comment-form')?.addEventListener('submit', submitComment);
  const qtyInput = document.getElementById('qty-input');
  if (qtyInput) qtyInput.addEventListener('change', e => { quantity = Math.max(1, parseInt(e.target.value)||1); e.target.value = quantity; });
});
