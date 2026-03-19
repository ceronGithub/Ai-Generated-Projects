// ============================================================
// STREETWISE PH — Cart Module (localStorage)
// ============================================================

const CART_KEY = 'swph_cart'; // unified key across all files

export function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('cartUpdated'));
}

// Accepts {id} or {productId} — normalised to productId internally
export function addToCart({ id, productId, name, price, imageUrl, size = '', color = '', quantity = 1 }) {
  const pid     = productId || id;
  const cart    = getCart();
  const sz      = size  || '';
  const cl      = color || '';
  const existing = cart.find(i => i.productId === pid && i.size === sz && i.color === cl);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: pid, name, price, imageUrl, size: sz, color: cl, quantity, cartId: Date.now().toString() + Math.random().toString(36).slice(2) });
  }
  saveCart(cart);
  return cart;
}

export function updateCartItem(cartId, quantity) {
  if (quantity <= 0) return removeCartItem(cartId);
  const cart = getCart();
  const item = cart.find(i => i.cartId === cartId);
  if (item) item.quantity = quantity;
  saveCart(cart);
  return cart;
}

export function removeCartItem(cartId) {
  const cart = getCart().filter(i => i.cartId !== cartId);
  saveCart(cart);
  return cart;
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('cartUpdated'));
}

export function getCartCount() {
  return getCart().reduce((s, i) => s + i.quantity, 0);
}

export function getCartSubtotal() {
  return getCart().reduce((s, i) => s + i.price * i.quantity, 0);
}

export function getCartTotals() {
  const subtotal = getCartSubtotal();
  const shipping = subtotal >= 2000 ? 0 : 150;
  return { subtotal, shipping, total: subtotal + shipping };
}

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = getCartCount();
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}
