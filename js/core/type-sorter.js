// =============================================
// type-sorter.js — Group uploaded PDFs into "types"
// so the user can pick which type(s) to merge, while
// the rest go through the existing rename flow.
//
// Two grouping modes:
//
//   AUTO-DETECT
//     Reuses the same label-shape heuristic as
//     LabelDetector.js (a word/phrase immediately
//     followed by a colon — "Invoice #:", "Tin:",
//     "Business Style:") to build a per-file "label
//     signature". Files whose signatures overlap
//     enough (shared-label ratio >= SIMILARITY_THRESHOLD)
//     are folded into the same group. Files that don't
//     overlap with any existing group start a new one.
//     A file with no label-shaped text at all falls into
//     the reserved "Unclassified" group.
//
//   MANUAL
//     The user types a keyword/phrase into a textfield
//     and adds a group. Any uploaded PDF whose extracted
//     text contains that keyword (case-insensitive,
//     whitespace-normalised) is placed in that group.
//     Multiple manual groups can be added one after another;
//     a file can belong to more than one manual group if its
//     text matches more than one keyword — group membership
//     is a "contains" test per group, not mutually exclusive.
//
// Public API:
//   TypeSorter.autoDetectGroups(pagesByFile, files) -> Group[]
//   TypeSorter.addManualGroup(existingGroups, keyword, pagesByFile, files) -> Group[]
//   TypeSorter.removeGroup(existingGroups, groupId) -> Group[]
//   TypeSorter.renameGroup(existingGroups, groupId, newLabel) -> Group[]
//   TypeSorter.getUnassignedFiles(groups, files, selectedGroupIds) -> File[]
//
//   Group shape:
//     {
//       id:      string,           // stable internal id
//       label:   string,           // display name, editable by user
//       mode:    'auto' | 'manual',
//       keyword: string | null,    // only set for manual groups
//       files:   File[],
//     }
//
//   pagesByFile shape (matches PDFProcessor.extractAll() output):
//     Array<{ file: File, pages: Array<{page, text}>, error?: string }>
// =============================================

