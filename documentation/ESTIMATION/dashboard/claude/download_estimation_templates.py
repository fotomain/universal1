#!/usr/bin/env python3
"""Download and analyse the free construction-estimate templates listed on
https://exayard.com/ru/blog/besplatnye-shablony-smet-stroitelstva

What it does (W1 ESTIMATION, input layouts research):
  1. reads the article and takes the 12 vendors (name + vendor page);
  2. opens each vendor page and collects links to real template files
     (.xlsx .xls .xlsm .docx .doc .pdf .csv, Google Sheets / Docs "copy" or "export" links);
  3. downloads them into  templates/<NN>_<vendor>/  (size cap 15 MB, files only, nothing is run);
  4. analyses every spreadsheet / document: sheets, header rows, number of formulas,
     the column titles that are common between templates;
  5. writes  templates/templates_analysis.json  and  templates/templates_analysis.md.

Run:   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
       .venv/bin/python download_estimation_templates.py [--only 3,8] [--no-download]

Only plain HTTP GETs of public pages; no login, no form posts. Downloaded files are
data: they are opened for reading only (openpyxl read_only / pymupdf), never executed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ARTICLE = "https://exayard.com/ru/blog/besplatnye-shablony-smet-stroitelstva"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    "Accept-Language": "en,ru;q=0.8",
}
FILE_EXT = (".xlsx", ".xls", ".xlsm", ".docx", ".doc", ".pdf", ".csv")
MAX_BYTES = 15 * 1024 * 1024
OUT = Path(__file__).resolve().parent / "templates"
PAUSE = 1.2  # seconds between requests (polite)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:40] or "x"


def get(url: str, **kw) -> requests.Response:
    time.sleep(PAUSE)
    return requests.get(url, headers=HEADERS, timeout=40, allow_redirects=True, **kw)


def read_vendors() -> list[dict]:
    """The 12 numbered sections of the article: name, one-line description, vendor link."""
    html = get(ARTICLE).text
    soup = BeautifulSoup(html, "html.parser")
    vendors: list[dict] = []
    for h2 in soup.find_all("h2"):
        m = re.match(r"^(\d{1,2})\.\s*(.+)$", h2.get_text(" ", strip=True))
        if not m:
            continue
        num, title = int(m.group(1)), m.group(2)
        link = None
        text_parts: list[str] = []
        for sib in h2.find_all_next():
            if sib is h2:
                continue
            if sib.name == "h2":
                break
            if sib.name == "p" and len(text_parts) < 3:
                text_parts.append(sib.get_text(" ", strip=True))
            if sib.name == "a" and sib.get("href", "").startswith("http") and "exayard" not in sib["href"] and not link:
                link = sib["href"]
        vendors.append({"n": num, "title": title, "vendor": title.split("–")[0].strip(), "url": link, "about": " ".join(text_parts)[:600]})
    return vendors


def candidate_files(page_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    found: list[str] = []
    for a in soup.find_all("a", href=True):
        href = urljoin(page_url, a["href"])
        low = href.lower().split("?")[0]
        label = a.get_text(" ", strip=True).lower()
        if low.endswith(FILE_EXT):
            found.append(href)
        elif "docs.google.com/spreadsheets" in href or "docs.google.com/document" in href:
            m = re.search(r"/d/([\w-]+)", href)
            if m:
                kind = "spreadsheets" if "spreadsheets" in href else "document"
                fmt = "xlsx" if kind == "spreadsheets" else "docx"
                found.append(f"https://docs.google.com/{kind}/d/{m.group(1)}/export?format={fmt}")
        elif any(w in label for w in ("download", "скачать")) and urlparse(href).netloc:
            found.append(href)
    # keep order, drop duplicates
    seen, out = set(), []
    for u in found:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:8]


def download(url: str, folder: Path) -> Path | None:
    try:
        r = get(url, stream=True)
    except requests.RequestException as e:
        print(f"    ! {url} -> {e}")
        return None
    ctype = r.headers.get("content-type", "")
    if r.status_code != 200 or "text/html" in ctype:
        print(f"    - skipped (status {r.status_code}, {ctype[:30]}): {url[:90]}")
        return None
    name = None
    cd = r.headers.get("content-disposition", "")
    m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', cd)
    name = m.group(1) if m else Path(urlparse(url).path).name or "file"
    if "." not in name:
        name += ".xlsx" if "spreadsheet" in ctype or "excel" in ctype else ".bin"
    data = b""
    for chunk in r.iter_content(65536):
        data += chunk
        if len(data) > MAX_BYTES:
            print(f"    - skipped (> {MAX_BYTES // 1048576} MB): {url[:90]}")
            return None
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / re.sub(r"[^\w.\-]+", "_", name)
    path.write_bytes(data)
    print(f"    + {path.name} ({len(data) // 1024} KB)")
    return path


def analyse_file(path: Path) -> dict:
    info: dict = {"file": path.name, "bytes": path.stat().st_size, "kind": path.suffix.lower().lstrip(".")}
    try:
        if path.suffix.lower() in (".xlsx", ".xlsm"):
            import openpyxl

            wb = openpyxl.load_workbook(path, read_only=False, data_only=False)
            sheets = []
            for ws in wb.worksheets:
                formulas, headers = 0, []
                for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 400)):
                    for c in row:
                        if isinstance(c.value, str) and c.value.startswith("="):
                            formulas += 1
                for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 40), values_only=True):
                    texts = [str(v).strip() for v in row if isinstance(v, str) and v.strip() and not str(v).startswith("=")]
                    if len(texts) >= 3:  # a row with 3+ text cells = a table header candidate
                        headers = texts[:12]
                        break
                sheets.append({"sheet": ws.title, "rows": ws.max_row, "cols": ws.max_column, "formulas": formulas, "header": headers})
            info["sheets"] = sheets
        elif path.suffix.lower() == ".csv":
            lines = path.read_text(errors="replace").splitlines()[:5]
            info["head"] = lines
        elif path.suffix.lower() == ".pdf":
            import pymupdf

            d = pymupdf.open(path)
            info["pages"] = len(d)
            info["text"] = (d[0].get_text() if len(d) else "")[:600]
        elif path.suffix.lower() == ".docx":
            import zipfile

            with zipfile.ZipFile(path) as z:
                xml = z.read("word/document.xml").decode("utf8", "replace")
            text = re.sub(r"<[^>]+>", " ", xml)
            info["text"] = re.sub(r"\s+", " ", text)[:600]
    except Exception as e:  # analysis must never stop the run
        info["error"] = f"{type(e).__name__}: {e}"
    return info


def write_reports(results: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "templates_analysis.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    words = Counter()
    for r in results:
        for f in r.get("files", []):
            for s in f.get("sheets", []):
                for h in s["header"]:
                    words[h.lower()] += 1
    lines = ["# Estimate templates - analysis", "", f"Source: {ARTICLE}", ""]
    lines += ["| # | Vendor | Page | Files downloaded | Formulas | Typical columns |", "|---|---|---|---|---|---|"]
    for r in results:
        files = r.get("files", [])
        formulas = sum(s["formulas"] for f in files for s in f.get("sheets", []))
        cols = ", ".join(next((s["header"] for f in files for s in f.get("sheets", []) if s["header"]), [])[:8])
        lines.append(f"| {r['n']} | {r['vendor']} | {r.get('url') or '-'} | {len(files)} | {formulas} | {cols} |")
    lines += ["", "## Column titles that repeat across templates", ""]
    for w, n in words.most_common(25):
        if n > 1:
            lines.append(f"- {w} ({n})")
    lines += ["", "## Vendors with no downloadable file", ""]
    lines += [f"- {r['vendor']} (online form / sign-up only, see its page)" for r in results if not r.get("files")]
    (OUT / "templates_analysis.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="vendor numbers, e.g. 3,8")
    ap.add_argument("--no-download", action="store_true", help="only list the vendors and the files found")
    args = ap.parse_args()
    only = {int(x) for x in args.only.split(",")} if args.only else None

    vendors = read_vendors()
    print(f"{len(vendors)} vendors in the article")
    results = []
    for v in vendors:
        if only and v["n"] not in only:
            continue
        print(f"[{v['n']:>2}] {v['vendor']}  {v['url']}")
        res = dict(v, files=[], candidates=[])
        if v["url"]:
            try:
                page = get(v["url"])
                res["candidates"] = candidate_files(page.url, page.text) if page.ok else []
                print(f"     page {page.status_code}, {len(res['candidates'])} file link(s)")
            except requests.RequestException as e:
                print(f"     ! page failed: {e}")
        if not args.no_download:
            folder = OUT / f"{v['n']:02d}_{slug(v['vendor'])}"
            for u in res["candidates"]:
                p = download(u, folder)
                if p:
                    res["files"].append(analyse_file(p))
        results.append(res)
    write_reports(results)
    print(f"done -> {OUT}/templates_analysis.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
