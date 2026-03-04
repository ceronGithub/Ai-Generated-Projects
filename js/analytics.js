// analytics.js — Data Analysis Modals (per-month + full-year)

/* ══════════════════════════════════════════════
   COMPUTE STATS
══════════════════════════════════════════════ */
function getMonthStats(month) {
  const year  = AppState.year;
  const days  = getDaysInMonth(year, month);
  const color = MONTH_COLORS[month];

  let totalBookings  = 0;
  let totalRevenue   = 0;
  let totalPax       = 0;
  let totalPets      = 0;
  let totalBalance   = 0;
  let totalDownpay   = 0;
  const tourCounts   = { 'Day Tour': 0, 'Night Tour': 0, 'Over-Night': 0 };
  const dailyRev     = {};
  const dailyCount   = {};
  const guests       = [];

  for (let d = 1; d <= days; d++) {
    const key  = toKey(year, month, d);
    const list = Bookings[key] || [];
    dailyRev[d]   = 0;
    dailyCount[d] = list.length;

    list.forEach(b => {
      totalBookings++;
      const rev  = b.payment?.total    ?? b.total    ?? 0;
      const dp   = b.payment?.downpayment ?? b.downpayment ?? 0;
      const bal  = b.payment?.balance  ?? b.balance  ?? 0;
      const pax  = b.guest?.totalPax   ?? b.totalPax ?? 0;
      const pets = b.guest?.pets       ?? b.pets     ?? 0;
      const tour = b.booking?.tourType || b.tourType || 'Day Tour';
      const name = b.guest?.name       || b.guestName || 'Guest';

      totalRevenue  += rev;
      totalDownpay  += dp;
      totalBalance  += bal;
      totalPax      += pax;
      totalPets     += pets;
      dailyRev[d]   += rev;
      if (tourCounts[tour] !== undefined) tourCounts[tour]++;
      else tourCounts[tour] = 1;
      guests.push({ name, rev, pax, tour, day: d });
    });
  }

  const bookedDays = Object.values(dailyCount).filter(v => v > 0).length;
  const avgRevPerBooking = totalBookings ? totalRevenue / totalBookings : 0;
  const peakDay = Object.entries(dailyRev).sort((a,b) => b[1]-a[1])[0];

  return {
    month, color,
    totalBookings, totalRevenue, totalPax, totalPets,
    totalBalance, totalDownpay, bookedDays,
    avgRevPerBooking, tourCounts, dailyRev, dailyCount,
    peakDay, guests, days,
  };
}

function getYearStats() {
  const all = [];
  for (let m = 0; m < 12; m++) all.push(getMonthStats(m));

  const totalBookings = all.reduce((s,m) => s + m.totalBookings, 0);
  const totalRevenue  = all.reduce((s,m) => s + m.totalRevenue,  0);
  const totalPax      = all.reduce((s,m) => s + m.totalPax,      0);
  const totalPets     = all.reduce((s,m) => s + m.totalPets,     0);
  const totalBalance  = all.reduce((s,m) => s + m.totalBalance,  0);
  const tourCounts    = { 'Day Tour': 0, 'Night Tour': 0, 'Over-Night': 0 };
  all.forEach(m => {
    Object.entries(m.tourCounts).forEach(([t,c]) => {
      tourCounts[t] = (tourCounts[t] || 0) + c;
    });
  });
  const peakMonth = [...all].sort((a,b) => b.totalRevenue - a.totalRevenue)[0];
  const avgMonthly = totalRevenue / 12;

  return { all, totalBookings, totalRevenue, totalPax, totalPets,
           totalBalance, tourCounts, peakMonth, avgMonthly };
}

