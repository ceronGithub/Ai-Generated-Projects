/**
 * FILE: r2-worker/index.js
 * PURPOSE:
 * Cloudflare Worker that acts as a secure proxy between Victoria's Haven
 * mailer (browser) and Cloudflare R2 (object storage).
 *
 * WHY A WORKER IS NEEDED:
 * R2 credentials (Account ID, Access Key, Secret Key) cannot live in
 * browser-side JS — they would be visible to anyone. The Worker holds
 * all credentials as environment variables (secrets) server-side, so
 * the browser only needs to POST/GET this Worker URL.
 *
 * DATA FLOW:
 * 1. On page load, attachments.js (browser) → GET /list
 * 2. Worker reads every object under HOUSE RULES/ from R2 and returns
 *    { key, url, title } for each — attachments.js builds the gallery
 *    grid directly from this list (no base64 baked into index.html).
 * 3. When the user adds/replaces a house-rule photo, attachments.js →
 *    POST /upload with FormData { file: <image.jpg>, title: <string> }
 * 4. Worker validates the file (type + size), writes it to R2 under
 *    /HOUSE RULES/, saving the title as R2 customMetadata
 * 5. Worker returns { success: true, url, key } — attachments.js swaps
 *    the card's <img src> to this URL immediately
 * 6. email.js never uploads anything — it just reads the R2 URL already
 *    sitting on each selected card and drops it straight into the email
 *    HTML, since the image is already hosted
 *
 * ══════════════════════════════════════════════════════════════════════
 * SETUP INSTRUCTIONS (one-time, ~10 minutes)
 * ══════════════════════════════════════════════════════════════════════
 *
 * STEP 1 — Create an R2 Bucket
 *   a. Go to https://dash.cloudflare.com
 *   b. Left sidebar → R2 Object Storage → Create bucket
 *   c. Name it: victorias-haven-assets (or any name you prefer)
 *   d. Leave all settings default → Create bucket
 *
 * STEP 2 — Enable Public Access on the bucket
 *   a. Open the bucket you just created → Settings tab
 *   b. Scroll to "Public Access" → click "Allow Access"
 *   c. Under "Public bucket URL", copy the URL
 *      It looks like: https://pub-XXXX.r2.dev  OR a custom domain
 *   d. Paste that URL below as R2_PUBLIC_BASE_URL
 *
 * STEP 3 — Create a Cloudflare Worker
 *   a. Left sidebar → Workers & Pages → Create
 *   b. Select "Create Worker" → give it a name: vh-r2-upload
 *   c. Click "Deploy" (deploys the default hello-world first — fine)
 *   d. Then click "Edit code" and paste the entire contents of THIS file
 *   e. Click "Deploy" again
 *
 * STEP 4 — Bind the Worker to your R2 Bucket
 *   a. On your Worker page → Settings → Bindings → Add binding
 *   b. Type: R2 Bucket
 *   c. Variable name: R2_BUCKET   (must match exactly — used in code below)
 *   d. R2 bucket: select victorias-haven-assets
 *   e. Save
 *
 * STEP 5 — Copy the Worker URL
 *   a. Your Worker URL is shown on the Worker overview page:
 *      https://vh-r2-upload.YOUR-SUBDOMAIN.workers.dev
 *   b. Open js/r2-config.js in this project
 *   c. Find the line:  window.R2_WORKER_URL = 'YOUR_WORKER_URL_HERE';
 *   d. Replace it with your actual Worker URL (no trailing slash)
 *      Example: window.R2_WORKER_URL = 'https://vh-r2-upload.ceron.workers.dev';
 *
 * STEP 6 — Update R2_PUBLIC_BASE_URL below
 *   Replace 'YOUR_R2_PUBLIC_BASE_URL' with the URL from Step 2c.
 *   Example: const R2_PUBLIC_BASE_URL = 'https://pub-abc123.r2.dev';
 *
 * STEP 7 — Test it
 *   Open the Victoria's Haven mailer — the House Rules grid should load
 *   straight from R2. Try adding/replacing a photo, then compose and send.
 *
 * ══════════════════════════════════════════════════════════════════════
 */

// ── Configuration ─────────────────────────────────────────────────────────
// Replace with the public CDN base URL of your R2 bucket (from Step 2c above).
// No trailing slash.
const R2_PUBLIC_BASE_URL = 'https://pub-6c431fe30a144e26944303b6a49592bb.r2.dev';

// Subfolder inside the bucket where HOUSE RULES images are stored.
// Must match the existing folder in the bucket exactly (case + space).
const UPLOAD_FOLDER = 'HOUSE RULES';

// Allowed origins — add your live domain when you deploy the site.
// Localhost is included for local development/testing.
const ALLOWED_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'file://',           // allows direct open of index.html from filesystem
  '*',                 // ← remove this line in production and list your domain instead
];

