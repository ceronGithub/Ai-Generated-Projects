// firebase.js — Firebase Realtime Database integration
// Uses REST API (no SDK needed, works from file://)

// ─────────────────────────────────────────────────
//  🔴 PASTE YOUR FIREBASE CONFIG VALUES HERE
// ─────────────────────────────────────────────────
const FB_DATABASE_URL_DEFAULT = 'https://victorias-haven-book-record-default-rtdb.asia-southeast1.firebasedatabase.app';
// Allow runtime override from localStorage (set by config modal)
let FB_DATABASE_URL = localStorage.getItem('fb_database_url') || FB_DATABASE_URL_DEFAULT;
// ^ e.g. 'https://my-calendar-app-default-rtdb.firebaseio.com'
// Get this from: Firebase Console → Project Settings → General → Your apps → databaseURL
// ─────────────────────────────────────────────────

const FB_PATH = '/bookings';   // root node in Realtime DB

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
    if (!res.ok || json.error) throw new Error(json.error || 'Insert failed ' + res.status);
    return json.name; // Firebase returns { name: "-auto_key" }
  },

  async fetchAll() {
    const res  = await fetch(FB_DATABASE_URL + FB_PATH + '.json', {
      method: 'GET',
    });
    const json = await res.json();
    if (!res.ok || json?.error) throw new Error(json?.error || 'FetchAll failed ' + res.status);
    if (!json) return []; // null = empty db
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
  if (_dbOnline) applyBookingIndicators();
}

/* ─────────────────────────────────────────
   FLATTEN Firebase row → booking object
───────────────────────────────────────── */
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
    checkinTime:      b.checkinTime  || '',
    checkoutTime:     b.checkoutTime || '',
  };
}

