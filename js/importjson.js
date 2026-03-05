// importjson.js — Import JSON & Preview on Web App
// ══════════════════════════════════════════════════════════════════
//  Reads any booking JSON file, flattens every entry into readable
//  summary cards, previews them in the Import modal, then lets the
//  user push selected bookings to Firebase.
//
//  ACCEPTED FORMATS:
//  ─────────────────────────────────────────────────────────────────
//  1. Single booking object  { guest:{}, booking:{}, payment:{} }
//  2. Full db.json           { bookings: { key: {...}, ... } }
//  3. Array of bookings      [ {...}, {...}, ... ]
//  4. Flat legacy booking    { guestName, checkinDate, total, ... }
// ══════════════════════════════════════════════════════════════════

/* ────────────────────────────────────────
   STATE
──────────────────────────────────────── */
let _importEntries   = [];   // flattened array of bookings to preview
let _importFilename  = '';   // original filename
let _importSelected  = new Set(); // indices user has checked for push

/* ────────────────────────────────────────
   OPEN / CLOSE
──────────────────────────────────────── */
function openImportModal() {
  const overlay = document.getElementById('importOverlay');
  const modal   = document.getElementById('importModal');
  _resetImportState();
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => {
    overlay.style.opacity   = '1';
    modal.style.transform   = 'translateY(0) scale(1)';
  });
  overlay.onclick = e => { if (e.target === overlay) closeImportModal(); };
  document.addEventListener('keydown', _importEscHandler);
}

function closeImportModal() {
  const overlay = document.getElementById('importOverlay');
  const modal   = document.getElementById('importModal');
  overlay.style.opacity      = '0';
  overlay.style.pointerEvents = 'none';
  modal.style.transform      = 'translateY(20px) scale(0.96)';
  document.removeEventListener('keydown', _importEscHandler);
  setTimeout(_resetImportState, 300);
}

function _importEscHandler(e) {
  if (e.key === 'Escape') closeImportModal();
}

function _resetImportState() {
  _importEntries  = [];
  _importFilename = '';
  _importSelected.clear();
  // Reset UI
  const dz   = document.getElementById('importDropZone');
  const prev = document.getElementById('importPreview');
  const sub  = document.getElementById('importSubtitle');
  const info = document.getElementById('importFooterInfo');
  const push = document.getElementById('importPushBtn');
  const load = document.getElementById('importLoadAnother');
  if (dz)   { dz.style.display   = ''; }
  if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
  if (sub)  sub.textContent = 'Load a booking file or full db.json backup to preview and import';
  if (info) info.textContent = '';
  if (push) push.style.display = 'none';
  if (load) load.style.display = 'none';
}

/* ────────────────────────────────────────
   FILE INPUT HANDLERS
──────────────────────────────────────── */
function handleImportFile(file) {
  _importFilename = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      _importEntries = _flattenImport(parsed);
      if (!_importEntries.length) {
        _showImportError('No bookings found in this file.');
        return;
      }
      _renderImportPreview();
    } catch(err) {
      _showImportError('Invalid JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function handleImportDrop(event) {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.name.endsWith('.json')) {
    _showImportError('Only .json files are supported.');
    return;
  }
  handleImportFile(file);
}

/* ────────────────────────────────────────
   FLATTEN — normalise any JSON shape
   Returns array of flat booking objects
──────────────────────────────────────── */
function _flattenImport(parsed) {
  let entries = [];

  // Format 1: full db.json  { bookings: { key: {...} } }
  if (parsed && parsed.bookings && typeof parsed.bookings === 'object') {
    entries = Object.entries(parsed.bookings).map(([fbKey, val]) => ({
      ...val, fbKey
    }));
  }
  // Format 2: array of bookings
  else if (Array.isArray(parsed)) {
    entries = parsed;
  }
  // Format 3: single booking object
  else if (parsed && typeof parsed === 'object') {
    entries = [parsed];
  }

  // Normalise each entry to a consistent flat shape
  return entries.map((raw, i) => _normaliseEntry(raw, i)).filter(Boolean);
}

