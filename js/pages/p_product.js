// ============================================================
// STREETWISE PH — pages/product.js
// Populates the existing product.html elements
// ============================================================

import "./p_main.js";
import { getProduct }              from "../firebase/f_products.js";
import { addToCart }               from "../firebase/f_cart.js";
import { getComments, addComment } from "../firebase/f_comments.js";

const colorMap = {
  Black:"#1a1a1a", White:"#f5f5f5", Charcoal:"#3d3d3d", Grey:"#888",
  Olive:"#6b7645", "Dusty Rose":"#c9897e", Cream:"#f0e8d8",
  Champagne:"#d4b896", Ivory:"#f5f0e0", "Midnight Blue":"#1a2340",
  Tan:"#c9a96e"
};

let product = null, selectedSize = "", selectedColor = "", qty = 1, rating = 5;

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { window.location.href = "shop.html"; return; }
  try {
    product = await getProduct(id);
    if (!product) { window.location.href = "shop.html"; return; }

    // ── Populate static elements ──────────────────────────
    document.title = `${product.name} — Streetwise PH`;

    const bcName = document.getElementById("breadcrumb-name");
    if (bcName) bcName.textContent = product.name;

    const catEl = document.getElementById("product-category");
    if (catEl) catEl.textContent = product.category || "";

    const nameEl = document.getElementById("product-name");
    if (nameEl) nameEl.textContent = product.name;

    const descEl = document.getElementById("product-desc");
    if (descEl) descEl.textContent = product.description || "";

    // ── Image ─────────────────────────────────────────────
    const imgWrap = document.getElementById("product-main-img");
    if (imgWrap) {
      imgWrap.innerHTML = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div style="width:100%;height:100%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:4rem;color:var(--text-muted)">◈</div>`;
    }

    // ── Price ─────────────────────────────────────────────
    const priceEl = document.getElementById("product-price");
    if (priceEl) {
      priceEl.innerHTML = `<span class="price-current" style="font-size:1.75rem;color:var(--accent)">₱${parseFloat(product.price).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>` +
        (product.originalPrice ? `<span class="price-original" style="margin-left:10px">₱${parseFloat(product.originalPrice).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>` : "");
    }

    // ── Sizes ─────────────────────────────────────────────
    const sizeSelector = document.getElementById("size-selector");
    const sizeOptions  = document.getElementById("size-options");
    if (sizeSelector && sizeOptions) {
      if (product.sizes?.length) {
        sizeOptions.innerHTML = product.sizes.map(s =>
          `<button class="size-btn" data-size="${s}">${s}</button>`
        ).join("");
        sizeSelector.style.display = "";
        sizeOptions.querySelectorAll(".size-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            sizeOptions.querySelectorAll(".size-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedSize = btn.dataset.size;
          });
        });
      } else {
        sizeSelector.style.display = "none";
      }
    }

    // ── Colors ────────────────────────────────────────────
    const colorSelector = document.getElementById("color-selector");
    const colorOptions  = document.getElementById("color-options");
    const colorLabel    = document.getElementById("selected-color-name");
    if (colorSelector && colorOptions) {
      if (product.colors?.length) {
        colorOptions.innerHTML = product.colors.map(c =>
          `<button class="color-btn" style="background:${colorMap[c]||"#888"}" title="${c}" data-color="${c}"></button>`
        ).join("");
        colorSelector.style.display = "";
        colorOptions.querySelectorAll(".color-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            colorOptions.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedColor = btn.dataset.color;
            if (colorLabel) colorLabel.textContent = selectedColor;
          });
        });
      } else {
        colorSelector.style.display = "none";
      }
    }

    // ── Qty controls ──────────────────────────────────────
    document.getElementById("qty-minus")?.addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      const inp = document.getElementById("qty-input");
      if (inp) inp.value = qty;
    });
    document.getElementById("qty-plus")?.addEventListener("click", () => {
      qty++;
      const inp = document.getElementById("qty-input");
      if (inp) inp.value = qty;
    });
    document.getElementById("qty-input")?.addEventListener("change", e => {
      qty = Math.max(1, parseInt(e.target.value) || 1);
      e.target.value = qty;
    });

    // ── Add to Cart button ────────────────────────────────
    document.getElementById("add-to-cart-btn")?.addEventListener("click", () => {
      if (product.sizes?.length  && !selectedSize)  { window.showToast("Please select a size.", "error");  return; }
      if (product.colors?.length && !selectedColor) { window.showToast("Please select a color.", "error"); return; }
      addToCart({
        id:       product.id,
        name:     product.name,
        price:    product.price,
        imageUrl: product.imageUrl || "",
        size:     selectedSize,
        color:    selectedColor,
        quantity: qty
      });
      window.showToast("Added to cart!", "success");
    });

    loadComments(id);
  } catch(e) {
    console.error("loadProduct:", e);
    window.showToast("Failed to load product.", "error");
  }
}

async function loadComments(productId) {
  const wrap = document.getElementById("comments-list");
  if (!wrap) return;
  try {
    const comments = await getComments(productId);
    if (!comments.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:32px 0">No reviews yet. Be the first!</p>';
      return;
    }
    wrap.innerHTML = comments.map(c => `
      <div style="padding:20px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:32px;height:32px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--accent)">${(c.userName||c.guestName||"G")[0]}</div>
          <div>
            <p style="font-size:.875rem;font-weight:500">${c.userName||c.guestName||"Guest"}</p>
            <p style="font-size:.75rem;color:var(--text-muted)">${window.formatDate(c.createdAt)}</p>
          </div>
          <div style="margin-left:auto;color:var(--accent)">${"★".repeat(c.rating||5)}${"☆".repeat(5-(c.rating||5))}</div>
        </div>
        <p style="font-size:.9375rem;color:var(--text-secondary)">${c.content}</p>
      </div>`).join("");
  } catch(e) { console.error("loadComments:", e); }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProduct();

  // ── Star rating ───────────────────────────────────────
  const stars = document.querySelectorAll("#star-select span");
  stars.forEach(star => {
    star.addEventListener("click", () => {
      rating = parseInt(star.dataset.v);
      stars.forEach((s, i) => {
        s.classList.toggle("active", i < rating);
        s.style.color = i < rating ? "var(--accent)" : "var(--text-muted)";
      });
      const ratingInput = document.getElementById("rating-value");
      if (ratingInput) ratingInput.value = rating;
    });
  });

  // ── Comment form ──────────────────────────────────────
  document.getElementById("comment-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id  = new URLSearchParams(window.location.search).get("id");
    const btn = e.target.querySelector("button[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Posting..."; }
    try {
      await addComment({
        content:   e.target.content.value,
        guestName: e.target.guest_name?.value || "Guest",
        productId: id,
        rating
      });
      window.showToast("Review posted!", "success");
      e.target.reset();
      // reset stars
      stars.forEach((s, i) => { s.classList.toggle("active", i < 4); s.style.color = i < 4 ? "var(--accent)" : "var(--text-muted)"; });
      rating = 5;
      loadComments(id);
    } catch(err) {
      window.showToast(err.message || "Failed to post review.", "error");
    }
    if (btn) { btn.disabled = false; btn.textContent = "Post Review"; }
  });
});