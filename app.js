/**
 * AuthentiScan — app.js
 * Product Authentication via Google Sheets (CSV) + GitHub Pages
 *
 * HOW IT WORKS:
 *  1. Extract token from URL parameter  (?token=XXXXXXX)
 *  2. Fetch published Google Sheet as CSV
 *  3. Parse CSV and search for matching token
 *  4. Render appropriate state card
 *
 * SETUP: Replace SHEET_CSV_URL with your own published Google Sheet CSV URL.
 *
 * To get your CSV URL:
 *   1. Open your Google Sheet
 *   2. File → Share → Publish to web
 *   3. Select sheet "Products", format "Comma-separated values (.csv)"
 *   4. Click "Publish" and copy the URL
 *   5. Paste that URL below as SHEET_CSV_URL
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURATION — Edit this section
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // Replace with your Google Sheet published CSV URL
  // Example:
  // "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv"
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfPht902sLeiY_BiRG4VHkNkbHszAWGHbgDB8uBhiVb-SVRBsfJVqfisWNRAbjO4UHLhz3lnopa6fl/pub?output=csv",

  // Column names in your Google Sheet (case-sensitive, must match headers exactly)
  COLUMNS: {
    token:           "Token",
    productName:     "ProductName",
    productCode:     "ProductCode",
    batchNumber:     "BatchNumber",
    manufacturingDate: "ManufacturingDate",
    expiryDate:      "ExpiryDate",
    status:          "Status",
    description:     "Description",
    imageURL:        "ImageURL",
  },

  // How long to cache the sheet data in sessionStorage (milliseconds)
  // 5 minutes = 300000 ms. Set 0 to disable caching.
  CACHE_TTL_MS: 300000,
};

// ─────────────────────────────────────────────────────────────
// DOM ELEMENT REFERENCES
// ─────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const STATES = {
  loading:  $("state-loading"),
  noToken:  $("state-no-token"),
  error:    $("state-error"),
  success:  $("state-success"),
};

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

/** Show one state card, hide all others */
function showState(stateName) {
  Object.entries(STATES).forEach(([name, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", name !== stateName);
  });
}

/** Format a date string (YYYY-MM-DD) to locale-friendly format */
function formatDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return "—";
  try {
    const [y, m, d] = dateStr.trim().split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Extract URL query parameter */
function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/** Sanitize text to prevent XSS */
function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str || "—";
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────
// CSV PARSER
// Handles quoted fields, commas inside quotes, newlines
// ─────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 2;
        continue;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      } else {
        field += ch;
        i++;
        continue;
      }
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      row.push(field.trim());
      field = "";
      i++;
      continue;
    }

    if (ch === "\r" && next === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      i += 2;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  // Last field/row
  if (field || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

/** Convert parsed CSV array into array of objects using header row */
function csvToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.some(cell => cell !== "")).map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = (row[i] || "").trim();
    });
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────
// GOOGLE SHEETS FETCHER (with sessionStorage caching)
// ─────────────────────────────────────────────────────────────

const CACHE_KEY = "authentiscan_products_cache";

async function fetchProducts() {
  // Try cache first
  if (CONFIG.CACHE_TTL_MS > 0) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CONFIG.CACHE_TTL_MS) {
          return data;
        }
      }
    } catch (_) { /* ignore cache errors */ }
  }

  const response = await fetch(CONFIG.SHEET_CSV_URL, {
    cache: "no-store",
    headers: { Accept: "text/csv,text/plain,*/*" },
  });

  if (!response.ok) {
    throw new Error(`Network error: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);
  const products = csvToObjects(rows);

  // Store in cache
  if (CONFIG.CACHE_TTL_MS > 0) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: products,
      }));
    } catch (_) { /* ignore quota errors */ }
  }

  return products;
}

/** Search products by token (case-insensitive) */
function findByToken(products, token) {
  const needle = token.trim().toUpperCase();
  return products.find(
    (p) => (p[CONFIG.COLUMNS.token] || "").trim().toUpperCase() === needle
  ) || null;
}

// ─────────────────────────────────────────────────────────────
// RENDER — SUCCESS
// ─────────────────────────────────────────────────────────────

function renderSuccess(product, token) {
  const C = CONFIG.COLUMNS;

  // Name
  const nameEl = $("product-name");
  if (nameEl) nameEl.textContent = product[C.productName] || "Unknown Product";

  // Image
  const imgEl  = $("product-image");
  const imgPlaceholder = $("product-image-placeholder");
  const imgUrl = (product[C.imageURL] || "").trim();

  if (imgUrl && imgEl) {
    imgEl.src = imgUrl;
    imgEl.alt = product[C.productName] || "Product";
    imgEl.onload  = () => { imgEl.classList.remove("hidden"); imgPlaceholder.classList.add("hidden"); };
    imgEl.onerror = () => { imgEl.classList.add("hidden"); imgPlaceholder.classList.remove("hidden"); };
    imgEl.classList.remove("hidden");
  } else {
    if (imgEl) imgEl.classList.add("hidden");
    if (imgPlaceholder) imgPlaceholder.classList.remove("hidden");
  }

  // Details
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val || "—"; };
  set("product-code",  product[C.productCode]);
  set("batch-number",  product[C.batchNumber]);
  set("mfg-date",      formatDate(product[C.manufacturingDate]));
  set("exp-date",      formatDate(product[C.expiryDate]));
  set("description",   product[C.description]);
  set("token-display", token.toUpperCase());

  // Timestamp
  const timeEl = $("verify-time");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `Verified at ${now.toLocaleTimeString("en-IN")} on ${now.toLocaleDateString("en-IN")}`;
  }

  showState("success");
}

// ─────────────────────────────────────────────────────────────
// RENDER — ERROR (not found)
// ─────────────────────────────────────────────────────────────

function renderNotFound(token) {
  const el = $("error-token-display");
  if (el) el.textContent = `Token: ${token.toUpperCase()}`;
  showState("error");
}

// ─────────────────────────────────────────────────────────────
// MAIN BOOTSTRAP
// ─────────────────────────────────────────────────────────────

async function init() {
  showState("loading");

  // 1. Get token from URL
  const token = getParam("token");
  if (!token || token.trim() === "") {
    showState("noToken");
    return;
  }

  // 2. Validate SHEET_CSV_URL is configured
  if (CONFIG.SHEET_CSV_URL.includes("PASTE_YOUR_SHEET_ID_HERE")) {
    console.error(
      "AuthentiScan: SHEET_CSV_URL is not configured.\n" +
      "Please edit app.js and replace PASTE_YOUR_SHEET_ID_HERE with your sheet URL."
    );
    renderNotFound(token);
    return;
  }

  // 3. Fetch and search
  try {
    const products = await fetchProducts();

    if (!products || products.length === 0) {
      throw new Error("Product database is empty or could not be read.");
    }

    const product = findByToken(products, token);

    if (product) {
      // Optional: check Status column
      // if (product[CONFIG.COLUMNS.status] !== "Genuine") { renderNotFound(token); return; }
      renderSuccess(product, token);
    } else {
      renderNotFound(token);
    }

  } catch (err) {
    console.error("AuthentiScan verification error:", err);
    renderNotFound(token);
  }
}

// Only run on the verify page (URL contains /verify/)
if (window.location.pathname.includes("/verify")) {
  document.addEventListener("DOMContentLoaded", init);
}
