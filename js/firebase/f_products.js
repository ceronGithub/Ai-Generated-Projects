// ============================================================
// STREETWISE PH — Products Module
// ============================================================
import { db } from './f_config.js';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PRODUCTS = 'products';
const CATS     = 'categories';

// ── Get all products ───────────────────────────────────────
export async function getProducts({ category = '', search = '', page = 1, perPage = 12 } = {}) {
  // No orderBy to avoid Firestore index requirement — sort client-side
  let q = query(collection(db, PRODUCTS), where('isActive', '==', true));
  const snap = await getDocs(q);
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  if (category) items = items.filter(p => p.categorySlug === category);
  if (search)   items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const total = items.length;
  const pages = Math.ceil(total / perPage);
  items = items.slice((page - 1) * perPage, page * perPage);
  return { products: items, total, pages };
}

// ── Get featured products ──────────────────────────────────
export async function getFeatured() {
  // Single where clause to avoid composite index requirement
  // Filter isActive client-side
  const q    = query(collection(db, PRODUCTS), where('isFeatured', '==', true), limit(20));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.isActive !== false)
    .slice(0, 8);
}

// ── Get single product ─────────────────────────────────────
export async function getProduct(id) {
  const snap = await getDoc(doc(db, PRODUCTS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Add product (owner only) ───────────────────────────────
export async function addProduct(data) {
  // Derive categoryName from category string if not provided
  const categoryName = data.categoryName || data.category || '';
  return await addDoc(collection(db, PRODUCTS), {
    ...data,
    categoryName,
    // Respect isActive from form — default true only if not set
    isActive:  data.isActive !== undefined ? data.isActive : true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

// ── Update product (owner only) ────────────────────────────
export async function updateProduct(id, data) {
  const categoryName = data.categoryName || data.category || '';
  await updateDoc(doc(db, PRODUCTS, id), { ...data, categoryName, updatedAt: new Date() });
}

// ── Hard delete product (owner only) ──────────────────────
// Uses deleteDoc so removed products disappear from admin list permanently
export async function deleteProduct(id) {
  await deleteDoc(doc(db, PRODUCTS, id));
}

// ── Get categories ─────────────────────────────────────────
export async function getCategories() {
  const snap = await getDocs(collection(db, CATS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Alias for compatibility
export const getFeaturedProducts = getFeatured;
export const getAllProductsAdmin = getProducts;

// ── Get ALL products for admin (no pagination, includes inactive) ──
export async function getProductsAdmin() {
  // No orderBy — avoids Firestore composite index requirement
  // Sort client-side instead: newest first
  const snap = await getDocs(collection(db, PRODUCTS));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return items.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?.seconds ?? 0;
    return tb - ta;
  });
}
