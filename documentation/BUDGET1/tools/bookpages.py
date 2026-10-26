#!/usr/bin/env python3
"""
BUDGET1: the blocks of the book + the PAGE of every block.

Used by build_book.py (the HTML of the book) and build_wbs_sql.py (the WBS names carry the page of the book: "(145)").

The .doc does not store its page breaks (Word lays the pages out when it opens the file), but the table of contents of the book gives the exact page of
every heading (75 of them). Between two headings the page of a block is interpolated by the SIZE of the blocks: characters of text, rows and characters of
tables, height of pictures. The three weights are fitted by least squares on the segments between the headings, so a heavy table does not push the
estimate. Headings: exact. Anything else: an estimate (+-1..2 pages); the HTML shows it as `стр. N` on the margin.
"""
import html
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
BUILD = HERE.parent / 'build'

PIC_RE = re.compile(r'⟦(\d+)⟧')


def norm(s):
    return ''.join(c.lower() for c in s if c.isalnum())


def strip_tags(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).replace('\xa0', ' ')


# ------------------------------------------------------------------ the blocks
def parse_blocks(marked):
    """[{'kind': 'p'|'table', 'cls': 'p17', 'html': inner html, 'text': plain text, 'rows': n}]  (the body of textutil is flat: p and table)"""
    body = marked[marked.find('<body'):]
    out = []
    pos = 0
    pat = re.compile(r'<p class="(p\d+)">(.*?)</p>|(<table.*?</table>)', re.S)
    for m in pat.finditer(body):
        if m.group(3):
            t = m.group(3)
            out.append({'kind': 'table', 'cls': '', 'html': t, 'text': re.sub(r'\s+', ' ', strip_tags(re.sub(r'</t[dh]>', ' | ', t))).strip(),
                        'rows': len(re.findall(r'<tr', t))})
        else:
            out.append({'kind': 'p', 'cls': m.group(1), 'html': m.group(2), 'text': re.sub(r'\s+', ' ', strip_tags(m.group(2))).strip(), 'rows': 0})
    return out


FIELD_RES = [re.compile(r'\s*HYPERLINK\s+\\l\s+"[^"]*"\s*'), re.compile(r'\s*EMBED\s+Equation\.3\s*'), re.compile(r'\s*PAGEREF\s+_Toc\d+\s+\\h\s*'),
             re.compile(r'\s*TOC\s+\\o\s+"[^"]*"\s+\\h\s+\\z\s*')]


