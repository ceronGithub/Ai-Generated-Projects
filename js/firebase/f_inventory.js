// ============================================================
// STREETWISE PH — Inventory Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, getDocs, getDoc, setDoc,
  updateDoc, deleteDoc, query, where, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const INV = 'inventory';

// Inventory doc ID: productId_size_color (lowercased, spaces→dashes)
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

// ── Create inventory entries for all size/color combos ─────
export async function createInventoryForProduct(productId, productName, sizes = [], colors = [], initialStock = 0) {
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
        quantity: initialStock > 0 ? initialStock : 0,
        lowStockThreshold: 5,
        updatedAt: new Date()
      }, { merge: true }));
    }
  }
  await Promise.all(writes);
}

// ── Delete all inventory entries for a product ─────────────
export async function deleteInventoryForProduct(productId) {
  const entries = await getProductInventory(productId);
  await Promise.all(entries.map(e => deleteDoc(doc(db, INV, e.id))));
}

// ── Decrement stock on order (atomic, no read required) ────
// Tries exact variant first. If not found, decrements all variants of the product.
export async function decrementStock(productId, size, color, qty) {
  if (!productId) return;

  const specificId = invId(productId, size, color);

  // Try exact size+color match first
  try {
    await updateDoc(doc(db, INV, specificId), {
      quantity:  increment(-qty),
      updatedAt: new Date()
    });
    return; // success
  } catch(e) {
    // Doc doesn't exist with that exact variant — fall through
  }

  // Fallback: find all variants for this product and decrement the first one
  try {
    const q    = query(collection(db, INV), where('productId', '==', productId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        quantity:  increment(-qty),
        updatedAt: new Date()
      });
    } else {
      console.warn('[decrementStock] no inventory doc found for product:', productId);
    }
  } catch(e2) {
    console.warn('[decrementStock] failed:', e2.message);
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