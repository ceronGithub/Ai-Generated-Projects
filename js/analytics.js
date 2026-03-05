/* ═══════════════════════════════════════════════
   analysis.js  —  Booking Analysis Modal
   Requires: data.js (MONTH_NAMES), booking.js (Bookings)
═══════════════════════════════════════════════ */

/* ── OPEN / CLOSE ─────────────────────────────── */
function openAnalysis() {
  var ov = document.getElementById('analysisOverlay');
  var md = document.getElementById('analysisModal');
  if (!ov || !md) { alert('Analysis modal missing from page.'); return; }

  // Show content first
  try {
    _renderAnalysisMeta();
    _renderAnalysisTab('overview');
    _highlightAnalysisTab('overview');
  } catch(err) {
    var body = document.getElementById('analysisBody');
    if (body) body.innerHTML = '<p style="color:#e04060;padding:20px;font-size:13px;">Error loading data: ' + err.message + '</p>';
  }

  // Reset modal position for animation
  md.style.transition = 'none';
  md.style.transform  = 'translateY(30px) scale(0.96)';

  // Make visible — visibility transition handles show/hide
  ov.style.visibility    = 'visible';
  ov.style.pointerEvents = 'all';

  // Trigger transition on next paint
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      md.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      ov.style.opacity    = '1';
      md.style.transform  = 'translateY(0) scale(1)';
    });
  });

  ov.onclick = function(e) { if (e.target === ov) closeAnalysis(); };
  document.addEventListener('keydown', _onAnalysisKey);
}

function closeAnalysis() {
  var ov = document.getElementById('analysisOverlay');
  var md = document.getElementById('analysisModal');
  if (!ov) return;
  ov.style.opacity       = '0';
  ov.style.visibility    = 'hidden';
  ov.style.pointerEvents = 'none';
  if (md) md.style.transform = 'translateY(30px) scale(0.96)';
  document.removeEventListener('keydown', _onAnalysisKey);
}

function _onAnalysisKey(e) { if (e.key === 'Escape') closeAnalysis(); }

/* ── TAB SWITCHING ─────────────────────────────── */
function switchAnalysisTab(tab) {
  try {
    _highlightAnalysisTab(tab);
    _renderAnalysisTab(tab);
  } catch(err) {
    var body = document.getElementById('analysisBody');
    if (body) body.innerHTML = '<p style="color:#e04060;padding:20px;">Error: ' + err.message + '</p>';
  }
}

function _highlightAnalysisTab(active) {
  ['overview','monthly','guests','revenue'].forEach(function(t) {
    var btn = document.getElementById('aTab_' + t);
    if (!btn) return;
    btn.style.color        = t === active ? '#7c6af4' : '#9996b0';
    btn.style.borderBottom = t === active ? '2px solid #7c6af4' : '2px solid transparent';
  });
}

