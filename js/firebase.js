// firebase.js — Firebase Realtime Database connection logic
// ⛔ DO NOT EDIT for configuration — edit js/firebase-config.js instead.
// Uses REST API (no SDK needed, works from file://)

// ─────────────────────────────────────────────────────────────
//  Configuration is loaded from firebase-config.js (loaded first in index.html)
//  FIREBASE_CONFIG.databaseURL  — your Realtime DB URL
//  FIREBASE_CONFIG.bookingsPath — root node (default: /bookings)
// ─────────────────────────────────────────────────────────────

// Pull URL from config file, then allow localStorage override (set by config modal)
const FB_DATABASE_URL_DEFAULT = (
  (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.databaseURL)
    ? FIREBASE_CONFIG.databaseURL
    : ''
).replace(/\/+$/, '');

let FB_DATABASE_URL = (() => {
  const saved = localStorage.getItem('fb_database_url');
  // Only use saved URL if it was explicitly set by the user via the modal
  if (saved && saved !== FB_DATABASE_URL_DEFAULT) return saved.replace(/\/+$/, '');
  // Otherwise use config file value (clear any stale saved URL)
  localStorage.removeItem('fb_database_url');
  return FB_DATABASE_URL_DEFAULT;
})();

// Bookings path from config (default: /bookings)
const FB_PATH = (
  (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.bookingsPath)
    ? FIREBASE_CONFIG.bookingsPath
    : '/bookings'
);

/* ─────────────────────────────────────────
   FB — raw fetch() REST operations
   Firebase Realtime DB REST API:
     GET    /node.json          → read
     POST   /node.json          → push (auto-key)
     DELETE /node/key.json      → delete
───────────────────────────────────────── */
const FB = {

  async insert(data) {
    const res  = await fetch(FB_DATABASE_URL + FB_PATH + '.json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      const err = new Error(json.error || 'Insert failed ' + res.status);
      err.status = res.status;
      err.isPermission = (res.status === 401 || res.status === 403);
      throw err;
    }
    return json.name; // Firebase returns { name: "-auto_key" }
  },

  async fetchAll() {
    const res  = await fetch(FB_DATABASE_URL + FB_PATH + '.json', {
      method: 'GET',
    });
    const json = await res.json();
    if (!res.ok) {
      // Tag error type so caller can handle differently
      const err = new Error(json?.error || 'FetchAll failed ' + res.status);
      err.status = res.status;
      err.isPermission = (res.status === 401 || res.status === 403);
      throw err;
    }
    if (!json) return []; // null = empty db (rules OK, just no data)
    // Convert Firebase object { key: {...}, key: {...} } → flat array
    return Object.entries(json).map(([fbKey, val]) => ({ ...val, fbKey }));
  },

  async deleteByKey(fbKey) {
    const res = await fetch(FB_DATABASE_URL + FB_PATH + '/' + fbKey + '.json', {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json?.error || 'Delete failed ' + res.status);
    }
  },
};

/* ─────────────────────────────────────────
   DB STATUS INDICATOR
   States: 'connecting' | 'online' | 'offline'
───────────────────────────────────────── */
let _dbOnline    = false;
let _retryTimer  = null;
let _retryCount  = 0;
const RETRY_DELAYS = [5, 10, 20, 30, 60]; // seconds

function setDbStatus(state) {
  if (state === true)  state = 'online';
  if (state === false) state = 'offline';
  _dbOnline = (state === 'online');

  const pill = document.getElementById('dbStatus');
  const dot  = document.getElementById('dbStatusDot');
  const lbl  = document.getElementById('dbStatusLabel');
  if (!dot || !lbl) return;

  pill?.classList.remove('is-online', 'is-offline', 'is-connecting');
  dot.classList.remove('online', 'offline', 'connecting');

  if (state === 'online') {
    pill?.classList.add('is-online');
    dot.classList.add('online');
    lbl.innerHTML   = 'Firebase Connected';
    _retryCount     = 0;
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    // Hide the offline banner in the config modal if it's open
    const banner = document.getElementById('dbOfflineBanner');
    if (banner) banner.style.display = 'none';

  } else if (state === 'offline') {
    pill?.classList.add('is-offline');
    dot.classList.add('offline');
    lbl.innerHTML = 'Offline &nbsp;<button onclick="manualRetry()" style="font:700 10px/1 inherit;background:#e0b000;color:#fff;border:none;border-radius:20px;padding:2px 8px;cursor:pointer;margin-right:3px;">RETRY</button><button onclick="openDbConfigModal()" style="font:700 10px/1 inherit;background:#7c6af4;color:#fff;border:none;border-radius:20px;padding:2px 8px;cursor:pointer;">⚙️ FIX</button>';

  } else {
    pill?.classList.add('is-connecting');
    dot.classList.add('connecting');
    lbl.innerHTML = 'Connecting…';
  }
}

