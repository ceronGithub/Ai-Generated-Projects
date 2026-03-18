// ============================================================
// STREETWISE PH — Cart Module (localStorage)
// Cart stored locally — no Firestore reads needed
// ============================================================

const CART_KEY = 'sw_cart';

export function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart({ productId, name, price, imageUrl, size, color, quantity = 1 }) {
  const cart    = getCart();
  const existing = cart.find(i => i.productId === productId && i.size === size && i.color === color);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, name, price, imageUrl, size, color, quantity, cartId: Date.now().toString() });
  }
  saveCart(cart);
  updateCartBadge();
  return cart;
}

export function updateCartItem(cartId, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.cartId === cartId);
  if (item) {
    if (quantity <= 0) return removeCartItem(cartId);
    item.quantity = quantity;
  }
  saveCart(cart);
  updateCartBadge();
  return cart;
}

export function removeCartItem(cartId) {
  const cart = getCart().filter(i => i.cartId !== cartId);
  saveCart(cart);
  updateCartBadge();
  return cart;
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

export function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

export function getCartSubtotal() {
  return getCart().reduce((sum, i) => sum + (i.price * i.quantity), 0);
}

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = getCartCount();
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}
