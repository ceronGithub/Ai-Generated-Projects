// ============================================================
// STREETWISE PH — Inventory Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, getDocs, getDoc, setDoc,
  updateDoc, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const INV = 'inventory';

// Inventory doc ID format: productId_size_color
function invId(productId, size, color) {
  return `${productId}_${size||'default'}_${color||'default'}`.replace(/\s+/g, '-').toLowerCase();
}

// ── Get all inventory ──────────────────────────────────────
export async function getInventory() {
  const snap = await getDocs(collection(db, INV));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get inventory for one product ─────────────────────────
export async function getProductInventory(productId) {
  const q    = query(collection(db, INV), where('productId', '==', productId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get stock for specific variant ─────────────────────────
export async function getStock(productId, size, color) {
  const snap = await getDoc(doc(db, INV, invId(productId, size, color)));
  return snap.exists() ? snap.data().quantity : 0;
}

// ── Set stock (owner) ──────────────────────────────────────
export async function setStock(productId, size, color, quantity, threshold = 5, productName = '') {
  const id = invId(productId, size, color);
  await setDoc(doc(db, INV, id), {
    productId,
    productName,
    size:  size  || '',
    color: color || '',
    quantity,
    lowStockThreshold: threshold,
    updatedAt: new Date()
  }, { merge: true });
}

// ── Auto-create inventory entries for all size/color combos ─
// Called right after addProduct() so inventory tab is populated immediately
export async function createInventoryForProduct(productId, productName, sizes = [], colors = []) {
  const effectiveSizes  = sizes.length  ? sizes  : [''];
  const effectiveColors = colors.length ? colors : [''];
  const writes = [];
  for (const size of effectiveSizes) {
    for (const color of effectiveColors) {
      const id = invId(productId, size, color);
      writes.push(setDoc(doc(db, INV, id), {
        productId,
        productName,
        size:  size  || '',
        color: color || '',
        quantity: 0,
        lowStockThreshold: 5,
        updatedAt: new Date()
      }, { merge: true }));
    }
  }
  await Promise.all(writes);
}

// ── Delete all inventory entries for a product ─────────────
// Called when a product is hard-deleted
export async function deleteInventoryForProduct(productId) {
  const entries = await getProductInventory(productId);
  await Promise.all(entries.map(e => deleteDoc(doc(db, INV, e.id))));
}

// ── Decrement stock on order ───────────────────────────────
export async function decrementStock(productId, size, color, qty) {
  const id   = invId(productId, size, color);
  const snap = await getDoc(doc(db, INV, id));
  if (snap.exists()) {
    const current = snap.data().quantity || 0;
    await updateDoc(doc(db, INV, id), {
      quantity:  Math.max(0, current - qty),
      updatedAt: new Date()
    });
  }
}

// ── Get low stock items ────────────────────────────────────
export async function getLowStock() {
  const all = await getInventory();
  return all.filter(i => i.quantity <= (i.lowStockThreshold || 5));
}

// ── Update stock quantity by doc ID ───────────────────────
export async function updateStock(id, quantity) {
  await updateDoc(doc(db, INV, id), { quantity, updatedAt: new Date() });
}

