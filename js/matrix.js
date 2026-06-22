/**
 * FILE: js/matrix.js
 * PURPOSE:
 * Renders a floating particle constellation background on the full-screen canvas.
 * Replaces the original matrix rain effect with a calmer, ambient visual that
 * complements the deep teal-green + lantern amber colour palette.
 *
 * HOW IT WORKS:
 * - A fixed number of small particles drift slowly across the canvas.
 * - Nearby particles (within CONNECTION_RADIUS px) are connected by a faint line.
 * - Each particle has a randomly assigned tint — either the amber accent or the
 *   sage-green accent — for visual cohesion with the app palette.
 * - Mouse proximity creates a subtle attraction effect without snapping.
 * - Canvas resizes automatically on window resize.
 */
(function () {

  const canvas = document.getElementById('matrixCanvas');
  const ctx    = canvas.getContext('2d');

  /* ── Configuration ───────────────────────────────────────────── */
  const PARTICLE_COUNT     = 72;    // Total floating nodes
  const CONNECTION_RADIUS  = 140;   // Max distance (px) before a line is drawn
  const PARTICLE_MIN_R     = 1.2;   // Minimum particle radius
  const PARTICLE_MAX_R     = 2.6;   // Maximum particle radius
  const SPEED_MAX          = 0.32;  // Max drift speed per axis
  const MOUSE_RADIUS       = 120;   // Radius of mouse attraction
  const MOUSE_FORCE        = 0.018; // Strength of mouse pull (subtle)

  /* Palette — amber accent + sage green, matching CSS --accent and --accent2 */
  const COLORS = [
    { r: 232, g: 160, b: 76  },   // --accent: lantern amber
    { r:  91, g: 124, b: 106 },   // --accent2: sage green
    { r: 159, g: 184, b: 168 },   // --muted2: soft sage
  ];

  let particles = [];
  let animFrame;
  let mouse = { x: -9999, y: -9999 };

  /* ── Particle factory ─────────────────────────────────────────── */
  function createParticle(existingX, existingY) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:     existingX !== undefined ? existingX : Math.random() * canvas.width,
      y:     existingY !== undefined ? existingY : Math.random() * canvas.height,
      vx:    (Math.random() - 0.5) * SPEED_MAX * 2,
      vy:    (Math.random() - 0.5) * SPEED_MAX * 2,
      r:     PARTICLE_MIN_R + Math.random() * (PARTICLE_MAX_R - PARTICLE_MIN_R),
      color: color,
      // Base opacity pulses slightly over time for a "breathing" feel
      phase:    Math.random() * Math.PI * 2,
      phaseSpd: 0.004 + Math.random() * 0.006,
    };
  }

  /* ── Resize handler ───────────────────────────────────────────── */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // Keep existing particles, just clamp positions to new bounds
    particles.forEach(p => {
      p.x = Math.min(p.x, canvas.width);
      p.y = Math.min(p.y, canvas.height);
    });

    // Refill if under count after resize (e.g. expand to larger viewport)
    while (particles.length < PARTICLE_COUNT) {
      particles.push(createParticle());
    }
  }

  /* ── Draw loop ────────────────────────────────────────────────── */
  function draw() {
    // Clear with the app's --bg colour (#111815) — hard clear, no trail
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw each particle
    particles.forEach(p => {
      // Advance phase for the breathing opacity effect
      p.phase += p.phaseSpd;
      const breathe = 0.55 + 0.45 * Math.sin(p.phase); // oscillates 0.1 → 1.0

      // Mouse attraction — gently nudges velocity toward the cursor
      const dx    = mouse.x - p.x;
      const dy    = mouse.y - p.y;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
        p.vx += dx / dist * force;
        p.vy += dy / dist * force;
      }

      // Clamp velocity so mouse interaction never causes runaway speed
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > SPEED_MAX * 2.5) {
        p.vx = (p.vx / speed) * SPEED_MAX * 2.5;
        p.vy = (p.vy / speed) * SPEED_MAX * 2.5;
      }

      // Advance position
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges so particles never disappear
      if (p.x < -10)                 p.x = canvas.width  + 10;
      if (p.x > canvas.width  + 10) p.x = -10;
      if (p.y < -10)                 p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      // Draw the particle dot
      const { r: cr, g: cg, b: cb } = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${breathe * 0.85})`;
      ctx.fill();
    });

    // Draw connecting lines between close particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a  = particles[i];
        const b  = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d  = Math.sqrt(dx * dx + dy * dy);

        if (d < CONNECTION_RADIUS) {
          // Line fades as distance increases — close = opaque, far = invisible
          const alpha = (1 - d / CONNECTION_RADIUS) * 0.18;

          // Blend the two particle colours for the line tint
          const { r: ar, g: ag, b: ab } = a.color;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${alpha})`;
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        }
      }
    }

    animFrame = requestAnimationFrame(draw);
  }

  /* ── Track mouse position ─────────────────────────────────────── */
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Reset mouse position when cursor leaves the window
  window.addEventListener('mouseleave', function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  /* ── Resize listener ──────────────────────────────────────────── */
  window.addEventListener('resize', function () {
    cancelAnimationFrame(animFrame);
    resize();
    draw();
  });

  /* ── Init ─────────────────────────────────────────────────────── */
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle());
  }

  draw();

})();