function _normaliseEntry(raw, idx) {
  if (!raw || typeof raw !== 'object') return null;

  // Nested structure (firebase.js / backup.js shape)
  const g = raw.guest   || {};
  const b = raw.booking || {};
  const p = raw.payment || {};

  // Flat legacy shape fallback
  const flat = {
    _idx:      idx,
    fbKey:     raw.fbKey     || raw._localKey || null,
    dateKey:   raw.dateKey   || b.checkinDate || raw.checkinDate || raw.checkin_date || '',
    createdAt: raw.createdAt || raw.created_at || '',

    // Guest
    guestName:  g.name     || raw.guestName  || raw.guest_name  || '—',
    guestEmail: g.email    || raw.guestEmail || raw.guest_email || '—',
    guestPhone: g.phone    || raw.guestPhone || raw.guest_phone || '—',
    pax:        g.pax      || raw.pax        || 0,
    extraPax:   g.extraPax || raw.extraPax   || raw.extra_pax   || 0,
    totalPax:   g.totalPax || raw.totalPax   || raw.total_pax   || 0,
    pets:       g.pets     || raw.pets       || 0,

    // Booking
    tourType:          b.tourType          || raw.tourType     || raw.tour_type    || '—',
    checkinDate:       b.checkinDate       || raw.checkinDate  || raw.checkin_date || '',
    checkoutDate:      b.checkoutDate      || raw.checkoutDate || raw.checkout_date|| '',
    checkinDateLabel:  b.checkinDateLabel  || raw.checkinDateLabel  || '',
    checkoutDateLabel: b.checkoutDateLabel || raw.checkoutDateLabel || '',
    checkinTime:       b.checkinTime       || raw.checkinTime  || raw.checkin_time || '',
    checkoutTime:      b.checkoutTime      || raw.checkoutTime || raw.checkout_time|| '',

    // Payment
    total:       p.total       ?? raw.total       ?? 0,
    downpayment: p.downpayment ?? raw.downpayment ?? raw.down_payment ?? 0,
    balance:     p.balance     ?? raw.balance     ?? 0,
    paymentMode: p.mode        || raw.paymentMode || raw.payment_mode || '—',
    paymentDate: p.date        || raw.paymentDate || raw.payment_date || '',

    // Keep originals for Firebase push
    _raw: raw,
  };

  // Compute balance if missing
  if (!flat.balance && flat.total && flat.downpayment) {
    flat.balance = flat.total - flat.downpayment;
  }
  // Compute totalPax if missing
  if (!flat.totalPax && (flat.pax || flat.extraPax)) {
    flat.totalPax = (flat.pax || 0) + (flat.extraPax || 0);
  }

  return flat;
}

