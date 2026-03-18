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
   * Speed improvements vs v1:
   *   • arrayBuffer() reads are batched in parallel (BATCH_SIZE at a time)
   *   • ZIP compression level 1 (fastest — PDFs are already compressed)
   *   • file.slice(0) forces a fresh File read, avoiding detached-buffer
   *     errors when the same File object was previously read by pdf-processor
   *   • Per-file error isolation — one bad file won't break the whole batch
   *
   * @param {File[]} files - original File objects
   * @param {Map<string, string>} renameMap
   * @param {Function} onProgress - (done, total, newName, remaining, timeStr) => void
   */
  async function downloadRenamed(files, renameMap, onProgress) {
    if (typeof JSZip === 'undefined') {
      alert('JSZip library not loaded. Please add the JSZip CDN script to index.html.');
      return;
    }

    const BATCH_SIZE = 6; // parallel reads per batch — conservative for large PDFs

    const zip    = new JSZip();
    const folder = zip.folder('PDF-Extractor-Rename-PDF-Result');

    // Build sorted entry list
    const entries = files
      .map(file => ({
        file,
        newName: renameMap.get(file.name) || file.name,
      }))
      .sort((a, b) => a.newName.localeCompare(b.newName));

    const total     = entries.length;
    let   done      = 0;
    let   skipped   = 0;
    const startTime = Date.now();

    // ── Parallel batched reads ────────────────────────────────────────────
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      // Use file.slice(0) to get a fresh Blob copy — avoids detached
      // ArrayBuffer errors when the File was previously read by pdf-processor.
      const reads = batch.map(({ file }) =>
        file.slice(0).arrayBuffer().catch(() => null)  // null = failed read
      );
      const buffers = await Promise.all(reads);

      batch.forEach(({ newName, file }, idx) => {
        const buf = buffers[idx];
        if (!buf || buf.byteLength === 0) {
          // Skip silently — file couldn't be read
          console.warn(`[Rename] Could not read "${file.name}" — skipped`);
          skipped++;
        } else {
          folder.file(newName, buf);
        }
        done++;
      });

      // Progress update after each batch
      if (onProgress) {
        const elapsed    = (Date.now() - startTime) / 1000;
        const avgPerFile = elapsed / Math.max(done - skipped, 1);
        const remaining  = total - done;
        const estSeconds = Math.ceil(avgPerFile * remaining);

        let timeStr = '';
        if (remaining > 0) {
          timeStr = estSeconds < 60
            ? `~${estSeconds}s remaining`
            : `~${Math.floor(estSeconds / 60)}m ${estSeconds % 60}s remaining`;
        }

        onProgress(done, total, batch[batch.length - 1].newName, remaining, timeStr);
      }
    }

    // ── Generate ZIP (level 1 = fastest; PDFs gain nothing from compression) ──
    if (onProgress) onProgress(done, total, '📦 Compressing ZIP…', 0, 'almost done…');

    const blob = await zip.generateAsync({
      type:               'blob',
      compression:        'DEFLATE',
      compressionOptions: { level: 1 },
    });

    // Download
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'PDF-Extractor-Rename-PDF-Result.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { buildRenameMap, downloadRenamed, sanitizeFilename };
})();
