// backup.js — Automatic Local Backup System
// ══════════════════════════════════════════════════════════════════
//  Firebase is the PRIMARY database. This is backup only.
//
//  WHAT IT DOES:
//  ─────────────────────────────────────────────────────────────────
//  1. Every INSERT   → auto-downloads a JSON file for that booking
//                      AND updates the full backup in memory
//  2. Every DELETE   → removes that booking from memory (silent)
//  3. 💾 Backup btn  → downloads full db.json snapshot right now
//  4. Restore btn    → load a db.json to re-push missing bookings
//
//  STORAGE:
//  ─────────────────────────────────────────────────────────────────
//  • _backupStore (in-memory)  — always in sync with Firebase data
//  • localStorage 'vh_backup'  — persists across refreshes
//  • per-booking .json files   — auto-downloaded on every insert
//  • db.json (manual export)   — full snapshot on demand
// ══════════════════════════════════════════════════════════════════

const BACKUP_LS_KEY = 'vh_backup_v1';

/* ────────────────────────────────────────
   IN-MEMORY BACKUP STORE
──────────────────────────────────────── */
let _backupStore = { bookings: {} };

(function _initBackupStore() {
  try {
    const raw = localStorage.getItem(BACKUP_LS_KEY);
    if (raw) {
      _backupStore = JSON.parse(raw);
      console.log('📦 Backup: localStorage loaded —',
        Object.keys(_backupStore.bookings || {}).length, 'entries');
    }
  } catch(e) {
    console.warn('Backup: localStorage read error —', e.message);
    _backupStore = { bookings: {} };
  }
})();

function _persistBackup() {
  try {
    localStorage.setItem(BACKUP_LS_KEY, JSON.stringify(_backupStore));
  } catch(e) {
    console.warn('Backup: localStorage write error —', e.message);
  }
}

/* ────────────────────────────────────────
   SYNC full Bookings{} into backup store
   Called after Firebase loads on init
──────────────────────────────────────── */
function syncBackupFromBookings() {
  _backupStore.bookings = {};
  Object.values(Bookings).forEach(dayArr => {
    dayArr.forEach(b => {
      if (b.fbKey) {
        _backupStore.bookings[b.fbKey] = {
          fbKey:     b.fbKey,
          dateKey:   b.dateKey   || b.checkinDate || '',
          createdAt: b.createdAt || '',
          guest:     b.guest     || {},
          payment:   b.payment   || {},
          booking:   b.booking   || {},
          dayInfo:   b.dayInfo   || {},
        };
      }
    });
  });
  _persistBackup();
  console.log('📦 Backup synced —',
    Object.keys(_backupStore.bookings).length, 'bookings');
}

/* ────────────────────────────────────────
   HOOK: called by booking.js after INSERT
   → adds to backup store
   → auto-downloads individual booking JSON
──────────────────────────────────────── */
function backupOnInsert(fbKey, bookingJSON) {
  if (!fbKey || !bookingJSON) return;

  // Update backup store
  _backupStore.bookings[fbKey] = {
    fbKey,
    dateKey:   bookingJSON.dateKey   || bookingJSON.booking?.checkinDate || '',
    createdAt: bookingJSON.createdAt || new Date().toISOString(),
    guest:     bookingJSON.guest     || {},
    payment:   bookingJSON.payment   || {},
    booking:   bookingJSON.booking   || {},
    dayInfo:   bookingJSON.dayInfo   || {},
  };
  _persistBackup();

  // Build filename: booking_YYYYMMDD_guestname_key.json
  const guestName = (bookingJSON.guest?.name || 'booking')
    .replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = (bookingJSON.booking?.checkinDate || bookingJSON.dateKey || 'unknown')
    .replace(/-/g, '');
  const filename = `booking_${dateStr}_${guestName}_${fbKey.slice(-6)}.json`;

  _downloadJSON({ fbKey, ...bookingJSON }, filename);

  console.log('💾 Backup: saved', filename);
}

/* ────────────────────────────────────────
   HOOK: called by booking.js after DELETE
   → removes from backup store silently
   → no file download needed
──────────────────────────────────────── */
function backupOnDelete(fbKey) {
  if (!fbKey || !_backupStore.bookings[fbKey]) return;
  delete _backupStore.bookings[fbKey];
  _persistBackup();
  console.log('🗑 Backup: removed', fbKey,
    '— remaining:', Object.keys(_backupStore.bookings).length);
}

/* ────────────────────────────────────────
   EXPORT — download full db.json snapshot
   Triggered by 💾 Backup button in header
──────────────────────────────────────── */
function exportBackup() {
  syncBackupFromBookings(); // always rebuild from live data

  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  const count   = Object.keys(_backupStore.bookings).length;
  const fname   = `vh_backup_${dateStr}_${timeStr}_${count}bookings.json`;

  _downloadJSON(_backupStore, fname);
  showToast(`💾 Backup downloaded — ${count} booking${count !== 1 ? 's' : ''}`);
  console.log('⬇️ Full backup exported:', fname);
}

/* ────────────────────────────────────────
   RESTORE — load a backup .json file
   Accepts full db.json OR single booking JSON
──────────────────────────────────────── */
function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);

      // Support both full db.json and single booking file
      let entries = [];
      if (parsed.bookings && typeof parsed.bookings === 'object') {
        entries = Object.entries(parsed.bookings).map(([k, v]) => ({ ...v, fbKey: k }));
      } else if (parsed.guest || parsed.booking) {
        entries = [parsed];
      } else {
        throw new Error('Not a valid backup file — missing bookings or guest data.');
      }

      if (!entries.length) { showToast('⚠️ Backup file is empty.', 3000); return; }

      const msg = `Restore ${entries.length} booking${entries.length !== 1 ? 's' : ''} from "${file.name}"?\n\nOnly bookings missing from Firebase will be re-added. Existing ones won't be duplicated.`;
      if (!confirm(msg)) return;

      showToast('⏳ Restoring…', 60000);

      let added = 0, skipped = 0;
      const existingKeys = new Set(Object.values(Bookings).flat().map(b => b.fbKey));

      for (const entry of entries) {
        if (entry.fbKey && existingKeys.has(entry.fbKey)) {
          skipped++; continue;
        }
        const bJSON = {
          dateKey:   entry.dateKey   || entry.booking?.checkinDate || '',
          createdAt: entry.createdAt || new Date().toISOString(),
          guest:     entry.guest     || {},
          payment:   entry.payment   || {},
          booking:   entry.booking   || {},
          dayInfo:   entry.dayInfo   || {},
        };
        try {
          const newKey = await FB.insert(bJSON);
          backupOnInsert(newKey, bJSON);
          added++;
        } catch(err) {
          console.warn('Restore: insert failed —', err.message);
        }
      }

      await refreshFromFirebase();
      showToast(`✅ Restored — ${added} added, ${skipped} already existed`, 5000);
      console.log('📦 Restore done:', added, 'added,', skipped, 'skipped');

    } catch(err) {
      showToast('❌ Restore failed: ' + err.message, 6000);
      console.error('Restore error:', err);
    }
  };
  reader.readAsText(file);
}

/* ────────────────────────────────────────
   INTERNAL — trigger browser file download
──────────────────────────────────────── */
function _downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