/* ────────────────────────────────────────
   RENDER PREVIEW
──────────────────────────────────────── */
function _renderImportPreview() {
  const dz   = document.getElementById('importDropZone');
  const prev = document.getElementById('importPreview');
  const sub  = document.getElementById('importSubtitle');
  const info = document.getElementById('importFooterInfo');
  const push = document.getElementById('importPushBtn');
  const load = document.getElementById('importLoadAnother');

  dz.style.display   = 'none';
  prev.style.display = 'flex';
  prev.innerHTML     = '';
  sub.textContent    = `"${_importFilename}" — ${_importEntries.length} booking${_importEntries.length !== 1 ? 's' : ''} found`;

  // Select-all bar
  _importSelected = new Set(_importEntries.map((_, i) => i)); // select all by default
  const selBar = document.createElement('div');
  selBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f3f0ff;border-radius:12px;';
  selBar.innerHTML = `
    <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#7c6af4;cursor:pointer;">
      <input type="checkbox" id="importSelectAll" checked style="width:15px;height:15px;accent-color:#7c6af4;cursor:pointer;">
      Select All
    </label>
    <span id="importSelCount" style="font-size:12px;font-weight:700;color:#7c6af4;">
      ${_importEntries.length} selected
    </span>`;
  prev.appendChild(selBar);
  document.getElementById('importSelectAll').addEventListener('change', e => {
    const boxes = document.querySelectorAll('.import-entry-check');
    boxes.forEach((cb, i) => {
      cb.checked = e.target.checked;
      e.target.checked ? _importSelected.add(i) : _importSelected.delete(i);
    });
    _updateImportSelCount();
  });

  // Summary stats bar
  const totalRev = _importEntries.reduce((s, e) => s + (Number(e.total) || 0), 0);
  const statsBar = document.createElement('div');
  statsBar.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';
  [
    ['📋', 'Bookings', _importEntries.length],
    ['👥', 'Total Pax', _importEntries.reduce((s,e)=>s+(Number(e.totalPax||e.pax)||0),0)],
    ['💰', 'Total Revenue', '₱' + Number(totalRev).toLocaleString('en-PH',{minimumFractionDigits:2})],
  ].forEach(([icon, label, val]) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:1.5px solid rgba(0,0,0,0.06);border-radius:12px;padding:12px 14px;text-align:center;';
    card.innerHTML = `<div style="font-size:18px;margin-bottom:4px;">${icon}</div>
      <div style="font-size:15px;font-weight:800;color:#1a1a2e;">${val}</div>
      <div style="font-size:10px;font-weight:700;color:#9996b0;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">${label}</div>`;
    statsBar.appendChild(card);
  });
  prev.appendChild(statsBar);

  // Divider
  const div = document.createElement('div');
  div.style.cssText = 'font-size:11px;font-weight:800;color:#9996b0;letter-spacing:1px;text-transform:uppercase;padding:4px 0 2px;';
  div.textContent = `All Bookings (${_importEntries.length})`;
  prev.appendChild(div);

  // Cards
  _importEntries.forEach((entry, i) => {
    prev.appendChild(_buildImportCard(entry, i));
  });

  // Footer
  info.textContent = `${_importEntries.length} booking${_importEntries.length !== 1 ? 's' : ''} ready to import`;
  push.style.display = 'inline-flex';
  load.style.display = 'inline-flex';
  _updateImportSelCount();
}

