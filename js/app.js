// app.js — entry point

function renderTodayBadge() {
  const t   = AppState.today;
  const el  = document.getElementById('todayBadge');
  const dow = DAY_NAMES[t.getDay()];
  const mon = MONTH_NAMES[t.getMonth()].slice(0, 3);
  el.textContent = `Today — ${dow}, ${mon} ${t.getDate()}, ${t.getFullYear()}`;
}

// Wrap refreshMonth so booking indicators re-apply after a card rebuild
const _origRefreshMonth = refreshMonth;
function refreshMonth(month) {
  _origRefreshMonth(month);
  const grid = document.getElementById('yearGrid');
  if (!grid) return;
  const card = grid.querySelectorAll('.month-card')[month];
  if (!card) return;
  card.querySelectorAll('.day-cell:not(.other-month)').forEach(cell => {
    const numEl = cell.querySelector('.day-num');
    if (!numEl) return;
    const day = parseInt(numEl.textContent);
    const key = toKey(AppState.year, month, day);
    if (Bookings[key] && Bookings[key].length > 0) {
      cell.classList.add('has-booking');
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   SILENT BACKGROUND SYNC — every 60 seconds
   Re-fetches Firebase data without disrupting the UI.
   Detects new/deleted records added directly to the database.
══════════════════════════════════════════════════════════════ */
const BG_SYNC_INTERVAL_MS = 60 * 1000; // 1 minute
let   _bgSyncTimer = null;

async function _backgroundSync() {
  // Skip if Firebase is not connected yet or a modal is open
  if (!_dbOnline) return;
  const anyModalOpen =
    document.getElementById('bookingOverlay')?.classList.contains('open') ||
    document.getElementById('bkListOverlay')?.classList.contains('open')  ||
    document.getElementById('bkViewOverlay')?.classList.contains('open');
  if (anyModalOpen) return;

  try {
    // Snapshot current booking count for change detection
    const countBefore = Object.values(Bookings).reduce((s, a) => s + a.length, 0);

    await initFirebase();

    const countAfter  = Object.values(Bookings).reduce((s, a) => s + a.length, 0);

    // Only re-render if data actually changed
    if (countAfter !== countBefore) {
      renderAllMonths();
      applyBookingIndicators();
      syncBackupFromBookings();
      console.log(`🔄 Background sync: ${countBefore} → ${countAfter} bookings`);
    }
  } catch (e) {
    console.warn('Background sync error:', e.message);
  }
}

function startBackgroundSync() {
  if (_bgSyncTimer) clearInterval(_bgSyncTimer);
  _bgSyncTimer = setInterval(_backgroundSync, BG_SYNC_INTERVAL_MS);
  console.log('⏱ Background sync started — every 1 minute');
}

function init() {
  // Step 1 — render calendar instantly, never await anything
  renderTodayBadge();
  renderAllMonths();
  setupModalListeners();
  setupBookingListeners();
  initNewsTicker(); // 📰 start rules expiry ticker

  // Step 2 — connect Firebase in background, never blocks UI
  initFirebase().then(async () => {
    applyBookingIndicators();
    // 💾 Sync localStorage backup with live Firebase data
    syncBackupFromBookings();
    // Auto-sync any bookings that were saved while offline
    await flushSyncQueue();
    // ⏱ Start silent 1-minute background sync
    startBackgroundSync();
  }).catch(e => {
    console.warn('Firebase background init failed:', e.message);
  });
}

document.addEventListener('DOMContentLoaded', init);