// ============================================================
// STREETWISE PH — pages/contact.js
// ============================================================

import "./p_main.js";
import { getComments, addComment } from "../firebase/f_comments.js";

async function loadComments() {
  const wrap = document.getElementById("contact-comments");
  if (!wrap) return;
  try {
    const comments = await getComments();
    if (!comments.length) {
      wrap.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">No messages yet. Be the first!</p>';
      return;
    }
    wrap.innerHTML = comments.map(c => {
      const rating = Math.min(100, Math.max(1, c.rating || 50));
      const pct    = rating + "%";
      const col    = rating >= 70 ? "#4caf76" : rating >= 40 ? "#e6a817" : "#d94f4f";
      const label  = rating >= 70 ? "Excellent" : rating >= 40 ? "Okay" : "Poor";
      const reply  = c.adminReply ? `
        <div style="margin-top:10px;padding:10px 14px;background:var(--bg-elevated);border-left:2px solid var(--accent);border-radius:0 var(--radius-sm) var(--radius-sm) 0">
          <p style="font-size:.7rem;color:var(--accent);font-weight:500;margin:0 0 3px;text-transform:uppercase;letter-spacing:.05em">Owner Reply</p>
          <p style="font-size:.875rem;color:var(--text-secondary);margin:0">${c.adminReply}</p>
        </div>` : "";
      return `
      <div style="padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:28px;height:28px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--accent)">${(c.userName||c.guestName||"G")[0].toUpperCase()}</div>
          <span style="font-size:.875rem;font-weight:500">${c.userName||c.guestName||"Guest"}</span>
          <span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">${window.formatDate(c.createdAt)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="width:${pct};height:100%;background:${col};border-radius:2px"></div>
          </div>
          <span style="font-size:.75rem;font-weight:600;color:${col};min-width:34px;text-align:right">${pct}</span>
          <span style="font-size:.7rem;color:var(--text-muted)">${label}</span>
        </div>
        <p style="font-size:.9rem;color:var(--text-secondary);line-height:1.6;margin:0">${c.content}</p>
        ${reply}
      </div>`;
    }).join("");
  } catch(e) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Connect Firebase to see messages.</p>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadComments();

  document.getElementById("contact-comment-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const btn    = e.target.querySelector("button[type=submit]");
    const rating = parseInt(document.getElementById("rating-slider")?.value || "50", 10);
    btn.disabled = true;
    try {
      await addComment({
        content:   e.target.content.value,
        guestName: e.target.guest_name.value,
        rating
      });
      window.showToast("Message sent!", "success");
      e.target.reset();
      // Reset slider UI back to 50%
      const slider = document.getElementById("rating-slider");
      const val    = document.getElementById("rating-val");
      const fill   = document.getElementById("rating-fill");
      if (slider) slider.value = 50;
      if (val)    { val.textContent = "50%"; val.style.color = "#e6a817"; }
      if (fill)   { fill.style.width = "50%"; fill.style.background = "#e6a817"; }
      loadComments();
    } catch(err) {
      window.showToast(err.message || "Failed to send.", "error");
    }
    btn.disabled = false;
  });
});