/* ─────────────────────────────────────────
   AUTO-RETRY with countdown
───────────────────────────────────────── */
function scheduleRetry() {
  if (_retryTimer) return;
  const delaySec = RETRY_DELAYS[Math.min(_retryCount, RETRY_DELAYS.length - 1)];
  _retryCount++;
  console.log('🔄 Firebase retry #' + _retryCount + ' in ' + delaySec + 's…');

  let remaining = delaySec;
  const tick = setInterval(() => {
    remaining--;
    const lbl = document.getElementById('dbStatusLabel');
    if (lbl && !_dbOnline) {
      lbl.innerHTML = 'Offline — retry in ' + remaining + 's &nbsp;<button onclick="manualRetry()" style="font:700 10px/1 inherit;background:#e0b000;color:#fff;border:none;border-radius:20px;padding:2px 8px;cursor:pointer;">NOW</button>';
    }
    if (remaining <= 0) clearInterval(tick);
  }, 1000);

  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    clearInterval(tick);
    if (!_dbOnline) await initFirebase();
  }, delaySec * 1000);
}

async function manualRetry() {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  _retryCount = 0;
  await initFirebase();
  if (_dbOnline) {
    applyBookingIndicators();
    await flushSyncQueue();
  }
}

/* ─────────────────────────────────────────
   FLATTEN Firebase row → booking object
───────────────────────────────────────── */

/* -----------------------------------------
   HELPER - normalise any time to "HH:MM" 24-hr
----------------------------------------- */
function _fbNormTime(t) {
  if (!t || typeof t !== 'string') return t || '';
  t = t.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
    const parts = t.split(':');
    return parts[0].padStart(2,'0') + ':' + parts[1];
  }
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const isPM = m[3].toUpperCase() === 'PM';
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return String(h).padStart(2,'0') + ':' + min;
  }
  return t;
}

function flattenRow(row) {
  const b = row.booking  || {};
  const g = row.guest    || {};
  const p = row.payment  || {};
  return {
    fbKey:    row.fbKey,
    id:       row.fbKey,
    dateKey:  row.dateKey  || b.checkinDate || '',
    createdAt: row.createdAt || '',
    guest:    g,
    payment:  p,
    booking:  b,
    dayInfo:  row.dayInfo || { type: 'weekday', icon: '📅', label: '' },
    // flat aliases for summary card
    guestName:        g.name        || '',
    guestEmail:       g.email       || '',
    guestPhone:       g.phone       || '',
    pax:              g.pax         || 0,
    extraPax:         g.extraPax    || 0,
    totalPax:         g.totalPax    || 0,
    pets:             g.pets        || 0,
    paymentDate:      p.date        || '',
    paymentMode:      p.mode        || '',
    total:            p.total       || 0,
    downpayment:      p.downpayment || 0,
    balance:          p.balance     || 0,
    tourType:         b.tourType    || '',
    checkinDate:      b.checkinDate  || '',
    checkoutDate:     b.checkoutDate || '',
    checkinDateLabel: b.checkinDateLabel  || '',
    checkoutDateLabel:b.checkoutDateLabel || '',
    checkinTime:      _fbNormTime(b.checkinTime  || ''),
    checkoutTime:     _fbNormTime(b.checkoutTime || ''),
  };
}

