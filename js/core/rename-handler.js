// =============================================
// rename-handler.js — Rename PDFs based on
// captured text from single keyword search
// =============================================

const RenameHandler = (() => {

  /**
   * Given search results for a single keyword,
   * prepare a rename map: { originalName -> newName }
   * Uses first captured text snippet, sanitized as a filename.
   *
   * @param {Array<{page, filename, keyword, contexts}>} results
   * @returns {Map<string, string>} originalName → newName
   */
  function buildRenameMap(results) {
    const map = new Map();
    const seen = new Map(); // to avoid duplicate names

    // Group by filename, take first result per file
    const byFile = {};
    for (const r of results) {
      if (!byFile[r.filename]) {
        byFile[r.filename] = r;
      }
    }

    for (const [original, r] of Object.entries(byFile)) {
      const rawText = r.contexts[0] || '';
      let newBase = sanitizeFilename(rawText);
      if (!newBase) newBase = 'extracted';

      // Truncate to 60 chars
      newBase = newBase.slice(0, 60).trim();

      // Avoid duplicates
      const ext = original.slice(original.lastIndexOf('.'));
      let candidate = newBase + ext;
      let counter = 1;
      while (seen.has(candidate.toLowerCase())) {
        candidate = newBase + `_${counter}` + ext;
        counter++;
      }
      seen.set(candidate.toLowerCase(), true);
      map.set(original, candidate);
    }

    return map;
  }

  /**
   * Sanitize text to be a valid filename.
   */
  function sanitizeFilename(text) {
    return text
      .replace(/[^\w\s\-().]/g, '')   // remove invalid chars
      .replace(/\s+/g, '_')           // spaces to underscores
      .replace(/^[_.]+/, '')          // remove leading dots/underscores
      .replace(/[_.]+$/, '')          // remove trailing
      || 'unnamed';
  }

  /**
   * Package all renamed PDFs into a single ZIP file.
   * Files are sorted A→Z by their new name before zipping.
   * ZIP folder name: PDF-Extractor-Rename-PDF-Result
   *
   * @param {File[]} files - original File objects
   * @param {Map<string, string>} renameMap
   * @param {Function} onProgress - (done, total, newName) => void
   */
  async function downloadRenamed(files, renameMap, onProgress) {
    if (typeof JSZip === 'undefined') {
      alert('JSZip library not loaded. Please add the JSZip CDN script to index.html.');
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder('PDF-Extractor-Rename-PDF-Result');

    // Build list of { file, newName } sorted A→Z by newName
    const entries = files
      .map(file => ({
        file,
        newName: renameMap.get(file.name) || file.name
      }))
      .sort((a, b) => a.newName.localeCompare(b.newName));

    const total = entries.length;
    let done = 0;
    const startTime = Date.now();

    for (const { file, newName } of entries) {
      const arrayBuffer = await file.arrayBuffer();
      folder.file(newName, arrayBuffer);
      done++;

      // ── Time estimate ─────────────────────────────
      const elapsed   = (Date.now() - startTime) / 1000;       // seconds so far
      const avgPerFile = elapsed / done;                        // avg seconds per file
      const remaining  = total - done;                          // files left
      const estSeconds = Math.ceil(avgPerFile * remaining);     // estimated wait

      // Format time string: show seconds under 1 min, else "Xm Ys"
      let timeStr = '';
      if (remaining === 0) {
        timeStr = '';
      } else if (estSeconds < 60) {
        timeStr = `~${estSeconds}s remaining`;
      } else {
        const m = Math.floor(estSeconds / 60);
        const s = estSeconds % 60;
        timeStr = `~${m}m ${s}s remaining`;
      }

      if (onProgress) onProgress(done, total, newName, remaining, timeStr);
    }

    // Generate ZIP — this can take a moment for large files
    if (onProgress) onProgress(done, total, '📦 Compressing ZIP…', 0, 'almost done…');
    const blob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PDF-Extractor-Rename-PDF-Result.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { buildRenameMap, downloadRenamed, sanitizeFilename };
})();