// Maximum file size accepted: 5MB in bytes.
// attachments.js already compresses images to well under this before uploading.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Accepted MIME types — only images allowed.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ── CORS headers — sent on every response ─────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  '*',  // tighten to your domain in production
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ── Main Worker handler ────────────────────────────────────────────────────
export default {
  /**
   * fetch
   * Entry point for every request hitting this Worker.
   * Routes: OPTIONS (CORS preflight), GET /list (gallery images),
   * POST /upload (image upload), everything else → 404.
   *
   * @param {Request}     request  - Incoming HTTP request
   * @param {Object}      env      - Worker environment (contains R2_BUCKET binding)
   * @param {ExecutionContext} ctx - Execution context (unused here)
   */
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    // Handle CORS preflight requests from the browser
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status:  204,
        headers: corsHeaders(origin),
      });
    }

    // Route: list every image currently stored in the HOUSE RULES folder —
    // used by attachments.js to build the gallery grid straight from R2
    // instead of embedded base64.
    if (request.method === 'GET' && url.pathname === '/list') {
      return handleList(origin, env);
    }

    // Only accept POST to /upload — reject everything else
    if (request.method !== 'POST' || url.pathname !== '/upload') {
      return new Response(
        JSON.stringify({ success: false, message: 'Not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    // ── Parse the incoming multipart/form-data ─────────────────────────
    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return errorResponse(origin, 400, 'Invalid form data: ' + err.message);
    }

    const file = formData.get('file');

    // Optional display title (e.g. "Pool Fountain") — saved as R2
    // customMetadata so /list can return a human-readable name instead
    // of the raw timestamped filename.
    const titleField = formData.get('title');
    const title = (typeof titleField === 'string' && titleField.trim()) ? titleField.trim() : null;

    // Validate: file field must be present
    if (!file || typeof file.arrayBuffer !== 'function') {
      return errorResponse(origin, 400, 'No file provided in the request.');
    }

    // Validate: file type must be an image
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return errorResponse(origin, 400, `File type not allowed: ${file.type}. Only JPEG, PNG, WebP, GIF accepted.`);
    }

    // Validate: file must not exceed the size limit
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES) {
      return errorResponse(origin, 400, `File too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
    }

    // ── Build a unique file key to prevent collisions ──────────────────
    // Format: HOUSE RULES/{timestamp}-{sanitized-title}.jpg
    const originalName  = file.name || 'image.jpg';
    const safeName      = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '-').toLowerCase();
    const timestamp     = Date.now();
    const fileKey       = `${UPLOAD_FOLDER}/${timestamp}-${safeName}`;

    // ── Write the file to R2 ───────────────────────────────────────────
    try {
      await env.R2_BUCKET.put(fileKey, buffer, {
        httpMetadata: {
          contentType: file.type,
          // Set cache-control so the CDN caches images aggressively — emails
          // referencing these URLs will always load fast even months later.
          cacheControl: 'public, max-age=31536000, immutable',
        },
        // Display title for the gallery — read back by /list.
        customMetadata: title ? { title } : undefined,
      });
    } catch (err) {
      return errorResponse(origin, 500, 'R2 write failed: ' + err.message);
    }

    // ── Build the public CDN URL and return it ─────────────────────────
    // encodeURI keeps the "/" separators intact but escapes the space in
    // "HOUSE RULES/" so the URL is valid wherever it's used (<img src>, etc).
    const publicUrl = `${R2_PUBLIC_BASE_URL}/${encodeURI(fileKey)}`;

    return new Response(
      JSON.stringify({ success: true, url: publicUrl, key: fileKey }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      }
    );
  },
};

// ── Helper: return a consistent JSON error response ────────────────────────
function errorResponse(origin, status, message) {
  return new Response(
    JSON.stringify({ success: false, message }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    }
  );
}

// ── Helper: turn a raw object key into a readable fallback title ───────────
// Only used when an object has no saved title (e.g. an upload from before
// this field existed). "HOUSE RULES/1718999999999-pool-fountain.jpg"
// becomes "Pool Fountain".
function deriveTitleFromKey(key) {
  const fileName = key.split('/').pop() || key;
  const withoutTimestamp = fileName.replace(/^\d+-/, '');
  const withoutExt = withoutTimestamp.replace(/\.[a-zA-Z0-9]+$/, '');
  const spaced = withoutExt.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return 'House Rule';
  // Plain numeric filenames (e.g. "1.png", "10.png") get a friendlier label
  // than just the bare number.
  if (/^\d+$/.test(spaced)) return `House Rule ${spaced}`;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── handleList ───────────────────────────────────────────────────────────
// Reads every object under HOUSE RULES/ directly from R2 (paginating via
// cursor since a single list() call caps at 1000 keys) and returns each
// image's public CDN URL + display title. Sorted oldest-upload-first so
// the gallery order stays stable across reloads instead of shuffling.
async function handleList(origin, env) {
  try {
    const images = [];
    let cursor;

    do {
      const page = await env.R2_BUCKET.list({
        prefix: `${UPLOAD_FOLDER}/`,
        cursor,
        include: ['customMetadata'],
      });

      for (const obj of page.objects) {
        images.push({
          key:      obj.key,
          url:      `${R2_PUBLIC_BASE_URL}/${encodeURI(obj.key)}`,
          title:    obj.customMetadata?.title || deriveTitleFromKey(obj.key),
          uploaded: obj.uploaded,
        });
      }

      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    images.sort((a, b) => new Date(a.uploaded) - new Date(b.uploaded));

    return new Response(
      JSON.stringify({ success: true, images }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
    );
  } catch (err) {
    return errorResponse(origin, 500, 'R2 list failed: ' + err.message);
  }
}