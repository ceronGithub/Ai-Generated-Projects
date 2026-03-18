// ============================================================
// STREETWISE PH — cart.js
// ============================================================
import './main.js';
import { initAuth } from './main.js';
import { getCart, updateCartItem, removeCartItem, getCartSubtotal, clearCart } from '../firebase/cart.js';
import { placeOrder } from '../firebase/orders.js';
import { formatPrice, showToast } from '../utils/helpers.js';
import { auth } from '../firebase/config.js';

initAuth();

function renderCart() {
  const items    = getCart();
  const wrap     = document.getElementById('cart-items');
  const sumWrap  = document.getElementById('cart-summary-section');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">◈</div><h3 style="font-family:var(--font-display);font-weight:300;font-size:1.75rem;margin-bottom:8px">Your cart is empty</h3><p style="color:var(--text-secondary);margin-bottom:28px">Discover something worth wearing.</p><a href="shop.html" class="btn btn-primary">Shop Now</a></div>`;
    sumWrap?.classList.add('hidden'); return;
  }
  sumWrap?.classList.remove('hidden');
  wrap.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : '<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">◈</div>'}</div>
      <div>
        <h4 class="cart-item-name">${item.name}</h4>
        <p class="cart-item-variant">${[item.size,item.color].filter(Boolean).join(' · ')}</p>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div class="qty-control" style="transform:scale(0.9);transform-origin:left">
            <button class="qty-btn" onclick="changeQty('${item.cartId}',${item.quantity-1})">−</button>
            <span style="padding:0 12px;font-size:.875rem">${item.quantity}</span>
            <button class="qty-btn" onclick="changeQty('${item.cartId}',${item.quantity+1})">+</button>
          </div>
          <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
        </div>
        <button class="cart-item-remove" onclick="removeItem('${item.cartId}')">Remove</button>
      </div>
    </div>`).join('');
  const subtotal = getCartSubtotal();
  const shipping = subtotal > 0 ? 150 : 0;
  document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('summary-shipping').textContent = shipping ? formatPrice(shipping) : 'Free';
  document.getElementById('summary-total').textContent    = formatPrice(subtotal + shipping);
  document.getElementById('checkout-total').textContent   = formatPrice(subtotal + shipping);
}

window.changeQty  = (id, qty) => { updateCartItem(id, qty); renderCart(); };
window.removeItem = (id) => { removeCartItem(id); showToast('Item removed.','info'); renderCart(); };

document.getElementById('checkout-btn')?.addEventListener('click', () => {
  if (!getCart().length) { showToast('Your cart is empty.','error'); return; }
  document.getElementById('cart-view')?.classList.add('hidden');
  document.getElementById('checkout-view')?.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
});

document.getElementById('back-to-cart-btn')?.addEventListener('click', () => {
  document.getElementById('checkout-view')?.classList.add('hidden');
  document.getElementById('cart-view')?.classList.remove('hidden');
});

document.getElementById('checkout-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;display:inline-block;margin-right:8px"></div> Placing Order...';
  const fd = new FormData(e.target);
  try {
    const { orderNumber, total } = await placeOrder({
      cartItems:    getCart(),
      userId:       auth.currentUser?.uid || null,
      customerInfo: {
        name:    fd.get('guest_name'),
        email:   fd.get('guest_email'),
        phone:   fd.get('guest_phone'),
        address: fd.get('shipping_address'),
        notes:   fd.get('notes') || ''
      }
    });
    document.getElementById('checkout-view')?.classList.add('hidden');
    const confirm = document.getElementById('order-confirm');
    if (confirm) {
      confirm.classList.remove('hidden');
      document.getElementById('confirm-order-num').textContent = orderNumber;
      document.getElementById('confirm-total').textContent     = formatPrice(total);
    }
  } catch(err) {
    showToast('Order failed. Please try again.', 'error');
    btn.disabled = false; btn.innerHTML = 'Place Order — Cash on Delivery';
  }
});

document.addEventListener('DOMContentLoaded', renderCart);
