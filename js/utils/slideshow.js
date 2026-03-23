// ============================================================
// STREETWISE PH — Product Image Slideshow Utility
// Cycles through product images every 2 seconds
// ============================================================

const SLIDE_INTERVAL = 2000; // ms between image changes
const _timers = new Map(); // imgWrap el → interval id

/**
 * Build a flat images array from a product object.
 * Supports both the new `images[]` array and the legacy `imageUrl` string.
 */
export function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images;
  if (p.imageUrl) return [p.imageUrl];
  return [];
}

/**
 * Serialise images for a data-attribute so the DOM carries the info.
 */
export function encodeImages(images) {
  return encodeURIComponent(JSON.stringify(images));
}

/**
 * Start cycling images for every `.product-img-wrap[data-images]` found
 * inside `container` (defaults to document).
 *
 * Safe to call multiple times — clears previous timers first.
 */
export function initSlideshows(container = document) {
  // Clear any existing timers for wraps inside this container
  container.querySelectorAll('.product-img-wrap[data-images]').forEach(wrap => {
    if (_timers.has(wrap)) {
      clearInterval(_timers.get(wrap));
      _timers.delete(wrap);
    }
  });

  container.querySelectorAll('.product-img-wrap[data-images]').forEach(wrap => {
    let images;
    try {
      images = JSON.parse(decodeURIComponent(wrap.dataset.images));
    } catch { return; }

    if (!images || images.length < 2) return; // nothing to cycle

    let idx = 0;

    const id = setInterval(() => {
      idx = (idx + 1) % images.length;
      const img = wrap.querySelector('img');
      if (img) {
        img.style.transition = 'opacity 0.35s ease';
        img.style.opacity = '0';
        setTimeout(() => {
          img.src = images[idx];
          img.style.opacity = '1';
        }, 350);
      }
    }, SLIDE_INTERVAL);

    _timers.set(wrap, id);
  });
}

/**
 * Stop all active slideshow timers (call on page teardown if needed).
 */
export function destroySlideshows() {
  _timers.forEach(id => clearInterval(id));
  _timers.clear();
}
