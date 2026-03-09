/* ═══════════════════════════════════════════════════════
   analysis.js  —  Year Analysis + Month Analysis modals
   Requires: data.js (MONTH_NAMES, MONTH_COLORS, toKey)
             booking.js (Bookings)
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════ */
function _peso(n) {
  return '\u20b1' + (+n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function _statCard(icon, label, value, sub, accent) {
  return '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:16px 18px;">' +
    '<div style="font-size:20px;margin-bottom:6px;">' + icon + '</div>' +
    '<div style="font-size:10px;font-weight:700;color:#9996b0;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:3px;">' + label + '</div>' +
    '<div style="font-size:18px;font-weight:800;color:' + accent + ';letter-spacing:-0.5px;">' + value + '</div>' +
    (sub ? '<div style="font-size:11px;color:#9996b0;margin-top:3px;">' + sub + '</div>' : '') +
  '</div>';
}

/* SVG bar chart — generic, used by both year and month views */
function _svgBarChart(opts) {
  /*
    opts = {
      bars:   [{label, value, value2, color, tooltip}],
      width:  number (px),
      height: number (px — chart area only),
      showValue: bool,
      unit: string ('₱' or ''),
      accentLine: bool  (draw a second line for value2)
    }
  */
  var W      = opts.width  || 560;
  var H      = opts.height || 120;
  var PAD_L  = 4;
  var PAD_R  = 4;
  var PAD_B  = 22; // label space
  var PAD_T  = 18; // value label space
  var bars   = opts.bars;
  var n      = bars.length;
  var maxVal = 0;
  bars.forEach(function(b) { if (b.value > maxVal) maxVal = b.value; });
  if (maxVal === 0) maxVal = 1;

  var chartW = W - PAD_L - PAD_R;
  var chartH = H - PAD_B - PAD_T;
  var barW   = Math.floor(chartW / n) - 3;
  var gap    = Math.floor(chartW / n);

  var rects = '';
  var labels = '';
  var vals   = '';
  var lines  = '';  // overlay line for value2

  bars.forEach(function(b, i) {
    var x      = PAD_L + i * gap + Math.floor((gap - barW) / 2);
    var barH   = b.value > 0 ? Math.max(Math.round(b.value / maxVal * chartH), 3) : 0;
    var y      = PAD_T + chartH - barH;
    var col    = b.color || '#7c6af4';

    // bar
    rects += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH +
      '" rx="4" fill="' + col + '" opacity="0.88">' +
      (b.tooltip ? '<title>' + b.tooltip + '</title>' : '') +
      '</rect>';

    // value label above bar
    if (opts.showValue && b.value > 0) {
      var labelTxt = opts.unit === '\u20b1'
        ? (b.value >= 1000 ? (b.value/1000).toFixed(1) + 'k' : b.value)
        : b.value;
      vals += '<text x="' + (x + barW/2) + '" y="' + (y - 3) +
        '" text-anchor="middle" font-size="8" font-weight="700" fill="' + col + '">' + labelTxt + '</text>';
    }

    // x-axis label
    labels += '<text x="' + (x + barW/2) + '" y="' + (PAD_T + chartH + 14) +
      '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#9996b0">' + b.label + '</text>';
  });

  // optional overlay polyline for value2 (e.g. revenue trend)
  if (opts.accentLine) {
    var maxVal2 = 0;
    bars.forEach(function(b) { if ((b.value2||0) > maxVal2) maxVal2 = b.value2||0; });
    if (maxVal2 > 0) {
      var pts = '';
      bars.forEach(function(b, i) {
        var x2  = PAD_L + i * gap + gap/2;
        var h2  = Math.round((b.value2||0) / maxVal2 * chartH);
        var y2  = PAD_T + chartH - h2;
        pts += (i === 0 ? 'M' : 'L') + x2 + ',' + y2 + ' ';
      });
      lines += '<polyline points="' + pts + '" fill="none" stroke="#3cb771" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>';
      // dots on line
      bars.forEach(function(b, i) {
        if ((b.value2||0) > 0) {
          var x2 = PAD_L + i * gap + gap/2;
          var h2 = Math.round((b.value2||0) / maxVal2 * chartH);
          var y2 = PAD_T + chartH - h2;
          lines += '<circle cx="' + x2 + '" cy="' + y2 + '" r="3" fill="#3cb771" stroke="#fff" stroke-width="1.5"/>';
        }
      });
    }
  }

  return '<svg viewBox="0 0 ' + W + ' ' + (H) + '" width="100%" style="overflow:visible;display:block;">' +
    '<rect x="0" y="' + PAD_T + '" width="' + W + '" height="' + chartH +
      '" fill="#f8f7ff" rx="6"/>' +
    rects + lines + vals + labels +
  '</svg>';
}

/* ═══════════════════════════════════════════════════════
   YEAR ANALYSIS MODAL
═══════════════════════════════════════════════════════ */
function openAnalysis() {
  var ov = document.getElementById('analysisOverlay');
  var md = document.getElementById('analysisModal');
  if (!ov || !md) { alert('Analysis modal not found.'); return; }

  try {
    _renderAnalysisMeta();
    _renderAnalysisTab('overview');
    _highlightAnalysisTab('overview');
  } catch(err) {
    var body = document.getElementById('analysisBody');
    if (body) body.innerHTML = '<p style="color:#e04060;padding:20px;">Error: ' + err.message + '</p>';
  }

  md.style.transition = 'none';
  md.style.transform  = 'translateY(30px) scale(0.96)';
  ov.style.visibility    = 'visible';
  ov.style.pointerEvents = 'all';
  requestAnimationFrame(function() { requestAnimationFrame(function() {
    md.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
    ov.style.opacity    = '1';
    md.style.transform  = 'translateY(0) scale(1)';
  }); });

  ov.onclick = function(e) { if (e.target === ov) closeAnalysis(); };
  document.addEventListener('keydown', _onAnalysisKey);
}

function closeAnalysis() {
  var ov = document.getElementById('analysisOverlay');
  var md = document.getElementById('analysisModal');
  if (!ov) return;
  ov.style.opacity = '0'; ov.style.visibility = 'hidden'; ov.style.pointerEvents = 'none';
  if (md) md.style.transform = 'translateY(30px) scale(0.96)';
  document.removeEventListener('keydown', _onAnalysisKey);
}
function _onAnalysisKey(e) { if (e.key === 'Escape') closeAnalysis(); }

function switchAnalysisTab(tab) {
  try { _highlightAnalysisTab(tab); _renderAnalysisTab(tab); }
  catch(err) {
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

/* ── year data compiler ── */
function _getYearData() {
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
  var byTour = {};
  var byMonth = MN.map(function(name) { return { month: name, count: 0, revenue: 0, pax: 0 }; });

  all.forEach(function(b) {
    var rev  = +((b.payment && b.payment.total)   || b.total    || 0) || 0;
    var bal  = +((b.payment && b.payment.balance) || b.balance  || 0) || 0;
    var pax  = +((b.guest   && b.guest.totalPax)  || b.totalPax || 0) || 0;
    var pets = +((b.guest   && b.guest.pets)       || b.pets     || 0) || 0;
    var tour = (b.booking && b.booking.tourType) || b.tourType  || 'Unknown';
    var dk   = b.dateKey || (b.booking && b.booking.checkinDate) || '';
    var mo   = parseInt((dk.split('-')[1] || '0'), 10) - 1;

    totalRevenue += rev; totalBalance += bal; totalPax += pax; totalPets += pets;

    if (!byTour[tour]) byTour[tour] = { count:0, revenue:0 };
    byTour[tour].count++; byTour[tour].revenue += rev;

    if (mo >= 0 && mo <= 11) {
      byMonth[mo].count++; byMonth[mo].revenue += rev; byMonth[mo].pax += pax;
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

  return { all, total: all.length, totalRevenue, totalBalance,
           totalCollected: totalRevenue - totalBalance,
           totalPax, totalPets, byTour, byMonth, guests };
}

function _renderAnalysisMeta() {
  var d = _getYearData();
  var el = document.getElementById('analysisMeta');
  if (el) el.textContent = d.total + ' booking' + (d.total!==1?'s':'') +
    ' \u00b7 ' + _peso(d.totalRevenue) + ' total revenue';
}

function _renderAnalysisTab(tab) {
  var body = document.getElementById('analysisBody');
  if (!body) return;
  var d = _getYearData();
  if      (tab === 'overview') body.innerHTML = _yearTabOverview(d);
  else if (tab === 'monthly')  body.innerHTML = _yearTabMonthly(d);
  else if (tab === 'guests')   body.innerHTML = _yearTabGuests(d);
  else if (tab === 'revenue')  body.innerHTML = _yearTabRevenue(d);
}

/* ── year: overview tab ── */
function _yearTabOverview(d) {
  var pct = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;
  var TOUR_COL = { 'Day Tour':'#ff8c42','Night Tour':'#7c6af4','Over-Night':'#29b5e8','Half Day':'#3cb771','Overnight Tour':'#ff9900','Over Night':'#ff9900' };

  var tourRows = '';
  Object.keys(d.byTour).sort(function(a,b){return d.byTour[b].count-d.byTour[a].count;})
    .forEach(function(type) {
      var td = d.byTour[type];
      var p  = d.total ? Math.round(td.count/d.total*100) : 0;
      var col = TOUR_COL[type] || '#9996b0';
      tourRows +=
        '<div style="margin-bottom:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
            '<div style="display:flex;align-items:center;gap:7px;">' +
              '<span style="width:9px;height:9px;border-radius:50%;background:'+col+';display:inline-block;"></span>' +
              '<span style="font-size:12px;font-weight:700;color:#1a1a2e;">'+type+'</span>' +
            '</div>' +
            '<span style="font-size:11px;color:#9996b0;">'+td.count+' booking'+(td.count!==1?'s':'')+' &middot; '+_peso(td.revenue)+'</span>' +
          '</div>' +
          '<div style="height:7px;background:#f0eeff;border-radius:99px;overflow:hidden;">' +
            '<div style="height:100%;width:'+p+'%;background:'+col+';border-radius:99px;"></div>' +
          '</div>' +
        '</div>';
    });

  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
      _statCard('📅','Total Bookings',''+d.total, d.totalPax+' pax &middot; '+d.totalPets+' pets','#1a1a2e') +
      _statCard('💳','Total Revenue',_peso(d.totalRevenue),_peso(d.totalCollected)+' collected ('+pct+'%)','#3cb771') +
    '</div>' +
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 14px;">Tour Type Breakdown</p>' +
      (tourRows||'<p style="color:#9996b0;font-size:12px;">No bookings yet.</p>') +
    '</div>';
}

/* ── year: monthly tab — DUAL CHART ── */
function _yearTabMonthly(d) {
  var MC = (typeof MONTH_COLORS !== 'undefined') ? MONTH_COLORS :
    Array(12).fill({ accent:'#7c6af4', light:'#e0daff', tint:'#f5f3ff' });

  // Bookings bar chart
  var bookingBars = d.byMonth.map(function(m, i) {
    return {
      label:   m.month.slice(0,3),
      value:   m.count,
      value2:  m.revenue,
      color:   MC[i].accent,
      tooltip: m.month + ': ' + m.count + ' booking' + (m.count!==1?'s':'') + ' | ' + _peso(m.revenue)
    };
  });

  // Revenue bar chart
  var revenueBars = d.byMonth.map(function(m, i) {
    return {
      label:   m.month.slice(0,3),
      value:   m.revenue,
      value2:  m.count,
      color:   MC[i].accent,
      tooltip: m.month + ': ' + _peso(m.revenue) + ' | ' + m.count + ' booking' + (m.count!==1?'s':'')
    };
  });

  // All 12 months table
  var tableRows = '';
  d.byMonth.forEach(function(m, i) {
    var active = m.count > 0;
    var col    = MC[i].accent;
    tableRows +=
      '<tr style="border-bottom:1px solid #f5f5f8;' + (active?'':'opacity:0.4;') + '">' +
        '<td style="padding:9px 0;">' +
          '<div style="display:flex;align-items:center;gap:7px;">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:'+col+';flex-shrink:0;display:inline-block;"></span>' +
            '<span style="font-size:12px;font-weight:'+(active?'700':'400')+';color:#1a1a2e;">'+m.month+'</span>' +
          '</div>' +
        '</td>' +
        '<td style="padding:9px 8px;font-size:12px;color:#555570;text-align:center;">'+(m.count||'—')+'</td>' +
        '<td style="padding:9px 8px;font-size:12px;color:#555570;text-align:center;">'+(m.pax||'—')+'</td>' +
        '<td style="padding:9px 0;font-size:12px;font-weight:'+(active?'700':'400')+';color:'+(active?'#3cb771':'#ccc')+';text-align:right;">'+(active?_peso(m.revenue):'—')+'</td>' +
      '</tr>';
  });

  return (
    // Bookings chart
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">' +
        '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0;">Bookings by Month</p>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:10px;font-weight:700;color:#9996b0;">Bars = bookings count</span>' +
          '<div style="display:flex;align-items:center;gap:4px;"><div style="width:14px;height:2px;background:#3cb771;border-radius:2px;"></div><span style="font-size:10px;font-weight:700;color:#3cb771;">Revenue trend</span></div>' +
        '</div>' +
      '</div>' +
      '<div style="padding-top:10px;">' + _svgBarChart({ bars: bookingBars, width: 580, height: 140, showValue: true, unit: '', accentLine: true }) + '</div>' +
    '</div>' +
    // Revenue chart
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">' +
        '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0;">Revenue by Month (₱)</p>' +
        '<div style="display:flex;align-items:center;gap:4px;"><div style="width:14px;height:2px;background:#7c6af4;border-radius:2px;opacity:0.5;"></div><span style="font-size:10px;font-weight:700;color:#9996b0;">k = thousands</span></div>' +
      '</div>' +
      '<div style="padding-top:10px;">' + _svgBarChart({ bars: revenueBars, width: 580, height: 140, showValue: true, unit: '\u20b1' }) + '</div>' +
    '</div>' +
    // Table
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 10px;">All 12 Months</p>' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="border-bottom:2px solid #f0eeff;">' +
          '<th style="padding:7px 0;font-size:10px;color:#9996b0;text-align:left;font-weight:700;letter-spacing:0.5px;">MONTH</th>' +
          '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;letter-spacing:0.5px;">BOOKINGS</th>' +
          '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;letter-spacing:0.5px;">PAX</th>' +
          '<th style="padding:7px 0;font-size:10px;color:#9996b0;text-align:right;font-weight:700;letter-spacing:0.5px;">REVENUE</th>' +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

/* ── year: guests tab ── */
function _yearTabGuests(d) {
  if (!d.guests.length)
    return '<p style="color:#9996b0;font-size:13px;text-align:center;padding:50px 0;">No bookings yet.</p>';
  var TC = {'Day Tour':'#ff8c42','Night Tour':'#7c6af4','Over-Night':'#29b5e8','Half Day':'#3cb771'};
  var rows = '';
  d.guests.forEach(function(g) {
    var col = TC[g.tourType]||'#9996b0';
    rows += '<tr style="border-bottom:1px solid #f5f5f8;">' +
      '<td style="padding:9px 0;"><div style="font-size:12px;font-weight:700;color:#1a1a2e;">'+g.name+'</div><div style="font-size:11px;color:#9996b0;">'+g.phone+'</div></td>' +
      '<td style="padding:9px 8px;"><span style="background:'+col+'20;color:'+col+';font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;">'+g.tourType+'</span></td>' +
      '<td style="padding:9px 8px;font-size:12px;color:#555570;white-space:nowrap;">'+g.date+'</td>' +
      '<td style="padding:9px 8px;font-size:12px;color:#555570;text-align:center;">'+g.pax+'</td>' +
      '<td style="padding:9px 0;text-align:right;"><div style="font-size:12px;font-weight:700;color:#3cb771;">'+_peso(g.total)+'</div>'+(g.balance>0?'<div style="font-size:10px;color:#e04060;">bal: '+_peso(g.balance)+'</div>':'<div style="font-size:10px;color:#3cb771;">\u2705 paid</div>')+'</td>' +
    '</tr>';
  });
  return '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;">' +
    '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 10px;">All Guests ('+d.guests.length+')</p>' +
    '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:460px;">' +
      '<thead><tr style="border-bottom:2px solid #f0eeff;">' +
        '<th style="padding:7px 0;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">GUEST</th>' +
        '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">TOUR</th>' +
        '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">DATE</th>' +
        '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;">PAX</th>' +
        '<th style="padding:7px 0;font-size:10px;color:#9996b0;text-align:right;font-weight:700;">TOTAL</th>' +
      '</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

/* ── year: revenue tab ── */
function _yearTabRevenue(d) {
  var pct       = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;

  var topMonths = d.byMonth.filter(function(m) { return m.revenue > 0; })
    .sort(function(a, b) { return b.revenue - a.revenue; }).slice(0, 6);

  var topRows = '';
  topMonths.forEach(function(m) {
    var barPct = topMonths[0].revenue > 0 ? Math.round(m.revenue / topMonths[0].revenue * 100) : 0;
    topRows +=
      '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #f5f5f8;">' +
        '<span style="font-size:12px;font-weight:700;color:#1a1a2e;width:80px;flex-shrink:0;">'+m.month+'</span>' +
        '<div style="flex:1;height:6px;background:#f0eeff;border-radius:99px;overflow:hidden;">' +
          '<div style="height:100%;width:'+barPct+'%;background:#3cb771;border-radius:99px;"></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;min-width:110px;">' +
          '<span style="font-size:13px;font-weight:800;color:#3cb771;">'+_peso(m.revenue)+'</span>' +
          '<span style="font-size:10px;color:#9996b0;">'+m.count+' booking'+(m.count!==1?'s':'')+'</span>' +
        '</div>' +
      '</div>';
  });

  var unpaid = d.guests.filter(function(g) { return g.balance > 0; });
  var unpaidRows = '';
  unpaid.forEach(function(g) {
    unpaidRows +=
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f5f5f8;">' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="font-size:12px;font-weight:700;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+g.name+'</div>' +
          '<div style="font-size:11px;color:#9996b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+g.date+' &middot; '+g.tourType+'</div>' +
        '</div>' +
        '<span style="font-size:13px;font-weight:800;color:#e04060;flex-shrink:0;">'+_peso(g.balance)+'</span>' +
      '</div>';
  });

  var summaryCard =
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;margin-bottom:14px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 14px;">Revenue Summary</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div style="background:#fff;border:1.5px solid #e8e8f0;border-radius:12px;padding:14px 16px;">' +
          '<div style="font-size:10px;font-weight:700;color:#9996b0;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:5px;">TOTAL REVENUE</div>' +
          '<div style="font-size:20px;font-weight:800;color:#1a1a2e;letter-spacing:-0.5px;">'+_peso(d.totalRevenue)+'</div>' +
          '<div style="font-size:11px;color:#9996b0;margin-top:3px;">'+d.total+' booking'+(d.total!==1?'s':'')+'</div>' +
        '</div>' +
        '<div style="background:#f0fff4;border:1.5px solid #b8f0ce;border-radius:12px;padding:14px 16px;">' +
          '<div style="font-size:10px;font-weight:700;color:#2a9a5a;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:5px;">COLLECTED</div>' +
          '<div style="font-size:20px;font-weight:800;color:#2a9a5a;letter-spacing:-0.5px;">'+_peso(d.totalCollected)+'</div>' +
          '<div style="margin-top:8px;height:6px;background:#b8f0ce;border-radius:99px;overflow:hidden;">' +
            '<div style="height:100%;width:'+pct+'%;background:#3cb771;border-radius:99px;"></div>' +
          '</div>' +
          '<div style="font-size:11px;color:#2a9a5a;margin-top:4px;">'+pct+'% of total</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var topSection =
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:18px;margin-bottom:14px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 2px;">Top Revenue Months</p>' +
      '<p style="font-size:11px;color:#9996b0;margin:0 0 10px;">Sorted highest to lowest</p>' +
      (topRows || '<p style="color:#9996b0;font-size:12px;margin-top:8px;">No revenue yet.</p>') +
    '</div>';

  var outstandingSection = unpaid.length
    ? '<div style="background:#fafafa;border:1.5px solid #ffd6df;border-radius:14px;padding:18px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<p style="font-size:12px;font-weight:800;color:#e04060;margin:0;">\u26a0\ufe0f Outstanding Balance</p>' +
          '<span style="font-size:11px;font-weight:700;background:#ffe0e6;color:#e04060;padding:3px 10px;border-radius:20px;">'+unpaid.length+' guest'+(unpaid.length!==1?'s':'')+' unpaid</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff0f3;border-radius:10px;margin-bottom:10px;">' +
          '<span style="font-size:11px;font-weight:700;color:#e04060;">Total Outstanding</span>' +
          '<span style="font-size:16px;font-weight:800;color:#e04060;">'+_peso(d.totalBalance)+'</span>' +
        '</div>' +
        unpaidRows +
      '</div>'
    : '<div style="background:#f0fff4;border:1.5px solid #b8f0ce;border-radius:14px;padding:20px;text-align:center;">' +
        '<div style="font-size:28px;margin-bottom:6px;">\u2705</div>' +
        '<p style="font-size:13px;font-weight:700;color:#2a9a5a;margin:0;">All guests fully paid!</p>' +
      '</div>';

  return summaryCard + topSection + outstandingSection;
}

/* ═══════════════════════════════════════════════════════
   MONTH ANALYSIS MODAL
═══════════════════════════════════════════════════════ */
var _maCurrentYear  = null;
var _maCurrentMonth = null;
var _maCurrentColor = null;

function _triggerMonthPdfExport() {
  if (typeof exportMonthAnalysisPDF === 'function' && _maCurrentYear !== null) {
    exportMonthAnalysisPDF(_maCurrentYear, _maCurrentMonth, _maCurrentColor);
  } else {
    alert('PDF library not ready. Please try again.');
  }
}

function openMonthAnalysis(year, month, color) {
  var ov = document.getElementById('monthAnalysisOverlay');
  var md = document.getElementById('monthAnalysisModal');
  if (!ov || !md) { alert('Month analysis modal not found.'); return; }

  _maCurrentYear  = year;
  _maCurrentMonth = month;
  _maCurrentColor = color;

  var MN  = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES : [];
  var title = document.getElementById('maTitle');
  var pill  = document.getElementById('maColorPill');
  if (title) title.textContent = MN[month] + ' ' + year;
  if (pill)  pill.style.background = color.accent;

  var body = document.getElementById('monthAnalysisBody');
  try {
    body.innerHTML = _buildMonthAnalysis(year, month, color);
  } catch(err) {
    body.innerHTML = '<p style="color:#e04060;padding:20px;">Error: ' + err.message + '</p>';
  }

  md.style.transition = 'none';
  md.style.transform  = 'translateY(30px) scale(0.96)';
  ov.style.visibility    = 'visible';
  ov.style.pointerEvents = 'all';
  requestAnimationFrame(function() { requestAnimationFrame(function() {
    md.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
    ov.style.opacity    = '1';
    md.style.transform  = 'translateY(0) scale(1)';
  }); });

  ov.onclick = function(e) { if (e.target === ov) closeMonthAnalysis(); };
  document.addEventListener('keydown', _onMonthAnalysisKey);
}

function closeMonthAnalysis() {
  var ov = document.getElementById('monthAnalysisOverlay');
  var md = document.getElementById('monthAnalysisModal');
  if (!ov) return;
  ov.style.opacity = '0'; ov.style.visibility = 'hidden'; ov.style.pointerEvents = 'none';
  if (md) md.style.transform = 'translateY(30px) scale(0.96)';
  document.removeEventListener('keydown', _onMonthAnalysisKey);
}
function _onMonthAnalysisKey(e) { if (e.key === 'Escape') closeMonthAnalysis(); }

/* ── month data compiler ── */
function _getMonthData(year, month) {
  var src = (typeof Bookings !== 'undefined') ? Bookings : {};
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  var days = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var key  = (typeof toKey === 'function') ? toKey(year, month, d)
               : year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var list = src[key] || [];
    var rev  = 0, bal = 0, pax = 0;
    list.forEach(function(b) {
      rev += +((b.payment && b.payment.total)   || b.total   || 0) || 0;
      bal += +((b.payment && b.payment.balance) || b.balance || 0) || 0;
      pax += +((b.guest   && b.guest.totalPax)  || b.totalPax|| 0) || 0;
    });
    days.push({ day: d, key: key, bookings: list, count: list.length, revenue: rev, balance: bal, pax: pax });
  }

  var totalCount   = days.reduce(function(s,d){return s+d.count;}, 0);
  var totalRevenue = days.reduce(function(s,d){return s+d.revenue;}, 0);
  var totalBalance = days.reduce(function(s,d){return s+d.balance;}, 0);
  var totalPax     = days.reduce(function(s,d){return s+d.pax;}, 0);

  // tour type breakdown
  var byTour = {};
  days.forEach(function(d) {
    d.bookings.forEach(function(b) {
      var t = (b.booking && b.booking.tourType) || b.tourType || 'Unknown';
      if (!byTour[t]) byTour[t] = 0;
      byTour[t]++;
    });
  });

  // busiest days
  var activeDays = days.filter(function(d){return d.count>0;})
    .sort(function(a,b){return b.revenue-a.revenue;});

  return { days, totalCount, totalRevenue, totalBalance,
           totalCollected: totalRevenue - totalBalance,
           totalPax, byTour, activeDays };
}

/* ── month analysis content builder ── */
function _buildMonthAnalysis(year, month, color) {
  var d   = _getMonthData(year, month);
  var acc = color.accent;
  var pct = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;
  var TOUR_COL = {'Day Tour':'#ff8c42','Night Tour':'#7c6af4','Over-Night':'#29b5e8','Half Day':'#3cb771'};

  // ── stat cards ──
  var stats =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">' +
      _statCard('📅','Bookings',''+d.totalCount, d.totalPax+' total pax', acc) +
      _statCard('💳','Revenue',_peso(d.totalRevenue),_peso(d.totalCollected)+' collected ('+pct+'%)',acc) +
    '</div>';

  // ── bookings-per-day bar chart ──
  var dayBars = d.days.map(function(day) {
    var dow = new Date(year, month, day.day).getDay();
    var isWknd = dow===0||dow===6;
    return {
      label: ''+day.day,
      value: day.count,
      value2: day.revenue,
      color: day.count > 0 ? acc : (isWknd ? color.light : '#e8e8f0'),
      tooltip: 'Day '+day.day+': '+day.count+' booking'+(day.count!==1?'s':'')+' | '+_peso(day.revenue)
    };
  });

  var bookingsChart =
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:16px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">' +
        '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0;">Bookings Per Day</p>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:10px;color:#9996b0;">Bars = bookings</span>' +
          '<div style="display:flex;align-items:center;gap:4px;"><div style="width:12px;height:2px;background:#3cb771;border-radius:2px;"></div><span style="font-size:10px;font-weight:700;color:#3cb771;">Revenue</span></div>' +
        '</div>' +
      '</div>' +
      '<div style="padding-top:10px;">' +
        _svgBarChart({ bars: dayBars, width: 560, height: 130, showValue: false, unit: '', accentLine: true }) +
      '</div>' +
    '</div>';

  // ── revenue-per-day bar chart ──
  var revBars = d.days.map(function(day) {
    return {
      label: ''+day.day,
      value: day.revenue,
      color: day.revenue > 0 ? acc : '#e8e8f0',
      tooltip: 'Day '+day.day+': '+_peso(day.revenue)
    };
  });

  var revenueChart =
    '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:16px;margin-bottom:14px;">' +
      '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 2px;">Revenue Per Day (₱)</p>' +
      '<p style="font-size:10px;color:#9996b0;margin:0 0 10px;">k = thousands</p>' +
      _svgBarChart({ bars: revBars, width: 560, height: 120, showValue: true, unit: '\u20b1' }) +
    '</div>';

  // ── tour type mini breakdown ──
  var tourKeys = Object.keys(d.byTour);
  var tourSection = '';
  if (tourKeys.length) {
    var tourRows = '';
    tourKeys.sort(function(a,b){return d.byTour[b]-d.byTour[a];}).forEach(function(type) {
      var cnt = d.byTour[type];
      var p   = d.totalCount ? Math.round(cnt/d.totalCount*100) : 0;
      var col = TOUR_COL[type] || '#9996b0';
      tourRows +=
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
          '<span style="width:9px;height:9px;border-radius:50%;background:'+col+';flex-shrink:0;display:inline-block;"></span>' +
          '<span style="font-size:12px;font-weight:700;color:#1a1a2e;flex:1;">'+type+'</span>' +
          '<span style="font-size:11px;color:#9996b0;margin-right:8px;">'+cnt+' booking'+(cnt!==1?'s':'')+'</span>' +
          '<div style="width:80px;height:6px;background:#f0eeff;border-radius:99px;overflow:hidden;">' +
            '<div style="height:100%;width:'+p+'%;background:'+col+';border-radius:99px;"></div>' +
          '</div>' +
        '</div>';
    });
    tourSection =
      '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:16px;margin-bottom:14px;">' +
        '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 12px;">Tour Types This Month</p>' +
        tourRows +
      '</div>';
  }

  // ── busiest days table ──
  var busySection = '';
  if (d.activeDays.length) {
    var MN2 = (typeof MONTH_NAMES!=='undefined') ? MONTH_NAMES : [];
    var busyRows = '';
    d.activeDays.slice(0, 8).forEach(function(day) {
      var dow  = new Date(year, month, day.day).getDay();
      var wday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
      busyRows +=
        '<tr style="border-bottom:1px solid #f5f5f8;">' +
          '<td style="padding:8px 0;font-size:12px;font-weight:700;color:#1a1a2e;">'+wday+', '+(MN2[month]||'').slice(0,3)+' '+day.day+'</td>' +
          '<td style="padding:8px 8px;font-size:12px;color:#555570;text-align:center;">'+day.count+'</td>' +
          '<td style="padding:8px 8px;font-size:12px;color:#555570;text-align:center;">'+day.pax+'</td>' +
          '<td style="padding:8px 0;font-size:12px;font-weight:700;color:#3cb771;text-align:right;">'+_peso(day.revenue)+'</td>' +
        '</tr>';
    });
    busySection =
      '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:16px;">' +
        '<p style="font-size:12px;font-weight:800;color:#1a1a2e;margin:0 0 10px;">Active Days</p>' +
        '<table style="width:100%;border-collapse:collapse;">' +
          '<thead><tr style="border-bottom:2px solid #f0eeff;">' +
            '<th style="padding:7px 0;font-size:10px;color:#9996b0;text-align:left;font-weight:700;">DATE</th>' +
            '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;">BOOKINGS</th>' +
            '<th style="padding:7px 8px;font-size:10px;color:#9996b0;text-align:center;font-weight:700;">PAX</th>' +
            '<th style="padding:7px 0;font-size:10px;color:#9996b0;text-align:right;font-weight:700;">REVENUE</th>' +
          '</tr></thead>' +
          '<tbody>'+busyRows+'</tbody>' +
        '</table>' +
      '</div>';
  } else {
    busySection =
      '<div style="background:#fafafa;border:1.5px solid #f0eeff;border-radius:14px;padding:24px;text-align:center;">' +
        '<p style="font-size:22px;margin:0 0 8px;">📭</p>' +
        '<p style="font-size:13px;color:#9996b0;margin:0;">No bookings this month yet.</p>' +
      '</div>';
  }

  return stats + bookingsChart + revenueChart + tourSection + busySection;
}