/* ══════════════════════════════════════════════
   FORMATTERS
══════════════════════════════════════════════ */
function fPHP(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function fNum(n) { return Number(n).toLocaleString(); }

/* ══════════════════════════════════════════════
   BUILD STAT CARD
══════════════════════════════════════════════ */
function makeStatCard(icon, label, value, sub, accentColor) {
  const card = document.createElement('div');
  card.className = 'an-stat-card';
  card.style.setProperty('--an-accent', accentColor);
  card.innerHTML = `
    <div class="an-stat-icon">${icon}</div>
    <div class="an-stat-body">
      <div class="an-stat-value">${value}</div>
      <div class="an-stat-label">${label}</div>
      ${sub ? `<div class="an-stat-sub">${sub}</div>` : ''}
    </div>`;
  return card;
}

/* ══════════════════════════════════════════════
   CANVAS BAR CHART
══════════════════════════════════════════════ */
function drawBarChart(canvas, labels, values, color, labelFormatter) {
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth  || 300;
  const H   = canvas.offsetHeight || 140;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const max    = Math.max(...values, 1);
  const pad    = { top: 16, right: 8, bottom: 32, left: 8 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;
  const barW   = chartW / labels.length;
  const gap    = barW * 0.22;

  // Zero line
  ctx.beginPath();
  ctx.moveTo(pad.left, H - pad.bottom);
  ctx.lineTo(W - pad.right, H - pad.bottom);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  values.forEach((v, i) => {
    const barH  = (v / max) * chartH;
    const x     = pad.left + i * barW + gap / 2;
    const y     = pad.top  + chartH - barH;
    const bw    = barW - gap;
    const rad   = Math.min(5, bw / 2);

    // Bar with rounded top
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + bw - rad, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + rad);
    ctx.lineTo(x + bw, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, color + 'ee');
    grad.addColorStop(1, color + '66');
    ctx.fillStyle = v > 0 ? grad : 'rgba(0,0,0,0.05)';
    ctx.fill();

    // Value label on top
    if (v > 0) {
      ctx.fillStyle = color;
      ctx.font      = `bold ${Math.max(8, barW * 0.28)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      const lbl = labelFormatter ? labelFormatter(v) : fNum(v);
      ctx.fillText(lbl.length > 5 ? lbl.substring(0,5) : lbl, x + bw / 2, y - 4);
    }

    // X label
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font      = `600 ${Math.max(7, barW * 0.24)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + bw / 2, H - pad.bottom + 14);
  });
}

/* ══════════════════════════════════════════════
   DONUT CHART
══════════════════════════════════════════════ */
function drawDonut(canvas, slices, colors) {
  const dpr = window.devicePixelRatio || 1;
  const S   = Math.min(canvas.offsetWidth, canvas.offsetHeight) || 120;
  canvas.width = canvas.height = S * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx   = S / 2, cy = S / 2;
  const r    = S * 0.38, ri = S * 0.22;
  const total = slices.reduce((s, v) => s + v, 0) || 1;
  let angle  = -Math.PI / 2;

  slices.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    angle += sweep;
  });

  // Punch hole
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Center total
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.font      = `bold ${S * 0.14}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fNum(total), cx, cy);
}

/* ══════════════════════════════════════════════
   MONTH ANALYTICS MODAL
══════════════════════════════════════════════ */
function openMonthAnalytics(month) {
  const s = getMonthStats(month);
  const c = s.color;
  const overlay = document.getElementById('anOverlay');
  const modal   = document.getElementById('anModal');

  modal.style.setProperty('--an-primary', c.accent);
  modal.style.setProperty('--an-light',   c.light);
  modal.style.setProperty('--an-tint',    c.tint);

  // Title
  document.getElementById('anTitle').textContent =
    `${MONTH_NAMES[month]} ${AppState.year} — Analytics`;
  document.getElementById('anSubtitle').textContent =
    `${s.totalBookings} booking${s.totalBookings !== 1 ? 's' : ''} · ${s.bookedDays} day${s.bookedDays !== 1 ? 's' : ''} occupied`;

  const body = document.getElementById('anBody');
  body.innerHTML = '';

  // ── Stat cards ──
  const statRow = document.createElement('div');
  statRow.className = 'an-stat-row';
  statRow.append(
    makeStatCard('📋', 'Total Bookings',  fNum(s.totalBookings),  null, c.accent),
    makeStatCard('💰', 'Total Revenue',   fPHP(s.totalRevenue),   `Avg ${fPHP(s.avgRevPerBooking)}`, c.accent),
    makeStatCard('💳', 'Downpayments',    fPHP(s.totalDownpay),   `Balance due: ${fPHP(s.totalBalance)}`, c.accent),
    makeStatCard('👥', 'Total Guests',    fNum(s.totalPax),       s.totalPets ? `🐾 ${s.totalPets} pets` : null, c.accent),
    makeStatCard('📅', 'Days Occupied',   s.bookedDays + ' / ' + s.days, `${Math.round(s.bookedDays/s.days*100)}% occupancy`, c.accent),
  );
  if (s.peakDay && s.peakDay[1] > 0) {
    statRow.append(makeStatCard('🏆', 'Peak Day', `Day ${s.peakDay[0]}`, fPHP(s.peakDay[1]) + ' revenue', c.accent));
  }
  body.appendChild(statRow);

  // ── Tour type donut ──
  const tourSection = document.createElement('div');
  tourSection.className = 'an-section';
  tourSection.innerHTML = `<div class="an-section-title" style="color:${c.accent}">🏷 Tour Type Breakdown</div>`;

  const tourRow = document.createElement('div');
  tourRow.className = 'an-tour-row';

  const donutWrap = document.createElement('div');
  donutWrap.className = 'an-donut-wrap';
  const donutCanvas = document.createElement('canvas');
  donutCanvas.className = 'an-donut';
  donutWrap.appendChild(donutCanvas);
  tourRow.appendChild(donutWrap);

  const tourLegend = document.createElement('div');
  tourLegend.className = 'an-legend';
  const tourTypes   = ['Day Tour', 'Night Tour', 'Over-Night'];
  const tourColors  = [c.accent, c.light, c.tint.replace('f','e').replace('f','d')];
  const solidColors = [c.accent, '#7c6af4', '#ff9900'];

  tourTypes.forEach((t, i) => {
    const cnt  = s.tourCounts[t] || 0;
    const pct  = s.totalBookings ? Math.round((cnt / s.totalBookings) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'an-legend-item';
    item.innerHTML = `
      <span class="an-legend-dot" style="background:${solidColors[i]}"></span>
      <span class="an-legend-label">${t}</span>
      <span class="an-legend-val">${cnt} <span class="an-legend-pct">(${pct}%)</span></span>`;
    tourLegend.appendChild(item);
  });
  tourRow.appendChild(tourLegend);
  tourSection.appendChild(tourRow);
  body.appendChild(tourSection);

  // ── Daily revenue bar chart ──
  const chartSection = document.createElement('div');
  chartSection.className = 'an-section';
  chartSection.innerHTML = `<div class="an-section-title" style="color:${c.accent}">📊 Daily Revenue</div>`;

  const chartWrap = document.createElement('div');
  chartWrap.className = 'an-chart-wrap';
  const chartCanvas = document.createElement('canvas');
  chartCanvas.className = 'an-chart';
  chartWrap.appendChild(chartCanvas);
  chartSection.appendChild(chartWrap);
  body.appendChild(chartSection);

  // ── Daily bookings bar chart ──
  const countSection = document.createElement('div');
  countSection.className = 'an-section';
  countSection.innerHTML = `<div class="an-section-title" style="color:${c.accent}">👥 Daily Booking Count</div>`;
  const countWrap = document.createElement('div');
  countWrap.className = 'an-chart-wrap';
  const countCanvas = document.createElement('canvas');
  countCanvas.className = 'an-chart';
  countWrap.appendChild(countCanvas);
  countSection.appendChild(countWrap);
  body.appendChild(countSection);

  // ── Guest list ──
  if (s.guests.length) {
    const guestSection = document.createElement('div');
    guestSection.className = 'an-section';
    guestSection.innerHTML = `<div class="an-section-title" style="color:${c.accent}">👤 Guest Summary</div>`;
    const table = document.createElement('div');
    table.className = 'an-table';
    table.innerHTML = `
      <div class="an-table-head">
        <span>Day</span><span>Guest</span><span>Tour</span>
        <span>Pax</span><span>Revenue</span>
      </div>`;
    s.guests.forEach(g => {
      const row = document.createElement('div');
      row.className = 'an-table-row';
      row.innerHTML = `
        <span>${g.day}</span>
        <span>${g.name}</span>
        <span>${g.tour}</span>
        <span>${g.pax}</span>
        <span>${fPHP(g.rev)}</span>`;
      table.appendChild(row);
    });
    guestSection.appendChild(table);
    body.appendChild(guestSection);
  } else {
    const empty = document.createElement('div');
    empty.className = 'an-empty';
    empty.innerHTML = `<span>📭</span><p>No bookings yet for ${MONTH_NAMES[month]}.</p>`;
    body.appendChild(empty);
  }

  overlay.classList.add('open');

  // Draw charts after DOM paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const days  = Array.from({length: s.days}, (_, i) => i + 1);
      const revVals   = days.map(d => s.dailyRev[d]   || 0);
      const countVals = days.map(d => s.dailyCount[d] || 0);
      const labels    = days.map(d => d % 5 === 1 || d === s.days ? String(d) : '');

      drawBarChart(chartCanvas,  labels, revVals,   c.accent, v => '₱' + (v >= 1000 ? Math.round(v/1000)+'k' : v));
      drawBarChart(countCanvas,  labels, countVals, c.accent, v => String(v));
      drawDonut(donutCanvas,
        tourTypes.map(t => s.tourCounts[t] || 0),
        solidColors
      );
    });
  });
}

/* ══════════════════════════════════════════════
   YEAR ANALYTICS MODAL
══════════════════════════════════════════════ */
function openYearAnalytics() {
  const s   = getYearStats();
  const col = { accent: '#7c6af4', light: '#d0caff', tint: '#f3f0ff' };
  const overlay = document.getElementById('anOverlay');
  const modal   = document.getElementById('anModal');

  modal.style.setProperty('--an-primary', col.accent);
  modal.style.setProperty('--an-light',   col.light);
  modal.style.setProperty('--an-tint',    col.tint);

  document.getElementById('anTitle').textContent    = `${AppState.year} — Year Analytics`;
  document.getElementById('anSubtitle').textContent =
    `${s.totalBookings} total bookings · Full-year overview`;

  const body = document.getElementById('anBody');
  body.innerHTML = '';

  // ── Year stat cards ──
  const statRow = document.createElement('div');
  statRow.className = 'an-stat-row';
  statRow.append(
    makeStatCard('📋', 'Total Bookings',  fNum(s.totalBookings),  null, col.accent),
    makeStatCard('💰', 'Total Revenue',   fPHP(s.totalRevenue),   `Avg/month: ${fPHP(s.avgMonthly)}`, col.accent),
    makeStatCard('👥', 'Total Guests',    fNum(s.totalPax),       s.totalPets ? `🐾 ${s.totalPets} pets` : null, col.accent),
    makeStatCard('💳', 'Balance Due',     fPHP(s.totalBalance),   null, col.accent),
    makeStatCard('🏆', 'Peak Month',      s.peakMonth.totalBookings ? MONTH_NAMES[s.peakMonth.month] : '—',
      s.peakMonth.totalBookings ? fPHP(s.peakMonth.totalRevenue) : 'No bookings yet', col.accent),
  );
  body.appendChild(statRow);

  // ── Monthly revenue bar chart ──
  const revSection = document.createElement('div');
  revSection.className = 'an-section';
  revSection.innerHTML = `<div class="an-section-title" style="color:${col.accent}">📊 Monthly Revenue</div>`;
  const revWrap = document.createElement('div');
  revWrap.className = 'an-chart-wrap an-chart-wrap--tall';
  const revCanvas = document.createElement('canvas');
  revCanvas.className = 'an-chart';
  revWrap.appendChild(revCanvas);
  revSection.appendChild(revWrap);
  body.appendChild(revSection);

  // ── Monthly booking count bar chart ──
  const cntSection = document.createElement('div');
  cntSection.className = 'an-section';
  cntSection.innerHTML = `<div class="an-section-title" style="color:${col.accent}">📅 Bookings per Month</div>`;
  const cntWrap = document.createElement('div');
  cntWrap.className = 'an-chart-wrap an-chart-wrap--tall';
  const cntCanvas = document.createElement('canvas');
  cntCanvas.className = 'an-chart';
  cntWrap.appendChild(cntCanvas);
  cntSection.appendChild(cntWrap);
  body.appendChild(cntSection);

  // ── Tour type donut ──
  const tourSection = document.createElement('div');
  tourSection.className = 'an-section';
  tourSection.innerHTML = `<div class="an-section-title" style="color:${col.accent}">🏷 Tour Type Breakdown — Full Year</div>`;
  const tourRow = document.createElement('div');
  tourRow.className = 'an-tour-row';
  const donutWrap = document.createElement('div');
  donutWrap.className = 'an-donut-wrap';
  const donutCanvas = document.createElement('canvas');
  donutCanvas.className = 'an-donut';
  donutWrap.appendChild(donutCanvas);
  tourRow.appendChild(donutWrap);
  const solidColors = [col.accent, '#7c6af4', '#ff9900'];
  const tourTypes   = ['Day Tour', 'Night Tour', 'Over-Night'];
  const tourLegend  = document.createElement('div');
  tourLegend.className = 'an-legend';
  tourTypes.forEach((t, i) => {
    const cnt  = s.tourCounts[t] || 0;
    const pct  = s.totalBookings ? Math.round((cnt / s.totalBookings) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'an-legend-item';
    item.innerHTML = `
      <span class="an-legend-dot" style="background:${solidColors[i]}"></span>
      <span class="an-legend-label">${t}</span>
      <span class="an-legend-val">${cnt} <span class="an-legend-pct">(${pct}%)</span></span>`;
    tourLegend.appendChild(item);
  });
  tourRow.appendChild(tourLegend);
  tourSection.appendChild(tourRow);
  body.appendChild(tourSection);

  // ── Per-month breakdown table ──
  const mSection = document.createElement('div');
  mSection.className = 'an-section';
  mSection.innerHTML = `<div class="an-section-title" style="color:${col.accent}">📆 Month-by-Month Summary</div>`;
  const table = document.createElement('div');
  table.className = 'an-table';
  table.innerHTML = `
    <div class="an-table-head">
      <span>Month</span><span>Bookings</span><span>Guests</span>
      <span>Occupied</span><span>Revenue</span>
    </div>`;
  s.all.forEach(m => {
    const row = document.createElement('div');
    row.className = 'an-table-row';
    const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color.accent};margin-right:5px;vertical-align:middle"></span>`;
    row.innerHTML = `
      <span>${dot}${MONTH_NAMES[m.month].substring(0,3)}</span>
      <span>${m.totalBookings || '—'}</span>
      <span>${m.totalPax || '—'}</span>
      <span>${m.bookedDays}d</span>
      <span>${m.totalRevenue ? fPHP(m.totalRevenue) : '—'}</span>`;
    table.appendChild(row);
  });
  mSection.appendChild(table);
  body.appendChild(mSection);

  overlay.classList.add('open');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const mLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      drawBarChart(revCanvas, mLabels, s.all.map(m => m.totalRevenue), col.accent,
        v => v >= 1000 ? '₱' + Math.round(v/1000) + 'k' : '₱' + v);
      drawBarChart(cntCanvas, mLabels, s.all.map(m => m.totalBookings), col.accent, v => String(v));
      drawDonut(donutCanvas, tourTypes.map(t => s.tourCounts[t] || 0), solidColors);
    });
  });
}

/* ══════════════════════════════════════════════
   CLOSE
══════════════════════════════════════════════ */
function closeAnalytics() {
  document.getElementById('anOverlay').classList.remove('open');
}

function setupAnalyticsListeners() {
  document.getElementById('anClose').addEventListener('click', closeAnalytics);
  document.getElementById('anOverlay').addEventListener('click', e => {
    if (e.target.id === 'anOverlay') closeAnalytics();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAnalytics();
  });

  // Year analytics button in header
  document.getElementById('btnYearAnalytics').addEventListener('click', openYearAnalytics);
}
