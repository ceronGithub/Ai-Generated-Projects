# Streetwise PH — Firebase Setup Guide
## Stack: HTML + CSS + JavaScript + Firebase (₱0/month)

---

## Project Structure

```
streetwise_firebase/
├── index.html            ← Homepage with hero banner
├── shop.html             ← Product listing + filters
├── product.html          ← Product detail page
├── cart.html             ← Cart + checkout (Cash on Delivery)
├── dashboard.html        ← Owner panel (login protected)
├── contact.html          ← Guest contact + public messages
├── seed.html             ← Run once to populate sample data
├── firestore.rules       ← Copy this into Firebase Console
├── css/
│   ├── variables.css     ← Global design tokens
│   ├── navbar.css
│   ├── hero.css
│   ├── products.css
│   ├── cart.css
│   ├── dashboard.css
│   ├── shop.css
│   └── media-queries.css ← All responsive breakpoints
└── js/
    ├── main.js           ← Core utilities, auth state, navbar
    └── firebase/
        ├── config.js     ← ⚠️ YOUR FIREBASE CREDENTIALS GO HERE
        ├── auth.js       ← Login, logout, register
        ├── products.js   ← Product CRUD
        ├── cart.js       ← Cart (localStorage)
        ├── orders.js     ← Checkout + Firestore orders
        ├── inventory.js  ← Stock management
        ├── sales.js      ← Sales analytics
        ├── comments.js   ← Reviews + messages
        └── export.js     ← PDF, Excel, Word, PowerPoint
```

---

## Step 1 — Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `streetwise-ph`
3. Disable Google Analytics (optional for a small store)
4. Click **Create project**

---

## Step 2 — Enable Firestore Database

1. In Firebase Console → left sidebar → **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode**
4. Select region: **asia-southeast1 (Singapore)** — closest to Philippines
5. Click **Enable**

---

## Step 3 — Enable Authentication

1. Left sidebar → **Authentication** → **Get started**
2. Click **Email/Password** → Enable → Save
3. Go to **Users** tab → **Add user**:
   - Email: `owner@streetwiseph.com`
   - Password: (choose a strong password)
4. Note down the **User UID** shown after creation

---

## Step 4 — Set Owner Role in Firestore

After creating the owner Firebase Auth account, you need to set their role in Firestore:

1. Go to **Firestore Database** → **Data** tab
2. Click **+ Start collection** → Collection ID: `users`
3. Document ID: paste the owner's **UID** from Step 3
4. Add these fields:
   ```
   uid       (string)  → paste UID
   email     (string)  → owner@streetwiseph.com
   fullName  (string)  → Store Owner
   username  (string)  → owner
   role      (string)  → owner   ← THIS IS CRITICAL
   ```
5. Click **Save**

---

## Step 5 — Set Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Delete all existing content
3. Open `firestore.rules` from this project
4. Copy the entire content and paste it into the Rules editor
5. Click **Publish**

---

## Step 6 — Get Your Firebase Config

1. Go to **Project Settings** (gear icon top left)
2. Scroll down to **Your apps** → click **</>** (Web app)
3. Register app name: `streetwise-ph-web` → click **Register app**
4. Copy the `firebaseConfig` object shown

---

## Step 7 — Update config.js

Open `js/firebase/config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",           // paste yours
  authDomain:        "streetwise-ph.firebaseapp.com",
  projectId:         "streetwise-ph",
  storageBucket:     "streetwise-ph.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

---

## Step 8 — Seed Sample Data

1. Open `seed.html` in your browser
   - If running locally, use Live Server (VS Code extension)
   - Or deploy first (Step 9) then visit `/seed.html`
2. Log in as owner first (go to `dashboard.html`, sign in)
3. Come back to `seed.html` → click **Run Seed Data**
4. You should see green checkmarks for all items
5. Visit `index.html` — your products will appear!

---

## Step 9 — Deploy Free with Firebase Hosting

```bash
# Install Firebase CLI (run once)
npm install -g firebase-tools

# Login
firebase login

# Initialize in your project folder
firebase init hosting

# Answer the prompts:
# Public directory: .  (just a dot)
# Single-page app:  No
# Overwrite index.html: No

# Deploy!
firebase deploy
```

Your site will be live at:
```
https://streetwise-ph.web.app
```

**That's it. ₱0/month. Permanently free.**

---

## Optional: Custom Domain

1. Firebase Console → Hosting → **Add custom domain**
2. Enter your domain (e.g. `streetwiseph.com`)
3. Follow the DNS verification steps
4. Firebase provides free SSL automatically

Philippine `.ph` domains: ~₱800/year at Namecheap or Domain.com.ph

---

## Owner Login

| Field    | Value                      |
|----------|----------------------------|
| Email    | owner@streetwiseph.com     |
| Password | (what you set in Step 3)   |
| URL      | yoursite.web.app/dashboard.html |

---

## Adding Your Own Products

After seeding sample data, delete or edit it via the Owner Dashboard:

1. Log in → Dashboard → **Products** tab
2. Click **+ Add Product**
3. Fill in name, price, sizes, colors, image URL
4. For images: upload to [imgbb.com](https://imgbb.com) (free) and paste the URL

---

## Notes

- Cart uses `localStorage` — no Firebase reads needed for browsing
- Daily free limits: 50,000 reads / 20,000 writes — plenty for a starting store
- The owner dashboard is protected by Firebase Security Rules — guests cannot access data even if they find the URL
- Export (PDF/Excel/Word/PPT) works entirely in the browser — no server needed
