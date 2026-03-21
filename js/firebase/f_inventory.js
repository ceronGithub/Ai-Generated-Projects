// ============================================================
// STREETWISE PH — Inventory Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, getDocs, getDoc, setDoc,
  updateDoc, deleteDoc, query, where, increment, runTransaction
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

// ── Decrement stock on order (transaction — prevents overselling) ──
// Uses runTransaction to atomically check stock >= qty before decrementing.
// Throws if insufficient stock so the order is blocked.
export async function decrementStock(productId, size, color, qty) {
  if (!productId) return;

  const specificId  = invId(productId, size, color);
  const specificRef = doc(db, INV, specificId);

  // Helper: run atomic decrement on a specific ref
  async function transactDecrement(ref) {
    await runTransaction(db, async tx => {
      const snap    = await tx.get(ref);
      if (!snap.exists()) {
        // No inventory doc — allow order but log warning
        console.warn('[decrementStock] no inventory doc:', ref.id);
        return;
      }
      const current = snap.data().quantity || 0;
      if (current < qty) {
        throw new Error(`Paumanhin, wala nang sapat na stock para sa item na ito. Available: ${current}, kailangan: ${qty}.`);
      }
      tx.update(ref, {
        quantity:  Math.max(0, current - qty),
        updatedAt: new Date()
      });
    });
  }

  // Try exact variant first
  try {
    const snap = await getDoc(specificRef);
    if (snap.exists()) {
      await transactDecrement(specificRef);
      return;
    }
  } catch(e) {
    // Re-throw stock errors (insufficient stock) — these must block the order
    if (e.message.includes('stock') || e.message.includes('stock')) throw e;
    console.warn('[decrementStock] transaction failed:', e.message);
    throw e;
  }

  // Fallback: find any variant for this product
  try {
    const q    = query(collection(db, INV), where('productId', '==', productId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await transactDecrement(snap.docs[0].ref);
    } else {
      console.warn('[decrementStock] no inventory found for product:', productId);
    }
  } catch(e2) {
    throw e2; // propagate stock errors
  }
}

// ── Check available stock for a variant ───────────────────
export async function checkStock(productId, size, color) {
  if (!productId) return 0;
  try {
    const snap = await getDoc(doc(db, INV, invId(productId, size, color)));
    if (snap.exists()) return snap.data().quantity || 0;
    // Fallback: sum all variants
    const q  = query(collection(db, INV), where('productId', '==', productId));
    const all = await getDocs(q);
    if (all.empty) return 999; // no inventory = assume unlimited
    return all.docs.reduce((s, d) => s + (d.data().quantity || 0), 0);
  } catch(e) { return 999; } // if check fails, don't block add to cart
}

// ── Validate all cart items have enough stock ──────────────
// Returns array of out-of-stock items: { name, requested, available }
export async function checkCartStock(cartItems) {
  const problems = [];
  for (const item of cartItems) {
    const pid = item.productId || item.id;
    if (!pid) continue;
    const available = await checkStock(pid, item.size || '', item.color || '');
    if (available < item.quantity) {
      problems.push({
        name:      item.name || 'Item',
        requested: item.quantity,
        available
      });
    }
  }
  return problems;
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