// ============================================================
// STREETWISE PH — Orders Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { clearCart } from './f_cart.js';
import { decrementStock, checkCartStock } from './f_inventory.js';

const ORDERS = 'orders';

// ── Place order ────────────────────────────────────────────
export async function placeOrder({ cartItems, customerInfo, totals }) {
  if (!cartItems || !cartItems.length) throw new Error("Cart is empty");

  // First, verify stock one last time before creating the order
  const problems = await checkCartStock(cartItems);
  if (problems.length > 0) {
    const msg = problems.map(p => `${p.name} (Only ${p.available} left)`).join(', ');
    throw new Error(`Stock changed: ${msg}`);
  }

  const total = totals.total || 0;
  const orderNumber = 'SWP-' + Math.random().toString(36).slice(2, 10).toUpperCase();

  // 1. Create the Order Document
  const orderRef = await addDoc(collection(db, ORDERS), {
    orderNumber,
    customerInfo,
    items: cartItems,
    total,
    paymentStatus: 'pending',
    orderStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 2. TRIGGER STOCK REDUCTION
  // Use decrementStock from f_inventory.js which has proper variant fallback logic
  for (const item of cartItems) {
    try {
      const pid = item.productId || item.id;
      await decrementStock(pid, item.size || '', item.color || '', item.quantity);
    } catch (e) {
      console.error("Failed to decrement stock for:", item.name, e);
      // We don't throw here so the order isn't cancelled after the document is already created
    }
  }

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