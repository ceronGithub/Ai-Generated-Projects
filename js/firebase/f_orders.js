// ============================================================
// STREETWISE PH — Orders Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { clearCart } from './f_cart.js';

const ORDERS = 'orders';
const INV    = 'inventory';

// ── Inline stock check ────────────────────────────────────
async function checkCartStock(cartItems) {
  const problems = [];
  for (const item of cartItems) {
    const pid = item.productId || item.id;
    if (!pid) continue;
    try {
      const snap = await getDocs(query(collection(db, INV), where('productId', '==', pid)));
      const available = snap.empty ? 999 : snap.docs.reduce((s, d) => s + (d.data().quantity || 0), 0);
      if (available < item.quantity) {
        problems.push({ name: item.name || 'Item', requested: item.quantity, available });
      }
    } catch(e) { /* check failed — allow through */ }
  }
  return problems;
}

// ── Atomic decrement for one item (transaction) ───────────
async function atomicDecrement(pid, size, color, qty) {
  const invId  = id => `${id}_${size||'default'}_${color||'default'}`.replace(/\s+/g,'-').toLowerCase();
  const docRef = doc(db, INV, invId(pid));
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) return; // no inventory doc — skip
      const current = snap.data().quantity || 0;
      if (current < qty) throw new Error(`"${snap.data().productName||pid}" ran out of stock while your order was being placed.`);
      tx.update(docRef, { quantity: current - qty, updatedAt: new Date() });
    });
  } catch(e) {
    if (e.message?.includes('ran out')) throw e;
    // Fallback: find first variant for this product
    try {
      const snap = await getDocs(query(collection(db, INV), where('productId', '==', pid)));
      if (!snap.empty) {
        await runTransaction(db, async tx => {
          const d = await tx.get(snap.docs[0].ref);
          const current = d.data().quantity || 0;
          if (current < qty) throw new Error(`"${d.data().productName||pid}" ran out of stock.`);
          tx.update(snap.docs[0].ref, { quantity: current - qty, updatedAt: new Date() });
        });
      }
    } catch(e2) { if (e2.message?.includes('ran out')) throw e2; }
  }
}

// ── Place order ────────────────────────────────────────────
export async function placeOrder({ cartItems, customerInfo, userId = null }) {
  // 1. Pre-flight stock check (fast fail before writing anything)
  const problems = await checkCartStock(cartItems);
  if (problems.length) {
    const msg = problems.map(p => `"${p.name}" — only ${p.available} left`).join(', ');
    throw new Error('Some items are unavailable: ' + msg);
  }

  const subtotal    = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingFee = 0; // Depends on Courier
  const total       = subtotal + shippingFee;
  const orderNumber = 'SWP-' + Date.now().toString(36).toUpperCase();

  // 2. Atomically decrement stock BEFORE writing the order
  //    If any item runs out mid-checkout, no order is created
  for (const item of cartItems) {
    const pid = item.productId || item.id;
    if (pid) await atomicDecrement(pid, item.size || '', item.color || '', item.quantity);
  }

  // 3. Write the order only after stock is successfully reserved
  const orderRef = await addDoc(collection(db, ORDERS), {
    orderNumber,
    userId,
    customerInfo,
    guestName:       customerInfo?.name || customerInfo?.fullName || '',
    guestPhone:      customerInfo?.phone || '',
    shippingAddress: customerInfo?.address || '',
    items:           cartItems,
    subtotal,
    shippingFee,
    shippingLabel:   'Depends on Courier',
    total,
    paymentMethod:   'cash_on_delivery',
    paymentStatus:   'pending',
    orderStatus:     'pending',
    createdAt:       new Date(),
    updatedAt:       new Date()
  });

  clearCart();
  return { orderId: orderRef.id, orderNumber, total };
}

// ── Get all orders (owner) ─────────────────────────────────
export async function getOrders(statusFilter = '') {
  const snap = await getDocs(statusFilter
    ? query(collection(db, ORDERS), where('orderStatus', '==', statusFilter))
    : collection(db, ORDERS));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds??0) - (a.createdAt?.seconds??0));
}

// ── Get recent orders (limited) ────────────────────────────
export async function getRecentOrders(count = 10) {
  // Fetch all and sort client-side (Firestore orderBy requires index)
  const snap = await getDocs(collection(db, ORDERS));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds??0) - (a.createdAt?.seconds??0))
    .slice(0, count);
}

// ── Get single order ───────────────────────────────────────
export async function getOrder(id) {
  const snap = await getDoc(doc(db, ORDERS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Update order status (owner) ────────────────────────────
export async function updateOrderStatus(id, status) {
  await updateDoc(doc(db, ORDERS, id), { orderStatus: status, updatedAt: new Date() });
}

export const getAllOrders = getOrders;