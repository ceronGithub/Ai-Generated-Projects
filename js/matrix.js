/* matrix.js — Alphabet Matrix Background */
(function () {
  const canvas = document.getElementById('matrixCanvas');
  const ctx = canvas.getContext('2d');

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*';
  const FONT_SIZE = 13;
  const SPEED = 0.6; // lower = slower / smoother

  let columns = [];
  let animFrame;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / FONT_SIZE);

    // preserve existing drops or init new ones
    const prev = columns.slice();
    columns = [];
    for (let i = 0; i < cols; i++) {
      columns.push({
        y:      prev[i] ? prev[i].y : Math.random() * canvas.height,
        speed:  SPEED + Math.random() * 0.8,
        length: 8 + Math.floor(Math.random() * 18),
        chars:  [],
        timer:  0,
        interval: 3 + Math.floor(Math.random() * 5),
      });
    }
  }

  function draw() {
    // faint fade trail
    ctx.fillStyle = 'rgba(8,10,15,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${FONT_SIZE}px 'DM Mono', monospace`;

    columns.forEach((col, i) => {
      const x = i * FONT_SIZE;

      // update char periodically
      col.timer++;
      if (col.timer >= col.interval) {
        col.timer = 0;
        col.chars.unshift(CHARS[Math.floor(Math.random() * CHARS.length)]);
        if (col.chars.length > col.length) col.chars.pop();
      }

      // draw each char in the trail
      col.chars.forEach((ch, j) => {
        const alpha = 1 - j / col.chars.length;
        if (j === 0) {
          // leading char — bright
          ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(0, 180, 120, ${alpha * 0.55})`;
        }
        ctx.fillText(ch, x, col.y - j * FONT_SIZE);
      });

      // advance drop
      col.y += col.speed;

      // reset when off screen
      if (col.y - col.chars.length * FONT_SIZE > canvas.height) {
        col.y      = -FONT_SIZE * 2;
        col.chars  = [];
        col.speed  = SPEED + Math.random() * 0.8;
        col.length = 8 + Math.floor(Math.random() * 18);
      }
    });

    animFrame = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animFrame);
    resize();
    draw();
  });

  resize();
  draw();
})();
