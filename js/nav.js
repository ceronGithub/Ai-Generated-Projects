/* nav.js — Panel switching & mobile sidebar */
(function () {

  const navItems   = document.querySelectorAll('.nav-item');
  const panels     = document.querySelectorAll('.panel');
  const hamburger  = document.getElementById('hamburger');
  const sidebar    = document.getElementById('sidebar');
  const overlay    = document.getElementById('sidebarOverlay');

  /* ── Panel switching ── */
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.panel;

      // Update active nav
      navItems.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');

      // Show target panel
      panels.forEach(p => {
        if (p.id === `panel-${target}`) {
          p.classList.remove('hidden');
          // Re-trigger animation
          p.style.animation = 'none';
          requestAnimationFrame(() => {
            p.style.animation = '';
          });
        } else {
          p.classList.add('hidden');
        }
      });

      // Close sidebar on mobile after selecting
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  /* ── Mobile sidebar ── */
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.remove('hidden');
    hamburger.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
    hamburger.classList.remove('open');
  }

  hamburger.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  // Start overlay hidden
  overlay.classList.add('hidden');

  // Close sidebar on resize back to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });
})();


/* ── Dev Watermark toggle ──────────────────────────────────────────────────
   Clicking the floating watermark icon expands the tooltip label.
   Auto-collapses after 3 seconds of no interaction. */
(function () {
  const watermark = document.getElementById('devWatermark');
  if (!watermark) return;

  let collapseTimer = null;

  /* expandWatermark
     Adds the expanded class to show the tooltip, then sets a 3-second
     timer to auto-collapse so it never permanently blocks the UI. */
  function expandWatermark() {
    watermark.classList.add('devExpanded');
    clearTimeout(collapseTimer);
    // Auto-collapse after 3 seconds of no further clicks
    collapseTimer = setTimeout(function () {
      watermark.classList.remove('devExpanded');
    }, 3000);
  }

  /* collapseWatermark
     Immediately hides the tooltip and clears the timer. */
  function collapseWatermark() {
    watermark.classList.remove('devExpanded');
    clearTimeout(collapseTimer);
  }

  // Toggle on click: if already expanded, collapse it; otherwise expand
  watermark.addEventListener('click', function () {
    if (watermark.classList.contains('devExpanded')) {
      collapseWatermark();
    } else {
      expandWatermark();
    }
  });
})();