/* ── DATA COMPILER ─────────────────────────────── */
function _getAnalyticsData() {
  var all = [];
  var src = (typeof Bookings !== 'undefined') ? Bookings : {};
  Object.keys(src).forEach(function(key) {
    var list = src[key];
    if (Array.isArray(list)) list.forEach(function(b) { all.push(b); });
  });

  var MN = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES :
    ['January','February','March','April','May','June',
     'July','August','September','October','November','December'];

  var totalRevenue = 0, totalBalance = 0, totalPax = 0, totalPets = 0;
  var byTour  = {};
  // Always 12 months, all initialized to zero
  var byMonth = MN.map(function(name) { return { month: name, count: 0, revenue: 0, pax: 0 }; });

  all.forEach(function(b) {
    var rev  = +((b.payment && b.payment.total)    || b.total    || 0) || 0;
    var bal  = +((b.payment && b.payment.balance)  || b.balance  || 0) || 0;
    var pax  = +((b.guest   && b.guest.totalPax)   || b.totalPax || 0) || 0;
    var pets = +((b.guest   && b.guest.pets)        || b.pets     || 0) || 0;
    var tour = (b.booking && b.booking.tourType) || b.tourType  || 'Unknown';
    var dk   = b.dateKey || (b.booking && b.booking.checkinDate) || '';
    var mo   = parseInt((dk.split('-')[1] || '0'), 10) - 1;

    totalRevenue += rev;
    totalBalance += bal;
    totalPax     += pax;
    totalPets    += pets;

    if (!byTour[tour]) byTour[tour] = { count:0, revenue:0 };
    byTour[tour].count++;
    byTour[tour].revenue += rev;

    if (mo >= 0 && mo <= 11) {
      byMonth[mo].count++;
      byMonth[mo].revenue += rev;
      byMonth[mo].pax     += pax;
    }
  });

  var guests = all.map(function(b) {
    return {
      name:     (b.guest && b.guest.name)  || b.guestName  || '—',
      phone:    (b.guest && b.guest.phone) || b.guestPhone || '—',
      tourType: (b.booking && b.booking.tourType) || b.tourType || '—',
      date:     (b.booking && b.booking.checkinDateLabel) || b.checkinDateLabel || b.dateKey || '—',
      pax:      +((b.guest && b.guest.totalPax) || b.totalPax) || 0,
      total:    +((b.payment && b.payment.total)   || b.total)   || 0,
      balance:  +((b.payment && b.payment.balance) || b.balance) || 0,
    };
  }).sort(function(a, b) { return a.name.localeCompare(b.name); });

  return {
    all:            all,
    total:          all.length,
    totalRevenue:   totalRevenue,
    totalBalance:   totalBalance,
    totalCollected: totalRevenue - totalBalance,
    totalPax:       totalPax,
    totalPets:      totalPets,
    byTour:         byTour,
    byMonth:        byMonth,
    guests:         guests,
  };
}

/* ── HELPERS ────────────────────────────────────── */
function _peso(n) {
  return '\u20b1' + (+n || 0).toLocaleString('en-PH', { minimumFractionDigits:2 });
}

function _statCard(icon, label, value, sub, color) {
  return '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:16px;padding:18px 20px;">' +
    '<div style="font-size:22px;margin-bottom:8px;">'                                                  + icon  + '</div>' +
    '<div style="font-size:10px;font-weight:700;color:#9996b0;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>' +
    '<div style="font-size:19px;font-weight:800;color:' + color + ';letter-spacing:-0.5px;">'          + value + '</div>' +
    (sub ? '<div style="font-size:11px;color:#9996b0;margin-top:4px;">' + sub + '</div>' : '') +
  '</div>';
}

/* ── META LINE ──────────────────────────────────── */
function _renderAnalysisMeta() {
  var d  = _getAnalyticsData();
  var el = document.getElementById('analysisMeta');
  if (el) el.textContent = d.total + ' booking' + (d.total !== 1 ? 's' : '') +
    ' \u00b7 ' + _peso(d.totalRevenue) + ' total revenue';
}

/* ── TAB RENDERER ───────────────────────────────── */
function _renderAnalysisTab(tab) {
  var body = document.getElementById('analysisBody');
  if (!body) return;
  var d = _getAnalyticsData();
  if      (tab === 'overview') body.innerHTML = _tabOverview(d);
  else if (tab === 'monthly')  body.innerHTML = _tabMonthly(d);
  else if (tab === 'guests')   body.innerHTML = _tabGuests(d);
  else if (tab === 'revenue')  body.innerHTML = _tabRevenue(d);
}

