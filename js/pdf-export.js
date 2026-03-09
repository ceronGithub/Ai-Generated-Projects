/* ═══════════════════════════════════════════════════════════
   pdf-export.js  —  Beautiful PDF exports for Analysis modals
   Uses jsPDF (loaded via CDN in index.html)
   ─────────────────────────────────────────────────────────
   exportMonthAnalysisPDF(year, month, color)
   exportBookingAnalysisPDF()
═══════════════════════════════════════════════════════════ */

/* ── Shared colour palette ── */
var PDF_PURPLE = [124, 106, 244];
var PDF_GREEN  = [42,  154, 90];
var PDF_RED    = [224, 64,  96];
var PDF_DARK   = [26,  26,  46];
var PDF_GREY   = [153, 150, 176];
var PDF_LIGHT  = [240, 238, 255];
var PDF_WHITE  = [255, 255, 255];
var PDF_BG     = [250, 250, 252];

/* ── Shared peso helper ── */
function _pdfPeso(n) {
  return 'P' + (+n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

/* ═══════════════════════════════════════════
   DRAWING PRIMITIVES
═══════════════════════════════════════════ */

/* Rounded rect (filled) */
function _pdfRRect(doc, x, y, w, h, r, fillRGB) {
  doc.setFillColor(fillRGB[0], fillRGB[1], fillRGB[2]);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

/* Rounded rect (stroked) */
function _pdfRRectS(doc, x, y, w, h, r, strokeRGB, lw) {
  doc.setDrawColor(strokeRGB[0], strokeRGB[1], strokeRGB[2]);
  doc.setLineWidth(lw || 0.4);
  doc.roundedRect(x, y, w, h, r, r, 'S');
}

/* Stat card — icon area + label + value + sub */
function _pdfStatCard(doc, x, y, w, h, label, value, sub, accentRGB) {
  _pdfRRect(doc, x, y, w, h, 4, PDF_BG);
  doc.setDrawColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.setLineWidth(0.5);
  doc.rect(x, y, 3, h, 'F');   // left accent bar
  doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.rect(x, y, 3, h, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
  doc.text(label.toUpperCase(), x + 7, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.text(value, x + 7, y + 18);

  if (sub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
    doc.text(sub, x + 7, y + 25);
  }
}

/* Section header */
function _pdfSectionHeader(doc, x, y, w, title, accentRGB) {
  _pdfRRect(doc, x, y, w, 9, 3, PDF_LIGHT);
  doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.rect(x, y, 3, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
  doc.text(title, x + 7, y + 6.2);
  return y + 13;
}

/* Progress bar */
function _pdfProgressBar(doc, x, y, w, h, pct, fillRGB, bgRGB) {
  _pdfRRect(doc, x, y, w, h, h/2, bgRGB || [230,230,245]);
  if (pct > 0) {
    _pdfRRect(doc, x, y, Math.max(w * pct / 100, h), h, h/2, fillRGB);
  }
}

/* Bar chart drawn natively in PDF */
function _pdfBarChart(doc, x, y, w, h, bars, accentRGB) {
  /* bars = [{label, value, value2?}] */
  var maxVal = 0;
  bars.forEach(function(b) { if (b.value > maxVal) maxVal = b.value; });
  if (maxVal === 0) maxVal = 1;

  var n      = bars.length;
  var gap    = w / n;
  var barW   = Math.max(gap * 0.55, 1.5);
  var chartH = h - 14; // leave room for labels

  /* BG */
  _pdfRRect(doc, x, y, w, h, 3, [248, 247, 255]);

  bars.forEach(function(b, i) {
    var bx   = x + i * gap + (gap - barW) / 2;
    var barH = b.value > 0 ? Math.max((b.value / maxVal) * chartH, 1.5) : 0;
    var by   = y + chartH - barH;
    var col  = b.color || accentRGB;

    /* bar */
    if (barH > 0) {
      doc.setFillColor(col[0], col[1], col[2]);
      doc.roundedRect(bx, by, barW, barH, 1, 1, 'F');
    }

    /* label */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
    var lbl = (b.label || '').toString();
    var lblW = doc.getTextWidth(lbl);
    doc.text(lbl, bx + barW / 2 - lblW / 2, y + chartH + 5);
  });
}

/* Divider line */
function _pdfDivider(doc, x, y, w) {
  doc.setDrawColor(240, 238, 255);
  doc.setLineWidth(0.3);
  doc.line(x, y, x + w, y);
}

/* Page header with gradient-like banner */
function _pdfPageHeader(doc, title, subtitle, accentRGB, pageW) {
  /* banner */
  doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.rect(0, 0, pageW, 28, 'F');
  /* subtle overlay strip */
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.08 }));
  doc.rect(0, 14, pageW, 14, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  /* title */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 13);

  /* subtitle */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.80 }));
  doc.text(subtitle, 14, 22);
  doc.setGState(doc.GState({ opacity: 1 }));

  /* date stamp top-right */
  var now = new Date();
  var stamp = 'Generated ' + now.toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255,255,255);
  doc.setGState(doc.GState({ opacity: 0.70 }));
  var sw = doc.getTextWidth(stamp);
  doc.text(stamp, pageW - 14 - sw, 22);
  doc.setGState(doc.GState({ opacity: 1 }));
}

