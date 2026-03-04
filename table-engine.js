// =============================================
// table-engine.js — Spatial table detection,
// silent grid reconstruction, and structured
// text injection for PDF.js itemMaps.
//
// ALGORITHM (all work is internal / hidden from user):
//
//  DETECT
//    Scan each page's itemMap (words with x, screenY coordinates).
//    A TABLE HEADER row satisfies ALL of:
//      • ≥ 3 distinct column clusters spread across ≥ 250 px
//      • Contains ONLY label-like tokens (short alpha/punct words)
//      • Contains NO data tokens: dates (dd/mm/yyyy), times (H:MM:SS),
//        reference codes (LETTERS+8digits), amounts (5,000.00), or
//        standalone ":" separators
//      • The very next row aligns at least 2 words to these columns
//
//    Column boundaries use an asymmetric tolerance:
//      xStart − 5px  …  next_col_xStart − 1px
//    This ensures a word at x=60.8 with col boundary at x=61.8
//    (a real 1-px PDF rendering offset) lands in the correct column.
//
//  REBUILD (internal silent 2-D grid, never shown to user)
//    Logical rows are separated by detecting the leftmost-column
//    "Ref No." / "IER No." anchor, or by y-gap > MAX_ROW_GAP.
//    For complex tables (>30% sparsely-filled data rows) an extra
//    centroid-snap re-alignment pass tightens column assignment.
//
//  READ — 4 passes over the grid
//    Pass A  top → bottom (1st)   — walk rows, for each row walk columns
//    Pass B  top → bottom (2nd)   — same order, duplicates filtered
//    Pass C  left → right (1st)   — walk columns, for each column walk rows
//    Pass D  left → right (2nd)   — same order, duplicates filtered
//
//    Each pass emits  "ColName : cellValue"  tokens.
//    After all 4 passes, per-row "ColName : val | ColName : val …"
//    strings are assembled into the final structured text block.
//
//  INJECT
//    The table's y-extent is replaced in the page text by the
//    structured block.  Non-table regions are kept verbatim.
//    KeywordHandler.search() receives the enriched text unchanged.
// =============================================