/* ────────────────────────────────────────
   BUILD IMPORT PREVIEW CARD
──────────────────────────────────────── */
function _buildImportCard(e, i) {
  // Detect if already in Firebase
  const alreadyExists = e.fbKey &&
    Object.values(Bookings).flat().some(b => b.fbKey === e.fbKey);

  // Tour color
  const tourColors = {
    'Day Tour':       { accent:'#29b5e8', light:'#b0e4f8', tint:'#f0faff' },
    'Night Tour':     { accent:'#7c6af4', light:'#d0caff', tint:'#f3f0ff' },
    'Overnight Tour': { accent:'#ff9900', light:'#ffdfa0', tint:'#fff8f0' },
    'Over Night':     { accent:'#ff9900', light:'#ffdfa0', tint:'#fff8f0' },
  };
  const color = tourColors[e.tourType] || { accent:'#9996b0', light:'#e0e0ee', tint:'#f8f8fc' };

  const card = document.createElement('div');
  card.style.cssText = `
    background:${alreadyExists ? '#f5f5f8' : '#fff'};
    border:1.5px solid ${alreadyExists ? '#ddd' : color.light};
    border-left:4px solid ${alreadyExists ? '#ccc' : color.accent};
    border-radius:14px;padding:16px 18px;
    display:flex;flex-direction:column;gap:10px;position:relative;
    opacity:${alreadyExists ? '0.65' : '1'};
    transition:box-shadow 0.15s,transform 0.15s;`;
  if (!alreadyExists) {
    card.onmouseenter = () => { card.style.boxShadow='0 4px 18px rgba(0,0,0,0.08)'; card.style.transform='translateY(-1px)'; };
    card.onmouseleave = () => { card.style.boxShadow=''; card.style.transform=''; };
  }

  // Header row: checkbox + name + badge
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;gap:10px;';

  const cb = document.createElement('input');
  cb.type      = 'checkbox';
  cb.className = 'import-entry-check';
  cb.checked   = !alreadyExists;
  cb.disabled  = alreadyExists;
  cb.dataset.idx = i;
  cb.style.cssText = 'width:16px;height:16px;flex-shrink:0;accent-color:' + color.accent + ';cursor:pointer;';
  if (!alreadyExists) _importSelected.add(i); else _importSelected.delete(i);
  cb.addEventListener('change', () => {
    cb.checked ? _importSelected.add(i) : _importSelected.delete(i);
    _updateImportSelCount();
  });

  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-size:15px;font-weight:700;color:#1a1a2e;flex:1;';
  nameEl.textContent = e.guestName;

  const badge = document.createElement('span');
  badge.style.cssText = `font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;
    color:#fff;background:${color.accent};letter-spacing:0.5px;flex-shrink:0;`;
  badge.textContent = e.tourType;

  if (alreadyExists) {
    const existBadge = document.createElement('span');
    existBadge.style.cssText = 'font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:#e0e0ee;color:#9996b0;flex-shrink:0;';
    existBadge.textContent = '✓ In Firebase';
    hdr.append(cb, nameEl, badge, existBadge);
  } else {
    hdr.append(cb, nameEl, badge);
  }
  card.appendChild(hdr);

  // Info grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;';

  const fields = [
    ['📧', 'Email',     e.guestEmail],
    ['📞', 'Phone',     e.guestPhone],
    ['📅', 'Check-in',  e.checkinDateLabel  || e.checkinDate  || '—'],
    ['📅', 'Check-out', e.checkoutDateLabel || e.checkoutDate || '—'],
    ['👥', 'Guests',    `${e.totalPax || e.pax || 0} Pax${e.pets ? ' · 🐾 ' + e.pets : ''}`],
    ['🕐', 'Time',      e.checkinTime && e.checkoutTime ? `${_to12hr(e.checkinTime)} → ${_to12hr(e.checkoutTime)}` : '—'],
    ['💰', 'Total',     '₱' + Number(e.total).toLocaleString('en-PH',{minimumFractionDigits:2})],
    ['💳', 'Downpay',  '₱' + Number(e.downpayment).toLocaleString('en-PH',{minimumFractionDigits:2})],
    ['⚖️', 'Balance',   '₱' + Number(e.balance).toLocaleString('en-PH',{minimumFractionDigits:2})],
    ['💳', 'Pay Mode',  e.paymentMode || '—'],
  ];

  fields.forEach(([icon, label, val]) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    cell.innerHTML = `
      <span style="font-size:9px;font-weight:700;color:#9996b0;letter-spacing:0.5px;text-transform:uppercase;">${icon} ${label}</span>
      <span style="font-size:12px;font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${val}</span>`;
    grid.appendChild(cell);
  });

  // fbKey row full-width
  if (e.fbKey) {
    const keyRow = document.createElement('div');
    keyRow.style.cssText = 'grid-column:1/-1;';
    keyRow.innerHTML = `<span style="font-size:9px;font-weight:700;color:#9996b0;letter-spacing:0.5px;text-transform:uppercase;">🔗 Firebase Key</span>
      <div style="font-size:11px;font-weight:600;color:#7c6af4;word-break:break-all;">${e.fbKey}</div>`;
    grid.appendChild(keyRow);
  }

  card.appendChild(grid);
  return card;
}

/* ────────────────────────────────────────
   UPDATE SELECTION COUNT IN FOOTER
──────────────────────────────────────── */
function _updateImportSelCount() {
  const sel  = document.getElementById('importSelCount');
  const push = document.getElementById('importPushBtn');
  const info = document.getElementById('importFooterInfo');
  const n    = _importSelected.size;
  if (sel)  sel.textContent  = n + ' selected';
  if (push) push.style.display = n > 0 ? 'inline-flex' : 'none';
  if (info) info.textContent = n > 0
    ? `${n} booking${n !== 1 ? 's' : ''} will be pushed to Firebase`
    : 'Select at least one booking to import';
}

