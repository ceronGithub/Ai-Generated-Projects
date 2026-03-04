/* promo.js — Promo countdown timer */
(function () {

  // Set deadline 23 hours from page load
  const DEADLINE = Date.now() + 23 * 60 * 60 * 1000 + 47 * 60 * 1000 + 33 * 1000;

  const elHours = document.getElementById('tHours');
  const elMins  = document.getElementById('tMins');
  const elSecs  = document.getElementById('tSecs');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const remaining = Math.max(0, DEADLINE - Date.now());

    const totalSecs  = Math.floor(remaining / 1000);
    const hours      = Math.floor(totalSecs / 3600);
    const mins       = Math.floor((totalSecs % 3600) / 60);
    const secs       = totalSecs % 60;

    elHours.textContent = pad(hours);
    elMins.textContent  = pad(mins);
    elSecs.textContent  = pad(secs);

    // Flash on second change
    flashEl(elSecs);

    if (remaining <= 0) {
      clearInterval(timer);
      elHours.textContent = '00';
      elMins.textContent  = '00';
      elSecs.textContent  = '00';
    }
  }

  function flashEl(el) {
    el.style.transition = 'color 0.1s';
    el.style.color = 'var(--accent)';
    setTimeout(() => {
      el.style.color = '';
    }, 200);
  }

  const timer = setInterval(tick, 1000);
  tick(); // immediate first render

  /* ── Glass card CTA interactions ── */
  document.querySelectorAll('.glass-cta').forEach(btn => {
    btn.addEventListener('click', function () {
      const card = this.closest('.glass-card');
      const overline = card.querySelector('.glass-overline');
      const label = overline ? overline.textContent : 'Offer';

      // Ripple effect
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position:absolute;
        border-radius:50%;
        background:rgba(255,255,255,0.15);
        width:120px; height:120px;
        margin-left:-60px; margin-top:-60px;
        animation: rippleOut 0.5s ease forwards;
        pointer-events:none;
        left:50%; top:50%;
      `;
      card.style.overflow = 'hidden';
      card.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });
  });

  // Inject ripple keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rippleOut {
      from { transform: scale(0); opacity: 1; }
      to   { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();