def clean_text(t):
    for r in FIELD_RES:
        t = r.sub(' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def toc_entries(blocks):
    """[(title, page)] from the table of contents of the book (the field results HYPERLINK ... PAGEREF ... N)"""
    out = []
    for b in blocks:
        m = re.match(r'^\s*HYPERLINK\s+\\l\s+"_Toc\d+"\s*(.*?)\s*PAGEREF\s+_Toc\d+\s+\\h\s*(\d+)\s*$', b['text'])
        if b['kind'] == 'p' and m:
            out.append((m.group(1).strip(), int(m.group(2))))
    return out


def level_of(title):
    if re.match(r'^Глава\s+\d+', title):
        return 1
    m = re.match(r'^(\d+(?:\.\d+)+)\.?\s', title + ' ')
    if m:
        return 1 + m.group(1).count('.')
    return 2 if title.startswith('Заключение к главе') else 1


def mark_headings(blocks, toc):
    """block['heading'] = (level, page) for the body paragraphs that are an entry of the TOC (in order); the TOC itself is dropped"""
    first_toc = next(i for i, b in enumerate(blocks) if b['kind'] == 'p' and 'PAGEREF' in b['text'])
    last_toc = max(i for i, b in enumerate(blocks) if b['kind'] == 'p' and 'PAGEREF' in b['text'])
    for i in range(first_toc - 1, last_toc + 1):
        if blocks[i]['kind'] == 'p' and re.match(r'^\s*(TOC\b|HYPERLINK)', blocks[i]['text']):
            blocks[i]['drop'] = True
    j = last_toc + 1
    heads = []
    for title, page in toc:
        key = norm(title)
        k = j
        while k < len(blocks):
            b = blocks[k]
            if b['kind'] == 'p' and norm(clean_text(b['text'])) == key:
                break
            k += 1
        if k >= len(blocks):
            raise SystemExit('heading not found in the body: ' + title)
        blocks[k]['heading'] = (level_of(title), page)
        blocks[k]['title'] = title
        heads.append(k)
        j = k + 1
    return heads


# ------------------------------------------------------------------ the pages
def features(b, fig_h):
    txt = clean_text(PIC_RE.sub('', b['text']))
    f_chars = len(txt)
    f_rows = b['rows']
    f_cell = len(txt) if b['kind'] == 'table' else 0
    f_pic = sum(fig_h.get(int(n), 0) for n in PIC_RE.findall(b['text'] if b['kind'] == 'p' else b['html']))
    if b['kind'] == 'table':
        f_chars = 0
    return [f_chars, f_rows, f_cell, f_pic]


def solve(A, y, ridge=1e-6):
    """least squares by the normal equations (no numpy): small, the unknowns are 4"""
    n = len(A[0])
    M = [[sum(A[k][i] * A[k][j] for k in range(len(A))) + (ridge if i == j else 0) for j in range(n)] for i in range(n)]
    v = [sum(A[k][i] * y[k] for k in range(len(A))) for i in range(n)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(M[r][i]))
        M[i], M[p] = M[p], M[i]
        v[i], v[p] = v[p], v[i]
        for r in range(i + 1, n):
            f = M[r][i] / M[i][i]
            for c in range(i, n):
                M[r][c] -= f * M[i][c]
            v[r] -= f * v[i]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (v[i] - sum(M[i][j] * x[j] for j in range(i + 1, n))) / M[i][i]
    return x


def assign_pages(blocks, heads, fig_h):
    for b in blocks:
        b['feat'] = features(b, fig_h)
    segs = []
    for a, z in zip(heads, heads[1:]):
        pa, pz = blocks[a]['heading'][1], blocks[z]['heading'][1]
        s = [0.0] * 4
        for b in blocks[a:z]:
            if b.get('drop'):
                continue
            for i in range(4):
                s[i] += b['feat'][i]
        if pz > pa:
            segs.append((s, pz - pa))
    w = solve([s for s, _ in segs], [d for _, d in segs])
    w = [max(x, 0.0) for x in w]
    if w[0] <= 0:
        w[0] = 1.0 / 3000                                   # ~3000 characters a page
    wsum = lambda f: sum(w[i] * f[i] for i in range(4)) + 1e-9
    last = len(blocks)
    bounds = heads + [last]
    for a, z in zip(bounds, bounds[1:]):
        pa = blocks[a]['heading'][1]
        pz = blocks[z]['heading'][1] if z < last else pa + 2           # after the last heading (Литература): 2 pages
        tot = sum(wsum(b['feat']) for b in blocks[a:z] if not b.get('drop')) or 1.0
        cum = 0.0
        for b in blocks[a:z]:
            if b.get('drop'):
                continue
            b['page_f'] = pa + (pz - pa) * cum / tot
            cum += wsum(b['feat'])
    # blocks before the first heading: the front matter
    for b in blocks[:heads[0]]:
        b['page_f'] = 1.0
    for b in blocks:
        b['page'] = int(b.get('page_f', 1.0) + 1e-9)
        if 'heading' in b:
            b['page'] = b['heading'][1]
    return w


def load(build=BUILD, fig_heights=None):
    marked = (pathlib.Path(build) / 'marked.html').read_text(encoding='utf-8')
    blocks = parse_blocks(marked)
    toc = toc_entries(blocks)
    heads = mark_headings(blocks, toc)
    if fig_heights is None:
        fig_heights = {}
        pj = pathlib.Path(build) / 'figure_heights.json'
        if pj.exists():
            fig_heights = {int(k): v for k, v in json.loads(pj.read_text()).items()}
    w = assign_pages(blocks, heads, fig_heights)
    return blocks, toc, heads, w


def find(blocks, anchor, start=0, regex=False):
    """the first block (index >= start) whose text starts with / contains the anchor; SystemExit when there is none (a wrong anchor must not pass silently)"""
    a = clean_text(anchor)
    for i in range(start, len(blocks)):
        b = blocks[i]
        if b.get('drop'):
            continue
        t = clean_text(PIC_RE.sub('', b['text']))
        if (re.search(anchor, t) if regex else (t.startswith(a) or a in t)):
            return i
    raise SystemExit('anchor not found: ' + anchor)


if __name__ == '__main__':
    blocks, toc, heads, w = load()
    print('weights (pages per char, per row, per cell char, per px):', ['%.6f' % x for x in w])
    print('blocks', len(blocks), 'headings', len(heads))
    for a in sys.argv[1:]:
        i = find(blocks, a)
        print(a, '->', blocks[i]['page'], '%.2f' % blocks[i].get('page_f', 0), blocks[i]['text'][:70])
