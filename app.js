/**
 * AuthentiScan — app.js
 * ZAR Eyewear Product Verification
 */
 
const CONFIG = {
  SHEET_CSV_URL: "/Zar-QR-Code-Product-Verification/products.csv",
  COLUMNS: {
    token:             "Token",
    productName:       "ProductName",
    productCode:       "ProductCode",
    batchNumber:       "BatchNumber",
    manufacturingDate: "ManufacturingDate",
    expiryDate:        "ExpiryDate",
    status:            "Status",
    description:       "Description",
    imageURL:          "ImageURL",
   manufacturer: "Manufacturer",
seller: "Seller",
phone: "Phone",
email: "Email",
colour: "Colour",
frameType: "FrameType",
  },
};
 
const $ = (id) => document.getElementById(id);
 
const STATES = {
  loading: $("state-loading"),
  noToken: $("state-no-token"),
  error:   $("state-error"),
  success: $("state-success"),
};
 
function showState(stateName) {
  Object.entries(STATES).forEach(([name, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", name !== stateName);
  });
}
 
function formatDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return "—";
  try {
    // Handle both YYYY-MM-DD and M/D/YYYY formats
    let date;
    if (dateStr.includes("-")) {
      const [y, m, d] = dateStr.trim().split("-").map(Number);
      date = new Date(y, m - 1, d);
    } else if (dateStr.includes("/")) {
      const parts = dateStr.trim().split("/");
      // M/D/YYYY
      date = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
    } else {
      return dateStr;
    }
    return date.toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return dateStr; }
}
 
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
 
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false, i = 0;
 
  while (i < text.length) {
    const ch = text[i], next = text[i + 1];
 
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      field += ch; i++; continue;
    }
 
    if (ch === '"') { inQuotes = true; i++; continue; }
 
    // Support both tab and comma separated
    if (ch === "\t" || ch === ",") {
      row.push(field.trim()); field = ""; i++; continue;
    }
 
    if (ch === "\r" && next === "\n") {
      row.push(field.trim()); rows.push(row); row = []; field = ""; i += 2; continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field.trim()); rows.push(row); row = []; field = ""; i++; continue;
    }
 
    field += ch; i++;
  }
 
  if (field || row.length > 0) { row.push(field.trim()); rows.push(row); }
  return rows;
}
 
function csvToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter(r => r.some(cell => cell !== ""))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
      return obj;
    });
}
 
async function fetchProducts() {
  const response = await fetch(CONFIG.SHEET_CSV_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`CSV fetch failed: ${response.status}`);
  const text = await response.text();
  return csvToObjects(parseCSV(text));
}
 
function findByToken(products, token) {
  const needle = token.trim().toUpperCase();
  return products.find(
    p => (p[CONFIG.COLUMNS.token] || "").trim().toUpperCase() === needle
  ) || null;
}
 
function renderSuccess(product, token) {
  const C = CONFIG.COLUMNS;
 
  const nameEl = $("product-name");
  if (nameEl) nameEl.textContent = product[C.productName] || "Unknown Product";
 
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val || "—"; };
  set("product-code", product[C.productCode]);
  set("batch-number", product[C.batchNumber]);
  set("mfg-date",     formatDate(product[C.manufacturingDate]));
  set("exp-date",     formatDate(product[C.expiryDate]));
  set("description",  product[C.description]);
  set("token-display", token.toUpperCase());
 
  const timeEl = $("verify-time");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `Verified at ${now.toLocaleTimeString("en-IN")} on ${now.toLocaleDateString("en-IN")}`;
  }
 
  showState("success");
}
 
function renderNotFound(token) {
  const el = $("error-token-display");
  if (el) el.textContent = `Token: ${token.toUpperCase()}`;
  showState("error");
}
 
async function init() {
  showState("loading");
 
  const token = getParam("token");
  if (!token || token.trim() === "") {
    showState("noToken");
    return;
  }
 
  try {
    const products = await fetchProducts();
 
    if (!products || products.length === 0) {
      throw new Error("products.csv is empty or could not be read.");
    }
 
    const product = findByToken(products, token);
    if (product) {
      renderSuccess(product, token);
    } else {
      renderNotFound(token);
    }
 
  } catch (err) {
    console.error("AuthentiScan error:", err);
    renderNotFound(token);
  }
}
 
if (window.location.pathname.includes("/verify")) {
  document.addEventListener("DOMContentLoaded", init);
}