/* ─────────────────────────────────────────
   INIT — fetch all bookings → fill Bookings{}
───────────────────────────────────────── */
async function initFirebase() {
  // Apply any runtime URL override (from modal), else use hardcoded default
  // Always strip trailing slash to prevent HTTP 400 errors
  const savedUrl = localStorage.getItem('fb_database_url');
  FB_DATABASE_URL = (savedUrl || FB_DATABASE_URL_DEFAULT).replace(/\/+$/, '');

  setDbStatus('connecting');

  // Guard: check config is set
  if (FB_DATABASE_URL.includes('YOUR_PROJECT_ID')) {
    setDbStatus('offline');
    console.warn('⚠️ Firebase not configured. Edit firebase.js and set FB_DATABASE_URL.');
    document.getElementById('dbStatusLabel').innerHTML =
      '⚠️ Firebase not configured — <a href="#" onclick="alert(\'Edit js/firebase.js and set your FB_DATABASE_URL\')" style="color:inherit;font-weight:900;">see setup</a>';
    return;
  }

  try {
    const rows = await FB.fetchAll();

    // Only replace local data if Firebase actually returned records
    // This prevents wiping localStorage cache when connected to an empty/new database
    if (rows.length > 0) {
      Object.keys(Bookings).forEach(k => delete Bookings[k]);
      rows.forEach(row => {
        const flat = flattenRow(row);
        const key  = flat.dateKey;
        if (!key) return;
        if (!Bookings[key]) Bookings[key] = [];
        Bookings[key].push(flat);
      });
      saveBookingsLocal(Bookings);
      console.log('✅ Firebase connected — ' + rows.length + ' booking(s) loaded.');
    } else {
      console.warn('⚠️ Firebase connected but returned 0 records — keeping local cache. Database may be empty or path may be wrong.');
    }
    setDbStatus('online');

  } catch (e) {
    setDbStatus('offline');
    console.error('❌ Firebase error:', e.message, 'status:', e.status, 'perm:', e.isPermission);

    if (e.isPermission) {
      // 401/403 = rules expired or blocked
      // _retryCount hasn't been incremented yet for this attempt — use it as the attempt counter
      const attempt = _retryCount + 1; // what attempt number this is (1-based)

      // Update status pill with helpful message
      const lbl = document.getElementById('dbStatusLabel');
      if (lbl) {
        var retryMsg = attempt < 3
          ? 'Rules blocked (attempt ' + attempt + '/3) &nbsp;'
          : 'Rules expired — ';
        lbl.innerHTML = retryMsg +
          '<button onclick="manualRetry()" style="font:700 10px/1 inherit;background:#e0b000;color:#fff;border:none;border-radius:20px;padding:2px 8px;cursor:pointer;margin-right:3px;">RETRY</button>' +
          '<button onclick="openDbConfigModal()" style="font:700 10px/1 inherit;background:#e04060;color:#fff;border:none;border-radius:20px;padding:2px 8px;cursor:pointer;">⚙️ FIX</button>';
      }

      if (attempt <= 3) {
        // Retry up to 3 times automatically — rules may just be propagating
        console.warn('🔄 Permission error — retry attempt ' + attempt + '/3');
        scheduleRetry(); // this increments _retryCount
      } else {
        // 3 retries exhausted — open config modal on Rules tab automatically
        console.warn('⚠️ Rules still blocked after 3 retries — opening Fix Rules modal');
        setTimeout(function() { openDbConfigModal(); }, 800);
      }

    } else {
      // Network / URL error
      scheduleRetry();
      // Open config modal only on very first failure
      if (_retryCount <= 1) {
        setTimeout(function() { openDbConfigModal(); }, 1400);
      }
    }
  }
}

/* ─────────────────────────────────────────
   REFRESH — re-fetch then re-render
───────────────────────────────────────── */
async function refreshFromFirebase() {
  await initFirebase();
  renderAllMonths();
  applyBookingIndicators();
}


/* ═══════════════════════════════════════════════════
   DB CONFIG MODAL
   Shows when Firebase is offline — lets user update
   the database URL and view rules + help guide.
═══════════════════════════════════════════════════ */

let _configModalOpen = false;

