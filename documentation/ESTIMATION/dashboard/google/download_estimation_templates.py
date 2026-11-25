#!/usr/bin/env python3
"""
Construction Estimation Template Downloader & Structural Analyzer
Source catalog: https://exayard.com/ru/blog/besplatnye-shablony-smet-stroitelstva

Downloads all publicly accessible (non-gated) construction estimate templates
(.xlsx, .xls, .docx, .pdf, and public Google Sheets exported to .xlsx) referenced
by the Exayard Top-12 Construction Estimation Templates guide, then performs a
structural analysis of worksheets, column headers, formulas, cost breakdowns,
tax/overhead/markup blocks, and data-input layout patterns.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, parse_qs

import openpyxl
import requests
from bs4 import BeautifulSoup
from docx import Document
from pypdf import PdfReader

EXAYARD_URL = "https://exayard.com/ru/blog/besplatnye-shablony-smet-stroitelstva"
BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "templates"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
}

DIRECT_EXTS = (".xlsx", ".xls", ".xltx", ".docx", ".doc", ".pdf")
SKIP_WORDS = ("privacy", "terms", "cookie", "security", "legal", "gdpr", "policy")


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return s[:48] or "vendor"


def parse_exayard_catalog() -> list[dict[str, Any]]:
    """Fetch Exayard blog article and extract the 12 template vendors and URLs."""
    resp = requests.get(EXAYARD_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    vendors: list[dict[str, Any]] = []
    for h2 in soup.find_all("h2"):
        heading = h2.get_text(" ", strip=True)
        m = re.match(r"^(\d+)\.\s+(.+)$", heading)
        if not m:
            continue
        rank = int(m.group(1))
        title = m.group(2).strip()
        vendor_url = None
        summary_parts: list[str] = []
        for sib in h2.find_next_siblings():
            if sib.name == "h2":
                break
            txt = sib.get_text(" ", strip=True)
            if txt:
                summary_parts.append(txt)
            for a in sib.find_all("a", href=True):
                href = a["href"]
                if href.startswith("http") and "exayard.com" not in href:
                    vendor_url = href
        vendors.append(
            {
                "rank": rank,
                "name": title,
                "slug": f"{rank:02d}_{slugify(title.split('–')[0].split('-')[0])}",
                "landing_url": vendor_url,
                "exayard_summary_ru": " ".join(summary_parts)[:600],
            }
        )
    return vendors


def normalize_google_export_url(url: str) -> tuple[str, str] | None:
    """Convert a public Google Sheets/Docs /copy or /edit link to direct export URL."""
    m_sheet = re.search(r"docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if m_sheet:
        doc_id = m_sheet.group(1)
        return (
            f"https://docs.google.com/spreadsheets/d/{doc_id}/export?format=xlsx",
            f"google_sheet_{doc_id[:10]}.xlsx",
        )
    m_doc = re.search(r"docs\.google\.com/document/d/([a-zA-Z0-9_-]+)", url)
    if m_doc:
        doc_id = m_doc.group(1)
        return (
            f"https://docs.google.com/document/d/{doc_id}/export?format=docx",
            f"google_doc_{doc_id[:10]}.docx",
        )
    return None


def discover_download_links(landing_url: str) -> tuple[str, list[tuple[str, str]], str]:
    """
    Crawl a vendor landing page for direct public download links.
    Returns (status, [(url, suggested_filename)], note).
    Never bypasses email gates, logins, or anti-bot walls.
    """
    try:
        resp = requests.get(landing_url, headers=HEADERS, timeout=15, allow_redirects=True)
    except requests.RequestException as exc:
        return "TIMEOUT_OR_NETWORK_ERROR", [], str(exc)

    if resp.status_code in (403, 406, 429):
        return f"BLOCKED_HTTP_{resp.status_code}", [], f"Server returned HTTP {resp.status_code} (bot/WAF policy)."
    if resp.status_code >= 400:
        return f"HTTP_ERROR_{resp.status_code}", [], f"HTTP {resp.status_code}"

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, str] = {}

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        full = urljoin(resp.url, href)
        low = full.lower()
        if any(w in low for w in SKIP_WORDS):
            continue

        # Direct office/PDF files
        parsed = urlparse(full)
        path_low = parsed.path.lower()
        if any(path_low.endswith(ext) for ext in DIRECT_EXTS):
            fname = os.path.basename(parsed.path)
            found[full] = fname
            continue

        # Vertex42 direct download php scripts
        if "vertex42.com/files/download" in low:
            qs = parse_qs(parsed.query)
            if "file" in qs:
                base = qs["file"][0]
                if "doc.php" in low:
                    found[full] = base if base.endswith(".docx") else f"{base}.docx"
                elif "gdrive.php" in low:
                    # Resolve redirect to see if it leads to a public Google Sheet
                    try:
                        r2 = requests.get(full, headers=HEADERS, timeout=12, allow_redirects=True)
                        g = normalize_google_export_url(r2.url)
                        if g:
                            found[g[0]] = f"vertex42_{base}.xlsx"
                    except requests.RequestException:
                        pass
                elif "themed.php" in low or "xls" in low:
                    found[full] = base if base.endswith(".xlsx") else f"{base}.xlsx"
            continue

        # Direct Google Sheets / Docs links
        g = normalize_google_export_url(full)
        if g:
            found[g[0]] = g[1]
            continue

    # Also check Vertex42 onclick/Excel download links embedded in JS/HTML
    if "vertex42.com" in resp.url:
        for m in re.finditer(r"['\"]([^'\"]*Files/download2/[^'\"]+)['\"]", html):
            u = urljoin(resp.url, m.group(1))
            if "themed.php" in u or "doc.php" in u:
                qs = parse_qs(urlparse(u).query)
                base = qs.get("file", ["template"])[0]
                ext = ".docx" if "doc.php" in u else ".xlsx"
                found[u] = base if base.endswith(ext) else f"{base}{ext}"

    if found:
        return "DIRECT_AVAILABLE", list(found.items()), f"Found {len(found)} direct file URL(s)."

    # Classify why no direct link was present
    low_html = html.lower()
    if any(k in low_html for k in ("hubspot", "type=\"email\"", "email address", "work email", "enter your email", "get the template")):
        return "EMAIL_GATED_FORM", [], "Template requires submitting an email lead-capture form on vendor site."
    return "WEB_APP_OR_INTERACTIVE_ONLY", [], "Vendor provides an interactive online builder rather than a static file download."


def download_file(url: str, dest: Path) -> tuple[bool, str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=25, allow_redirects=True)
        if r.status_code != 200:
            return False, f"HTTP {r.status_code}"
        ctype = (r.headers.get("Content-Type") or "").lower()
        if "text/html" in ctype and dest.suffix.lower() in DIRECT_EXTS:
            # Sometimes a download script returns an HTML interstitial/redirect page
            m = re.search(r'href=["\'](https?://[^"\']+\.(?:xlsx|xls|docx|pdf))["\']', r.text, re.I)
            if m:
                r = requests.get(m.group(1), headers=HEADERS, timeout=25, allow_redirects=True)
                ctype = (r.headers.get("Content-Type") or "").lower()
                if r.status_code != 200 or "text/html" in ctype:
                    return False, f"HTML interstitial (Content-Type: {ctype})"
            else:
                return False, f"Returned HTML instead of binary file ({ctype})"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(r.content)
        return True, f"{len(r.content)} bytes"
    except requests.RequestException as exc:
        return False, str(exc)


def analyze_xlsx(path: Path) -> dict[str, Any]:
    wb_f = openpyxl.load_workbook(path, data_only=False)
    wb_v = openpyxl.load_workbook(path, data_only=True)
    sheets_info = []
    total_formulas = 0
    all_headers: list[str] = []
    detected_sections: list[str] = []
    detected_totals: list[str] = []

    section_keywords = (
        "labor", "labour", "material", "equipment", "subcontract", "permit",
        "overhead", "markup", "profit", "tax", "vat", "contingency", "subtotal",
        "total", "phase", "site", "foundation", "framing", "electrical", "plumbing",
        "finish", "summary", "scope", "client", "vendor", "unit", "qty", "quantity",
        "rate", "cost", "price", "amount", "description", "item", "hours", "discount",
    )

    for name in wb_f.sheetnames:
        ws_f = wb_f[name]
        ws_v = wb_v[name]
        max_r = min(ws_f.max_row or 0, 250)
        max_c = min(ws_f.max_column or 0, 30)
        formulas = []
        candidate_header_rows = []
        non_empty_rows = 0

        for r in range(1, max_r + 1):
            row_vals = []
            for c in range(1, max_c + 1):
                vf = ws_f.cell(r, c).value
                vv = ws_v.cell(r, c).value
                if isinstance(vf, str) and vf.startswith("="):
                    formulas.append(f"{ws_f.cell(r, c).coordinate}: {vf}")
                val = vv if vv is not None else vf
                if val is not None and str(val).strip() != "":
                    row_vals.append((c, str(val).strip()))
            if not row_vals:
                continue
            non_empty_rows += 1
            joined = " ".join(v for _, v in row_vals).lower()
            # Header heuristic: >= 3 short text cells containing estimation header terms
            text_cells = [v for _, v in row_vals if not v.startswith("=") and len(v) <= 45]
            kw_hits = sum(1 for kw in ("description", "item", "qty", "quantity", "unit", "rate", "price", "cost", "amount", "total", "labor", "material", "hours", "category", "phase", "task", "subtotal", "tax") if kw in joined)
            if len(text_cells) >= 3 and kw_hits >= 2:
                candidate_header_rows.append({"row": r, "columns": text_cells[:12]})
            # Totals/summary labels
            for _, v in row_vals:
                vl = v.lower()
                if any(t in vl for t in ("subtotal", "grand total", "total estimate", "total cost", "tax", "markup", "overhead", "profit", "contingency", "discount", "deposit")):
                    if len(v) <= 60 and not v.startswith("=") and v not in detected_totals:
                        detected_totals.append(v)
            # Single-cell section headers
            if len(row_vals) <= 2 and len(row_vals[0][1]) <= 65 and not row_vals[0][1].startswith("="):
                v0 = row_vals[0][1]
                if any(k in v0.lower() for k in section_keywords) and v0 not in detected_sections:
                    detected_sections.append(v0)

        total_formulas += len(formulas)
        best_headers = candidate_header_rows[0]["columns"] if candidate_header_rows else []
        all_headers.extend(best_headers)
        sheets_info.append(
            {
                "sheet_name": name,
                "rows": ws_f.max_row,
                "cols": ws_f.max_column,
                "non_empty_rows": non_empty_rows,
                "formula_count": len(formulas),
                "sample_formulas": formulas[:6],
                "detected_table_headers": candidate_header_rows[:3],
            }
        )

    # Classify input layout paradigm
    hdr_blob = " ".join(all_headers + detected_sections + detected_totals).lower()
    if len(wb_f.sheetnames) >= 2 and any(k in hdr_blob for k in ("phase", "summary", "dashboard", "pre-construction", "site")):
        layout_type = "Multi-Sheet Phase / WBS Workbook (Summary + Detail Tabs)"
    elif "labor" in hdr_blob and "material" in hdr_blob and ("hours" in hdr_blob or "rate" in hdr_blob):
        layout_type = "Split Labor & Materials Grid (Dual-Resource Cost Matrix)"
    elif any(k in hdr_blob for k in ("markup", "overhead", "margin", "contingency")):
        layout_type = "Cost-Plus / Markup Line-Item Estimator"
    else:
        layout_type = "Flat Line-Item Quote Table (Qty × Unit Rate → Subtotal/Tax/Total)"

    return {
        "file_type": "xlsx",
        "sheet_count": len(wb_f.sheetnames),
        "sheet_names": wb_f.sheetnames,
        "total_formulas": total_formulas,
        "layout_archetype": layout_type,
        "detected_totals_and_markups": detected_totals[:15],
        "detected_sections": detected_sections[:15],
        "sheets": sheets_info,
    }


def analyze_docx(path: Path) -> dict[str, Any]:
    doc = Document(path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    tables_info = []
    for idx, t in enumerate(doc.tables):
        headers = [cell.text.strip().replace("\n", " ") for cell in t.rows[0].cells] if t.rows else []
        headers = [h for h in headers if h]
        tables_info.append(
            {
                "table_index": idx + 1,
                "rows": len(t.rows),
                "cols": len(t.columns),
                "first_row_headers": headers[:10],
            }
        )
    return {
        "file_type": "docx",
        "paragraph_count": len(paragraphs),
        "table_count": len(doc.tables),
        "sample_headings": paragraphs[:12],
        "tables": tables_info[:6],
        "layout_archetype": "Client-Facing Narrative & Table Proposal (Word Document)",
    }


def analyze_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    pages_text = []
    for p in reader.pages[:5]:
        pages_text.append((p.extract_text() or "").strip())
    full = "\n".join(pages_text)
    lines = [ln.strip() for ln in full.splitlines() if ln.strip()]
    return {
        "file_type": "pdf",
        "page_count": len(reader.pages),
        "has_fillable_fields": bool(reader.get_fields()),
        "fillable_field_count": len(reader.get_fields() or {}),
        "sample_lines": lines[:20],
        "layout_archetype": "Fillable / Printable Client Quote Form (PDF)",
    }


def analyze_file(path: Path) -> dict[str, Any]:
    ext = path.suffix.lower()
    try:
        if ext == ".xlsx":
            return analyze_xlsx(path)
        if ext == ".docx":
            return analyze_docx(path)
        if ext == ".pdf":
            return analyze_pdf(path)
        return {"file_type": ext.lstrip("."), "note": "Unsupported binary parser"}
    except Exception as exc:
        return {"file_type": ext.lstrip("."), "parse_error": str(exc)}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[1/3] Fetching template directory from {EXAYARD_URL} ...")
    vendors = parse_exayard_catalog()
    print(f"      Found {len(vendors)} vendors listed in Exayard article.")

    results: list[dict[str, Any]] = []
    total_downloaded = 0

    print("[2/3] Crawling vendor landing pages and downloading public templates ...")
    for v in vendors:
        slug = v["slug"]
        url = v["landing_url"]
        entry = dict(v)
        entry["downloaded_files"] = []

        if not url:
            entry["status"] = "NO_LINK_IN_ARTICLE"
            entry["note"] = "Exayard did not hyperlink this vendor (HubSpot uses an email-gated form)."
            results.append(entry)
            print(f"  - {slug}: NO_LINK_IN_ARTICLE")
            continue

        status, links, note = discover_download_links(url)
        entry["status"] = status
        entry["note"] = note

        if status == "DIRECT_AVAILABLE":
            v_dir = OUT_DIR / slug
            v_dir.mkdir(parents=True, exist_ok=True)
            for dl_url, fname in links:
                dest = v_dir / fname
                ok, info = download_file(dl_url, dest)
                if ok:
                    total_downloaded += 1
                    analysis = analyze_file(dest)
                    entry["downloaded_files"].append(
                        {
                            "filename": fname,
                            "relative_path": str(dest.relative_to(BASE_DIR)),
                            "source_url": dl_url,
                            "size_info": info,
                            "analysis": analysis,
                        }
                    )
                    print(f"  + {slug}/{fname} ({info}) -> {analysis.get('layout_archetype', analysis.get('file_type'))}")
                else:
                    entry.setdefault("failed_urls", []).append({"url": dl_url, "reason": info})
                    print(f"  ! {slug}/{fname} skipped: {info}")
            if not entry["downloaded_files"]:
                entry["status"] = "INTERSTITIAL_OR_GATED"
        else:
            print(f"  - {slug}: {status} ({note})")

        results.append(entry)

    print(f"[3/3] Writing structural analysis report ({total_downloaded} files downloaded) ...")
    summary = {
        "source_article": EXAYARD_URL,
        "vendors_cataloged": len(results),
        "vendors_with_direct_downloads": sum(1 for r in results if r["downloaded_files"]),
        "total_files_downloaded": total_downloaded,
        "vendors": results,
    }
    json_path = OUT_DIR / "templates_analysis.json"
    json_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    # Write concise Markdown summary
    md_lines = [
        "# Exayard Top-12 Construction Estimation Templates — Download & Structural Analysis",
        "",
        f"- **Source Catalog**: {EXAYARD_URL}",
        f"- **Vendors Cataloged**: {summary['vendors_cataloged']}",
        f"- **Vendors with Direct Public Files**: {summary['vendors_with_direct_downloads']}",
        f"- **Total Files Downloaded & Parsed**: {summary['total_files_downloaded']}",
        "",
        "## Vendor Matrix",
        "",
        "| # | Vendor | Acquisition Status | Files Downloaded | Primary Layout Archetype |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        files = r["downloaded_files"]
        f_names = ", ".join(f["filename"] for f in files) if files else "—"
        archetypes = sorted({f["analysis"].get("layout_archetype", "") for f in files if f.get("analysis")})
        arch_str = "; ".join(a for a in archetypes if a) or r["note"]
        md_lines.append(f"| {r['rank']} | {r['name']} | `{r['status']}` | {f_names} | {arch_str} |")

    md_path = OUT_DIR / "templates_analysis.md"
    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(f"Done! JSON -> {json_path}\n      MD   -> {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
