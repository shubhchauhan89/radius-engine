# Radius SEO — Client Deployment Guide

> **Estimated setup time:** < 5 minutes

This package lets you serve Radius-generated SEO pages directly from your own
domain through a lightweight PHP proxy with built-in 24-hour caching.

---

## Prerequisites

| Requirement         | Details                                     |
|---------------------|---------------------------------------------|
| PHP                 | 7.4 + with cURL extension enabled           |
| Apache              | `mod_rewrite` enabled                       |
| API Key             | Provided by your Radius account manager     |

---

## Step 1 — Configure `radius.php`

Open `radius.php` and update the two constants at the top of the file:

```php
define('RADIUS_API_KEY', 'your-secret-api-key');
define('RADIUS_API_URL', 'https://your-radius-instance.com');
```

- **`RADIUS_API_KEY`** — The API key you received during onboarding.
- **`RADIUS_API_URL`** — The Radius server URL (no trailing slash).

---

## Step 2 — Upload Files

Upload **`radius.php`** to your website's **document root** (the same
directory that contains your main `index.php` or `index.html`).

```
public_html/
├── index.php          ← your existing site
├── radius.php         ← upload here
└── .htaccess          ← edit in the next step
```

> The proxy will automatically create a `radius_cache/` folder on first
> request. Make sure your web root is writable by PHP, or create the folder
> manually with `chmod 755`.

---

## Step 3 — Add the Rewrite Rules

Open your `.htaccess` file and paste the following snippet **before** any
existing CMS rewrite rules (e.g., WordPress, Laravel):

```apache
RewriteEngine On

# Route all /locations/* requests to the Radius edge proxy
RewriteRule ^locations/(.*)$ radius.php [L,QSA]
```

Save the file — that's it! Visit `https://yourdomain.com/locations/your-city-keyword`
to verify the pages are rendering.

---

## How It Works

```
Visitor → yourdomain.com/locations/noida-crm
            │
            ▼
        .htaccess rewrites to radius.php
            │
            ├── Cache HIT?  → Serve local HTML instantly
            │
            └── Cache MISS? → Fetch from Radius API
                                 │
                                 ├── 200 → Cache HTML (24 h) & serve
                                 ├── 404 → Show "Page Not Found"
                                 └── 5xx → Show "Bad Gateway"
```

---

## Troubleshooting

| Symptom                    | Fix                                                       |
|----------------------------|------------------------------------------------------------|
| **500 Internal Server Error** | Ensure `mod_rewrite` is enabled (`a2enmod rewrite`)     |
| **Blank page**             | Check PHP error logs; verify cURL extension is installed   |
| **Stale content**          | Delete the `radius_cache/` folder to force a refresh       |
| **403 Forbidden on API**   | Double-check your `RADIUS_API_KEY` value                  |

---

## Cache Management

- **TTL:** 24 hours by default — edit `RADIUS_CACHE_TTL` in `radius.php`.
- **Purge all:** Delete everything inside the `radius_cache/` directory.
- **Purge one page:** Delete the specific `.html` file from `radius_cache/`.

---

*Need help? Reach out to your Radius account manager or email support@radius.dev*