function openDbConfigModal() {
  if (_configModalOpen) return;
  _configModalOpen = true;

  // Inject modal HTML if not already present
  if (!document.getElementById('dbConfigOverlay')) {
    document.body.insertAdjacentHTML('beforeend', `
<div id="dbConfigOverlay" style="
  position:fixed;inset:0;z-index:9000;
  background:rgba(15,15,35,0.60);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  display:flex;align-items:center;justify-content:center;padding:20px;
  opacity:0;transition:opacity 0.3s ease;pointer-events:none;">

  <div id="dbConfigModal" style="
    background:#fff;border-radius:24px;
    box-shadow:0 32px 100px rgba(0,0,0,0.25);
    width:560px;max-width:100%;max-height:90vh;
    display:flex;flex-direction:column;overflow:hidden;
    transform:translateY(28px) scale(0.95);
    transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);">

    <!-- Header -->
    <div style="padding:24px 28px 0;flex-shrink:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">🔥</span>
          <h2 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1a1a2e;">Firebase Setup</h2>
        </div>
        <button onclick="closeDbConfigModal()" style="
          width:34px;height:34px;border-radius:50%;background:#f5f5f8;
          font-size:20px;color:#9996b0;display:flex;align-items:center;justify-content:center;
          transition:all 0.15s ease;border:none;cursor:pointer;"
          onmouseover="this.style.background='#ffe0e6';this.style.color='#e04060'"
          onmouseout="this.style.background='#f5f5f8';this.style.color='#9996b0'">×</button>
      </div>
      <p id="dbOfflineBanner" style="font-size:12px;color:#e04060;font-weight:700;background:#fff0f3;padding:8px 12px;border-radius:8px;margin-bottom:16px;display:none;">
        ⚠️ Firebase is offline — update your database URL to reconnect.
      </p>

      <!-- No tabs — URL only -->
    </div>

    <!-- Body (scrollable) -->
    <div style="flex:1;overflow-y:auto;padding:24px 28px;">

      <!-- TAB: URL -->
      <div id="dbPane_url">
        <label style="font-size:11px;font-weight:700;color:#555570;letter-spacing:0.5px;display:block;margin-bottom:6px;">
          DATABASE URL <span style="color:#ff6b8a">*</span>
        </label>
        <input id="dbUrlInput" type="text"
          value=""
          placeholder="https://your-project-default-rtdb.firebaseio.com"
          style="width:100%;padding:11px 14px;border:1.5px solid rgba(0,0,0,0.10);
            border-radius:10px;font-size:13px;font-weight:600;color:#1a1a2e;
            background:#fafafa;font-family:'Nunito',sans-serif;
            transition:border-color 0.18s,box-shadow 0.18s;outline:none;"
          onfocus="this.style.borderColor='#7c6af4';this.style.boxShadow='0 0 0 3px rgba(124,106,244,0.12)'"
          onblur="this.style.borderColor='rgba(0,0,0,0.10)';this.style.boxShadow='none'"/>
        <p style="font-size:11px;color:#9996b0;margin-top:8px;line-height:1.6;">
          Found in Firebase Console → <b>Realtime Database → Data tab</b> — shown at the very top.<br>
          Format: <code style="background:#f0eeff;padding:1px 5px;border-radius:4px;color:#7c6af4;">https://your-project-rtdb.region.firebasedatabase.app</code>
        </p>
        <div style="margin-top:10px;padding:10px 12px;background:#f0fff4;border:1.5px solid #b8f0ce;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span style="font-size:11px;color:#2a9a5a;font-weight:700;">✅ Current URL: <span id="currentUrlDisplay" style="font-weight:600;color:#1a1a2e;word-break:break-all;"></span></span>
          <button onclick="clearSavedUrl()" style="padding:4px 10px;background:#fff0f3;color:#e04060;border:1.5px solid #ffd6df;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">🗑 Clear</button>
        </div>
        <div id="dbUrlStatus" style="margin-top:10px;min-height:20px;font-size:12px;font-weight:700;"></div>
      </div>


    </div>

    <!-- Footer -->
    <div style="padding:16px 28px 22px;border-top:1px solid rgba(0,0,0,0.07);flex-shrink:0;display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="closeDbConfigModal()" style="
        padding:10px 20px;border-radius:12px;font-family:'Nunito',sans-serif;
        font-size:13px;font-weight:700;color:#9996b0;background:#f5f5f8;border:none;cursor:pointer;">
        Close
      </button>
      <button onclick="saveDbConfig()" id="dbConfigSaveBtn" style="
        padding:10px 24px;border-radius:12px;font-family:'Nunito',sans-serif;
        font-size:13px;font-weight:700;color:#fff;border:none;cursor:pointer;
        background:linear-gradient(135deg,#7c6af4,#29b5e8);
        box-shadow:0 4px 16px rgba(124,106,244,0.30);">
        Save &amp; Reconnect
      </button>
    </div>

  </div>
</div>`);
  }

  // Animate in
  const overlay = document.getElementById('dbConfigOverlay');
  const modal   = document.getElementById('dbConfigModal');
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.transform = 'translateY(0) scale(1)';
  });

  // Show offline banner only when actually offline
  const banner = document.getElementById('dbOfflineBanner');
  if (banner) banner.style.display = _dbOnline ? 'none' : 'block';

  // Close on backdrop click
  overlay.onclick = e => { if (e.target === overlay) closeDbConfigModal(); };

  switchDbTab('url');
}

