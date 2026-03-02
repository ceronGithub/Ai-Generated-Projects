// =============================================
// pdf-viewer.js
// Cosmic PDF Viewer Modal
// Features:
//   - Render PDF pages via PDF.js canvas
//   - Previous / Next page navigation
//   - Zoom In / Out / Reset
//   - Filename display centered below nav
//   - Keyboard shortcuts (arrows, +/-, Escape)
//   - Smooth open/close animation
// =============================================

const PDFViewer = (() => {

  // ── State ──────────────────────────────────
  let _pdfDoc   = null;
  let _pageNum  = 1;
  let _scale    = 1.2;
  let _fileName = '';
  let _rendering = false;
  let _pendingPage = null;

  const SCALE_MIN  = 0.4;
  const SCALE_MAX  = 4.0;
  const SCALE_STEP = 0.2;

  // ── DOM refs (resolved on first open) ──────
  const $ = id => document.getElementById(id);

  // ── Open modal with a File object ──────────
  async function open(file) {
    _fileName = file.name;
    _pageNum  = 1;
    _scale    = 1.2;

    // Show modal immediately (skeleton state)
    _showModal();
    _setFileName(file.name);
    _setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      _pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      _updatePageInfo();
      await _renderPage(_pageNum);
    } catch (err) {
      _setError(`Could not render PDF: ${err.message}`);
    } finally {
      _setLoading(false);
    }
  }

  // ── Close modal ────────────────────────────
  function close() {
    const overlay = $('pdfViewerOverlay');
    if (!overlay) return;
    overlay.classList.remove('pvm-open');
    overlay.classList.add('pvm-closing');
    setTimeout(() => {
      overlay.classList.remove('pvm-closing');
      overlay.style.display = 'none';
      // Clean up
      const canvas = $('pdfViewerCanvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      _pdfDoc = null;
    }, 320);
  }

  // ── Page navigation ────────────────────────
  async function goToPage(n) {
    if (!_pdfDoc) return;
    const total = _pdfDoc.numPages;
    n = Math.max(1, Math.min(n, total));
    if (n === _pageNum && !_rendering) return;

    if (_rendering) {
      _pendingPage = n;
      return;
    }

    _pageNum = n;
    _updatePageInfo();
    await _renderPage(n);
  }

  function prevPage() { goToPage(_pageNum - 1); }
  function nextPage() { goToPage(_pageNum + 1); }

  // ── Zoom ───────────────────────────────────
  function zoomIn()    { _setScale(_scale + SCALE_STEP); }
  function zoomOut()   { _setScale(_scale - SCALE_STEP); }
  function zoomReset() { _setScale(1.2); }

  function _setScale(s) {
    _scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, parseFloat(s.toFixed(1))));
    _updateZoomLabel();
    if (_pdfDoc) _renderPage(_pageNum);
  }

  // ── Render ─────────────────────────────────
  async function _renderPage(num) {
    if (!_pdfDoc) return;
    _rendering = true;

    const canvas  = $('pdfViewerCanvas');
    const ctx     = canvas.getContext('2d');
    const page    = await _pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: _scale });

    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    // Fade-out the canvas briefly
    canvas.style.opacity = '0.3';

    await page.render({ canvasContext: ctx, viewport }).promise;

    canvas.style.opacity = '1';
    _rendering = false;

    // If another page was requested while rendering, paint it now
    if (_pendingPage !== null) {
      const p = _pendingPage;
      _pendingPage = null;
      _pageNum = p;
      _updatePageInfo();
      await _renderPage(p);
    }
  }

  // ── UI helpers ─────────────────────────────
  function _showModal() {
    const overlay = $('pdfViewerOverlay');
    overlay.style.display = 'flex';
    // Force reflow then add open class for transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('pvm-open'));
    });
  }

  function _setFileName(name) {
    const el = $('pdfViewerFilename');
    if (el) el.textContent = name;
  }

  function _setLoading(on) {
    const loader = $('pdfViewerLoader');
    if (loader) loader.style.display = on ? 'flex' : 'none';
    const canvas = $('pdfViewerCanvas');
    if (canvas) canvas.style.display = on ? 'none' : 'block';
  }

  function _setError(msg) {
    const canvas = $('pdfViewerCanvas');
    const loader = $('pdfViewerLoader');
    if (loader) { loader.style.display = 'flex'; loader.innerHTML = `<span style="color:var(--danger);font-size:0.8rem;">${msg}</span>`; }
    if (canvas) canvas.style.display = 'none';
  }

  function _updatePageInfo() {
    if (!_pdfDoc) return;
    const total = _pdfDoc.numPages;
    const cur   = $('pdfViewerCurrentPage');
    const tot   = $('pdfViewerTotalPages');
    const inp   = $('pdfViewerPageInput');
    const prev  = $('pdfViewerPrev');
    const next  = $('pdfViewerNext');

    if (cur)  cur.textContent  = _pageNum;
    if (tot)  tot.textContent  = total;
    if (inp)  inp.value        = _pageNum;
    if (prev) prev.disabled    = _pageNum <= 1;
    if (next) next.disabled    = _pageNum >= total;
  }

  function _updateZoomLabel() {
    const el = $('pdfViewerZoomLabel');
    if (el) el.textContent = Math.round(_scale * 100) + '%';
    const zoomIn  = $('pdfViewerZoomIn');
    const zoomOut = $('pdfViewerZoomOut');
    if (zoomIn)  zoomIn.disabled  = _scale >= SCALE_MAX;
    if (zoomOut) zoomOut.disabled = _scale <= SCALE_MIN;
  }

  // ── Keyboard shortcuts ─────────────────────
  function _onKeyDown(e) {
    const overlay = $('pdfViewerOverlay');
    if (!overlay || overlay.style.display === 'none') return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault(); nextPage(); break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault(); prevPage(); break;
      case '+':
      case '=':
        e.preventDefault(); zoomIn(); break;
      case '-':
        e.preventDefault(); zoomOut(); break;
      case '0':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomReset(); } break;
      case 'Escape':
        close(); break;
    }
  }

  // ── Init: wire up static modal buttons ─────
  function init() {
    // Close button & overlay click
    const closeBtn = $('pdfViewerClose');
    const overlay  = $('pdfViewerOverlay');
    const backdrop = $('pdfViewerBackdrop');

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);

    // Nav
    const prevBtn = $('pdfViewerPrev');
    const nextBtn = $('pdfViewerNext');
    if (prevBtn) prevBtn.addEventListener('click', prevPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);

    // Page jump input
    const pageInput = $('pdfViewerPageInput');
    if (pageInput) {
      pageInput.addEventListener('change', () => {
        const n = parseInt(pageInput.value, 10);
        if (!isNaN(n)) goToPage(n);
      });
      pageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const n = parseInt(pageInput.value, 10);
          if (!isNaN(n)) goToPage(n);
        }
      });
    }

    // Zoom
    const zoomInBtn    = $('pdfViewerZoomIn');
    const zoomOutBtn   = $('pdfViewerZoomOut');
    const zoomResetBtn = $('pdfViewerZoomReset');
    if (zoomInBtn)    zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn)   zoomOutBtn.addEventListener('click', zoomOut);
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', zoomReset);

    // Keyboard
    document.addEventListener('keydown', _onKeyDown);
  }

  return { open, close, init };
})();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => PDFViewer.init());
if (document.readyState !== 'loading') PDFViewer.init();

window.PDFViewer = PDFViewer;