/* ─────────────────────────────────────────
   INIT — fetch all bookings → fill Bookings{}
───────────────────────────────────────── */
async function initFirebase() {
  // Apply any runtime URL override from modal
  const savedUrl = localStorage.getItem('fb_database_url');
  if (savedUrl) FB_DATABASE_URL = savedUrl;

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

    Object.keys(Bookings).forEach(k => delete Bookings[k]);
    rows.forEach(row => {
      const flat = flattenRow(row);
      const key  = flat.dateKey;
      if (!key) return;
      if (!Bookings[key]) Bookings[key] = [];
      Bookings[key].push(flat);
    });

    saveBookingsLocal(Bookings);
    setDbStatus('online');
    console.log('✅ Firebase connected — ' + rows.length + ' booking(s) loaded.');

  } catch (e) {
    setDbStatus('offline');
    console.error('❌ Firebase error:', e.message);
    scheduleRetry();
    // Auto-open config modal on first failure so user can fix it
    if (_retryCount <= 1) {
      setTimeout(() => openDbConfigModal(), 1200);
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
      <p style="font-size:12px;color:#e04060;font-weight:700;background:#fff0f3;padding:8px 12px;border-radius:8px;margin-bottom:16px;">
        ⚠️ Firebase is offline — update your database URL to reconnect.
      </p>

      <!-- Tabs -->
      <div style="display:flex;gap:0;border-bottom:2px solid #f0eeff;margin-bottom:0;">
        <button id="dbTab_url" onclick="switchDbTab('url')" style="
          padding:10px 20px;font-size:12px;font-weight:700;letter-spacing:0.5px;
          border:none;cursor:pointer;background:none;color:#7c6af4;
          border-bottom:2px solid #7c6af4;margin-bottom:-2px;transition:all 0.15s;">
          🔗 Database URL
        </button>
        <button id="dbTab_rules" onclick="switchDbTab('rules')" style="
          padding:10px 20px;font-size:12px;font-weight:700;letter-spacing:0.5px;
          border:none;cursor:pointer;background:none;color:#9996b0;
          border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.15s;">
          🔒 Rules
        </button>
        <button id="dbTab_help" onclick="switchDbTab('help')" style="
          padding:10px 20px;font-size:12px;font-weight:700;letter-spacing:0.5px;
          border:none;cursor:pointer;background:none;color:#9996b0;
          border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.15s;">
          ❓ Help
        </button>
      </div>
    </div>

    <!-- Body (scrollable) -->
    <div style="flex:1;overflow-y:auto;padding:24px 28px;">

      <!-- TAB: URL -->
      <div id="dbPane_url">
        <label style="font-size:11px;font-weight:700;color:#555570;letter-spacing:0.5px;display:block;margin-bottom:6px;">
          DATABASE URL <span style="color:#ff6b8a">*</span>
        </label>
        <input id="dbUrlInput" type="text"
          value="${typeof FB_DATABASE_URL !== 'undefined' ? FB_DATABASE_URL : ''}"
          placeholder="https://your-project-default-rtdb.firebaseio.com"
          style="width:100%;padding:11px 14px;border:1.5px solid rgba(0,0,0,0.10);
            border-radius:10px;font-size:13px;font-weight:600;color:#1a1a2e;
            background:#fafafa;font-family:'Nunito',sans-serif;
            transition:border-color 0.18s,box-shadow 0.18s;outline:none;"
          onfocus="this.style.borderColor='#7c6af4';this.style.boxShadow='0 0 0 3px rgba(124,106,244,0.12)'"
          onblur="this.style.borderColor='rgba(0,0,0,0.10)';this.style.boxShadow='none'"/>
        <p style="font-size:11px;color:#9996b0;margin-top:8px;line-height:1.6;">
          Found in Firebase Console → <b>Realtime Database</b> — shown at the top of the Data tab.<br>
          Format: <code style="background:#f0eeff;padding:1px 5px;border-radius:4px;color:#7c6af4;">https://your-project-rtdb.region.firebasedatabase.app</code>
        </p>
        <div id="dbUrlStatus" style="margin-top:10px;min-height:20px;font-size:12px;font-weight:700;"></div>
      </div>

      <!-- TAB: Rules -->
      <div id="dbPane_rules" style="display:none;">
        <p style="font-size:12px;color:#555570;margin-bottom:14px;line-height:1.6;">
          Your Firebase Realtime Database rules must allow <b>read & write</b> access.<br>
          Go to <b>Firebase Console → Realtime Database → Rules</b> and set:
        </p>
        <div style="background:#1a1a2e;border-radius:12px;padding:16px 18px;position:relative;">
          <button onclick="copyRules()" style="
            position:absolute;top:10px;right:10px;padding:4px 12px;
            background:#7c6af4;color:#fff;border:none;border-radius:6px;
            font-size:11px;font-weight:700;cursor:pointer;">COPY</button>
          <pre id="rulesCode" style="color:#aef;font-size:12px;font-family:monospace;white-space:pre-wrap;margin:0;">{
  "rules": {
    ".read": true,
    ".write": true
  }
}</pre>
        </div>
        <p style="font-size:11px;color:#e04060;margin-top:12px;font-weight:600;">
          ⚠️ Test mode only — restrict rules before going to production.
        </p>
        <div style="margin-top:16px;background:#fffbe0;border:1.5px solid #ffe066;border-radius:10px;padding:12px 14px;">
          <p style="font-size:11px;color:#9a7800;font-weight:700;margin-bottom:4px;">Your current rules (time-limited):</p>
          <pre style="font-size:11px;color:#555570;font-family:monospace;white-space:pre-wrap;margin:0;">{
  "rules": {
    ".read": "now &lt; 1775232000000",
    ".write": "now &lt; 1775232000000"
  }
}</pre>
          <p style="font-size:11px;color:#9a7800;margin-top:6px;">⏰ Expires: <b>April 4, 2026</b> — update to <code>true</code> before then.</p>
        </div>
      </div>

      <!-- TAB: Help -->
      <div id="dbPane_help" style="display:none;">
        <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:16px;">Step-by-step: Get your Firebase Database URL</p>
        ${[
          ['1', '🌐', 'Go to Firebase Console', 'Open <a href="https://console.firebase.google.com" target="_blank" style="color:#7c6af4;font-weight:700;">console.firebase.google.com</a> and sign in with your Google account.'],
          ['2', '📁', 'Open your project', 'Click on <b>Victorias-Haven-Book-Record</b> from your project list.'],
          ['3', '🗄️', 'Click Realtime Database', 'In the left sidebar under <b>Build</b>, click <b>Realtime Database</b>.'],
          ['4', '➕', 'Create database (if needed)', 'If not created yet, click <b>"Create database"</b> → choose region <b>asia-southeast1</b> → select <b>"Start in test mode"</b> → click <b>Enable</b>.'],
          ['5', '🔗', 'Copy the database URL', 'At the top of the Data tab you will see a URL like:<br><code style="background:#f0eeff;padding:2px 6px;border-radius:4px;color:#7c6af4;font-size:11px;">https://your-project-rtdb.asia-southeast1.firebasedatabase.app</code><br>Copy that URL.'],
          ['6', '📋', 'Paste URL above', 'Come back here, click the <b>🔗 Database URL</b> tab, paste the URL and click <b>Save & Reconnect</b>.'],
          ['7', '🔒', 'Set Rules', 'Go to the <b>Rules</b> tab in Firebase Console, paste the rules shown in the <b>🔒 Rules</b> tab here, then click <b>Publish</b>.'],
        ].map(([num, icon, title, desc]) => `
        <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7c6af4,#29b5e8);
            color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
            ${num}
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">${icon} ${title}</div>
            <div style="font-size:12px;color:#555570;line-height:1.6;">${desc}</div>
          </div>
        </div>`).join('')}
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
  ['url','rules','help'].forEach(t => {
    const pane = document.getElementById('dbPane_' + t);
    const btn  = document.getElementById('dbTab_'  + t);
    if (!pane || !btn) return;
    const active = t === tab;
    pane.style.display    = active ? '' : 'none';
    btn.style.color       = active ? '#7c6af4' : '#9996b0';
    btn.style.borderBottom = active ? '2px solid #7c6af4' : '2px solid transparent';
  });
}

function copyRules() {
  const text = document.getElementById('rulesCode').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    btn.textContent = 'COPIED ✓';
    btn.style.background = '#3cb771';
    setTimeout(() => { btn.textContent = 'COPY'; btn.style.background = '#7c6af4'; }, 2000);
  });
}

