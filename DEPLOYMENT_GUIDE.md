# AuthentiScan — Complete Deployment Guide

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Google Sheet Setup](#3-google-sheet-setup)
4. [GitHub Pages Deployment](#4-github-pages-deployment)
5. [QR Code Generation](#5-qr-code-generation)
6. [Testing](#6-testing)
7. [Security Considerations](#7-security-considerations)
8. [Limitations of Google Sheets](#8-limitations-of-google-sheets)
9. [Future Upgrade Path](#9-future-upgrade-path)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYSTEM ARCHITECTURE                         │
│                                                                 │
│  ┌───────────────┐    scan QR     ┌──────────────────────────┐  │
│  │   Product     │ ─────────────▶ │  Customer's Phone        │  │
│  │   Package     │                │  (any browser, no app)   │  │
│  │  [QR Code]    │                └──────────┬───────────────┘  │
│  └───────────────┘                           │ opens URL        │
│                                              ▼                  │
│                                  ┌──────────────────────────┐   │
│                                  │   GitHub Pages           │   │
│                                  │   (free static hosting)  │   │
│                                  │                          │   │
│                                  │   index.html (home)      │   │
│                                  │   verify/index.html      │   │
│                                  │   styles.css             │   │
│                                  │   app.js                 │   │
│                                  └──────────┬───────────────┘   │
│                                             │ fetch CSV         │
│                                             ▼                   │
│                                  ┌──────────────────────────┐   │
│                                  │   Google Sheets          │   │
│                                  │   (free database)        │   │
│                                  │                          │   │
│                                  │   Published as CSV URL   │   │
│                                  │   No auth required       │   │
│                                  │   Up to ~10K rows        │   │
│                                  └──────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  MANUFACTURER TOOLS (runs locally, once per batch)    │     │
│  │                                                        │     │
│  │  products.xlsx ──▶ generate_qr.py ──▶ QR images       │     │
│  │                                  ──▶ products_with_    │     │
│  │                                      tokens.xlsx       │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. Manufacturer creates product list in Excel → runs `generate_qr.py`
2. Script generates unique tokens + QR images
3. Tokens are uploaded to Google Sheet
4. QR images are sent to printer / label maker
5. Products shipped with QR codes on packaging
6. Customer scans QR → browser opens GitHub Pages URL
7. `app.js` fetches CSV from Google Sheets → searches for token → shows result

### Cost Breakdown
| Component       | Service         | Cost          |
|----------------|-----------------|---------------|
| Frontend hosting | GitHub Pages  | **FREE**      |
| Database        | Google Sheets   | **FREE**      |
| QR generation   | Python (local)  | **FREE**      |
| SSL/HTTPS       | GitHub Pages    | **FREE**      |
| Custom domain   | Your registrar  | ~$10/year (optional) |
| **Total**       |                 | **$0/month**  |

---

## 2. Folder Structure

```
your-github-repo/
│
├── index.html              ← Home / landing page
├── styles.css              ← All styles (shared)
├── app.js                  ← Verification logic
│
├── verify/
│   └── index.html          ← Verification page (/verify/?token=XXX)
│
└── README.md               ← (optional) repo readme
```

**Local development / manufacturer tools:**
```
manufacturer-tools/
├── products.xlsx           ← Your product list
├── generate_qr.py          ← QR generator script
├── products_with_tokens.xlsx ← Output: Excel with tokens
└── qrcodes/                ← Output: QR PNG images
    ├── 8F2K9X7P4M_BD001.png
    ├── 3T5R1W8Q6N_BD002.png
    └── qr_summary.csv      ← Summary of all QR codes
```

---

## 3. Google Sheet Setup

### Step 3.1 — Create the Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and sign in.
2. Click **+ Blank** to create a new spreadsheet.
3. Rename it to **"Products"** (click "Untitled spreadsheet" at the top).

### Step 3.2 — Create the Columns

In **Row 1**, type these exact headers (one per cell, A through I):

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Token | ProductName | ProductCode | BatchNumber | ManufacturingDate | ExpiryDate | Status | Description | ImageURL |

### Step 3.3 — Add Sample Data

Add this sample row in Row 2 to test:

| Token | ProductName | ProductCode | BatchNumber | ManufacturingDate | ExpiryDate | Status | Description | ImageURL |
|-------|-------------|-------------|-------------|-------------------|------------|--------|-------------|----------|
| 8F2K9X7P4M | Brilliant Dye Blue | BD001 | B2026001 | 2026-01-01 | 2028-01-01 | Genuine | Premium Natural Dye | (optional image URL) |

### Step 3.4 — Publish the Sheet as CSV

> ⚠️ **This makes the sheet publicly readable.** Do NOT put sensitive information here.

1. Click **File** → **Share** → **Publish to web**
2. In the first dropdown, select your sheet tab name (e.g. "Sheet1" or "Products")
3. In the second dropdown, select **"Comma-separated values (.csv)"**
4. Click **Publish**
5. Click **OK** in the confirmation popup
6. **Copy the URL** — it looks like:
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-1vS.../pub?gid=0&single=true&output=csv
   ```
7. Save this URL — you'll need it in Step 4.

### Step 3.5 — Test the CSV URL

Open the URL in a browser. You should see plain text like:
```
Token,ProductName,ProductCode,...
8F2K9X7P4M,Brilliant Dye Blue,BD001,...
```

If you see this, your sheet is correctly published. ✅

---

## 4. GitHub Pages Deployment

### Step 4.1 — Create a GitHub Account

1. Go to [github.com](https://github.com)
2. Click **Sign up** and follow the steps
3. Verify your email address

### Step 4.2 — Create Repository

1. Click **+** (top-right) → **New repository**
2. Set **Repository name** to: `authentiscan` (or any name)
   - Your site URL will be: `https://YOURUSERNAME.github.io/authentiscan/`
3. Set visibility to **Public**
4. Check **"Add a README file"**
5. Click **Create repository**

### Step 4.3 — Configure app.js

Before uploading, open `app.js` and update line 44:

```javascript
SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/PASTE_YOUR_SHEET_ID_HERE/pub?gid=0&single=true&output=csv",
```

Replace the entire string with your actual CSV URL from Step 3.4:

```javascript
SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYOURACTUALURL/pub?gid=0&single=true&output=csv",
```

### Step 4.4 — Upload Files

**Method A: GitHub Web UI (easiest for beginners)**

1. Go to your repository page on GitHub
2. Click **"Add file"** → **"Upload files"**
3. Drag and drop these files:
   - `index.html`
   - `styles.css`
   - `app.js`
4. Click **"Commit changes"**
5. For the `verify/` folder:
   - Click **"Add file"** → **"Create new file"**
   - Type filename as: `verify/index.html`
   - Paste the content of `verify/index.html`
   - Click **"Commit new file"**

**Method B: Git command line (for developers)**

```bash
# Clone your repo
git clone https://github.com/YOURUSERNAME/authentiscan.git
cd authentiscan

# Copy your files in
cp /path/to/index.html .
cp /path/to/styles.css .
cp /path/to/app.js .
mkdir -p verify
cp /path/to/verify/index.html verify/

# Commit and push
git add .
git commit -m "Initial deployment of AuthentiScan"
git push origin main
```

### Step 4.5 — Enable GitHub Pages

1. Go to your repository → **Settings** tab
2. Scroll down to **"Pages"** in the left sidebar
3. Under **"Source"**, select **"Deploy from a branch"**
4. Select branch: **main**, folder: **/ (root)**
5. Click **Save**
6. Wait 1–3 minutes, then visit:
   ```
   https://YOURUSERNAME.github.io/authentiscan/
   ```

### Step 4.6 — Update QR Base URL

In `generate_qr.py`, update the default base URL:

```python
p.add_argument(
    "--base-url", "-u",
    default="https://YOURUSERNAME.github.io/authentiscan/verify",
    ...
)
```

Or pass it as an argument:
```bash
python generate_qr.py --base-url https://YOURUSERNAME.github.io/authentiscan/verify
```

---

## 5. QR Code Generation

### Step 5.1 — Install Python Dependencies

```bash
pip install qrcode[pil] openpyxl pillow pandas
```

### Step 5.2 — Prepare Your Product List

Create `products.xlsx` with these columns:
- **Token** (leave empty — script will auto-generate)
- **ProductName**
- **ProductCode**
- **BatchNumber**
- **ManufacturingDate** (format: YYYY-MM-DD)
- **ExpiryDate** (format: YYYY-MM-DD)
- **Status** (use "Genuine")
- **Description**
- **ImageURL** (optional, publicly accessible image URL)

### Step 5.3 — Run the Script

```bash
python generate_qr.py \
  --input products.xlsx \
  --output qrcodes \
  --base-url https://YOURUSERNAME.github.io/authentiscan/verify
```

### Step 5.4 — What You Get

```
qrcodes/
├── 8F2K9X7P4M_BD001.png   ← QR image for product BD001
├── 3T5R1W8Q6N_BD002.png   ← QR image for product BD002
└── qr_summary.csv          ← Summary with all URLs

products_with_tokens.xlsx   ← Updated Excel with tokens filled in
```

### Step 5.5 — Upload Tokens to Google Sheet

1. Open `products_with_tokens.xlsx`
2. Copy all rows (Ctrl+A → Ctrl+C)
3. Paste into your Google Sheet
4. The tokens are now live — QR codes will work immediately

### Step 5.6 — Print QR Codes

- Give `qrcodes/` folder to your printer/packaging vendor
- Each PNG is 400×460px, suitable for print at 300 DPI
- Match each `TOKEN_PRODUCTCODE.png` to the corresponding product

---

## 6. Testing

### Test the Verification Page

Open your browser and navigate to:
```
https://YOURUSERNAME.github.io/authentiscan/verify/?token=8F2K9X7P4M
```

Replace `8F2K9X7P4M` with a real token from your sheet.

**Expected results:**
- ✅ Token found → Green success card with product details
- ❌ Token not found → Red error card ("may be counterfeit")
- ⚠️ No token in URL → Warning "scan QR code on product"

### Test on Mobile

1. Open your Google Sheet
2. Find a QR code PNG in the `qrcodes/` folder
3. Open the PNG on your computer screen
4. Scan it with your phone camera
5. Tap the notification → should open the verify page

---

## 7. Security Considerations

### What's Secure ✅
- **Unique random tokens** — 10-char alphanumeric = 36^10 = ~3.6 trillion combinations. Brute-forcing is impractical.
- **No server-side code** — no attack surface for SQL injection, RCE, etc.
- **HTTPS** — GitHub Pages enforces HTTPS by default.
- **Read-only database** — customers can only read the sheet, never write.

### What's NOT Secure ⚠️ (and how to mitigate)

| Risk | Description | Mitigation |
|------|-------------|-----------|
| **Token copying** | A counterfeiter could scan a genuine QR and reprint it | Add scan-count tracking (requires backend — see Upgrade Path) |
| **Public sheet** | Anyone can download your entire product list | Accept this trade-off; the token list alone isn't valuable |
| **No scan logging** | You can't tell if a token was scanned 1 or 1000 times | Upgrade to Cloudflare D1 or Supabase for logging |
| **Token guessing** | Someone could try to guess tokens | Extremely hard with 10-char random tokens; increase length if needed |
| **Image spoofing** | Counterfeiters could mimic your page design | Add domain verification instructions on your packaging |

### Recommended Best Practices
1. **Use 12-character tokens** for higher security (edit `TOKEN_LENGTH = 12` in `generate_qr.py`)
2. **Print "Verify at authentiscan.github.io"** on packaging alongside QR
3. **Monitor your Google Sheet** for unexpected access patterns
4. **Rotate tokens per batch** — generate fresh tokens for each production run
5. **Use Status column** — mark compromised tokens as "Invalid" to disable them

---

## 8. Limitations of Google Sheets as Database

| Limitation | Impact | When It Matters |
|-----------|--------|-----------------|
| **No write access** | Can't log who scanned, when, or how many times | You need scan analytics |
| **5MB CSV export limit** | ~50,000 rows max for CSV export | Above 10,000 products (you're safe) |
| **Rate limiting** | Google may throttle frequent CSV requests | >10,000 verifications/day |
| **No real-time push** | Can't notify manufacturer when product is scanned | You need scan alerts |
| **Latency** | CSV fetch adds 0.5–2s overhead vs SQL DB | Generally acceptable |
| **No field validation** | Easy to accidentally corrupt data | Use careful data entry |
| **Single source of truth** | Hard to merge multiple sheets | Fine for most use cases |
| **Sheet must stay public** | Security trade-off | Accept for free tier |

**Bottom line:** Google Sheets works well for 0–10,000 products with low-to-medium verification traffic. It breaks down when you need scan logging, analytics, or very high traffic.

---

## 9. Future Upgrade Path

### When to Upgrade
- You need **scan logging** (who verified, when, how many times)
- Traffic exceeds **~5,000 verifications/day**
- You have **10,000+ products**
- You want a **custom domain** and professional polish

### Option A: Cloudflare D1 + Cloudflare Pages (still mostly free)

**Architecture:**
```
Customer → Cloudflare Pages (HTML/JS) → Cloudflare Worker (API) → D1 (SQLite)
```

**Cost:** Free tier: 100K DB reads/day, 1M worker requests/month
**Migration effort:** Medium (need to learn Cloudflare Workers)

**Steps:**
1. Create Cloudflare account → enable Pages + Workers + D1
2. Create D1 database, import your products CSV
3. Write a Cloudflare Worker:
   ```javascript
   // worker.js
   export default {
     async fetch(req, env) {
       const token = new URL(req.url).searchParams.get("token");
       const product = await env.DB.prepare(
         "SELECT * FROM products WHERE token = ?"
       ).bind(token).first();
       // Also log the scan:
       await env.DB.prepare(
         "INSERT INTO scan_log (token, ip, scanned_at) VALUES (?, ?, ?)"
       ).bind(token, req.headers.get("CF-Connecting-IP"), new Date().toISOString()).run();
       return Response.json(product || { error: "not found" });
     }
   }
   ```
4. Update `app.js` to call your Worker URL instead of Google Sheets
5. Deploy frontend to Cloudflare Pages

### Option B: Supabase (PostgreSQL, very developer-friendly)

**Architecture:**
```
Customer → GitHub Pages (HTML/JS) → Supabase REST API → PostgreSQL
```

**Cost:** Free tier: 500MB DB, 2GB bandwidth/month, unlimited API calls
**Migration effort:** Easy (Supabase has a great UI and REST API)

**Steps:**
1. Create Supabase account → new project
2. Create `products` table (match your Google Sheet columns)
3. Import data via Supabase Table Editor (paste CSV)
4. Enable Row Level Security (RLS) → allow anonymous SELECT only:
   ```sql
   CREATE POLICY "Public read" ON products
   FOR SELECT USING (true);
   ```
5. Update `app.js`:
   ```javascript
   const res = await fetch(
     `https://YOURPROJECT.supabase.co/rest/v1/products?token=eq.${token}&select=*`,
     { headers: { "apikey": "YOUR_ANON_KEY" } }
   );
   const [product] = await res.json();
   ```
6. Add scan logging table and insert on each verification

### Comparison Table

| Feature | Google Sheets (current) | Cloudflare D1 | Supabase |
|---------|------------------------|---------------|----------|
| Cost | $0 | $0 | $0 |
| Scan logging | ❌ | ✅ | ✅ |
| Analytics dashboard | ❌ | ❌ (build own) | ✅ |
| Max products | ~10,000 | 500,000+ | 500,000+ |
| Setup difficulty | ⭐ Easy | ⭐⭐⭐ Hard | ⭐⭐ Medium |
| Custom domain | ✅ | ✅ | ✅ |
| Response time | 0.5–2s | <100ms | <200ms |
| SQL support | ❌ | ✅ | ✅ |

**Recommendation:** Start with Google Sheets. Migrate to Supabase when you need scan logging or exceed 5,000 verifications/day.

---

## Quick Reference

### Important URLs
- **Home:** `https://YOURUSERNAME.github.io/authentiscan/`
- **Verify:** `https://YOURUSERNAME.github.io/authentiscan/verify/?token=TOKEN`
- **Your Sheet:** `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/`
- **Sheet CSV:** `https://docs.google.com/spreadsheets/d/e/YOUR_EXPORT_ID/pub?gid=0&single=true&output=csv`

### Key Files
| File | Purpose | Edit When |
|------|---------|-----------|
| `app.js` (line 44) | Google Sheet CSV URL | Setting up / changing sheets |
| `app.js` (line 48) | Column name mapping | Renaming sheet headers |
| `generate_qr.py` (line ~100) | Default base URL | Deploying to new domain |
| `verify/index.html` | Verification page HTML | Changing UI text/layout |
| `styles.css` | All visual styles | Changing colors/fonts |

---

*AuthentiScan is open-source and free. Built with GitHub Pages + Google Sheets.*
