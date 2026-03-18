// ============================================================
// STREETWISE PH — pages/product.js
// ============================================================

import "./main.js";
import { getProduct } from "../firebase/products.js";
import { addToCart }  from "../firebase/cart.js";
import { getComments, addComment } from "../firebase/comments.js";

const colorMap = { Black:"#1a1a1a", White:"#f5f5f5", Charcoal:"#3d3d3d", Grey:"#888", Olive:"#6b7645", "Dusty Rose":"#c9897e", Cream:"#f0e8d8", Champagne:"#d4b896", Ivory:"#f5f0e0", "Midnight Blue":"#1a2340", Tan:"#c9a96e" };

let product = null, selectedSize = "", selectedColor = "", qty = 1, rating = 5;

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { window.location.href = "shop.html"; return; }
  try {
    product = await getProduct(id);
    if (!product) { window.location.href = "shop.html"; return; }
    document.title = `${product.name} — Streetwise PH`;
    const bc = document.getElementById("bc-name");
    if (bc) bc.textContent = product.name;
    const detail = document.getElementById("product-detail");
    if (!detail) return;
    detail.innerHTML = `
      <div class="product-gallery">
        <div class="product-main-img">${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : '<div class="product-img-placeholder" style="height:100%">◈</div>'}</div>
      </div>
      <div class="product-detail-info">
        <p class="product-category text-accent">${product.category || ""}</p>
        <h1 class="product-detail-name">${product.name}</h1>
        <div style="margin-bottom:20px">
          <span class="price-current" style="font-size:1.75rem;color:var(--accent)">₱${parseFloat(product.price).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>
          ${product.originalPrice ? `<span class="price-original" style="margin-left:10px">₱${parseFloat(product.originalPrice).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>` : ""}
        </div>
        <p style="color:var(--text-secondary);line-height:1.8;margin-bottom:28px">${product.description || ""}</p>
        ${product.sizes?.length ? `<div class="size-selector"><label>Size</label><div class="size-options">${product.sizes.map(s => `<button class="size-btn" onclick="selectSize('${s}',this)">${s}</button>`).join("")}</div></div>` : ""}
        ${product.colors?.length ? `<div class="color-selector"><label>Color — <span id="color-label" style="color:var(--accent)"></span></label><div class="color-options">${product.colors.map(c => `<button class="color-btn" style="background:${colorMap[c]||"#888"}" title="${c}" onclick="selectColor('${c}',this)"></button>`).join("")}</div></div>` : ""}
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(-1)">−</button>
          <input class="qty-input" type="number" id="qty-input" value="1" min="1">
          <button class="qty-btn" onclick="changeQty(1)">+</button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:24px">
          <button id="atc-btn" class="btn btn-primary btn-lg" style="flex:1">Add to Cart</button>
          <a href="cart.html" class="btn btn-outline btn-lg">View Cart</a>
        </div>
        <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8125rem;color:var(--text-muted)">
          <p style="margin-bottom:4px">💳 Payment: <span style="color:var(--text-secondary)">Cash on Delivery</span></p>
          <p>🚚 Shipping: <span style="color:var(--text-secondary)">₱150 flat rate · Metro Manila</span></p>
        </div>
      </div>`;
    document.getElementById("atc-btn")?.addEventListener("click", handleAddToCart);
    document.getElementById("qty-input")?.addEventListener("change", e => { qty = Math.max(1, parseInt(e.target.value) || 1); e.target.value = qty; });
    loadComments(id);
  } catch(e) { console.error(e); }
}

window.selectSize  = (size, btn) => { selectedSize = size; document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("selected")); btn.classList.add("selected"); };
window.selectColor = (color, btn) => { selectedColor = color; document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected")); btn.classList.add("selected"); const lbl = document.getElementById("color-label"); if (lbl) lbl.textContent = color; };
window.changeQty   = delta => { qty = Math.max(1, qty + delta); const inp = document.getElementById("qty-input"); if (inp) inp.value = qty; };

function handleAddToCart() {
  if (product?.sizes?.length && !selectedSize)  { window.showToast("Please select a size.", "error"); return; }
  if (product?.colors?.length && !selectedColor) { window.showToast("Please select a color.", "error"); return; }
  addToCart(product, selectedSize, selectedColor, qty);
  window.showToast("Added to cart!", "success");
}

async function loadComments(productId) {
  const wrap = document.getElementById("comments-list");
  if (!wrap) return;
  try {
    const comments = await getComments(productId);
    if (!comments.length) { wrap.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:32px 0">No reviews yet. Be the first!</p>'; return; }
    wrap.innerHTML = comments.map(c => `
      <div style="padding:20px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:32px;height:32px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--accent)">${(c.userName||c.guestName||"G")[0]}</div>
          <div><p style="font-size:.875rem;font-weight:500">${c.userName||c.guestName||"Guest"}</p><p style="font-size:.75rem;color:var(--text-muted)">${window.formatDate(c.createdAt)}</p></div>
          <div class="stars" style="margin-left:auto">${"★".repeat(c.rating||5)}${"☆".repeat(5-(c.rating||5))}</div>
        </div>
        <p style="font-size:.9375rem;color:var(--text-secondary)">${c.content}</p>
      </div>`).join("");
  } catch(e) { console.error(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProduct();

  // Star rating
  document.querySelectorAll(".star-select span")?.forEach(star => {
    star.addEventListener("click", () => {
      rating = parseInt(star.dataset.v);
      document.querySelectorAll(".star-select span").forEach((s, i) => s.classList.toggle("lit", i < rating));
    });
  });

  // Comment form
  document.getElementById("comment-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id  = new URLSearchParams(window.location.search).get("id");
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await addComment({ content: e.target.content.value, guestName: e.target.guestName?.value, productId: id, rating });
      window.showToast("Review posted!", "success");
      e.target.reset();
      loadComments(id);
    } catch(err) { window.showToast(err.message, "error"); }
    btn.disabled = false;
  });
});
