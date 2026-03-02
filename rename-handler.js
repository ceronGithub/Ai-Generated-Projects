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
   * Download renamed PDF files.
   * Since browsers cannot actually rename files on disk,
   * we trigger a download for each file with the new name.
   *
   * @param {File[]} files - original File objects
   * @param {Map<string, string>} renameMap
   * @param {Function} onProgress - (done, total, newName) => void
   */
  async function downloadRenamed(files, renameMap, onProgress) {
    let done = 0;
    for (const file of files) {
      const newName = renameMap.get(file.name) || file.name;
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = newName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Small delay to avoid browser blocking multiple downloads
      await new Promise(r => setTimeout(r, 400));
      URL.revokeObjectURL(url);
      done++;
      if (onProgress) onProgress(done, files.length, newName);
    }
  }

  return { buildRenameMap, downloadRenamed, sanitizeFilename };
})();
