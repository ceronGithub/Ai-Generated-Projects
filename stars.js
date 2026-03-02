// =============================================
// stars.js — Cosmic star field animation
// Features:
//   - Multi-layer parallax stars
//   - Twinkling, coloured stars
//   - Occasional shooting stars
//   - WARP SPEED mode during extraction
//   - Cursor-reactive subtle parallax
// =============================================

const StarField = (() => {

  const canvas = document.getElementById('starCanvas');
  const ctx = canvas.getContext('2d');

  // ---------- CONFIG ----------
  const CFG = {
    layers: [
      { count: 280, speed: 0.008, sizeMin: 0.3, sizeMax: 1.0, alpha: 0.5, color: '#ffffff' },
      { count: 120, speed: 0.018, sizeMin: 0.6, sizeMax: 1.6, alpha: 0.7, color: '#aac8ff' },
      { count: 55,  speed: 0.035, sizeMin: 1.0, sizeMax: 2.4, alpha: 0.9, color: '#ffd6a0' },
    ],
    twinkleSpeed: 0.018,
    shootingInterval: 3200,   // ms between shooting stars
    warpMultiplier: 14,        // speed multiplier in warp mode
    warpStreakAlpha: 0.85,
  };

  // ---------- STATE ----------
  let W = 0, H = 0;
  let stars = [];
  let shootingStars = [];
  let isWarp = false;
  let animId = null;
  let lastShot = 0;
  let mouse = { x: 0.5, y: 0.5 }; // normalized

  // ---------- STAR STRUCT ----------
  function makeStar(layer, layerIdx) {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
      speed: layer.speed * (0.6 + Math.random() * 0.8),
      alpha: layer.alpha * (0.5 + Math.random() * 0.5),
      twinklePhase: Math.random() * Math.PI * 2,
      layerIdx,
      color: layer.color,
    };
  }

  function initStars() {
    stars = [];
    CFG.layers.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push(makeStar(layer, li));
      }
    });
  }

  // ---------- SHOOTING STAR ----------
  function spawnShootingStar() {
    const angle = (Math.random() * 40 + 15) * (Math.PI / 180); // 15–55 deg
    const speed = 6 + Math.random() * 8;
    shootingStars.push({
      x: Math.random() * W * 0.8,
      y: Math.random() * H * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.022 + Math.random() * 0.015,
      len: 80 + Math.random() * 120,
      color: Math.random() < 0.5 ? '#00e5ff' : '#ffffff',
    });
  }

  // ---------- RESIZE ----------
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars();
  }

  // ---------- DRAW ----------
  function draw(ts) {
    ctx.clearRect(0, 0, W, H);

    const warpMult = isWarp ? CFG.warpMultiplier : 1;
    const parallaxStrength = 8; // px

    // --- Draw regular stars ---
    for (const s of stars) {
      // Twinkle
      s.twinklePhase += CFG.twinkleSpeed;
      const twinkle = 0.6 + 0.4 * Math.sin(s.twinklePhase);

      // Parallax offset by mouse
      const px = (mouse.x - 0.5) * parallaxStrength * (s.layerIdx + 1) * 0.3;
      const py = (mouse.y - 0.5) * parallaxStrength * (s.layerIdx + 1) * 0.3;

      const drawX = s.x + px;
      const drawY = s.y + py;

      if (isWarp) {
        // Streak mode: draw elongated lines
        const streakLen = s.speed * warpMult * 60;
        const grad = ctx.createLinearGradient(drawX, drawY, drawX + streakLen, drawY);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, s.color);
        ctx.strokeStyle = grad;
        ctx.globalAlpha = s.alpha * CFG.warpStreakAlpha;
        ctx.lineWidth = s.r;
        ctx.beginPath();
        ctx.moveTo(drawX, drawY);
        ctx.lineTo(drawX + streakLen, drawY);
        ctx.stroke();
      } else {
        // Normal dot
        ctx.globalAlpha = s.alpha * twinkle;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(drawX, drawY, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Occasional glow for bright stars
        if (s.r > 1.6 && s.layerIdx === 2) {
          ctx.globalAlpha = s.alpha * twinkle * 0.25;
          ctx.beginPath();
          ctx.arc(drawX, drawY, s.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Move star rightward (simulate slow drift / galactic rotation)
      s.x += s.speed * warpMult;
      if (s.x > W + 10) {
        s.x = -10;
        s.y = Math.random() * H;
      }
    }

    ctx.globalAlpha = 1;

    // --- Shooting stars ---
    if (!isWarp && ts - lastShot > CFG.shootingInterval) {
      spawnShootingStar();
      lastShot = ts;
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life -= ss.decay;

      if (ss.life <= 0) { shootingStars.splice(i, 1); continue; }

      const tailX = ss.x - ss.vx * (ss.len / 8);
      const tailY = ss.y - ss.vy * (ss.len / 8);
      const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, ss.color);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = ss.life;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(ss.x, ss.y);
      ctx.stroke();

      // Leading dot
      ctx.globalAlpha = ss.life * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    animId = requestAnimationFrame(draw);
  }

  // ---------- PUBLIC API ----------
  function startWarp() {
    isWarp = true;
    canvas.style.opacity = '1';
  }

  function stopWarp() {
    isWarp = false;
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX / W;
      mouse.y = e.clientY / H;

      // Move cursor glow
      const glow = document.getElementById('cursorGlow');
      if (glow) {
        glow.style.left = e.clientX + 'px';
        glow.style.top  = e.clientY + 'px';
      }
    });
    animId = requestAnimationFrame(draw);
  }

  return { init, startWarp, stopWarp };
})();

// Boot
StarField.init();

// Expose globally so app.js can call warp
window.StarField = StarField;
