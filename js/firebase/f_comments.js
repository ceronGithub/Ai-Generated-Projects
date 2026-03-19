// ============================================================
// STREETWISE PH — Comments Module
// ============================================================
import { db, auth } from './f_config.js';
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COMMENTS = 'comments';

export async function getComments(productId = null) {
  let q = productId
    ? query(collection(db, COMMENTS), where('productId', '==', productId))
    : collection(db, COMMENTS);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addComment({ content, guestName, productId = null, rating = 5 }) {
  const user = auth.currentUser;
  await addDoc(collection(db, COMMENTS), {
    content,
    guestName:  user ? null : guestName,
    userName:   user ? user.displayName || user.email : null,
    userId:     user ? user.uid : null,
    productId,
    rating,
    createdAt:  new Date()
  });
}

export async function deleteComment(id) {
  await deleteDoc(doc(db, COMMENTS, id));
}
