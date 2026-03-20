// ============================================================
//  SCRPD — app.js
//  Replace the value below with your actual n8n webhook URL.
//  See SETUP.md for instructions on how to get this URL.
// ============================================================

const N8N_WEBHOOK_URL = "https://n8n-3zpf.onrender.com/webhook-test/scrape";

// ── DOM refs ─────────────────────────────────────────────────
const urlInput    = document.getElementById("urlInput");
const scrapeBtn   = document.getElementById("scrapeBtn");
const indicator   = document.getElementById("indicator");
const statusText  = document.getElementById("statusText");
const stepCounter = document.getElementById("stepCounter");
const resultBox   = document.getElementById("result");
const summaryText = document.getElementById("summaryText");
const errorBox    = document.getElementById("errorBox");
const domainChip  = document.getElementById("domainChip");
const wordsChip   = document.getElementById("wordsChip");
const statusChip  = document.getElementById("statusChip");
const configNotice= document.getElementById("configNotice");

// ── Helpers ──────────────────────────────────────────────────
function setStatus(msg, state = "active", step = "") {
  statusText.textContent  = msg;
  stepCounter.textContent = step;
  indicator.className     = "status-indicator " + state;
}

function showError(msg) {
  errorBox.textContent = "⚠  " + msg;
  errorBox.classList.add("visible");
}

function hideError() {
  errorBox.classList.remove("visible");
}

function reset() {
  hideError();
  resultBox.classList.remove("visible");
  summaryText.textContent = "";
  configNotice.style.display = "none";
}

// ── Main ─────────────────────────────────────────────────────
async function runScrape() {
  const url = urlInput.value.trim();

  if (!url || !url.startsWith("http")) {
    showError("Please enter a valid URL starting with http:// or https://");
    return;
  }

  // Guard: webhook not configured yet
  if (N8N_WEBHOOK_URL === "YOUR_N8N_WEBHOOK_URL") {
    showError(
      "n8n webhook URL is not configured yet.\n" +
      "Open app.js and replace YOUR_N8N_WEBHOOK_URL with your actual n8n webhook URL.\n" +
      "Follow the steps in SETUP.md to set up n8n."
    );
    configNotice.style.display = "block";
    return;
  }

  reset();
  scrapeBtn.disabled = true;

  try {
    setStatus("Sending to n8n…", "active", "1 / 3");

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    setStatus("Processing scrape + AI…", "active", "2 / 3");

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`n8n returned ${response.status}. ${errText || "Check your workflow."}`);
    }

    const data = await response.json();

    setStatus("Done", "done", "3 / 3");

    // Populate result — n8n workflow should return:
    // { summary, domain, wordCount, status }
    const summary   = data.summary   || data.text    || data.output || JSON.stringify(data, null, 2);
    const domain    = data.domain    || extractDomain(url);
    const wordCount = data.wordCount || data.words   || "—";
    const status    = data.status    || "200 OK";

    domainChip.textContent  = domain;
    wordsChip.textContent   = wordCount;
    statusChip.textContent  = status;
    summaryText.textContent = summary;

    resultBox.classList.add("visible");

  } catch (err) {
    setStatus("Failed", "error", "");
    showError(err.message || "Something went wrong. Check your n8n workflow.");
  } finally {
    scrapeBtn.disabled = false;
  }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return "unknown"; }
}

// Enter key support
urlInput.addEventListener("keydown", e => {
  if (e.key === "Enter") runScrape();
});
