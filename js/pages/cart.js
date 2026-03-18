// ============================================================
// STREETWISE PH — pages/cart.js
// ============================================================

import "./main.js";
import { getCart, getCartTotals, updateCartItem, removeCartItem } from "../firebase/cart.js";
import { placeOrder } from "../firebase/orders.js";

function renderCart() {
  const items   = getCart();
  const totals  = getCartTotals();
  const wrap    = document.getElementById("cart-items");
  const sumWrap = document.getElementById("cart-summary-section");
  if (!wrap) return;

  if (!items.length) {
    wrap.innerHTML = `<div class="cart-empty">
      <div class="cart-empty-icon">◈</div>
      <h3 style="font-family:var(--font-display);font-weight:300;font-size:1.75rem;margin-bottom:8px">Your cart is empty</h3>
      <p style="color:var(--text-secondary);margin-bottom:28px">Discover something worth wearing.</p>
      <a href="shop.html" class="btn btn-primary">Shop Now</a>
    </div>`;
    sumWrap?.classList.add("hidden");
    return;
  }
  sumWrap?.classList.remove("hidden");

  wrap.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : '<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">◈</div>'}
      </div>
      <div>
        <h4 class="cart-item-name">${item.name}</h4>
        <p class="cart-item-variant">${[item.size, item.color].filter(Boolean).join(" · ")}</p>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div class="qty-control" style="transform:scale(0.9);transform-origin:left">
            <button class="qty-btn" onclick="updQty('${item.key}',${item.quantity - 1})">−</button>
            <span style="padding:0 12px;font-size:.875rem">${item.quantity}</span>
            <button class="qty-btn" onclick="updQty('${item.key}',${item.quantity + 1})">+</button>
          </div>
          <span class="cart-item-price">₱${(item.price * item.quantity).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>
        </div>
        <button class="cart-item-remove" onclick="remItem('${item.key}')">Remove</button>
      </div>
    </div>`).join("");

  const ss = document.getElementById("summary-subtotal");
  const sh = document.getElementById("summary-shipping");
  const st = document.getElementById("summary-total");
  const ct = document.getElementById("checkout-total");
  if (ss) ss.textContent = window.formatPrice(totals.subtotal);
  if (sh) sh.textContent = totals.shipping ? window.formatPrice(totals.shipping) : "Free";
  if (st) st.textContent = window.formatPrice(totals.total);
  if (ct) ct.textContent = window.formatPrice(totals.total);

  // Checkout preview
  const preview = document.getElementById("checkout-items-preview");
  if (preview) {
    preview.innerHTML = items.map(i =>
      `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:.875rem">
        <span>${i.name} ×${i.quantity}</span>
        <span>₱${(i.price * i.quantity).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>
      </div>`).join("");
  }
}

window.updQty = (key, qty) => { updateCartItem(key, qty); renderCart(); };
window.remItem = key => { removeCartItem(key); window.showToast("Item removed.", "info"); renderCart(); };

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  window.addEventListener("cartUpdated", renderCart);

  document.getElementById("checkout-btn")?.addEventListener("click", () => {
    if (!getCart().length) { window.showToast("Your cart is empty.", "error"); return; }
    document.getElementById("cart-view").classList.add("hidden");
    document.getElementById("checkout-view").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("back-btn")?.addEventListener("click", () => {
    document.getElementById("checkout-view").classList.add("hidden");
    document.getElementById("cart-view").classList.remove("hidden");
  });

  document.getElementById("checkout-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("place-order-btn");
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;display:inline-block;margin-right:8px;vertical-align:middle"></div> Placing Order...';
    const fd = new FormData(e.target);
    try {
      const result = await placeOrder({
        cartItems:    getCart(),
        customerInfo: { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), address: fd.get("address"), notes: fd.get("notes") || "" },
        totals:       getCartTotals()
      });
      document.getElementById("checkout-view").classList.add("hidden");
      document.getElementById("order-confirm").classList.remove("hidden");
      const onum = document.getElementById("confirm-order-num");
      const otot = document.getElementById("confirm-total");
      if (onum) onum.textContent = result.orderNumber;
      if (otot) otot.textContent = window.formatPrice(result.total);
      window.updateCartBadge?.();
    } catch(err) {
      window.showToast(err.message || "Order failed. Please try again.", "error");
      btn.disabled = false;
      btn.innerHTML = "Place Order — Cash on Delivery";
    }
  });
});