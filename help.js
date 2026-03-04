/* =============================================
   help.js — Help modal controller
   ============================================= */
(function () {
  'use strict';

  const overlay  = document.getElementById('helpOverlay');
  const backdrop = document.getElementById('helpBackdrop');
  const closeBtn = document.getElementById('helpClose');
  const doneBtn  = document.getElementById('helpDone');
  const openBtn  = document.getElementById('helpBtn');
  const tabs     = overlay.querySelectorAll('.hlp-tab');
  const panes    = overlay.querySelectorAll('.hlp-pane');

  let closing = false;

  // ── Open ──────────────────────────────────────────────────────────────
  function openHelp() {
    overlay.style.display = 'flex';
    // Force reflow so CSS transition fires
    void overlay.offsetWidth;
    overlay.classList.add('hlp-open');
    closing = false;
    // Restore first tab
    switchTab('overview');
    document.addEventListener('keydown', onKey);
  }

  // ── Close ─────────────────────────────────────────────────────────────
  function closeHelp() {
    if (closing) return;
    closing = true;
    overlay.classList.remove('hlp-open');
    overlay.classList.add('hlp-closing');
    document.removeEventListener('keydown', onKey);
    overlay.addEventListener('transitionend', onClosed, { once: true });
    // Fallback in case transitionend doesn't fire
    setTimeout(onClosed, 380);
  }

  function onClosed() {
    overlay.classList.remove('hlp-closing');
    overlay.style.display = 'none';
    closing = false;
  }

  // ── Key handler ───────────────────────────────────────────────────────
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeHelp(); }
  }

  // ── Tab switching ─────────────────────────────────────────────────────
  function switchTab(tabId) {
    tabs.forEach(t => {
      t.classList.toggle('hlp-tab--active', t.dataset.tab === tabId);
    });
    panes.forEach(p => {
      p.classList.toggle('hlp-pane--active', p.dataset.pane === tabId);
    });
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  openBtn.addEventListener('click', openHelp);
  closeBtn.addEventListener('click', closeHelp);
  doneBtn.addEventListener('click', closeHelp);

  backdrop.addEventListener('click', closeHelp);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

}());
