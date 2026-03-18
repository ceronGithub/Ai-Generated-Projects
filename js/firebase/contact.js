// ============================================================
// STREETWISE PH — pages/contact.js
// ============================================================

import "./main.js";
import { getComments, addComment } from "../firebase/comments.js";

async function loadComments() {
  const wrap = document.getElementById("contact-comments");
  if (!wrap) return;
  try {
    const comments = await getComments();
    if (!comments.length) {
      wrap.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">No messages yet. Be the first!</p>';
      return;
    }
    wrap.innerHTML = comments.map(c => `
      <div style="padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:28px;height:28px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--accent)">${(c.userName||c.guestName||"G")[0]}</div>
          <span style="font-size:.875rem;font-weight:500">${c.userName||c.guestName||"Guest"}</span>
          <span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">${window.formatDate(c.createdAt)}</span>
        </div>
        <p style="font-size:.9rem;color:var(--text-secondary);line-height:1.6">${c.content}</p>
      </div>`).join("");
  } catch(e) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Connect Firebase to see messages.</p>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadComments();

  document.getElementById("contact-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await addComment({ content: e.target.content.value, guestName: e.target.guestName.value });
      window.showToast("Message sent!", "success");
      e.target.reset();
      loadComments();
    } catch(err) {
      window.showToast(err.message || "Failed to send.", "error");
    }
    btn.disabled = false;
  });
});