/* ────────────────────────────────────────
   PUSH SELECTED TO FIREBASE
──────────────────────────────────────── */
async function pushImportToFirebase() {
  if (!_importSelected.size) {
    showToast('⚠️ No bookings selected.', 3000);
    return;
  }

  const btn = document.getElementById('importPushBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Pushing…';

  let added = 0, skipped = 0, failed = 0;
  const existingKeys = new Set(Object.values(Bookings).flat().map(b => b.fbKey));

  for (const i of _importSelected) {
    const entry = _importEntries[i];
    if (!entry) continue;

    // Skip duplicates by fbKey
    if (entry.fbKey && existingKeys.has(entry.fbKey)) {
      skipped++; continue;
    }

    // Rebuild proper bookingJSON from raw or normalised fields
    const raw = entry._raw || {};
    const bJSON = {
      dateKey:   entry.dateKey || entry.checkinDate || '',
      createdAt: entry.createdAt || new Date().toISOString(),
      guest: raw.guest || {
        name:     entry.guestName,
        email:    entry.guestEmail,
        phone:    entry.guestPhone,
        pax:      entry.pax,
        extraPax: entry.extraPax,
        totalPax: entry.totalPax,
        pets:     entry.pets,
      },
      payment: raw.payment || {
        total:       entry.total,
        downpayment: entry.downpayment,
        balance:     entry.balance,
        mode:        entry.paymentMode,
        date:        entry.paymentDate,
      },
      booking: raw.booking || {
        tourType:          entry.tourType,
        checkinDate:       entry.checkinDate,
        checkoutDate:      entry.checkoutDate,
        checkinDateLabel:  entry.checkinDateLabel,
        checkoutDateLabel: entry.checkoutDateLabel,
        checkinTime:       entry.checkinTime,
        checkoutTime:      entry.checkoutTime,
      },
      dayInfo: raw.dayInfo || {},
    };

    try {
      const newKey = await FB.insert(bJSON);
      backupOnInsert(newKey, bJSON);
      added++;
    } catch(err) {
      console.error('Import push failed:', err.message);
      failed++;
    }
  }

  // Refresh calendar
  await refreshFromFirebase();
  applyBookingIndicators();

  btn.disabled = false;
  btn.textContent = '☁️ Push to Firebase';

  const msg = [
    added   ? `✅ ${added} imported`   : null,
    skipped ? `⏭ ${skipped} skipped`  : null,
    failed  ? `❌ ${failed} failed`    : null,
  ].filter(Boolean).join(' · ');

  showToast(msg, 5000);
  closeImportModal();
}

/* ────────────────────────────────────────
   SHOW IMPORT ERROR
──────────────────────────────────────── */
function _showImportError(msg) {
  const dz = document.getElementById('importDropZone');
  dz.style.borderColor = '#ff6b8a';
  dz.style.background  = '#fff0f3';
  dz.innerHTML = `
    <div style="font-size:36px;">❌</div>
    <div style="font-size:14px;font-weight:700;color:#e04060;">${msg}</div>
    <div style="font-size:12px;color:#9996b0;margin-top:4px;">Click to try another file</div>`;
  dz.onclick = () => {
    dz.style.borderColor = '#d0caff';
    dz.style.background  = '#f8f7ff';
    dz.innerHTML = `
      <div style="font-size:44px;line-height:1;">📂</div>
      <div style="font-size:15px;font-weight:700;color:#7c6af4;">Drop your JSON file here</div>
      <div style="font-size:12px;color:#9996b0;font-weight:600;">or click to browse</div>
      <div style="font-size:11px;color:#b0b0c8;margin-top:4px;">Supports: single booking · db.json · array</div>`;
    dz.onclick = () => document.getElementById('importFileInput').click();
    document.getElementById('importFileInput').click();
  };
}

/* ────────────────────────────────────────
   UTIL — 24hr → 12hr time string
──────────────────────────────────────── */
function _to12hr(t) {
  if (!t) return '—';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m   = mStr || '00';
  const suf = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${suf}`;
}
