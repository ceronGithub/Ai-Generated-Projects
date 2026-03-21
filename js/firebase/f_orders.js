// ============================================================
// STREETWISE PH — Orders Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { clearCart } from './f_cart.js';
import { decrementStock } from './f_inventory.js';

const ORDERS = 'orders';

// ── Place order ────────────────────────────────────────────
export async function placeOrder({ cartItems, customerInfo, userId = null, totals = null }) {
  const subtotal    = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingFee = totals?.shipping ?? (subtotal >= 2000 ? 0 : 150);
  const total       = subtotal + shippingFee;
  const orderNumber = 'SWP-' + Date.now().toString(36).toUpperCase();

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
    total,
    paymentMethod:   'cash_on_delivery',
    paymentStatus:   'pending',
    orderStatus:     'pending',
    createdAt:       new Date(),
    updatedAt:       new Date()
  });

  // Decrement stock — never blocks checkout even if it fails
  for (const item of cartItems) {
    const pid = item.productId || item.id;
    if (pid) {
      await decrementStock(pid, item.size || '', item.color || '', item.quantity);
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
    .sort((a,b)=>(b.createdAt?.seconds??0)-(a.createdAt?.seconds??0));
}

// ── Get recent orders ──────────────────────────────────────
export async function getRecentOrders(count = 10) {
  const snap = await getDocs(collection(db, ORDERS));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
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