// ============================================================
// STREETWISE PH — Sales Analysis Module
// ============================================================
import { db } from './config.js';
import {
  collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Get overview stats ─────────────────────────────────────
export async function getSalesOverview(from, to) {
  const orders = await getOrdersInRange(from, to);
  const active = orders.filter(o => o.orderStatus !== 'cancelled');

  const totalRevenue = active.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders  = active.length;
  const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Today
  const today      = new Date().toDateString();
  const todayOrders = active.filter(o => new Date(o.createdAt?.toDate?.() || o.createdAt).toDateString() === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Pending
  const snap    = await getDocs(collection(db, 'orders'));
  const pending = snap.docs.filter(d => d.data().orderStatus === 'pending').length;

  return { totalRevenue, totalOrders, avgOrder, todayRevenue, todayOrders: todayOrders.length, pendingOrders: pending };
}

// ── Get revenue by date ────────────────────────────────────
export async function getSalesByDate(from, to) {
  const orders = await getOrdersInRange(from, to);
  const active = orders.filter(o => o.orderStatus !== 'cancelled');
  const byDate = {};
  active.forEach(o => {
    const date = new Date(o.createdAt?.toDate?.() || o.createdAt).toISOString().split('T')[0];
    if (!byDate[date]) byDate[date] = { date, orders: 0, revenue: 0 };
    byDate[date].orders++;
    byDate[date].revenue += o.total || 0;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Get revenue by product ─────────────────────────────────
export async function getSalesByProduct(from, to) {
  const orders   = await getOrdersInRange(from, to);
  const active   = orders.filter(o => o.orderStatus !== 'cancelled');
  const byProduct = {};
  active.forEach(o => {
    (o.items || []).forEach(item => {
      const key = item.productId;
      if (!byProduct[key]) byProduct[key] = { productName: item.name, unitsSold: 0, revenue: 0, imageUrl: item.imageUrl || '' };
      byProduct[key].unitsSold += item.quantity;
      byProduct[key].revenue   += item.price * item.quantity;
    });
  });
  return Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

// ── Get revenue by category ────────────────────────────────
export async function getSalesByCategory(from, to) {
  const orders = await getOrdersInRange(from, to);
  const active = orders.filter(o => o.orderStatus !== 'cancelled');
  const byCat  = {};
  active.forEach(o => {
    (o.items || []).forEach(item => {
      const key = item.category || 'Uncategorized';
      if (!byCat[key]) byCat[key] = { category: key, unitsSold: 0, revenue: 0 };
      byCat[key].unitsSold += item.quantity;
      byCat[key].revenue   += item.price * item.quantity;
    });
  });
  return Object.values(byCat).sort((a, b) => b.revenue - a.revenue);
}

// ── Helper: fetch orders in date range ────────────────────
async function getOrdersInRange(from, to) {
  const snap   = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const fromDate = new Date(from);
  const toDate   = new Date(to); toDate.setHours(23,59,59,999);
  return orders.filter(o => {
    const d = new Date(o.createdAt?.toDate?.() || o.createdAt);
    return d >= fromDate && d <= toDate;
  });
}