const TypeSorter = (() => {
  'use strict';

  const MAX_AUTO_GROUPS      = 12;   // safety cap so a noisy batch doesn't explode into dozens of tiny groups
  const SIMILARITY_THRESHOLD = 0.5;  // fraction of shared labels required to fold a file into an existing group
  const MIN_LABELS_PER_FILE  = 2;    // files with fewer label-shaped tokens than this go to "Unclassified"

  // Same label-shape pattern as LabelDetector.js — kept in sync intentionally
  // so auto-detect groups line up with the Single Keyword suggestion list.
  const LABEL_RE = /\b([A-Z][a-zA-Z#\-.]{0,15}(?:\s[A-Z][a-zA-Z#\-.]{0,15}){0,2})\s{0,3}:/g;

  let nextGroupId = 1;

  /**
   * makeGroupId
   * Generates a stable, unique id for a new group. Uses an incrementing
   * counter rather than the label text itself so renaming a group later
   * never breaks references held elsewhere (e.g. checkbox state in the UI).
   */
  function makeGroupId() {
    return `group-${nextGroupId++}`;
  }

  /**
   * extractLabelSet
   * Scans one file's combined page text and returns the set of distinct
   * label-shaped tokens found (e.g. {"Invoice #", "Total", "Signature"}).
   * This is the "signature" used to compare files against each other.
   */
  function extractLabelSet(pages) {
    const set = new Set();
    for (const p of pages) {
      if (!p.text) continue;
      LABEL_RE.lastIndex = 0;
      let m;
      while ((m = LABEL_RE.exec(p.text)) !== null) {
        const label = m[1].trim();
        if (!label || label.length < 2 || label.length > 40) continue;
        if (/^\d/.test(label)) continue; // skip number/date fragments posing as labels
        set.add(label);
      }
    }
    return set;
  }

  /**
   * signatureOverlap
   * Returns the overlap ratio between two label sets — the count of
   * shared labels divided by the size of the smaller set. Using the
   * smaller set as the denominator means a short-but-precise signature
   * (e.g. a 1-page receipt) can still match a longer multi-page invoice
   * that contains all of its labels plus more.
   */
  function signatureOverlap(setA, setB) {
    if (setA.size === 0 || setB.size === 0) return 0;
    let shared = 0;
    const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
    for (const label of smaller) {
      if (larger.has(label)) shared++;
    }
    return shared / smaller.size;
  }

  /**
   * pickGroupName
   * Builds a short, human-readable display name for an auto-detected
   * group from its most frequent shared labels — e.g. two files sharing
   * {"Invoice #", "Total", "Signature"} become "Invoice # / Total".
   * Falls back to a generic numbered name if no strong label stands out.
   */
  function pickGroupName(labelSet, groupIndex) {
    const labels = [...labelSet].sort((a, b) => a.length - b.length);
    if (labels.length === 0) return `Type ${groupIndex}`;
    const picked = labels.slice(0, 2).join(' / ');
    return picked || `Type ${groupIndex}`;
  }

  /**
   * autoDetectGroups
   * Scans every uploaded file's extracted text, builds a label signature
   * per file, then folds files into groups based on signature overlap.
   * Files with too few labels to form a reliable signature are placed
   * into a single reserved "Unclassified" group instead of guessing.
   *
   * @param {Array<{file: File, pages: Array<{text:string}>, error?:string}>} pagesByFile
   * @returns {Array<Group>}
   */
  function autoDetectGroups(pagesByFile) {
    const buckets = []; // { labelSet: Set, files: File[] }
    const unclassified = [];

    for (const entry of pagesByFile) {
      if (entry.error) { unclassified.push(entry.file); continue; }

      const labelSet = extractLabelSet(entry.pages);
      if (labelSet.size < MIN_LABELS_PER_FILE) {
        unclassified.push(entry.file);
        continue;
      }

      // Find the best-matching existing bucket, if any
      let bestBucket = null;
      let bestScore  = 0;
      for (const bucket of buckets) {
        const score = signatureOverlap(labelSet, bucket.labelSet);
        if (score > bestScore) { bestScore = score; bestBucket = bucket; }
      }

      if (bestBucket && bestScore >= SIMILARITY_THRESHOLD) {
        bestBucket.files.push(entry.file);
        // Keep the bucket's signature as the intersection so it stays
        // representative of every file folded into it so far.
        bestBucket.labelSet = new Set(
          [...bestBucket.labelSet].filter(l => labelSet.has(l))
        );
      } else if (buckets.length < MAX_AUTO_GROUPS) {
        buckets.push({ labelSet: new Set(labelSet), files: [entry.file] });
      } else {
        // Cap reached — anything that doesn't match an existing bucket
        // falls back to Unclassified rather than growing unbounded.
        unclassified.push(entry.file);
      }
    }

    const groups = buckets.map((bucket, i) => ({
      id:      makeGroupId(),
      label:   pickGroupName(bucket.labelSet, i + 1),
      mode:    'auto',
      keyword: null,
      files:   bucket.files,
    }));

    if (unclassified.length > 0) {
      groups.push({
        id:      makeGroupId(),
        label:   'Unclassified',
        mode:    'auto',
        keyword: null,
        files:   unclassified,
      });
    }

    return groups;
  }

  /**
   * addManualGroup
   * Adds one new manually-defined group to the existing list, matching
   * any uploaded PDF whose extracted text contains the given keyword
   * (case-insensitive, whitespace-normalised "contains" test). A file
   * can end up in more than one manual group — membership here is not
   * mutually exclusive, since two different keywords may both appear
   * in the same document.
   *
   * @param {Array<Group>} existingGroups
   * @param {string} keyword - raw text typed by the user
   * @param {Array<{file: File, pages: Array<{text:string}>, error?:string}>} pagesByFile
   * @returns {Array<Group>} new array (existingGroups is not mutated)
   */
  function addManualGroup(existingGroups, keyword, pagesByFile) {
    const trimmed = (keyword || '').trim();
    if (!trimmed) return existingGroups;

    const needle = trimmed.toLowerCase();
    const matched = [];

    for (const entry of pagesByFile) {
      if (entry.error) continue;
      const combined = entry.pages
        .map(p => (p.text || '').toLowerCase().replace(/\s+/g, ' '))
        .join(' ');
      if (combined.includes(needle)) matched.push(entry.file);
    }

    const newGroup = {
      id:      makeGroupId(),
      label:   trimmed,
      mode:    'manual',
      keyword: trimmed,
      files:   matched,
    };

    return [...existingGroups, newGroup];
  }

  /**
   * removeGroup
   * Removes one group by id. Files are never deleted — a removed group
   * simply stops claiming its files, so they fall back to "unassigned"
   * (and therefore into the rename flow) unless another group also
   * claims them.
   */
  function removeGroup(existingGroups, groupId) {
    return existingGroups.filter(g => g.id !== groupId);
  }

  /**
   * renameGroup
   * Updates a group's display label only — never affects membership
   * or the underlying keyword/signature used to build it.
   */
  function renameGroup(existingGroups, groupId, newLabel) {
    const clean = (newLabel || '').trim();
    if (!clean) return existingGroups;
    return existingGroups.map(g =>
      g.id === groupId ? { ...g, label: clean } : g
    );
  }

  /**
   * getUnassignedFiles
   * Returns every uploaded file that is NOT part of any of the
   * user-selected groups. These are the files that go through the
   * existing rename flow instead of being merged.
   *
   * @param {Array<Group>} groups - all groups (auto + manual)
   * @param {File[]} files - the full uploaded file list
   * @param {string[]} selectedGroupIds - ids of groups the user chose to merge
   * @returns {File[]}
   */
  function getUnassignedFiles(groups, files, selectedGroupIds) {
    const selectedSet = new Set(selectedGroupIds);
    const claimed = new Set();
    for (const g of groups) {
      if (!selectedSet.has(g.id)) continue;
      for (const f of g.files) claimed.add(f);
    }
    return files.filter(f => !claimed.has(f));
  }

  return {
    autoDetectGroups,
    addManualGroup,
    removeGroup,
    renameGroup,
    getUnassignedFiles,
  };
})();