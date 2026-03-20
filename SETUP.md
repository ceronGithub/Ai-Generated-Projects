# SCRPD — Setup Guide

## Overview

```
Browser (Netlify) ──POST──▶ n8n Webhook ──▶ Scrape URL ──▶ AI Summary ──▶ Response
```

Your frontend (HTML/CSS/JS) is hosted on **Netlify**.
All scraping + AI logic runs inside an **n8n workflow** triggered by a webhook.

---

## STEP 1 — Set Up n8n (Free, Cloud)

1. Go to **https://n8n.io** and click **Get started for free**
2. Sign up and log in to your n8n cloud instance
3. You'll land on the n8n dashboard

---

## STEP 2 — Create the n8n Workflow

### A. Add a Webhook node (trigger)

1. Click **+ New Workflow**
2. Click the **+** button → Search **Webhook** → select it
3. Set:
   - **HTTP Method:** `POST`
   - **Response Mode:** `Last Node`
   - **Path:** `scrape` (or any name you like)
4. Click **Listen for test event** — copy the **Test URL** shown (you'll use this later)

---

### B. Add an HTTP Request node (scrape the URL)

1. Add a new node → search **HTTP Request**
2. Connect it to the Webhook node
3. Configure:
   - **Method:** `GET`
   - **URL:** `{{ $json.body.url }}`
   - **Response Format:** `Text`
4. This fetches the raw HTML of the URL sent from your frontend

---

### C. Add a Code node (extract text from HTML)

1. Add a new node → search **Code**
2. Connect it to the HTTP Request node
3. Paste this JavaScript:

```js
const html = $input.first().json.data || "";

// Strip tags, collapse whitespace
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 12000);

const wordCount = text.split(/\s+/).filter(Boolean).length;

return [{ json: { text, wordCount } }];
```

---

### D. Add an AI / LLM node (summarize)

**Option 1 — OpenAI (recommended):**

1. Add node → search **OpenAI**
2. Connect it to the Code node
3. Set:
   - **Resource:** `Text`
   - **Operation:** `Message a model`
   - **Model:** `gpt-4o-mini` (cheap + fast)
   - **Messages (user):**
     ```
     Summarize the following web page content clearly and concisely in a few paragraphs. Cover the main topic, key points, and any notable details.

     {{ $json.text }}
     ```
4. Add your OpenAI API key in Credentials

**Option 2 — Use n8n's built-in AI nodes:**
- Search for **Basic LLM Chain** or **Summarization Chain** (under AI section)
- Connect an **OpenAI Chat Model** sub-node with your API key

---

### E. Add a final Code node (format response)

1. Add node → search **Code**
2. Connect it after the AI node
3. Paste:

```js
const summary   = $input.first().json.message?.content
               || $input.first().json.text
               || $input.first().json.output
               || "No summary available.";

const wordCount = $('Code').first().json.wordCount || 0;

// Extract domain from the original URL
let domain = "unknown";
try {
  const url = $('Webhook').first().json.body.url;
  domain = new URL(url).hostname.replace("www.", "");
} catch(e) {}

return [{
  json: {
    summary,
    domain,
    wordCount,
    status: "200 OK"
  }
}];
```

---

### F. Test the workflow

1. Click **Test workflow** in n8n
2. In a separate tab or Postman, send:
   ```
   POST <your-test-webhook-url>
   Content-Type: application/json

   { "url": "https://example.com" }
   ```
3. You should see data flowing through each node

---

### G. Activate + get Production URL

1. Toggle **Active** (top right) to turn the workflow on
2. Go back to the Webhook node → copy the **Production URL**
   - Looks like: `https://your-instance.app.n8n.cloud/webhook/scrape`
3. ✅ This is your `N8N_WEBHOOK_URL`

---

## STEP 3 — Connect Frontend to n8n

1. Open `app.js`
2. Replace line 8:
   ```js
   // BEFORE
   const N8N_WEBHOOK_URL = "YOUR_N8N_WEBHOOK_URL";

   // AFTER
   const N8N_WEBHOOK_URL = "https://your-instance.app.n8n.cloud/webhook/scrape";
   ```
3. Save the file

---

## STEP 4 — Deploy to Netlify

### Option A — Drag & Drop (easiest, no Git needed)

1. Go to **https://netlify.com** → Log in → **Add new site → Deploy manually**
2. Drag your entire `scraper-app/` folder into the upload zone
3. Netlify gives you a live URL like `https://scrpd-abc123.netlify.app`
4. Done! ✅

### Option B — GitHub + Auto Deploy

1. Push this folder to a GitHub repo
2. In Netlify: **Add new site → Import from Git**
3. Select your repo
4. Build settings:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.`
5. Click **Deploy site**
6. Every `git push` auto-deploys ✅

---

## STEP 5 — Fix CORS (if needed)

If your browser blocks the request to n8n, add a CORS header in the Webhook node:

1. Open your Webhook node in n8n
2. Under **Options → Allowed Origins**, enter:
   - `https://your-site.netlify.app` (your Netlify URL)
   - Or `*` to allow all origins (less secure, fine for personal use)

---

## File Structure

```
scraper-app/
├── index.html      ← Frontend UI
├── app.js          ← JS logic (put your webhook URL here)
├── netlify.toml    ← Netlify routing config
└── SETUP.md        ← This file
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "YOUR_N8N_WEBHOOK_URL" error | Paste your webhook URL in app.js |
| CORS error in browser | Add your Netlify URL to Webhook node's Allowed Origins |
| n8n returns 404 | Make sure workflow is **Active** (not just saved) |
| No summary returned | Check node names in the final Code node match exactly |
| Scraping fails | Some sites block bots — try a direct article URL |
