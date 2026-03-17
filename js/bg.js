/* bg.js — Optimised holographic background */
(function () {
  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d', { alpha: false });

  let W, H, particles = [], animId = null;
  const PARTICLE_COUNT = 24; // reduced for perf
  let gridCache  = null;     // offscreen grid cache
  let gridW = 0, gridH = 0;  // track when to rebuild cache

  /* ── Resize ───────────────────────────────────────────────────── */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    gridCache = null; // invalidate cache
  }

  /* ── Particles ────────────────────────────────────────────────── */
  function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x:     Math.random() * W,
        y:     Math.random() * H,
        vx:    (Math.random() - 0.5) * 0.25,
        vy:    (Math.random() - 0.5) * 0.25,
        size:  Math.random() * 1.2 + 0.4,
        alpha: Math.random() * 0.4 + 0.1,
        r: Math.random() > 0.6 ? 0   : (Math.random() > 0.5 ? 0   : 123),
        g: Math.random() > 0.6 ? 245 : (Math.random() > 0.5 ? 102 : 47),
        b: Math.random() > 0.6 ? 255 : (Math.random() > 0.5 ? 255 : 255),
      });
    }
  }

  /* ── Grid cache — draw once onto offscreen canvas ─────────────── */
  function buildGridCache() {
    const oc  = document.createElement('canvas');
    oc.width  = W;
    oc.height = H;
    const ox  = oc.getContext('2d');
    const sp  = 60;
    const cols = Math.ceil(W / sp) + 1;
    const rows = Math.ceil(H / sp) + 1;

    // batch all grid lines into one path
    ox.beginPath();
    for (let c = 0; c < cols; c++) { const x = c * sp; ox.moveTo(x, 0); ox.lineTo(x, H); }
    for (let r = 0; r < rows; r++) { const y = r * sp; ox.moveTo(0, y); ox.lineTo(W, y); }
    ox.strokeStyle = 'rgba(0,245,255,0.04)';
    ox.lineWidth   = 0.5;
    ox.stroke();

    // diagonal accents — single path
    const ds = 180;
    const dc = Math.ceil((W + H) / ds) + 1;
    ox.beginPath();
    for (let d = -5; d < dc; d++) {
      const off = d * ds;
      ox.moveTo(off, 0);
      ox.lineTo(off + H, H);
    }
    ox.strokeStyle = 'rgba(0,102,255,0.025)';
    ox.lineWidth   = 0.5;
    ox.stroke();

    // intersection dots — single fillRect pass via imageData is fastest
    ox.fillStyle = 'rgba(0,245,255,0.10)';
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c + r) % 3 === 0) {
          ox.fillRect(c * sp - 1, r * sp - 1, 2, 2);
        }
      }
    }

    gridCache = oc;
    gridW = W; gridH = H;
  }

  /* ── Horizon gradient — create once, reuse ─────────────────────── */
  let horizGrad = null, horizH = -1;
  function getHorizGrad() {
    if (horizH !== H) {
      horizGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      horizGrad.addColorStop(0, 'rgba(0,0,0,0)');
      horizGrad.addColorStop(1, 'rgba(0,40,120,0.06)');
      horizH = H;
    }
    return horizGrad;
  }

  /* ── Particle connections — use squared distance (avoid sqrt) ─── */
  function drawConnections() {
    const maxD2 = 110 * 110;
    ctx.lineWidth = 0.4;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          const a = (1 - d2 / maxD2) * 0.12;
          ctx.strokeStyle = `rgba(0,245,255,${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  /* ── Main loop ────────────────────────────────────────────────── */
  let lastFrame = 0;
  const TARGET_FPS = 30; // throttle to 30fps — imperceptible for bg
  const FRAME_MS   = 1000 / TARGET_FPS;

  function animate(ts) {
    animId = requestAnimationFrame(animate);
    if (ts - lastFrame < FRAME_MS) return; // skip frame
    lastFrame = ts;

    // solid bg fill (alpha:false context so no clearRect needed)
    ctx.fillStyle = '#02040f';
    ctx.fillRect(0, 0, W, H);

    // horizon glow
    ctx.fillStyle = getHorizGrad();
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // grid from cache
    if (!gridCache || gridW !== W || gridH !== H) buildGridCache();
    ctx.drawImage(gridCache, 0, 0);

    // scan beam (simple — no gradient creation each frame)
    const t  = (ts * 0.00025) % 1;
    const sy = t * H;
    ctx.fillStyle = 'rgba(0,245,255,0.025)';
    ctx.fillRect(0, sy - 50, W, 100);
    ctx.fillStyle = 'rgba(0,245,255,0.015)';
    ctx.fillRect(0, sy - 80, W, 160);

    // connections
    drawConnections();

    // particles — batch same-alpha particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = `rgb(${p.r},${p.g},${p.b})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.2832);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /* ── Visibility API — pause when tab hidden ─────────────────────── */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      lastFrame = 0;
      animId = requestAnimationFrame(animate);
    }
  });

  /* ── Init ──────────────────────────────────────────────────────── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); initParticles(); }, 150);
  });

  resize();
  initParticles();
  animId = requestAnimationFrame(animate);
})();