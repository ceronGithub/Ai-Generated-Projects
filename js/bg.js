/* bg.js — Holographic grid background animation */

(function () {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const PARTICLE_COUNT = 40;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.6 ? '#00f5ff' : Math.random() > 0.5 ? '#0066ff' : '#7b2fff',
      });
    }
  }

  function drawGrid() {
    const spacing = 60;
    const cols = Math.ceil(W / spacing) + 1;
    const rows = Math.ceil(H / spacing) + 1;
    const t = Date.now() * 0.0003;

    ctx.strokeStyle = 'rgba(0,245,255,0.045)';
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let c = 0; c < cols; c++) {
      const x = c * spacing;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    // Horizontal lines
    for (let r = 0; r < rows; r++) {
      const y = r * spacing;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Diagonal accent lines
    ctx.strokeStyle = 'rgba(0,102,255,0.03)';
    ctx.lineWidth = 0.5;
    const diagSpacing = 180;
    const diagCount = Math.ceil((W + H) / diagSpacing) + 1;
    for (let d = -5; d < diagCount; d++) {
      const offset = d * diagSpacing;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + H, H);
      ctx.stroke();
    }

    // Glowing grid intersections
    const dotAlpha = 0.12 + Math.sin(t) * 0.05;
    ctx.fillStyle = `rgba(0,245,255,${dotAlpha})`;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c + r) % 3 === 0) {
          ctx.beginPath();
          ctx.arc(c * spacing, r * spacing, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawConnections() {
    const maxDist = 120;
    ctx.lineWidth = 0.4;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.15;
          ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function drawHorizonGlow() {
    const grad = ctx.createLinearGradient(0, H * 0.6, 0, H);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,102,255,0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);
  }

  function drawScanBeam() {
    const t = (Date.now() * 0.0004) % 1;
    const y = t * H;
    const grad = ctx.createLinearGradient(0, y - 60, 0, y + 60);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(0,245,255,0.04)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 60, W, 120);
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawHorizonGlow();
    drawGrid();
    drawScanBeam();
    drawConnections();
    drawParticles();
    requestAnimationFrame(animate);
  }

  resize();
  initParticles();
  animate();

  window.addEventListener('resize', () => {
    resize();
    initParticles();
  });
})();