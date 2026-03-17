// ============================================================
// STREETWISE PH - cart.js | Cart Display + Checkout
// ============================================================
let cartItems = [];

async function loadCart() {
  const res  = await fetch('php/controllers/cart.php?action=get');
  const data = await res.json();
  cartItems  = data.items || [];
  renderCart(cartItems, data.subtotal || 0);
}

function renderCart(items, subtotal) {
  const wrap = document.getElementById('cart-items');
  const sumWrap = document.getElementById('cart-summary-section');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">◈</div><h3 style="font-family:var(--font-display);font-weight:300;font-size:1.75rem;margin-bottom:8px">Your cart is empty</h3><p style="color:var(--text-secondary);margin-bottom:28px">Discover something worth wearing.</p><a href="shop.html" class="btn btn-primary">Shop Now</a></div>`;
    if (sumWrap) sumWrap.classList.add('hidden');
    return;
  }
  if (sumWrap) sumWrap.classList.remove('hidden');
  wrap.innerHTML = items.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-img">${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : '<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">◈</div>'}</div>
      <div>
        <h4 class="cart-item-name">${item.name}</h4>
        <p class="cart-item-variant">${[item.size, item.color].filter(Boolean).join(' · ')}</p>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div class="qty-control" style="transform:scale(0.9);transform-origin:left">
            <button class="qty-btn" onclick="updateCartItem(${item.id}, ${item.quantity - 1})">−</button>
            <span style="padding:0 12px;font-size:.875rem">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartItem(${item.id}, ${item.quantity + 1})">+</button>
          </div>
          <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
        </div>
        <button class="cart-item-remove" onclick="removeCartItem(${item.id})">Remove</button>
      </div>
    </div>`).join('');
  const shipping = subtotal > 0 ? 150 : 0;
  const total    = subtotal + shipping;
  document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('summary-shipping').textContent = shipping ? formatPrice(shipping) : 'Free';
  document.getElementById('summary-total').textContent    = formatPrice(total);
  document.getElementById('checkout-total').textContent   = formatPrice(total);
}

async function updateCartItem(cartId, newQty) {
  if (newQty < 1) { removeCartItem(cartId); return; }
  await fetch('php/controllers/cart.php', { method: 'POST', body: new URLSearchParams({ action: 'update', cart_id: cartId, quantity: newQty }) });
  loadCart(); updateCartBadge();
}

async function removeCartItem(cartId) {
  await fetch('php/controllers/cart.php', { method: 'POST', body: new URLSearchParams({ action: 'remove', cart_id: cartId }) });
  showToast('Item removed.', 'info'); loadCart(); updateCartBadge();
}

// ── Checkout ───────────────────────────────────────────────
function showCheckout() {
  if (!cartItems.length) { showToast('Your cart is empty.', 'error'); return; }
  document.getElementById('cart-view')?.classList.add('hidden');
  document.getElementById('checkout-view')?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToCart() {
  document.getElementById('checkout-view')?.classList.add('hidden');
  document.getElementById('cart-view')?.classList.remove('hidden');
}

async function submitOrder(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  form.append('action', 'checkout');
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Placing Order...';
  try {
    const res  = await fetch('php/controllers/orders.php', { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
      document.getElementById('checkout-view')?.classList.add('hidden');
      const confirm = document.getElementById('order-confirm');
      if (confirm) {
        confirm.classList.remove('hidden');
        document.getElementById('confirm-order-num').textContent = data.order_number;
        document.getElementById('confirm-total').textContent     = formatPrice(data.total);
      }
      updateCartBadge();
    } else {
      showToast(data.message || 'Order failed.', 'error');
      btn.disabled = false; btn.innerHTML = 'Place Order — Cash on Delivery';
    }
  } catch {
    showToast('Connection error. Please try again.', 'error');
    btn.disabled = false; btn.innerHTML = 'Place Order — Cash on Delivery';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  document.getElementById('checkout-btn')?.addEventListener('click', showCheckout);
  document.getElementById('back-to-cart-btn')?.addEventListener('click', backToCart);
  document.getElementById('checkout-form')?.addEventListener('submit', submitOrder);
});
