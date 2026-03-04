// background.js — animated canvas background with floating color orbs

(function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');

  // 8 orbs — each tied loosely to the calendar's month colors
  const ORBS = [
    { x: 0.12, y: 0.08, r: 0.30, color: '#ffb3c8', speedX: 0.00016, speedY: 0.00012, ox: 0, oy: 0 },
    { x: 0.82, y: 0.12, r: 0.25, color: '#b3d6ff', speedX: 0.00020, speedY: 0.00018, ox: 1.2, oy: 0.8 },
    { x: 0.08, y: 0.62, r: 0.22, color: '#b3f0ce', speedX: 0.00014, speedY: 0.00022, ox: 2.4, oy: 1.6 },
    { x: 0.88, y: 0.72, r: 0.28, color: '#ffddb3', speedX: 0.00018, speedY: 0.00014, ox: 0.6, oy: 2.2 },
    { x: 0.48, y: 0.42, r: 0.20, color: '#ddb3ff', speedX: 0.00015, speedY: 0.00019, ox: 3.6, oy: 0.4 },
    { x: 0.30, y: 0.88, r: 0.18, color: '#b3f0f4', speedX: 0.00021, speedY: 0.00013, ox: 1.8, oy: 3.0 },
    { x: 0.68, y: 0.28, r: 0.16, color: '#fff0b3', speedX: 0.00017, speedY: 0.00021, ox: 4.2, oy: 1.0 },
    { x: 0.55, y: 0.75, r: 0.19, color: '#ffb3e8', speedX: 0.00013, speedY: 0.00017, ox: 2.0, oy: 4.4 },
  ];

  let W = 0, H = 0, dpr = 1;
  let time = 0;
  let lastTs = null;

  function resize() {
    dpr            = window.devicePixelRatio || 1;
    W              = window.innerWidth;
    H              = window.innerHeight;
    canvas.width   = W * dpr;
    canvas.height  = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function drawOrb(orb, t) {
    // Each orb drifts on its own Lissajous-like path
    const cx = (orb.x + Math.sin(t * orb.speedX * 1000 + orb.ox) * 0.12) * W;
    const cy = (orb.y + Math.cos(t * orb.speedY * 1000 + orb.oy) * 0.10) * H;
    const r  = orb.r * Math.min(W, H);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,    orb.color + 'cc'); // ~80% opacity center
    grad.addColorStop(0.45, orb.color + '77'); // ~47% mid
    grad.addColorStop(1,    orb.color + '00'); // fully transparent edge

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(ts - lastTs, 50); // cap delta to avoid big jumps
    lastTs   = ts;
    time    += dt;

    ctx.clearRect(0, 0, W, H);

    // Soft base wash so the background feels warm white, not stark
    ctx.fillStyle = 'rgba(247, 245, 242, 0.30)';
    ctx.fillRect(0, 0, W, H);

    ORBS.forEach(orb => drawOrb(orb, time));

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
