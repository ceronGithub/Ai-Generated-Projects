// background.js — floating particles canvas background

(function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');

  // Particle palette — soft pastel colors matching month themes
  const COLORS = [
    '#ffb3c8', '#ff8fab', // pinks
    '#b3d6ff', '#74b9ff', // blues
    '#b3f0ce', '#55efc4', // greens
    '#ffddb3', '#fdcb6e', // oranges
    '#ddb3ff', '#a29bfe', // purples
    '#b3f0f4', '#81ecec', // teals
    '#fff0b3', '#ffeaa7', // yellows
    '#ffb3e8', '#fd79a8', // magentas
  ];

  const PARTICLE_COUNT = 80;
  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let lastTs = null;

  /* ── Particle factory ── */
  function createParticle(randomY) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size  = Math.random() * 5 + 2;          // 2–7 px
    return {
      x:       Math.random() * W,
      y:       randomY ? Math.random() * H : H + size + Math.random() * 200,
      size,
      color,
      alpha:   Math.random() * 0.5 + 0.15,        // 0.15–0.65 opacity
      speedX:  (Math.random() - 0.5) * 0.35,      // gentle horizontal drift
      speedY:  -(Math.random() * 0.55 + 0.15),    // float upward 0.15–0.70 px/frame
      wobble:  Math.random() * Math.PI * 2,        // phase offset for sine wobble
      wobbleSpeed: Math.random() * 0.018 + 0.006, // wobble rate
      wobbleAmp:   Math.random() * 18 + 6,        // wobble width 6–24 px
      // Each particle gently pulses in size
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.022 + 0.008,
      pulseAmp:   Math.random() * 1.2 + 0.3,
    };
  }

  function resize() {
    dpr   = window.devicePixelRatio || 1;
    W     = window.innerWidth;
    H     = window.innerHeight;
    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function spawnParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(true)); // spread across screen on init
    }
  }

  function drawParticle(p) {
    // Pulsing radius
    const r = p.size + Math.sin(p.pulsePhase) * p.pulseAmp;

    // Soft glowing circle — radial gradient for bloom effect
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.8);
    grad.addColorStop(0,   p.color + Math.round(p.alpha * 255).toString(16).padStart(2,'0'));
    grad.addColorStop(0.4, p.color + Math.round(p.alpha * 140).toString(16).padStart(2,'0'));
    grad.addColorStop(1,   p.color + '00');

    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Solid bright core
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = p.color + Math.round(Math.min(p.alpha * 1.6, 1) * 255).toString(16).padStart(2,'0');
    ctx.fill();
  }

  function updateParticle(p, dt) {
    const s = dt / 16.67; // normalize to 60fps

    // Update phase angles
    p.wobble      += p.wobbleSpeed * s;
    p.pulsePhase  += p.pulseSpeed  * s;

    // Move: float up with gentle sine wobble
    p.y += p.speedY * s;
    p.x += p.speedX * s + Math.sin(p.wobble) * p.wobbleAmp * 0.012 * s;

    // Fade in near bottom, fade out near top
    const progress = 1 - (p.y / H); // 0 at bottom, 1 at top
    if (progress < 0.1)       p.alpha = Math.min(p.alpha + 0.008 * s, 0.65);
    else if (progress > 0.75) p.alpha = Math.max(p.alpha - 0.005 * s, 0);

    // Recycle when off screen top or fully faded
    if (p.y < -p.size * 4 || p.alpha <= 0) {
      Object.assign(p, createParticle(false));
    }
  }

  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    const dt  = Math.min(ts - lastTs, 50);
    lastTs    = ts;

    ctx.clearRect(0, 0, W, H);

    // Warm white base wash
    ctx.fillStyle = 'rgba(247, 245, 242, 0.25)';
    ctx.fillRect(0, 0, W, H);

    // Draw all particles
    particles.forEach(p => {
      updateParticle(p, dt);
      drawParticle(p);
    });

    requestAnimationFrame(frame);
  }

  resize();
  spawnParticles();
  window.addEventListener('resize', () => { resize(); spawnParticles(); });
  requestAnimationFrame(frame);
})();