/* Page footer */
function _pdfFooter(doc, pageNum, totalPages, pageW, pageH) {
  doc.setFillColor(248, 247, 255);
  doc.rect(0, pageH - 10, pageW, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
  doc.text('2026 Full Year Calendar — Booking System', 14, pageH - 3.5);
  var pg = 'Page ' + pageNum + ' of ' + totalPages;
  doc.text(pg, pageW - 14 - doc.getTextWidth(pg), pageH - 3.5);
}

/* ═══════════════════════════════════════════
   MONTH ANALYSIS PDF
═══════════════════════════════════════════ */
function exportMonthAnalysisPDF(year, month, color) {
  if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
    alert('PDF library not loaded yet. Please try again in a moment.');
    return;
  }
  var jsPDF = (window.jspdf || jspdf).jsPDF;

  var MN = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES :
    ['January','February','March','April','May','June',
     'July','August','September','October','November','December'];

  var d   = _getMonthData(year, month);
  var acc = _hexToRgb(color.accent) || PDF_PURPLE;
  var pct = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;

  var TOUR_COL_HEX = {
    'Day Tour':'#ff8c42','Night Tour':'#7c6af4',
    'Over-Night':'#29b5e8','Overnight Tour':'#ff9900',
    'Over Night':'#ff9900','Half Day':'#3cb771'
  };

  var doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var pageW  = doc.internal.pageSize.getWidth();
  var pageH  = doc.internal.pageSize.getHeight();
  var margin = 14;
  var cw     = pageW - margin * 2;
  var cy     = 34; // cursor y

  /* ── Page 1 ── */
  _pdfPageHeader(doc,
    MN[month] + ' ' + year + ' — Monthly Analysis',
    d.totalCount + ' booking' + (d.totalCount !== 1 ? 's' : '') +
    '  ·  ' + _pdfPeso(d.totalRevenue) + ' total revenue  ·  ' +
    d.totalPax + ' total pax',
    acc, pageW
  );

  /* ── Stat cards row ── */
  var cardW = (cw - 6) / 2;
  var cardH = 32;
  _pdfStatCard(doc, margin,          cy, cardW, cardH, 'Bookings', '' + d.totalCount, d.totalPax + ' total guests', acc);
  _pdfStatCard(doc, margin + cardW + 6, cy, cardW, cardH, 'Revenue', _pdfPeso(d.totalRevenue), _pdfPeso(d.totalCollected) + ' collected (' + pct + '%)', PDF_GREEN);
  cy += cardH + 8;

  /* ── Collection progress ── */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'Collection Progress', acc);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
  doc.text('Collected: ' + _pdfPeso(d.totalCollected) + ' (' + pct + '%)', margin, cy);
  cy += 4;
  _pdfProgressBar(doc, margin, cy, cw, 4, pct, PDF_GREEN, [200, 240, 215]);
  cy += 10;

  /* ── Bookings per day bar chart ── */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'Bookings Per Day', acc);
  var dayBars = d.days.map(function(day) {
    var dow = new Date(year, month, day.day).getDay();
    var isWknd = dow === 0 || dow === 6;
    return {
      label: '' + day.day,
      value: day.count,
      color: day.count > 0 ? acc : (isWknd ? [200,196,255] : [220,220,235])
    };
  });
  _pdfBarChart(doc, margin, cy, cw, 36, dayBars, acc);
  cy += 42;

  /* ── Revenue per day bar chart ── */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'Revenue Per Day (PHP)', acc);
  var revBars = d.days.map(function(day) {
    return {
      label: '' + day.day,
      value: day.revenue,
      color: day.revenue > 0 ? PDF_GREEN : [220,220,235]
    };
  });
  _pdfBarChart(doc, margin, cy, cw, 36, revBars, PDF_GREEN);
  cy += 42;

  /* ── Tour type breakdown ── */
  var tourKeys = Object.keys(d.byTour);
  if (tourKeys.length) {
    cy = _pdfSectionHeader(doc, margin, cy, cw, 'Tour Types This Month', acc);
    tourKeys.sort(function(a,b){return d.byTour[b]-d.byTour[a];}).forEach(function(type) {
      var cnt = d.byTour[type];
      var p   = d.totalCount ? Math.round(cnt / d.totalCount * 100) : 0;
      var col = _hexToRgb(TOUR_COL_HEX[type] || '#9996b0');

      doc.setFillColor(col[0], col[1], col[2]);
      doc.circle(margin + 3, cy + 2.5, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
      doc.text(type, margin + 8, cy + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
      var ctxt = cnt + ' booking' + (cnt !== 1 ? 's' : '');
      doc.text(ctxt, pageW - margin - doc.getTextWidth(ctxt), cy + 4);

      var barStart = margin + 8 + doc.getTextWidth(type) + 6;
      var barEnd   = pageW - margin - doc.getTextWidth(ctxt) - 6;
      var barLen   = barEnd - barStart;
      _pdfProgressBar(doc, barStart, cy + 1, barLen, 2.5, p, col, [230,230,245]);
      cy += 9;

      if (cy > pageH - 20) { doc.addPage(); cy = 14; }
    });
    cy += 4;
  }

  /* ── Page 2: Active days table ── */
  if (d.activeDays.length) {
    if (cy > pageH - 60) { doc.addPage(); cy = 14; }

    cy = _pdfSectionHeader(doc, margin, cy, cw, 'Active Days (by Revenue)', acc);

    /* table header */
    _pdfRRect(doc, margin, cy, cw, 8, 2, PDF_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(acc[0], acc[1], acc[2]);
    doc.text('DATE',     margin + 3,         cy + 5.5);
    doc.text('BOOKINGS', margin + cw * 0.45, cy + 5.5);
    doc.text('PAX',      margin + cw * 0.60, cy + 5.5);
    doc.text('REVENUE',  margin + cw - 3 - doc.getTextWidth('REVENUE'), cy + 5.5);
    cy += 10;

    d.activeDays.forEach(function(day, idx) {
      if (cy > pageH - 15) { doc.addPage(); cy = 14; }

      var dow  = new Date(year, month, day.day).getDay();
      var wday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
      var dateStr = wday + ', ' + MN[month].slice(0,3) + ' ' + day.day;
      var revStr  = _pdfPeso(day.revenue);

      if (idx % 2 === 0) _pdfRRect(doc, margin, cy - 1, cw, 8, 1, [248,247,255]);

      doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
      doc.text(dateStr, margin + 3, cy + 5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
      doc.text('' + day.count, margin + cw * 0.45, cy + 5);
      doc.text('' + day.pax,   margin + cw * 0.60, cy + 5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
      doc.text(revStr, margin + cw - 3 - doc.getTextWidth(revStr), cy + 5);

      _pdfDivider(doc, margin, cy + 7, cw);
      cy += 9;
    });
  }

  /* ── Booking details ── */
  var allBookings = [];
  d.days.forEach(function(day) {
    day.bookings.forEach(function(b) {
      allBookings.push({ day: day.day, booking: b });
    });
  });

  if (allBookings.length) {
    if (cy > pageH - 60) { doc.addPage(); cy = 14; }
    cy = _pdfSectionHeader(doc, margin, cy, cw, 'Booking Details', acc);

    /* table header */
    _pdfRRect(doc, margin, cy, cw, 8, 2, PDF_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(acc[0], acc[1], acc[2]);
    var cols = [
      { label: 'GUEST',   x: margin + 3 },
      { label: 'TOUR',    x: margin + cw * 0.30 },
      { label: 'TIME',    x: margin + cw * 0.50 },
      { label: 'PAX',     x: margin + cw * 0.67 },
      { label: 'TOTAL',   x: margin + cw * 0.78 },
    ];
    cols.forEach(function(c) { doc.text(c.label, c.x, cy + 5.5); });
    cy += 10;

    allBookings.forEach(function(item, idx) {
      if (cy > pageH - 15) { doc.addPage(); cy = 14; }

      var b    = item.booking;
      var name = (b.guest && b.guest.name) || b.guestName || '—';
      var tour = (b.booking && b.booking.tourType) || b.tourType || '—';
      var cin  = (b.booking && b.booking.checkinTime)  || b.checkinTime  || '';
      var cout = (b.booking && b.booking.checkoutTime) || b.checkoutTime || '';
      var timeStr = cin && cout ? _to12hrPdf(cin) + '-' + _to12hrPdf(cout) : '—';
      var pax  = (b.guest && b.guest.totalPax) || b.totalPax || '—';
      var tot  = _pdfPeso((b.payment && b.payment.total) || b.total || 0);
      var bal  = +((b.payment && b.payment.balance) || b.balance || 0);

      if (idx % 2 === 0) _pdfRRect(doc, margin, cy - 1, cw, 9, 1, [248,247,255]);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
      /* truncate name */
      var nameStr = name.length > 20 ? name.slice(0,18) + '…' : name;
      doc.text(nameStr, cols[0].x, cy + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
      var tourStr = tour.length > 12 ? tour.slice(0,10) + '…' : tour;
      doc.text(tourStr,  cols[1].x, cy + 4.5);
      doc.text(timeStr,  cols[2].x, cy + 4.5);
      doc.text('' + pax, cols[3].x, cy + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
      doc.text(tot, cols[4].x, cy + 4.5);

      if (bal > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(PDF_RED[0], PDF_RED[1], PDF_RED[2]);
        doc.text('bal: ' + _pdfPeso(bal), cols[0].x, cy + 8.5);
      }

      _pdfDivider(doc, margin, cy + (bal > 0 ? 10 : 8), cw);
      cy += bal > 0 ? 12 : 9;
    });
  }

  /* ── Footers on all pages ── */
  var total = doc.getNumberOfPages();
  for (var p = 1; p <= total; p++) {
    doc.setPage(p);
    _pdfFooter(doc, p, total, pageW, pageH);
  }

  doc.save(MN[month] + '_' + year + '_Monthly_Analysis.pdf');
}

/* ═══════════════════════════════════════════
   BOOKING ANALYSIS PDF  (Overview + Monthly + Guests)
═══════════════════════════════════════════ */
function exportBookingAnalysisPDF() {
  if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
    alert('PDF library not loaded yet. Please try again in a moment.');
    return;
  }
  var jsPDF = (window.jspdf || jspdf).jsPDF;

  var d   = _getYearData();
  var acc = PDF_PURPLE;
  var pct = d.totalRevenue > 0 ? Math.round(d.totalCollected / d.totalRevenue * 100) : 0;

  var MC_HEX = (typeof MONTH_COLORS !== 'undefined')
    ? MONTH_COLORS.map(function(c){ return _hexToRgb(c.accent); })
    : Array(12).fill(PDF_PURPLE);

  var TOUR_COL_HEX = {
    'Day Tour':'#ff8c42','Night Tour':'#7c6af4',
    'Over-Night':'#29b5e8','Overnight Tour':'#ff9900',
    'Over Night':'#ff9900','Half Day':'#3cb771'
  };

  var doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var pageW = doc.internal.pageSize.getWidth();
  var pageH = doc.internal.pageSize.getHeight();
  var margin = 14;
  var cw     = pageW - margin * 2;
  var cy     = 34;

  /* ════════════════════════════════
     PAGE 1 — OVERVIEW
  ════════════════════════════════ */
  _pdfPageHeader(doc,
    '2026 Booking Analysis',
    d.total + ' booking' + (d.total !== 1 ? 's' : '') +
    '  ·  ' + _pdfPeso(d.totalRevenue) + ' total revenue  ·  ' +
    d.totalPax + ' pax',
    acc, pageW
  );

  /* Section label */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(acc[0], acc[1], acc[2]);
  doc.text('OVERVIEW', margin, cy);
  cy += 5;

  /* Stat cards — 2 per row */
  var cardW = (cw - 6) / 2;
  var cardH = 32;
  _pdfStatCard(doc, margin,              cy, cardW, cardH, 'Total Bookings', '' + d.total, d.totalPax + ' pax  ·  ' + d.totalPets + ' pets', PDF_DARK);
  _pdfStatCard(doc, margin + cardW + 6,  cy, cardW, cardH, 'Total Revenue', _pdfPeso(d.totalRevenue), _pdfPeso(d.totalCollected) + ' collected (' + pct + '%)', PDF_GREEN);
  cy += cardH + 8;

  /* Collection progress */
  _pdfProgressBar(doc, margin, cy, cw, 5, pct, PDF_GREEN, [200,240,215]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
  doc.text(pct + '% collected  ·  ' + (100 - pct) + '% balance', margin, cy + 9);
  cy += 16;

  /* Tour type breakdown */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'Tour Type Breakdown', acc);
  Object.keys(d.byTour).sort(function(a,b){return d.byTour[b].count - d.byTour[a].count;})
    .forEach(function(type) {
      if (cy > pageH - 20) { doc.addPage(); cy = 14; }
      var td  = d.byTour[type];
      var p   = d.total ? Math.round(td.count / d.total * 100) : 0;
      var col = _hexToRgb(TOUR_COL_HEX[type] || '#9996b0');

      doc.setFillColor(col[0], col[1], col[2]);
      doc.circle(margin + 3, cy + 3, 2.2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
      doc.text(type, margin + 8, cy + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
      var info = td.count + ' booking' + (td.count !== 1 ? 's' : '') + '  ·  ' + _pdfPeso(td.revenue);
      doc.text(info, pageW - margin - doc.getTextWidth(info), cy + 5);

      var barStart = margin + 8 + doc.getTextWidth(type) + 5;
      var barEnd   = pageW - margin - doc.getTextWidth(info) - 5;
      var barLen   = Math.max(barEnd - barStart, 10);
      _pdfProgressBar(doc, barStart, cy + 2, barLen, 3, p, col, [230,230,245]);
      cy += 11;
    });

  /* ════════════════════════════════
     PAGE 2 — MONTHLY
  ════════════════════════════════ */
  doc.addPage();
  cy = 14;

  _pdfPageHeader(doc,
    '2026 Booking Analysis',
    'Monthly Breakdown',
    acc, pageW
  );
  cy = 34;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(acc[0], acc[1], acc[2]);
  doc.text('MONTHLY BREAKDOWN', margin, cy);
  cy += 5;

  /* Bookings by month chart */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'Bookings by Month', acc);
  var bookingBars = d.byMonth.map(function(m, i) {
    return { label: m.month.slice(0,3), value: m.count, color: MC_HEX[i] || acc };
  });
  _pdfBarChart(doc, margin, cy, cw, 40, bookingBars, acc);
  cy += 46;

  /* Revenue by month chart */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'Revenue by Month (PHP)', acc);
  var revenueBars = d.byMonth.map(function(m, i) {
    return { label: m.month.slice(0,3), value: m.revenue, color: MC_HEX[i] || PDF_GREEN };
  });
  _pdfBarChart(doc, margin, cy, cw, 40, revenueBars, PDF_GREEN);
  cy += 46;

  /* All 12 months table */
  cy = _pdfSectionHeader(doc, margin, cy, cw, 'All 12 Months', acc);

  _pdfRRect(doc, margin, cy, cw, 8, 2, PDF_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(acc[0], acc[1], acc[2]);
  doc.text('MONTH',    margin + 10,         cy + 5.5);
  doc.text('BOOKINGS', margin + cw * 0.50,  cy + 5.5);
  doc.text('PAX',      margin + cw * 0.65,  cy + 5.5);
  doc.text('REVENUE',  margin + cw - 3 - doc.getTextWidth('REVENUE'), cy + 5.5);
  cy += 10;

  d.byMonth.forEach(function(m, i) {
    if (cy > pageH - 15) { doc.addPage(); cy = 14; }
    var active = m.count > 0;
    var col = MC_HEX[i] || acc;

    if (i % 2 === 0) _pdfRRect(doc, margin, cy - 1, cw, 8, 1, [248,247,255]);

    doc.setFillColor(col[0], col[1], col[2]);
    doc.circle(margin + 4, cy + 3, 2, 'F');

    doc.setFont('helvetica', active ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(active ? PDF_DARK[0] : PDF_GREY[0], active ? PDF_DARK[1] : PDF_GREY[1], active ? PDF_DARK[2] : PDF_GREY[2]);
    doc.text(m.month, margin + 10, cy + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
    doc.text(m.count ? '' + m.count : '—', margin + cw * 0.50, cy + 5);
    doc.text(m.pax   ? '' + m.pax   : '—', margin + cw * 0.65, cy + 5);

    if (active) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
      var rv = _pdfPeso(m.revenue);
      doc.text(rv, margin + cw - 3 - doc.getTextWidth(rv), cy + 5);
    } else {
      doc.text('—', margin + cw - 3 - doc.getTextWidth('—'), cy + 5);
    }

    _pdfDivider(doc, margin, cy + 7, cw);
    cy += 9;
  });

  /* ════════════════════════════════
     PAGE 3 — GUESTS
  ════════════════════════════════ */
  doc.addPage();
  _pdfPageHeader(doc, '2026 Booking Analysis', 'Guest List (' + d.guests.length + ' guests)', acc, pageW);
  cy = 34;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(acc[0], acc[1], acc[2]);
  doc.text('GUESTS', margin, cy);
  cy += 5;

  cy = _pdfSectionHeader(doc, margin, cy, cw, 'All Guests — Alphabetical', acc);

  /* Guest table header */
  _pdfRRect(doc, margin, cy, cw, 8, 2, PDF_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(acc[0], acc[1], acc[2]);
  var gCols = [
    { label: 'GUEST / PHONE', x: margin + 3 },
    { label: 'TOUR',          x: margin + cw * 0.36 },
    { label: 'DATE',          x: margin + cw * 0.54 },
    { label: 'PAX',           x: margin + cw * 0.74 },
    { label: 'TOTAL / BAL',   x: margin + cw * 0.82 },
  ];
  gCols.forEach(function(c) { doc.text(c.label, c.x, cy + 5.5); });
  cy += 10;

  d.guests.forEach(function(g, idx) {
    if (cy > pageH - 18) { doc.addPage(); cy = 14; }

    var hasBal = g.balance > 0;
    var rowH   = hasBal ? 13 : 9;

    if (idx % 2 === 0) _pdfRRect(doc, margin, cy - 1, cw, rowH + 1, 1, [248,247,255]);

    /* name */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
    var nameStr = g.name.length > 22 ? g.name.slice(0,20) + '…' : g.name;
    doc.text(nameStr, gCols[0].x, cy + 4.5);

    /* phone */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
    doc.text(g.phone || '—', gCols[0].x, cy + 9);

    /* tour badge */
    var col = _hexToRgb(TOUR_COL_HEX[g.tourType] || '#9996b0');
    var tourStr = g.tourType.length > 11 ? g.tourType.slice(0,9) + '…' : g.tourType;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(tourStr, gCols[1].x, cy + 4.5);

    /* date */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
    var dateStr = (g.date || '—').length > 14 ? (g.date || '—').slice(0,12)+'…' : (g.date || '—');
    doc.text(dateStr, gCols[2].x, cy + 4.5);

    /* pax */
    doc.text('' + (g.pax || '—'), gCols[3].x, cy + 4.5);

    /* total */
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
    doc.text(_pdfPeso(g.total), gCols[4].x, cy + 4.5);

    /* balance */
    if (hasBal) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(PDF_RED[0], PDF_RED[1], PDF_RED[2]);
      doc.text('Bal: ' + _pdfPeso(g.balance), gCols[4].x, cy + 9);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
      doc.text('Paid', gCols[4].x, cy + 9);
    }

    _pdfDivider(doc, margin, cy + rowH, cw);
    cy += rowH + 2;
  });

  /* ── Summary totals box ── */
  if (cy > pageH - 30) { doc.addPage(); cy = 14; }
  cy += 4;
  _pdfRRect(doc, margin, cy, cw, 20, 4, PDF_LIGHT);
  doc.setFillColor(acc[0], acc[1], acc[2]);
  doc.rect(margin, cy, 3, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_DARK[0], PDF_DARK[1], PDF_DARK[2]);
  doc.text('Summary', margin + 7, cy + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_GREY[0], PDF_GREY[1], PDF_GREY[2]);
  doc.text('Total Guests: ' + d.guests.length, margin + 7, cy + 12);
  doc.text('Total Revenue: ' + _pdfPeso(d.totalRevenue), margin + 7, cy + 17);

  doc.setTextColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
  doc.text('Collected: ' + _pdfPeso(d.totalCollected), margin + cw * 0.5, cy + 12);
  doc.setTextColor(PDF_RED[0], PDF_RED[1], PDF_RED[2]);
  doc.text('Balance: ' + _pdfPeso(d.totalBalance), margin + cw * 0.5, cy + 17);

  /* ── Footers ── */
  var total = doc.getNumberOfPages();
  for (var p = 1; p <= total; p++) {
    doc.setPage(p);
    _pdfFooter(doc, p, total, pageW, pageH);
  }

  doc.save('2026_Booking_Analysis.pdf');
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function _hexToRgb(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
  var n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _to12hrPdf(t) {
  if (!t) return '';
  var parts = t.split(':');
  var h = parseInt(parts[0], 10);
  var m = parts[1] || '00';
  var suf = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + suf;
}