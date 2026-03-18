// =============================================
// session-store.js — localStorage session persistence
//
// Saves and restores:
//   - Last used mode
//   - Last keywords list
//   - Last results metadata (not blobs — those can't be serialised)
//   - File names from last session (for display only)
//
// Keys are namespaced under 'pdfx.' to avoid
// collisions with other apps.
//
// Public API:
//   SessionStore.saveMode(mode)
//   SessionStore.loadMode()        → string | null
//
//   SessionStore.saveKeywords(kws) → void
//   SessionStore.loadKeywords()    → string[]
//
//   SessionStore.saveFileNames(files) → void
//   SessionStore.loadFileNames()      → string[]
//
//   SessionStore.saveResultsMeta(results, mode) → void
//   SessionStore.loadResultsMeta()              → { mode, results } | null
//
//   SessionStore.clear() → void
// =============================================

const SessionStore = (() => {
  'use strict';

  const NS      = 'pdfx.';
  const MAX_KWS = 50;
  const MAX_RESULTS_META = 200;  // max result cards to remember

  function key(k) { return NS + k; }

  function trySet(k, value) {
    try { localStorage.setItem(k, JSON.stringify(value)); } catch (_) {}
  }

  function tryGet(k, fallback = null) {
    try {
      const raw = localStorage.getItem(k);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  // ── Mode ──────────────────────────────────────────────────────────────────

  function saveMode(mode) {
    trySet(key('mode'), mode);
  }

  function loadMode() {
    return tryGet(key('mode'), null);
  }

  // ── Keywords ──────────────────────────────────────────────────────────────

  function saveKeywords(kws) {
    trySet(key('keywords'), (kws || []).slice(0, MAX_KWS));
  }

  function loadKeywords() {
    return tryGet(key('keywords'), []);
  }

  // ── File names (for display only — blobs can't be persisted) ─────────────

  function saveFileNames(files) {
    trySet(key('fileNames'), (files || []).map(f => f.name).slice(0, 200));
  }

  function loadFileNames() {
    return tryGet(key('fileNames'), []);
  }

  // ── Results metadata ──────────────────────────────────────────────────────
  //
  // We don't store blobs — just enough to show the user what they last found.
  // Format depends on mode:
  //   keyword modes: [{ filename, page, keyword, contexts: string[] }]
  //   extract/table: [{ filename, page, label, value }]

  function saveResultsMeta(results, mode) {
    if (!results || !results.length) { trySet(key('resultsMeta'), null); return; }
    try {
      const slim = results.slice(0, MAX_RESULTS_META).map(r => ({
        filename: r.filename || r.file?.name || '',
        page:     r.page     || 1,
        keyword:  r.keyword  || '',
        contexts: (r.contexts || []).slice(0, 3),
        label:    r.label    || '',
        value:    r.value    || '',
      }));
      trySet(key('resultsMeta'), { mode, ts: Date.now(), results: slim });
    } catch (_) {}
  }

  function loadResultsMeta() {
    const data = tryGet(key('resultsMeta'), null);
    if (!data || !data.results?.length) return null;
    // Expire after 24 hours
    if (Date.now() - data.ts > 86400000) { trySet(key('resultsMeta'), null); return null; }
    return data;
  }

  // ── Split config persistence ──────────────────────────────────────────────

  function saveSplitConfig(config) {
    trySet(key('splitConfig'), config);
  }

  function loadSplitConfig() {
    return tryGet(key('splitConfig'), { mode: 'every', every: 1, ranges: '' });
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  function clear() {
    ['mode','keywords','fileNames','resultsMeta','splitConfig'].forEach(k_ => {
      try { localStorage.removeItem(key(k_)); } catch (_) {}
    });
  }

  // ── Session age ───────────────────────────────────────────────────────────

  function getSessionAge() {
    const data = tryGet(key('resultsMeta'), null);
    if (!data) return null;
    const ms      = Date.now() - data.ts;
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1)   return 'just now';
    if (minutes < 60)  return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)    return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return {
    saveMode, loadMode,
    saveKeywords, loadKeywords,
    saveFileNames, loadFileNames,
    saveResultsMeta, loadResultsMeta,
    saveSplitConfig, loadSplitConfig,
    getSessionAge,
    clear,
  };
})();
