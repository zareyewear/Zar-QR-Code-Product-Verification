#!/usr/bin/env python3
"""
AuthentiScan — generate_qr.py
===============================
Reads products.xlsx, generates a unique QR code for each product,
saves QR images into a folder, and outputs a summary CSV.

REQUIREMENTS (install once):
    pip install qrcode[pil] openpyxl pillow pandas

USAGE:
    python generate_qr.py

    Optional arguments:
    python generate_qr.py --input products.xlsx --output qrcodes --base-url https://yourusername.github.io/verify

WHAT IT DOES:
    1. Reads products.xlsx (or any .xlsx / .csv file)
    2. Generates a unique 10-character alphanumeric token per product
       (if a token doesn't already exist)
    3. Creates a QR code image: qrcodes/TOKEN_ProductCode.png
    4. Writes updated tokens back to products_with_tokens.xlsx
    5. Outputs qr_summary.csv with all tokens and QR URLs
"""

import os
import re
import sys
import csv
import random
import string
import argparse
import hashlib
from pathlib import Path
from datetime import datetime

# ── Dependency check ──────────────────────────────────────────
MISSING = []
try:
    import qrcode
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
except ImportError:
    MISSING.append("qrcode[pil]")

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    MISSING.append("Pillow")

try:
    import openpyxl
except ImportError:
    MISSING.append("openpyxl")

try:
    import pandas as pd
except ImportError:
    MISSING.append("pandas")

if MISSING:
    print("❌  Missing packages. Install them with:")
    print(f"    pip install {' '.join(MISSING)}")
    sys.exit(1)

# ── Constants ─────────────────────────────────────────────────
TOKEN_CHARS    = string.ascii_uppercase + string.digits   # A-Z, 0-9
TOKEN_LENGTH   = 10   # e.g.  8F2K9X7P4M
QR_VERSION     = 3    # 1–40; 3 is good for short URLs up to ~80 chars
QR_BOX_SIZE    = 12   # pixels per module
QR_BORDER      = 3    # quiet-zone modules around QR
QR_ERROR_CORR  = qrcode.constants.ERROR_CORRECT_M   # 15% recovery
IMAGE_SIZE_PX  = 400  # final PNG dimension (square)
BRAND_LABEL    = "AuthentiScan"  # printed under QR

# ── Argument parsing ──────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser(
        description="Generate QR codes for AuthentiScan product list"
    )
    p.add_argument(
        "--input",  "-i",
        default="products.xlsx",
        help="Path to input Excel (.xlsx) or CSV file (default: products.xlsx)"
    )
    p.add_argument(
        "--output", "-o",
        default="qrcodes",
        help="Output folder for QR images (default: qrcodes)"
    )
    p.add_argument(
        "--base-url", "-u",
        default="https://yourusername.github.io/verify",
        help="Base URL for verification (default: https://yourusername.github.io/verify)"
    )
    p.add_argument(
        "--token-length", "-t",
        type=int,
        default=TOKEN_LENGTH,
        help=f"Token length (default: {TOKEN_LENGTH})"
    )
    return p.parse_args()

# ── Token generator ───────────────────────────────────────────
def generate_token(length: int, existing: set) -> str:
    """Generate a unique random alphanumeric token."""
    attempts = 0
    while True:
        token = "".join(random.choices(TOKEN_CHARS, k=length))
        if token not in existing:
            existing.add(token)
            return token
        attempts += 1
        if attempts > 10_000:
            raise RuntimeError("Too many token collisions — increase TOKEN_LENGTH.")

# ── QR Code creation ──────────────────────────────────────────
def make_qr_image(url: str) -> Image.Image:
    """Create a styled QR code PIL image from a URL."""
    qr = qrcode.QRCode(
        version          = QR_VERSION,
        error_correction = QR_ERROR_CORR,
        box_size         = QR_BOX_SIZE,
        border           = QR_BORDER,
    )
    qr.add_data(url)
    qr.make(fit=True)

    try:
        img = qr.make_image(
            image_factory  = StyledPilImage,
            module_drawer  = RoundedModuleDrawer(),
            fill_color     = "#0a0a0a",
            back_color     = "#ffffff",
        )
    except Exception:
        # Fall back to plain QR if styled fails
        img = qr.make_image(fill_color="#0a0a0a", back_color="#ffffff")

    return img.convert("RGB")