/* ══════════════════════════════════════════════
   TAB: OVERVIEW
══════════════════════════════════════════════ */
function _tabOverview(d) {
  var pct = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;
  var TOUR_COL = { 'Day Tour':'#ff8c42','Night Tour':'#7c6af4','Over-Night':'#29b5e8','Half Day':'#3cb771' };

  var tourRows = '';
  Object.keys(d.byTour)
    .sort(function(a,b) { return d.byTour[b].count - d.byTour[a].count; })
    .forEach(function(type) {
      var td  = d.byTour[type];
      var p   = d.total ? Math.round(td.count / d.total * 100) : 0;
      var col = TOUR_COL[type] || '#9996b0';
      tourRows +=
        '<div style="margin-bottom:14px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';display:inline-block;flex-shrink:0;"></span>' +
              '<span style="font-size:12px;font-weight:700;color:#1a1a2e;">' + type + '</span>' +
            '</div>' +
            '<span style="font-size:11px;color:#9996b0;">' + td.count + ' booking' + (td.count!==1?'s':'') + ' &nbsp;\u00b7&nbsp; ' + _peso(td.revenue) + '</span>' +
          '</div>' +
          '<div style="height:8px;background:#f0eeff;border-radius:99px;overflow:hidden;">' +
            '<div style="height:100%;width:' + p + '%;background:' + col + ';border-radius:99px;"></div>' +
          '</div>' +
        '</div>';
    });

  return (
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:22px;">' +
      _statCard('📅', 'Total Bookings',    '' + d.total,           d.totalPax + ' pax \u00b7 ' + d.totalPets + ' pets', '#1a1a2e') +
      _statCard('💳', 'Total Revenue',     _peso(d.totalRevenue),  _peso(d.totalCollected) + ' collected (' + pct + '%)',         '#3cb771') +
      _statCard('💰', 'Outstanding',       _peso(d.totalBalance),  d.totalBalance > 0 ? (100-pct) + '% unpaid' : 'All paid \u2705', d.totalBalance > 0 ? '#e04060' : '#3cb771') +
    '</div>' +
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:16px;padding:20px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 16px;">Tour Type Breakdown</p>' +
      (tourRows || '<p style="color:#9996b0;font-size:12px;padding:8px 0;">No bookings yet.</p>') +
    '</div>'
  );
}