const TableEngine = (() => {
  'use strict';

  // ── Tuning constants ─────────────────────────────────────────────────────────
  const Y_TOL        =  4;     // px — items within this y-distance share a row
  const MIN_COLS     =  3;     // minimum distinct column clusters for a header
  const MIN_SPAN     =  250;   // px — minimum horizontal span of a header row
  const MERGE_GAP    =  8;     // px — gap ≤ this merges adjacent header words into one column name
  const COL_L_TOL    =  5;     // px — left tolerance on column xStart
  const MAX_ROW_GAP  =  50;    // px — larger y-gap ends the table body
  const COMPLEX_RATE =  0.30;  // fraction of sparse data rows that marks a table "complex"

  // ── Data-pattern filter ──────────────────────────────────────────────────────
  // Tokens matching these patterns belong to DATA rows, not HEADER rows.
  const DATA_PAT = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{1,2}:\d{2}(:\d{2})?(\s*[AaPp][Mm])?$|^[A-Za-z]{2,}[0-9]{7,}$|^\d[\d,\.]{3,}$|^Php$/i;

  function isDataToken(str) {
    return DATA_PAT.test(str.trim());
  }

  // Noise tokens emitted inside table rows (row-total labels) — skip during grid fill
  const NOISE_TOKENS = new Set(['Total', 'Php']);

  // ── Row grouping ─────────────────────────────────────────────────────────────

  /**
   * Group itemMap entries into screenY buckets (rows).
   * Returns a Map<number, item[]> sorted ascending screenY (top of page first).
   * Within each bucket items are sorted left-to-right by x.
   */
  function groupRows(itemMap) {
    const buckets = new Map();

    for (const item of itemMap) {
      if (!item.str || !item.str.trim()) continue;
      let key = null;
      for (const [k] of buckets) {
        if (Math.abs(k - item.screenY) <= Y_TOL) { key = k; break; }
      }
      if (key === null) key = item.screenY;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }

    return new Map(
      [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([y, items]) => [y, items.sort((a, b) => a.x - b.x)])
    );
  }

  // ── Column building ───────────────────────────────────────────────────────────

  /**
   * Merge header-row items that are <= MERGE_GAP px apart into single column names.
   * Example: "E-SI" (x1=138) + "No." (x0=140) gap=2px -> merged "E-SI No."
   *          "TransNo." (x1=47) + "Date" (x0=62) gap=15px -> separate columns
   */
  function mergeHeaderWords(rowItems) {
    const out = [];
    let   cur = null;

    for (const item of rowItems) {
      const x1 = item.x + (item.width > 0 ? item.width : item.str.length * 5.5);
      if (!cur) {
        cur = { text: item.str, x0: item.x, x1 };
      } else if (item.x - cur.x1 <= MERGE_GAP) {
        cur.text += ' ' + item.str;
        cur.x1    = Math.max(cur.x1, x1);
      } else {
        out.push(cur);
        cur = { text: item.str, x0: item.x, x1 };
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  /**
   * Build column boundary objects from merged header clusters.
   * Asymmetric tolerance: xStart = cluster.x0 - COL_L_TOL, xEnd = nextCluster.x0 - 1
   * This ensures words 1-5px left of a boundary still land in the correct column.
   */
  function buildCols(merged, pageWidth) {
    return merged.map((m, i) => ({
      name:   m.text,
      xStart: m.x0 - COL_L_TOL,
      xEnd:   i + 1 < merged.length
                ? merged[i + 1].x0 - 1
                : (pageWidth || 612),
    }));
  }

  /** Return column index for a given x, or -1 if no match. */
  function colIdx(x, cols) {
    for (let i = 0; i < cols.length; i++) {
      if (x >= cols[i].xStart && x < cols[i].xEnd) return i;
    }
    return -1;
  }

  /** True when at least 2 items in rowItems align to cols. */
  function alignsWithCols(rowItems, cols) {
    if (!rowItems || rowItems.length === 0) return false;
    let hits = 0;
    for (const item of rowItems) {
      if (colIdx(item.x, cols) !== -1) hits++;
    }
    return hits >= Math.min(2, rowItems.length);
  }

  // ── Table detection ───────────────────────────────────────────────────────────

  /**
   * Find all table header rows on a page.
   * Returns [{headerY, cols, headerRowItems}] sorted by headerY (ascending).
   */
  function detectTableHeaders(rowMap, pageWidth) {
    const headers = [];
    const ys      = [...rowMap.keys()];

    for (let i = 0; i < ys.length; i++) {
      const y   = ys[i];
      const row = rowMap.get(y);

      if (row.length < MIN_COLS) continue;

      const span = (row[row.length - 1].x + (row[row.length - 1].width || 0)) - row[0].x;
      if (span < MIN_SPAN) continue;

      // Reject if any token looks like data (date, time, code, amount)
      if (row.some(item => isDataToken(item.str))) continue;

      // Require at least MIN_COLS short alpha/punct words (column label words)
      const labelWords = row.filter(item =>
        /^[A-Za-z#\.\-]+$/.test(item.str) && item.str.length <= 14
      );
      if (labelWords.length < MIN_COLS) continue;

      // Build candidate columns
      const merged = mergeHeaderWords(row);
      if (merged.length < MIN_COLS) continue;
      const cols = buildCols(merged, pageWidth);

      // Confirm: the very next row must align to these columns
      const nextRow = ys[i + 1] !== undefined ? rowMap.get(ys[i + 1]) : null;
      if (!alignsWithCols(nextRow, cols)) continue;

      headers.push({ headerY: y, cols, headerRowItems: row });
    }

    return headers;
  }

  // ── Logical row segmentation ──────────────────────────────────────────────────

  /**
   * A new logical row starts when:
   *   (a) First item is "Ref" or "IER" at x < 30 px  (transaction row anchor)
   *   (b) y-gap from previous line exceeds MAX_ROW_GAP
   */
  function isNewLogicalRow(lineItems, prevY, currentY) {
    if (currentY - prevY > MAX_ROW_GAP) return true;
    if (lineItems.length === 0) return false;
    const first = lineItems[0];
    return (first.str === 'Ref' || first.str === 'IER') && first.x < 30;
  }

  // ── Grid builder ─────────────────────────────────────────────────────────────

  /**
   * Build an internal 2-D grid from a table's data lines.
   * grid[logicalRowIndex][colIndex] = joined cell text.
   * This grid is PRIVATE — never rendered to the user.
   *
   * Implements 4 sub-passes:
   *   TOP->BOTTOM PASS 1: raw y-line scan (collect data words in screen order)
   *   TOP->BOTTOM PASS 2: logical row detection (split at anchors / y-gaps),
   *                        skip noise lines (Total : Php X.XX)
   *   LEFT->RIGHT PASS 1: column assignment by x coordinate
   *   LEFT->RIGHT PASS 2: cell cleanup (strip prefixes, deduplicate amounts)
   */
  function buildGrid(tableHeader, rowMap, nextHeaderY) {
    const { headerY, cols } = tableHeader;

    // TOP->BOTTOM PASS 1: gather data y-lines below header
    const ys = [...rowMap.keys()].filter(
      y => y > headerY + Y_TOL && y < (nextHeaderY || Infinity)
    );

    // TOP->BOTTOM PASS 2: segment into logical rows, skip total-noise lines
    const logicalRows = [];
    let   current     = new Array(cols.length).fill('');
    let   prevY       = headerY;
    let   hasContent  = false;

    for (const y of ys) {
      const lineItems = rowMap.get(y);

      if (isNewLogicalRow(lineItems, prevY, y)) {
        if (hasContent) logicalRows.push(current);
        current    = new Array(cols.length).fill('');
        hasContent = false;
      }

      // Skip "Total : Php X.XX" noise lines
      const lineTexts = lineItems.map(it => it.str);
      if (lineTexts.includes('Total') && lineTexts.includes(':')) {
        prevY = y;
        continue;
      }

      // LEFT->RIGHT PASS 1: assign each word to its column
      for (const item of lineItems) {
        // Skip noise tokens that appear at the far-right of data rows
        if (NOISE_TOKENS.has(item.str) && item.x > 400) continue;

        const ci = colIdx(item.x, cols);
        if (ci === -1) continue;

        current[ci] = current[ci] ? current[ci] + ' ' + item.str : item.str;
        hasContent  = true;
      }

      prevY = y;
    }
    if (hasContent) logicalRows.push(current);

    // LEFT->RIGHT PASS 2: clean each cell value
    return logicalRows.map(row =>
      row.map((cell, ci) => cleanCell(cell, cols[ci].name))
    );
  }

  /** Strip common noise from a cell value based on its column name. */
  function cleanCell(cell, colName) {
    let v = (cell || '').trim();
    if (!v) return v;

    // TransNo column: strip "Ref No. :" / "IER No. :" prefix, keep numeric ID only
    if (/^TransNo/i.test(colName)) {
      v = v.replace(/^(?:Ref|IER)\s*No\.\s*:\s*/i, '').trim();
      const m = v.match(/^(\d+)/);
      if (m) v = m[1];
    }

    // Toll Fee / Amount columns: keep only the first numeric value
    if (/Toll|Fee|Amount/i.test(colName)) {
      const nums = v.match(/\d[\d,.]*/g);
      if (nums) v = nums[0];
    }

    return v.replace(/\s+/g, ' ').trim();
  }

  // ── Complex table re-alignment ────────────────────────────────────────────────

  function isComplexGrid(grid, cols) {
    if (cols.length < 4 || grid.length === 0) return false;
    const sparse = grid.filter(row => row.filter(c => c.trim()).length === 1).length;
    return sparse / grid.length > COMPLEX_RATE;
  }

  /**
   * Re-align a complex grid by snapping each raw word to its nearest column centroid.
   * Same 4-sub-pass structure as buildGrid but uses centroid distances instead of
   * strict xStart/xEnd boundaries.
   */
  function realignGrid(tableHeader, rowMap, nextHeaderY) {
    const { headerY, cols } = tableHeader;
    const centroids  = cols.map(c => (c.xStart + c.xEnd) / 2);
    const halfWidths = cols.map(c => (c.xEnd - c.xStart) / 2);

    const ys = [...rowMap.keys()].filter(
      y => y > headerY + Y_TOL && y < (nextHeaderY || Infinity)
    );

    const logicalRows = [];
    let   current     = new Array(cols.length).fill('');
    let   prevY       = headerY;
    let   hasContent  = false;

    for (const y of ys) {
      const lineItems = rowMap.get(y);

      if (isNewLogicalRow(lineItems, prevY, y)) {
        if (hasContent) logicalRows.push(current);
        current    = new Array(cols.length).fill('');
        hasContent = false;
      }

      const lineTexts = lineItems.map(it => it.str);
      if (lineTexts.includes('Total') && lineTexts.includes(':')) {
        prevY = y;
        continue;
      }

      for (const item of lineItems) {
        if (NOISE_TOKENS.has(item.str) && item.x > 400) continue;
        if (!item.str.trim()) continue;

        // Snap to nearest centroid within 1.5× its half-width
        let best = -1, bestDist = Infinity;
        for (let ci = 0; ci < centroids.length; ci++) {
          const d = Math.abs(item.x - centroids[ci]);
          if (d < bestDist && d < halfWidths[ci] * 1.5) { bestDist = d; best = ci; }
        }
        if (best === -1) continue;

        current[best] = current[best] ? current[best] + ' ' + item.str : item.str;
        hasContent = true;
      }
      prevY = y;
    }
    if (hasContent) logicalRows.push(current);

    return logicalRows.map(row =>
      row.map((cell, ci) => cleanCell(cell, cols[ci].name))
    );
  }

  // ── 4-pass grid reader ────────────────────────────────────────────────────────

  /**
   * Walk the internal grid in 4 passes and produce structured token text.
   *
   *   Pass A  top->bottom (1st): for r in rows: for c in cols: emit grid[r][c]
   *   Pass B  top->bottom (2nd): same order; Set deduplicates
   *   Pass C  left->right (1st): for c in cols: for r in rows: emit grid[r][c]
   *   Pass D  left->right (2nd): same; Set deduplicates
   *
   * Output: one "ColName : val | ColName : val" string per logical row,
   *         all rows joined with spaces.
   */
  function readGrid(grid, cols) {
    if (grid.length === 0 || cols.length === 0) return '';

    const R = grid.length;
    const C = cols.length;
    const rowTexts = [];

    for (let r = 0; r < R; r++) {
      const seen   = new Set();
      const tokens = [];

      function emit(ci) {
        const val = grid[r][ci];
        if (!val || !val.trim()) return;
        const tok = cols[ci].name + ' : ' + val.trim();
        const key = tok.toLowerCase().replace(/\s+/g, '');
        if (!seen.has(key)) { seen.add(key); tokens.push(tok); }
      }

      // Pass A — top->bottom 1st (row r, left to right)
      for (let c = 0; c < C; c++) emit(c);
      // Pass B — top->bottom 2nd (same, deduped)
      for (let c = 0; c < C; c++) emit(c);
      // Pass C — left->right 1st (same for a single row)
      for (let c = 0; c < C; c++) emit(c);
      // Pass D — left->right 2nd (same, deduped)
      for (let c = 0; c < C; c++) emit(c);

      if (tokens.length > 0) rowTexts.push(tokens.join(' | '));
    }

    return rowTexts.join(' ');
  }

  // ── Main entry point ──────────────────────────────────────────────────────────

  /**
   * Process one page's itemMap.
   * Called by PDFProcessor.extractPages() for every page.
   *
   * Returns enriched page text where table regions have been replaced by
   * structured "ColName : val | ColName : val" tokens from the 4-pass read.
   * Non-table text is preserved verbatim in its original page position.
   *
   * The structured text is INTERNAL — never displayed to the user.
   * It exists so KeywordHandler.search() can find keywords in the correct
   * column context regardless of the raw PDF stream order.
   *
   * @param  {Array}  itemMap   [{str, x, screenY, width, height, start, end}]
   * @param  {number} pageWidth  page width in PDF user units (default 612)
   * @returns {string} enriched page text ready for keyword search
   */
  function processPage(itemMap, pageWidth) {
    pageWidth = pageWidth || 612;
    if (!itemMap || itemMap.length === 0) return '';

    const rowMap  = groupRows(itemMap);
    const headers = detectTableHeaders(rowMap, pageWidth);

    // No tables detected — return plain joined text unchanged
    if (headers.length === 0) {
      return [...rowMap.values()]
        .map(row => row.map(it => it.str).join(' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Build a structured text block for each detected table
    const blocks = [];

    for (let hi = 0; hi < headers.length; hi++) {
      const hdr      = headers[hi];
      const nextHdrY = hi + 1 < headers.length ? headers[hi + 1].headerY : Infinity;

      // Build internal grid (never shown to user)
      let grid = buildGrid(hdr, rowMap, nextHdrY);

      // Complex table: re-align with centroid snapping
      if (isComplexGrid(grid, hdr.cols)) {
        grid = realignGrid(hdr, rowMap, nextHdrY);
      }

      // 4-pass grid read -> structured token string
      const structuredText = readGrid(grid, hdr.cols);
      if (!structuredText) continue;

      // Determine y-extent (header through last data row)
      const dataYs = [...rowMap.keys()].filter(y => y > hdr.headerY && y < nextHdrY);
      const maxY   = dataYs.length > 0 ? Math.max(...dataYs) : hdr.headerY;

      blocks.push({ minY: hdr.headerY, maxY, text: structuredText });
    }

    if (blocks.length === 0) {
      // Tables were detected but produced no structured text — fall back to plain text
      return [...rowMap.values()]
        .map(row => row.map(it => it.str).join(' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Mark all y-values belonging to detected tables
    const tableYSet = new Set();
    for (const b of blocks) {
      for (const [y] of rowMap) {
        if (y >= b.minY && y <= b.maxY) tableYSet.add(y);
      }
    }

    // Assemble enriched page text in top-to-bottom order
    const segments      = [];
    const emittedBlocks = new Set();

    for (const [y, rowItems] of rowMap) {
      if (tableYSet.has(y)) {
        for (let bi = 0; bi < blocks.length; bi++) {
          const b = blocks[bi];
          if (y >= b.minY && y <= b.maxY && !emittedBlocks.has(bi)) {
            segments.push({ y: b.minY, text: b.text });
            emittedBlocks.add(bi);
          }
        }
      } else {
        const rowText = rowItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
        if (rowText) segments.push({ y, text: rowText });
      }
    }

    segments.sort((a, b) => a.y - b.y);
    return segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  }

  return { processPage };

})();