async function saveDbConfig() {
  const input  = document.getElementById('dbUrlInput');
  const status = document.getElementById('dbUrlStatus');
  const btn    = document.getElementById('dbConfigSaveBtn');
  const url    = input.value.trim();

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

  // Test the URL
  btn.textContent = 'Testing…';
  btn.style.opacity = '0.7';
  status.innerHTML = '<span style="color:#9090a8;">🔄 Testing connection…</span>';

  try {
    const res = await fetch(url + '/bookings.json?limitToFirst=1', { method: 'GET' });
    if (res.ok || res.status === 200) {
      // Update runtime URL
      window._FB_DATABASE_URL_OVERRIDE = url;
      status.innerHTML = '<span style="color:#3cb771;">✅ Connection successful!</span>';
      btn.textContent = 'Save & Reconnect';
      btn.style.opacity = '1';
      input.style.borderColor = '#3cb771';

      // Persist to localStorage so it survives page reload
      localStorage.setItem('fb_database_url', url);

      setTimeout(async () => {
        closeDbConfigModal();
        await initFirebase();
        if (_dbOnline) applyBookingIndicators();
      }, 800);
    } else {
      throw new Error('HTTP ' + res.status);
    }
  } catch (e) {
    status.innerHTML = `<span style="color:#ff6b8a;">❌ Could not connect: ${e.message}. Check URL and Rules.</span>`;
    btn.textContent = 'Save & Reconnect';
    btn.style.opacity = '1';
    input.style.borderColor = '#ff6b8a';
  }
}