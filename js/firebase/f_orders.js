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
export async function placeOrder({ cartItems, customerInfo, userId = null }) {
  const subtotal    = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingFee = 150;
  const total       = subtotal + shippingFee;
  const orderNumber = 'SWP-' + Date.now().toString(36).toUpperCase();

  const orderRef = await addDoc(collection(db, ORDERS), {
    orderNumber,
    userId,
    customerInfo,
    // Flattened for easy dashboard display
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

  // Decrement stock for each item
  for (const item of cartItems) {
    await decrementStock(item.productId, item.size, item.color, item.quantity);
  }

  clearCart();
  return { orderId: orderRef.id, orderNumber, total };
}

// ── Get all orders (owner) ─────────────────────────────────
export async function getOrders(statusFilter = '') {
  let q = statusFilter
    ? query(collection(db, ORDERS), where('orderStatus', '==', statusFilter), orderBy('createdAt', 'desc'))
    : query(collection(db, ORDERS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get recent orders ──────────────────────────────────────
export async function getRecentOrders(count = 10) {
  const q    = query(collection(db, ORDERS), orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

// Aliases for compatibility
export const getAllOrders = getOrders;