function closeDbConfigModal() {
  _configModalOpen = false;
  const overlay = document.getElementById('dbConfigOverlay');
  const modal   = document.getElementById('dbConfigModal');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  if (modal) modal.style.transform = 'translateY(28px) scale(0.95)';
}

function switchDbTab(tab) {
  // Only URL tab remains
  const el = document.getElementById('currentUrlDisplay');
  if (el) {
    el.textContent = FB_DATABASE_URL || '—';
    el.style.filter = 'blur(5px)';
    el.style.userSelect = 'none';
    el.style.cursor = 'default';
    el.title = '';
    el.onclick = null;
  }
  const input = document.getElementById('dbUrlInput');
  if (input) input.value = ''; // always empty for security
}

function clearSavedUrl() {
  localStorage.removeItem('fb_database_url');
  FB_DATABASE_URL = FB_DATABASE_URL_DEFAULT;
  const input  = document.getElementById('dbUrlInput');
  const el     = document.getElementById('currentUrlDisplay');
  const status = document.getElementById('dbUrlStatus');
  if (input) input.value = ''; // always empty for security
  if (el) {
    el.textContent = FB_DATABASE_URL_DEFAULT || '—';
    el.style.filter = 'blur(5px)';
    el.style.userSelect = 'none';
    el.style.cursor = 'default';
    el.onclick = null;
  }
  if (status) status.innerHTML = '<span style="color:#3cb771;">✅ Cleared — using URL from firebase-config.js.</span>';
  setTimeout(() => { if (status) status.innerHTML = ''; }, 3000);
}

function copyRules() {
  const text = document.getElementById('rulesCode').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopyRecommended');
    btn.textContent = 'COPIED ✓';
    btn.style.background = '#3cb771';
    setTimeout(() => { btn.textContent = 'COPY'; btn.style.background = '#7c6af4'; }, 2000);
  });
}

function copyCurrentRules() {
  const text = document.getElementById('rulesEditor').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopyCurrent');
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.style.background = '#3cb771'; btn.style.color = '#fff';
    btn.style.borderColor = '#3cb771';
    try { localStorage.setItem('fb_rules_backup', text); } catch(e) {}
    if (typeof refreshNewsTicker === 'function') refreshNewsTicker();
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.background = '#f0eeff'; btn.style.color = '#7c6af4';
      btn.style.borderColor = '#d0caff';
    }, 2000);
  });
}

function resetToSafeRules() {
  const saved = localStorage.getItem('fb_rules_backup');
  if (saved) {
    document.getElementById('rulesEditor').value = saved;
    document.getElementById('rulesEditorStatus').innerHTML =
      '<span style="color:#29b5e8;">↺ Restored from last saved version.</span>';
  } else {
    document.getElementById('rulesEditor').value = `{
  "rules": {
    ".read": "now < 1775232000000",
    ".write": "now < 1775232000000"
  }
}`;
    document.getElementById('rulesEditorStatus').innerHTML =
      '<span style="color:#9996b0;">↺ Reset to original time-limited rules.</span>';
  }
  setTimeout(() => { document.getElementById('rulesEditorStatus').innerHTML = ''; }, 3000);
}

function useRecommendedRules() {
  document.getElementById('rulesEditor').value = `{
  "rules": {
    ".read": true,
    ".write": true
  }
}`;
  document.getElementById('rulesEditorStatus').innerHTML =
    '<span style="color:#29b5e8;">↑ Recommended rules loaded — click Apply to save.</span>';
  // Scroll to top of pane so user sees the editor
}

function applyRulesToFirebase() {
  // Rules cannot be applied remotely without admin auth.
  // This function copies the rules and guides the user to paste in Firebase Console.
  copyCurrentRules();
  const status = document.getElementById('rulesEditorStatus');
  if (status) {
    status.innerHTML = '<span style="color:#3cb771;">📋 Copied! Now go to <a href="https://console.firebase.google.com/project/victoriashaven-93136/database/victoriashaven-93136-default-rtdb/rules" target="_blank" style="color:#7c6af4;font-weight:700;">Firebase Console → Rules ↗</a> — paste and click <b>Publish</b>.</span>';
  }
}

