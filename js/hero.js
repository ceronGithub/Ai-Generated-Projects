// ============================================================
// STREETWISE PH - hero.js | Auto-sliding Hero Banner
// ============================================================
(function () {
  let current = 0, timer = null;
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');

  function goTo(index) {
    slides[current]?.classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current]?.classList.add('active');
    dots[current]?.classList.add('active');
    // Re-trigger text animations
    const activeSlide = slides[current];
    if (activeSlide) {
      ['.hero-eyebrow','.hero-title','.hero-subtitle','.hero-cta'].forEach((sel, i) => {
        const el = activeSlide.querySelector(sel);
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = `heroFadeUp 0.8s ease ${0.3 + i * 0.2}s forwards`;
      });
    }
  }

  function startAuto() { timer = setInterval(() => goTo(current + 1), 6000); }
  function stopAuto()  { clearInterval(timer); }

  dots.forEach((dot, i) => dot.addEventListener('click', () => { stopAuto(); goTo(i); startAuto(); }));

  if (slides.length > 0) { goTo(0); startAuto(); }
})();