/* ══════════════════════════════════════════════
   TAB: MONTHLY  — always shows all 12 months
══════════════════════════════════════════════ */
function _tabMonthly(d) {
  var COLORS = [
    '#ff6b8a','#ff8c42','#f4c430','#3cb771',
    '#29b5e8','#7c6af4','#e040c8','#ff6347',
    '#00b8a9','#62c82a','#ff9900','#4e8af4'
  ];

  var maxRev = 0;
  d.byMonth.forEach(function(m) { if (m.revenue > maxRev) maxRev = m.revenue; });
  if (maxRev === 0) maxRev = 1;

  // BAR CHART — all 12 months, revenue-based bars
  var bars = '';
  d.byMonth.forEach(function(m, i) {
    var pct = Math.round(m.revenue / maxRev * 100);
    bars +=
      '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;">' +
        '<div style="font-size:9px;font-weight:700;color:#1a1a2e;height:13px;line-height:13px;">' +
          (m.count > 0 ? m.count : '') +
        '</div>' +
        '<div style="width:100%;background:#f0eeff;border-radius:5px 5px 0 0;height:90px;display:flex;align-items:flex-end;">' +
          '<div style="width:100%;height:' + Math.max(pct,0) + '%;min-height:' + (m.revenue>0?'4':'0') + 'px;background:' + COLORS[i] + ';border-radius:5px 5px 0 0;"></div>' +
        '</div>' +
        '<div style="font-size:8px;color:#9996b0;font-weight:700;letter-spacing:0.3px;">' +
          m.month.slice(0,3).toUpperCase() +
        '</div>' +
      '</div>';
  });

  // FULL TABLE — all 12 months
  var tableRows = '';
  d.byMonth.forEach(function(m, i) {
    var col = COLORS[i];
    var isActive = m.count > 0;
    tableRows +=
      '<tr style="border-bottom:1px solid #f5f5f8;' + (isActive ? '' : 'opacity:0.45;') + '">' +
        '<td style="padding:9px 0;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:' + col + ';flex-shrink:0;display:inline-block;"></span>' +
            '<span style="font-size:12px;font-weight:' + (isActive?'700':'400') + ';color:#1a1a2e;">' + m.month + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="padding:9px 8px;font-size:12px;color:#555570;text-align:center;">' + (m.count || '—') + '</td>' +
        '<td style="padding:9px 8px;font-size:12px;color:#555570;text-align:center;">' + (m.pax || '—') + '</td>' +
        '<td style="padding:9px 0;font-size:12px;font-weight:' + (isActive?'700':'400') + ';color:' + (isActive?'#3cb771':'#ccc') + ';text-align:right;">' +
          (isActive ? _peso(m.revenue) : '—') +
        '</td>' +
      '</tr>';
  });

  return (
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:16px;padding:20px;margin-bottom:18px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 4px;">Bookings Per Month</p>' +
      '<p style="font-size:11px;color:#9996b0;margin:0 0 14px;">Bar height = revenue. Number = booking count.</p>' +
      '<div style="display:flex;gap:3px;align-items:flex-end;height:113px;">' + bars + '</div>' +
    '</div>' +
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:16px;padding:20px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 12px;">All 12 Months</p>' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead>' +
          '<tr style="border-bottom:2px solid #f0eeff;">' +
            '<th style="padding:8px 0;font-size:10px;color:#9996b0;text-align:left;font-weight:700;letter-spacing:0.5px;">MONTH</th>' +
            '<th style="padding:8px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;letter-spacing:0.5px;">BOOKINGS</th>' +
            '<th style="padding:8px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;letter-spacing:0.5px;">PAX</th>' +
            '<th style="padding:8px 0;font-size:10px;color:#9996b0;text-align:right;font-weight:700;letter-spacing:0.5px;">REVENUE</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

/* ══════════════════════════════════════════════
   TAB: GUESTS
══════════════════════════════════════════════ */
function _tabGuests(d) {
  if (!d.guests.length)
    return '<p style="color:#9996b0;font-size:13px;text-align:center;padding:50px 0;">No bookings yet.</p>';

  var TOUR_COL = { 'Day Tour':'#ff8c42','Night Tour':'#7c6af4','Over-Night':'#29b5e8','Half Day':'#3cb771' };
  var rows = '';
  d.guests.forEach(function(g) {
    var col = TOUR_COL[g.tourType] || '#9996b0';
    rows +=
      '<tr style="border-bottom:1px solid #f5f5f8;">' +
        '<td style="padding:10px 0;">' +
          '<div style="font-size:12px;font-weight:700;color:#1a1a2e;">'  + g.name  + '</div>' +
          '<div style="font-size:11px;color:#9996b0;">'                  + g.phone + '</div>' +
        '</td>' +
        '<td style="padding:10px 8px;">' +
          '<span style="background:' + col + '20;color:' + col + ';font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap;">' + g.tourType + '</span>' +
        '</td>' +
        '<td style="padding:10px 8px;font-size:12px;color:#555570;white-space:nowrap;">' + g.date + '</td>' +
        '<td style="padding:10px 8px;font-size:12px;color:#555570;text-align:center;">'  + g.pax  + '</td>' +
        '<td style="padding:10px 0;text-align:right;">' +
          '<div style="font-size:12px;font-weight:700;color:#3cb771;">'  + _peso(g.total) + '</div>' +
          (g.balance > 0
            ? '<div style="font-size:10px;color:#e04060;">bal: ' + _peso(g.balance) + '</div>'
            : '<div style="font-size:10px;color:#3cb771;">\u2705 paid</div>') +
        '</td>' +
      '</tr>';
  });

  return (
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:16px;padding:20px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 12px;">All Guests (' + d.guests.length + ')</p>' +
      '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;min-width:460px;">' +
          '<thead><tr style="border-bottom:2px solid #f0eeff;">' +
            '<th style="padding:8px 0;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">GUEST</th>' +
            '<th style="padding:8px 8px;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">TOUR</th>' +
            '<th style="padding:8px 8px;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">DATE</th>' +
            '<th style="padding:8px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;">PAX</th>' +
            '<th style="padding:8px 0;font-size:10px;color:#9996b0;text-align:right;font-weight:700;">TOTAL</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>'
  );
}

/* ══════════════════════════════════════════════
   TAB: REVENUE
══════════════════════════════════════════════ */
function _tabRevenue(d) {
  var pct      = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;
  var unpaidPct = 100 - pct;

  var topMonths = d.byMonth.filter(function(m) { return m.revenue > 0; })
    .sort(function(a,b) { return b.revenue - a.revenue; }).slice(0, 6);

  var topRows = '';
  topMonths.forEach(function(m) {
    topRows +=
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f5f5f8;">' +
        '<span style="font-size:12px;font-weight:700;color:#1a1a2e;">' + m.month + '</span>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<span style="font-size:11px;color:#9996b0;">' + m.count + ' booking' + (m.count!==1?'s':'') + '</span>' +
          '<span style="font-size:13px;font-weight:800;color:#3cb771;">' + _peso(m.revenue) + '</span>' +
        '</div>' +
      '</div>';
  });

  var unpaidGuests = d.guests.filter(function(g) { return g.balance > 0; });
  var unpaidRows   = '';
  unpaidGuests.forEach(function(g) {
    unpaidRows +=
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f5f5f8;">' +
        '<div>' +
          '<div style="font-size:12px;font-weight:700;color:#1a1a2e;">' + g.name + '</div>' +
          '<div style="font-size:11px;color:#9996b0;">'                  + g.date + ' \u00b7 ' + g.tourType + '</div>' +
        '</div>' +
        '<span style="font-size:13px;font-weight:800;color:#e04060;">' + _peso(g.balance) + '</span>' +
      '</div>';
  });

  return (
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">' +
      '<div style="background:#f0fff4;border:1.5px solid #b8f0ce;border-radius:16px;padding:18px 20px;">' +
        '<div style="font-size:10px;font-weight:700;color:#2a9a5a;letter-spacing:0.5px;margin-bottom:6px;">COLLECTED</div>' +
        '<div style="font-size:22px;font-weight:800;color:#2a9a5a;">' + _peso(d.totalCollected) + '</div>' +
        '<div style="margin-top:10px;height:8px;background:#b8f0ce;border-radius:99px;overflow:hidden;">' +
          '<div style="height:100%;width:' + pct + '%;background:#3cb771;border-radius:99px;"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:#2a9a5a;margin-top:5px;">' + pct + '% of total</div>' +
      '</div>' +
      '<div style="background:#fff0f3;border:1.5px solid #ffd6df;border-radius:16px;padding:18px 20px;">' +
        '<div style="font-size:10px;font-weight:700;color:#e04060;letter-spacing:0.5px;margin-bottom:6px;">OUTSTANDING</div>' +
        '<div style="font-size:22px;font-weight:800;color:#e04060;">' + _peso(d.totalBalance) + '</div>' +
        '<div style="margin-top:10px;height:8px;background:#ffd6df;border-radius:99px;overflow:hidden;">' +
          '<div style="height:100%;width:' + unpaidPct + '%;background:#e04060;border-radius:99px;"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:#e04060;margin-top:5px;">' + unpaidGuests.length + ' guest' + (unpaidGuests.length!==1?'s':'') + ' with balance</div>' +
      '</div>' +
    '</div>' +
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:16px;padding:20px;margin-bottom:14px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 6px;">Top Revenue Months</p>' +
      (topRows || '<p style="color:#9996b0;font-size:12px;margin-top:8px;">No revenue data yet.</p>') +
    '</div>' +
    (unpaidGuests.length
      ? '<div style="background:#fafafa;border:1.5px solid #ffd6df;border-radius:16px;padding:20px;">' +
          '<p style="font-size:12px;font-weight:800;color:#e04060;margin:0 0 6px;">\u26a0\ufe0f Outstanding Balances (' + unpaidGuests.length + ')</p>' +
          unpaidRows +
        '</div>'
      : '<div style="background:#f0fff4;border:1.5px solid #b8f0ce;border-radius:16px;padding:18px;text-align:center;">' +
          '<p style="font-size:13px;font-weight:700;color:#2a9a5a;margin:0;">\u2705 All guests are fully paid!</p>' +
        '</div>'
    )
  );
}