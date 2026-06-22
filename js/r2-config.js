/* r2-config.js — Single source of truth for the Cloudflare R2 Worker URL
 *
 * Loaded first (before attachments.js and email.js) so both scripts can
 * read window.R2_WORKER_URL instead of each hardcoding their own copy:
 *   - attachments.js → GET  /list   (load the house-rules gallery)
 *                    → POST /upload (add/replace a house-rule photo)
 *   - email.js       → reads the R2 URL already on each selected card;
 *                       it never uploads anything itself anymore.
 *
 * Setup instructions: see r2-worker/index.js delivered alongside this file.
 * Format: https://your-worker-name.your-subdomain.workers.dev (no trailing slash)
 */
window.R2_WORKER_URL = 'https://vh-r2-upload.official-victoriashaven.workers.dev';
