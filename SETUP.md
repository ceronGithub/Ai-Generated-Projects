# Streetwise PH — Setup Guide

## Project Structure
```
streetwise_ph/
├── index.html               ← Homepage
├── shop.html                ← Product listing
├── product.html             ← Product detail
├── cart.html                ← Cart + checkout
├── owner-dashboard.html     ← Owner panel (protected)
├── contact.html             ← Guest contact page
├── composer.json            ← PHP dependencies
├── css/
│   ├── variables.css        ← Global tokens, buttons, forms
│   ├── navbar.css           ← Navigation
│   ├── hero.css             ← Hero banner
│   ├── products.css         ← Product cards & grid
│   ├── cart.css             ← Cart & checkout
│   ├── dashboard.css        ← Owner dashboard
│   └── shop.css             ← Shop filters
├── js/
│   ├── main.js              ← Core utilities, auth, navbar
│   ├── hero.js              ← Hero auto-slider
│   ├── shop.js              ← Product listing & filters
│   ├── product.js           ← Product detail page
│   ├── cart.js              ← Cart + checkout logic
│   ├── dashboard.js         ← Owner dashboard
│   └── sales.js             ← Sales charts + export
├── php/
│   ├── config/
│   │   ├── database.php     ← PlanetScale PDO config
│   │   └── session.php      ← Auth session helpers
│   └── controllers/
│       ├── auth.php         ← Login / logout / register
│       ├── products.php     ← Product CRUD
│       ├── cart.php         ← Cart management
│       ├── orders.php       ← Checkout + order status
│       ├── inventory.php    ← Stock tracking
│       ├── sales.php        ← Sales analytics API
│       ├── export.php       ← PDF/Excel/Word/PPT export
│       └── comments.php     ← Reviews & messages
└── database/
    └── schema.sql           ← DB tables + seed data
```

---

## Step 1 — PlanetScale Database

1. Go to https://app.planetscale.com and create a free account
2. Create a new database named `streetwise_ph`
3. Open the database → click **Connect** → choose **PHP (PDO)**
4. Copy the host, username, and password

Edit `php/config/database.php`:
```php
define('DB_HOST', 'aws.connect.psdb.cloud');  // from PlanetScale
define('DB_NAME', 'streetwise_ph');
define('DB_USER', 'your_username');           // from PlanetScale
define('DB_PASS', 'your_password');           // from PlanetScale
```

5. Download `cacert.pem` (SSL cert) from:
   https://curl.se/ca/cacert.pem
   Place it at: `php/config/cacert.pem`

6. In PlanetScale Console, paste and run all SQL from `database/schema.sql`

---

## Step 2 — PHP Dependencies (Export Feature)

```bash
composer install
```

This installs TCPDF, PhpSpreadsheet, PhpWord, and PhpPresentation for export.

---

## Step 3 — Web Server

**Option A: XAMPP (Local)**
- Copy project to `C:/xampp/htdocs/streetwise_ph/`
- Start Apache in XAMPP Control Panel
- Visit: http://localhost/streetwise_ph/

**Option B: Any PHP Host (Hostinger, etc.)**
- Upload via FTP to public_html/
- Make sure PHP 8.1+ is enabled

---

## Step 4 — Login

| Role  | Username | Password    |
|-------|----------|-------------|
| Owner | owner    | Admin@1234  |

To change the owner password:
```php
echo password_hash('YourNewPassword', PASSWORD_BCRYPT, ['cost' => 12]);
```
Then update the hash in the `users` table via PlanetScale Console.

---

## Notes

- Cart uses PHP sessions. Make sure cookies are enabled.
- All prices are in Philippine Peso (₱).
- Shipping fee is ₱150 flat per order.
- Product images: place files in `assets/images/` and update `image_url` in the products table.
