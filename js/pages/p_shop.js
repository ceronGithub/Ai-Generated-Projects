// ============================================================
// STREETWISE PH — pages/shop.js
// ============================================================

import "./p_main.js";
import { getProducts, getCategories } from "../firebase/f_products.js";
import { addToCart } from "../firebase/f_cart.js";
import { db } from "../firebase/f_config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let allProducts  = [];
let currentPage  = 1;
let currentCat   = "";
let currentSearch = "";
let stockCache   = {}; // productId → total quantity — cleared on filter/page change
const PAGE_SIZE  = 12;

// XSS-safe escape for product data rendered in innerHTML
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function loadCategories() {
  try {
    const cats = await getCategories();
    const wrap = document.getElementById("category-filters");
    if (!wrap) return;
    wrap.innerHTML =
      `<label class="filter-option"><input type="radio" name="cat" value="" checked onchange="filterCat('')"> All</label>` +
      cats.map(c => `<label class="filter-option"><input type="radio" name="cat" value="${c.slug}" onchange="filterCat('${c.slug}')"> ${c.name}</label>`).join("");
  } catch(e) { console.error(e); }
}

async function loadProducts() {
  const grid = document.getElementById("products-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="flex-center" style="grid-column:1/-1;padding:60px"><div class="spinner"></div></div>';
  stockCache = {}; // clear stale stock data on each load
  try {
    const result = await getProducts({ category: currentCat, search: currentSearch });
    // getProducts returns {products, total, pages} — extract the array
    allProducts = Array.isArray(result) ? result : (result.products || []);
    const sort = document.getElementById("sort-select")?.value;
    if (sort === "price-low")  allProducts.sort((a, b) => a.price - b.price);
    if (sort === "price-high") allProducts.sort((a, b) => b.price - a.price);
    // Apply price filter
    const priceFilter = document.querySelector("input[name='price']:checked")?.value || "all";
    if (priceFilter === "low")  allProducts = allProducts.filter(p => p.price < 1000);
    if (priceFilter === "mid")  allProducts = allProducts.filter(p => p.price >= 1000 && p.price <= 2500);
    if (priceFilter === "high") allProducts = allProducts.filter(p => p.price > 2500);
    const total = allProducts.length;
    const paged = allProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const rc = document.getElementById("results-count");
    if (rc) rc.textContent = `${total} item${total !== 1 ? "s" : ""}`;
    if (!paged.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-secondary)"><p style="font-size:3rem;margin-bottom:16px">◈</p><p>No products found.</p></div>';
      const pg = document.getElementById("pagination");
      if (pg) pg.innerHTML = "";
      return;
    }

    // Fetch stock for all visible products FIRST, then render once
    try {
      await Promise.all(paged.map(async p => {
        const snap = await getDocs(query(collection(db, 'inventory'), where('productId', '==', p.id)));
        stockCache[p.id] = snap.empty ? 999 : snap.docs.reduce((s, d) => s + (d.data().quantity || 0), 0);
      }));
    } catch(e) { /* stock check failed — render without stock info */ }

    grid.innerHTML = paged.map(renderCard).join("");
    renderPagination(Math.ceil(total / PAGE_SIZE));
  } catch(e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--danger)">Failed to load products. Check your Firebase connection.</div>';
    console.error(e);
  }
}

function renderCard(p) {
  const disc       = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const stock      = stockCache[p.id] ?? 999;
  const outOfStock = stock <= 0;
  const lowStock   = stock > 0 && stock <= 10;

  const imgStyle   = outOfStock ? ' style="filter:blur(3px) brightness(.6)"' : '';
  const img        = p.imageUrl
    ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy"${imgStyle}>`
    : `<div class="product-img-placeholder"${imgStyle}>◈</div>`;

  const outOverlay = outOfStock
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none">
        <span style="background:rgba(0,0,0,.72);color:#fff;font-size:.8rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:8px 20px;border-radius:4px;border:1px solid rgba(255,255,255,.15)">Out of Stock</span>
       </div>` : '';

  const stockBadge = lowStock ? `<span class="badge badge-danger">Only ${stock} left</span>` : '';
  const priceStyle = outOfStock ? ' style="color:var(--text-muted);text-decoration:line-through"' : '';

  const action = outOfStock
    ? `<div class="product-actions"><button class="product-quick-add" disabled style="opacity:.5;cursor:not-allowed">Out of Stock</button></div>`
    : `<div class="product-actions"><button class="product-quick-add" onclick="quickAdd('${p.id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${p.imageUrl||""}')">Add to Cart</button></div>`;

  return `
    <div class="product-card">
      <div class="product-img-wrap" style="position:relative">
        ${img}
        ${outOverlay}
        <div class="product-badges">
          ${p.isFeatured ? '<span class="badge badge-accent">Featured</span>' : ""}
          ${disc > 0 ? `<span class="badge badge-danger">-${disc}%</span>` : ""}
          ${stockBadge}
        </div>
        ${action}
      </div>
      <div class="product-info">
        <p class="product-category">${esc(p.category || "")}</p>
        <h3 class="product-name"><a href="product.html?id=${esc(p.id)}">${esc(p.name)}</a></h3>
        <div class="product-price">
          <span class="price-current"${priceStyle}>₱${parseFloat(p.price).toLocaleString("en-PH", {minimumFractionDigits:2})}</span>
          ${p.originalPrice ? `<span class="price-original">₱${parseFloat(p.originalPrice).toLocaleString("en-PH",{minimumFractionDigits:2})}</span>` : ""}
        </div>
      </div>
    </div>`;
}

function renderPagination(pages) {
  const wrap = document.getElementById("pagination");
  if (!wrap || pages <= 1) { if (wrap) wrap.innerHTML = ""; return; }
  let html = "";
  if (currentPage > 1) html += `<button class="page-btn" onclick="changePage(${currentPage - 1})">‹</button>`;
  for (let i = 1; i <= pages; i++) html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
  if (currentPage < pages) html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">›</button>`;
  wrap.innerHTML = html;
}

window.changePage = p => { currentPage = p; loadProducts(); window.scrollTo({ top: 200, behavior: "smooth" }); };
window.filterCat  = slug => { currentCat = slug; currentPage = 1; loadProducts(); };
window.quickAdd = async (id, name, price, imageUrl) => {
  try {
    const { checkStock } = await import('../firebase/f_inventory.js');
    const available = await checkStock(id, '', '');
    if (available <= 0) {
      window.showToast(`"${name}" is out of stock.`, 'error');
      return;
    }
  } catch(e) { /* if check fails, allow add */ }
  addToCart({ id, name, price, imageUrl, size: '', color: '', quantity: 1 });
  window.showToast('Added to cart!', 'success');
};

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("sort-select")?.addEventListener("change", () => { currentPage = 1; loadProducts(); });
  // Price filter
  document.querySelectorAll("input[name='price']").forEach(r => {
    r.addEventListener("change", () => { currentPage = 1; loadProducts(); });
  });
  let debounce;
  document.getElementById("search-input")?.addEventListener("input", e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { currentSearch = e.target.value; currentPage = 1; loadProducts(); }, 400);
  });
  const urlCat = new URLSearchParams(window.location.search).get("cat");
  if (urlCat) currentCat = urlCat;
  await loadCategories();
  await loadProducts();
});