def add_label(img: Image.Image, top_text: str, bottom_text: str) -> Image.Image:
    """
    Add product name above and brand label below the QR.
    Creates a new taller image with text strips.
    """
    qr_w, qr_h = img.size
    padding_top    = 48
    padding_bottom = 56
    total_h        = qr_h + padding_top + padding_bottom
    canvas = Image.new("RGB", (qr_w, total_h), "#ffffff")
    canvas.paste(img, (0, padding_top))

    draw = ImageDraw.Draw(canvas)

    # Try system font; fall back to default
    font_top = font_bot = None
    for font_path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                       "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                       "C:/Windows/Fonts/arial.ttf"]:
        if os.path.exists(font_path):
            try:
                font_top = ImageFont.truetype(font_path, 18)
                font_bot = ImageFont.truetype(font_path, 14)
            except Exception:
                pass
            break

    # Top label: product name
    if top_text:
        bbox = draw.textbbox((0, 0), top_text, font=font_top)
        tw = bbox[2] - bbox[0]
        draw.text(((qr_w - tw) // 2, 14), top_text, fill="#0a0a0a", font=font_top)

    # Bottom label: brand
    if bottom_text:
        draw.rectangle([(0, qr_h + padding_top), (qr_w, total_h)], fill="#0a0a0a")
        bbox = draw.textbbox((0, 0), bottom_text, font=font_bot)
        bw = bbox[2] - bbox[0]
        draw.text(
            ((qr_w - bw) // 2, qr_h + padding_top + 18),
            bottom_text,
            fill="#ffffff",
            font=font_bot
        )

    # Resize to fixed dimension
    canvas = canvas.resize((IMAGE_SIZE_PX, int(IMAGE_SIZE_PX * total_h / qr_w)), Image.LANCZOS)
    return canvas

# ── Load product data ─────────────────────────────────────────
def load_products(path: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    if p.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(p, dtype=str)
    elif p.suffix.lower() == ".csv":
        df = pd.read_csv(p, dtype=str)
    else:
        raise ValueError(f"Unsupported file type: {p.suffix}")

    df.fillna("", inplace=True)

    # Normalize column names (strip whitespace)
    df.columns = [c.strip() for c in df.columns]

    return df

# ── Main ──────────────────────────────────────────────────────
def main():
    args = parse_args()

    base_url     = args.base_url.rstrip("/")
    output_dir   = Path(args.output)
    token_length = args.token_length

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"📂  Loading: {args.input}")
    df = load_products(args.input)

    # Ensure Token column exists
    if "Token" not in df.columns:
        df.insert(0, "Token", "")
        print("ℹ️   'Token' column not found — it will be created.")

    # Collect existing tokens to ensure uniqueness
    existing_tokens: set = set(df["Token"].dropna().str.strip().str.upper().tolist())
    existing_tokens.discard("")

    total   = len(df)
    skipped = 0
    created = 0
    errors  = 0
    summary_rows = []

    print(f"🔢  Processing {total} product(s)…\n")

    for idx, row in df.iterrows():
        product_code = str(row.get("ProductCode", f"ROW{idx+2}")).strip() or f"ROW{idx+2}"
        product_name = str(row.get("ProductName", "Product")).strip()

        # Assign token if missing
        token = str(row.get("Token", "")).strip().upper()
        if not token:
            token = generate_token(token_length, existing_tokens)
            df.at[idx, "Token"] = token

        # Build URL
        url = f"{base_url}/?token={token}"

        # Output filename: TOKEN_PRODUCTCODE.png (alphanumeric safe)
        safe_code = re.sub(r"[^A-Za-z0-9_-]", "_", product_code)
        filename  = output_dir / f"{token}_{safe_code}.png"

        # Skip if already generated (re-run safe)
        if filename.exists():
            skipped += 1
            summary_rows.append({"Token": token, "ProductCode": product_code,
                                  "ProductName": product_name, "QR_URL": url,
                                  "QR_File": str(filename), "Status": "Skipped"})
            continue

        try:
            qr_img    = make_qr_image(url)
            final_img = add_label(qr_img, product_name, f"🛡 {BRAND_LABEL}")
            final_img.save(str(filename), "PNG", optimize=True)

            summary_rows.append({"Token": token, "ProductCode": product_code,
                                  "ProductName": product_name, "QR_URL": url,
                                  "QR_File": str(filename), "Status": "Created"})
            created += 1
            print(f"  ✅ [{idx+1:>4}/{total}] {product_code} → {filename.name}")

        except Exception as e:
            summary_rows.append({"Token": token, "ProductCode": product_code,
                                  "ProductName": product_name, "QR_URL": url,
                                  "QR_File": "", "Status": f"Error: {e}"})
            errors += 1
            print(f"  ❌ [{idx+1:>4}/{total}] {product_code} — ERROR: {e}")

    # ── Save updated Excel with tokens ────────────────────────
    out_xlsx = Path(args.input).stem + "_with_tokens.xlsx"
    df.to_excel(out_xlsx, index=False)
    print(f"\n💾  Saved updated file with tokens → {out_xlsx}")

    # ── Save summary CSV ──────────────────────────────────────
    summary_path = output_dir / "qr_summary.csv"
    with open(summary_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Token","ProductCode","ProductName","QR_URL","QR_File","Status"])
        w.writeheader()
        w.writerows(summary_rows)
    print(f"📋  Summary CSV → {summary_path}")

    # ── Final report ──────────────────────────────────────────
    print(f"""
╔══════════════════════════════════════╗
║        QR Generation Complete        ║
╠══════════════════════════════════════╣
║  Total products : {total:>5}                ║
║  QR codes created: {created:>4}                ║
║  Skipped (exist): {skipped:>4}                ║
║  Errors          : {errors:>4}                ║
╠══════════════════════════════════════╣
║  QR images saved in: ./{str(output_dir):<18}  ║
╚══════════════════════════════════════╝

NEXT STEPS:
  1. Upload tokens to your Google Sheet.
     (Copy Token column from {out_xlsx})
  2. Upload QR images to your packaging printer.
  3. Deploy your GitHub Pages site.
  4. Test by scanning a QR code with your phone.
""")

if __name__ == "__main__":
    main()
