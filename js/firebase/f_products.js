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
  let q = query(collection(db, PRODUCTS), where('isActive', '==', true), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (category) items = items.filter(p => p.categorySlug === category);
  if (search)   items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const total = items.length;
  const pages = Math.ceil(total / perPage);
  items = items.slice((page - 1) * perPage, page * perPage);
  return { products: items, total, pages };
}

// ── Get featured products ──────────────────────────────────
export async function getFeatured() {
  const q    = query(collection(db, PRODUCTS), where('isFeatured', '==', true), where('isActive', '==', true), limit(8));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get single product ─────────────────────────────────────
export async function getProduct(id) {
  const snap = await getDoc(doc(db, PRODUCTS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Add product (owner only) ───────────────────────────────
export async function addProduct(data) {
  return await addDoc(collection(db, PRODUCTS), {
    ...data,
    isActive:  true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

// ── Update product (owner only) ────────────────────────────
export async function updateProduct(id, data) {
  await updateDoc(doc(db, PRODUCTS, id), { ...data, updatedAt: new Date() });
}

// ── Soft delete product (owner only) ──────────────────────
export async function deleteProduct(id) {
  await updateDoc(doc(db, PRODUCTS, id), { isActive: false, updatedAt: new Date() });
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
  const snap = await getDocs(query(collection(db, PRODUCTS), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
