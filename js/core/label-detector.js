// =============================================
// label-detector.js — Detects candidate "label" words
// from already-extracted PDF text, for Single Keyword
// mode's auto-suggest checklist under the keyword field.
//
// A "label" here is any text token immediately followed
// by a colon — the same shape used by form-style PDFs:
// "Invoice #:", "Date:", "Customer Name:". This mirrors
// the label-shape heuristics KeywordHandler already uses
// internally to locate field values, just run in the
// opposite direction: harvest every label-shaped token
// instead of matching one specific known keyword.
//
// Public API:
//   LabelDetector.detect(pagesByFile) -> string[]
//     pagesByFile: Array<Array<{text: string}>>
//     (one pages-array per file, as returned by
//     PDFProcessor.extractAll()'s .pages field)
// =============================================

const LabelDetector = (() => {
  'use strict';

  const MAX_LABELS = 40;

  // Single/two/three Title-Case word label immediately followed
  // by a colon, optionally with a few spaces before it —
  // e.g. "Date:", "Invoice #:", "Customer Name :".
  const LABEL_RE = /\b([A-Z][a-zA-Z#\-.]{0,15}(?:\s[A-Z][a-zA-Z#\-.]{0,15}){0,2})\s{0,3}:/g;

  /**
   * collectFromText
   * Scans one page's text for label-shaped tokens and tallies
   * how often each distinct label appears (used to rank suggestions
   * by frequency — the most-repeated labels are the most likely to
   * be genuine PDF field labels rather than incidental capitalized text).
   */
  function collectFromText(text, counts) {
    if (!text) return;
    LABEL_RE.lastIndex = 0;
    let m;
    while ((m = LABEL_RE.exec(text)) !== null) {
      const label = m[1].trim();
      if (!label || label.length < 2 || label.length > 40) continue;
      // Skip tokens that are just a number/date fragment posing as a label
      if (/^\d/.test(label)) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }

  /**
   * detect
   * Scans every page of every file and returns the most frequent
   * label-shaped tokens found, most-common first, capped at MAX_LABELS
   * so the suggestion list stays usable.
   */
  function detect(pagesByFile) {
    const counts = new Map();
    for (const pages of pagesByFile) {
      for (const p of pages) collectFromText(p.text, counts);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_LABELS)
      .map(([label]) => label);
  }

  return { detect };
})();
