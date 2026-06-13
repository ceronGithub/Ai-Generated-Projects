// =============================================
// verse-ticker.js
// Scrolling ticker with Bible verses and
// motivational quotes, dedicated to Liza.
//
// HOW IT WORKS:
//   - Picks a random entry from the verses array
//   - Fades out the current text, swaps it, fades in
//   - Repeats every DISPLAY_DURATION milliseconds
// =============================================

const VerseTicker = (() => {

  // ── CONFIG ──────────────────────────────────
  const DISPLAY_DURATION = 6000;   // ms each verse is shown
  const FADE_DURATION    = 600;    // ms for fade transition

  // ── VERSES & QUOTES ─────────────────────────
  const verseList = [
    { text: "Love is patient, love is kind. It does not envy, it does not boast.", source: "1 Corinthians 13:4" },
    { text: "Be completely humble and gentle; be patient, bearing with one another in love.", source: "Ephesians 4:2" },
    { text: "A gentle answer turns away wrath, but a harsh word stirs up anger.", source: "Proverbs 15:1" },
    { text: "The beginning of wisdom is this: Get wisdom, and whatever you get, get insight.", source: "Proverbs 4:7" },
    { text: "She is clothed with strength and dignity, and she laughs without fear of the future.", source: "Proverbs 31:25" },
    { text: "Do everything in love.", source: "1 Corinthians 16:14" },
    { text: "The quiet soul finds rest, but patience turns every storm into still water.", source: "Daily Wisdom" },
    { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", source: "Daily Motivation" },
  ];

  let currentIndex  = 0;
  let tickerTextEl  = null;
  let tickerSourceEl = null;
  let intervalId    = null;

  // ── INIT ─────────────────────────────────────
  // Sets up the ticker element and starts rotation
  function init() {
    tickerTextEl   = document.getElementById('verseTickerText');
    tickerSourceEl = document.getElementById('verseTickerSource');
    if (!tickerTextEl || !tickerSourceEl) return;

    currentIndex = Math.floor(Math.random() * verseList.length);
    renderCurrent();
    intervalId = setInterval(rotateNext, DISPLAY_DURATION);
  }

  // ── RENDER CURRENT ───────────────────────────
  // Writes the current verse into the DOM elements
  function renderCurrent() {
    const entry = verseList[currentIndex];
    tickerTextEl.textContent   = '\u201C' + entry.text + '\u201D';
    tickerSourceEl.textContent = '\u2014\u00A0' + entry.source;
  }

  // ── ROTATE NEXT ──────────────────────────────
  // Fades out, swaps content, fades back in
  function rotateNext() {
    const tickerWrap = document.getElementById('verseTicker');
    if (!tickerWrap) return;

    tickerWrap.style.transition = `opacity ${FADE_DURATION}ms ease`;
    tickerWrap.style.opacity    = '0';

    setTimeout(() => {
      currentIndex = (currentIndex + 1) % verseList.length;
      renderCurrent();
      tickerWrap.style.opacity = '1';
    }, FADE_DURATION);
  }

  // ── PUBLIC ───────────────────────────────────
  return { init };

})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', VerseTicker.init);