async function saveDbConfig() {
  const input  = document.getElementById('dbUrlInput');
  const status = document.getElementById('dbUrlStatus');
  const btn    = document.getElementById('dbConfigSaveBtn');

  // Clean URL — strip trailing slash(es)
  let url = input.value.trim().replace(/\/+$/, '');
  input.value = url; // show cleaned value

  if (!url) {
    input.style.borderColor = '#ff6b8a';
    status.innerHTML = '<span style="color:#ff6b8a;">⚠️ Please enter a URL.</span>';
    return;
  }
  if (!url.startsWith('https://')) {
    input.style.borderColor = '#ff6b8a';
    status.innerHTML = '<span style="color:#ff6b8a;">⚠️ URL must start with https://</span>';
    return;
  }

  btn.textContent = 'Testing…';
  btn.style.opacity = '0.7';
  btn.disabled = true;
  status.innerHTML = '<span style="color:#9090a8;">🔄 Testing connection…</span>';

  try {
    // Test by hitting root .json — always works even if DB is empty (returns null)
    const res = await fetch(url + '/.json?shallow=true', { method: 'GET' });

    if (res.ok) {
      FB_DATABASE_URL = url;
      localStorage.setItem('fb_database_url', url);

      input.style.borderColor = '#3cb771';
      status.innerHTML = '<span style="color:#3cb771;">✅ Connected! Saving and reconnecting…</span>';
      btn.textContent = '✅ Connected!';
      btn.style.background = '#3cb771';

      // Hide the offline banner immediately — we're connected
      const banner = document.getElementById('dbOfflineBanner');
      if (banner) banner.style.display = 'none';

      setTimeout(async () => {
        input.value = ''; // clear field after save
        closeDbConfigModal();
        await initFirebase();
        if (_dbOnline) {
          applyBookingIndicators();
          showToast('🔥 Firebase connected!');
        }
        btn.textContent = 'Save & Reconnect';
        btn.style.background = 'linear-gradient(135deg,#7c6af4,#29b5e8)';
        btn.disabled = false;
        btn.style.opacity = '1';
      }, 900);

    } else {
      // 401/403 = rules blocking, but URL is valid
      if (res.status === 401 || res.status === 403) {
        FB_DATABASE_URL = url;
        localStorage.setItem('fb_database_url', url);
        input.style.borderColor = '#ff8c42';
        status.innerHTML = '<span style="color:#ff8c42;">⚠️ URL valid but access denied (HTTP ' + res.status + '). Check your Firebase Rules — set .read/.write to <b>true</b> and Publish.</span>';
        btn.textContent = 'Save & Reconnect';
        btn.style.opacity = '1';
        btn.disabled = false;
        // Still save and try — rules may allow /bookings even if root is blocked
        setTimeout(async () => {
          closeDbConfigModal();
          await initFirebase();
          if (_dbOnline) applyBookingIndicators();
        }, 2000);
      } else {
        throw new Error('HTTP ' + res.status + ' — double-check the URL is exactly as shown in Firebase Console');
      }
    }
  } catch (e) {
    input.style.borderColor = '#ff6b8a';
    status.innerHTML = '<span style="color:#ff6b8a;">❌ ' + e.message + '</span>';
    btn.textContent = 'Save & Reconnect';
    btn.style.opacity = '1';
    btn.disabled = false;
  }
}

/* ── Rules editor: validate JSON on keypress ── */
function validateRulesEditor() {
  const ta  = document.getElementById('rulesEditor');
  const msg = document.getElementById('rulesEditorStatus');
  if (!ta || !msg) return;
  try {
    JSON.parse(ta.value);
    msg.innerHTML = '<span style="color:#3cb771;">✅ Valid JSON</span>';
    ta.style.borderColor = '#2e2e4e';
  } catch (e) {
    msg.innerHTML = '<span style="color:#ff6b8a;">❌ ' + e.message + '</span>';
    ta.style.borderColor = '#ff6b8a';
  }
}

/* ── Rules editor: quick-insert templates ── */
function insertRulesTemplate(type) {
  const templates = {
    open:   '{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}',
    timed:  '{\n  "rules": {\n    ".read": "now < 1775232000000",\n    ".write": "now < 1775232000000"\n  }\n}',
    locked: '{\n  "rules": {\n    ".read": false,\n    ".write": false\n  }\n}',
  };
  const ta = document.getElementById('rulesEditor');
  if (ta && templates[type]) {
    ta.value = templates[type];
    validateRulesEditor();
    ta.focus();
  }
}