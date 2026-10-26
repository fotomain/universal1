#!/usr/bin/env python3
"""
BUDGET1 step 1: the Word 97-2003 book (.doc) -> work folder.

Needs:  pip install olefile        (the macOS tool `textutil` makes the text / tables, this script finds the PICTURES)
Run:    python3 extract_doc.py "/path/Щиборщ.doc" documentation/BUDGET1/build

Why this script exists: `textutil -convert html` drops every picture of the .doc. The book has 131 of them (57 schemes, 11 figures, formula images, small tables).
The script reads the binary file itself:
  1. WordDocument + 1Table streams  -> the text with the picture characters (0x01) and the Data offset of each picture (sprmCPicLocation)
  2. Data stream                    -> the OfficeArt blips (PNG / WMF) of every picture
  3. textutil html                  -> the readable body; each picture is put at its place by matching the text that precedes it
Output (folder `build/`):
  book.html       textutil html of the book
  marked.html     the same, with the marker  ⟦n⟧  at the place of picture n   (n = 1..131, the order of the book)
  fig/NNN.png     the pictures (WMF = the 6 formulas made by the Equation Editor: fig/NNN.wmf)
  equations.json  the 7 Equation Editor formulas of the book, decoded (MTEF) as plain text
  pictures.json   per picture: n, file, character position in the text, the caption before it
"""
import bisect
import html
import json
import os
import pathlib
import re
import struct
import subprocess
import sys
import zlib

try:
    import olefile
except ImportError:                                   # pragma: no cover
    sys.exit('pip install olefile')

SPRA = {0: 1, 1: 1, 2: 2, 3: 4, 4: 2, 5: 2, 7: 3}


# ------------------------------------------------------------------ the binary .doc: text + pieces + character properties
def load(path):
    ole = olefile.OleFileIO(path)
    wd = ole.openstream('WordDocument').read()
    tbl = ole.openstream('1Table' if struct.unpack_from('<H', wd, 10)[0] & 0x200 else '0Table').read()
    return ole, wd, tbl


def fib(wd):
    base = 154
    pair = lambda i: struct.unpack_from('<II', wd, base + i * 8)       # (fc, lcb) of the i-th FibRgFcLcb97 entry
    return struct.unpack_from('<I', wd, 64 + 12)[0], pair(12), pair(33)  # ccpText, PlcBteChpx, Clx


def pieces(tbl, fc_clx, lcb_clx):
    p = fc_clx
    while tbl[p] == 1:
        p += 3 + struct.unpack_from('<H', tbl, p + 1)[0]
    lcb = struct.unpack_from('<I', tbl, p + 1)[0]
    p += 5
    n = (lcb - 4) // 12
    cps = struct.unpack_from('<%dI' % (n + 1), tbl, p)
    p += 4 * (n + 1)
    out = []
    for i in range(n):
        _flags, fc, _prm = struct.unpack_from('<HIH', tbl, p + 8 * i)
        comp = bool(fc & 0x40000000)
        fcr = fc & 0x3FFFFFFF
        out.append((cps[i], cps[i + 1], fcr // 2 if comp else fcr, comp))
    return out


def full_text(wd, pcs):
    parts = []
    for cp0, cp1, fc, comp in pcs:
        n = cp1 - cp0
        parts.append(wd[fc:fc + n].decode('cp1251', errors='replace') if comp else wd[fc:fc + 2 * n].decode('utf-16-le', errors='replace'))
    return ''.join(parts)


def cp_to_fc(pcs, cp):
    for cp0, cp1, fc, comp in pcs:
        if cp0 <= cp < cp1:
            return fc + (cp - cp0) * (1 if comp else 2)
    return None


def chpx_ranges(wd, tbl, fc_bte, lcb_bte):
    n = (lcb_bte - 4) // 8
    pns = struct.unpack_from('<%dI' % n, tbl, fc_bte + 4 * (n + 1))
    out = []
    for pn in pns:
        pg = wd[pn * 512:(pn + 1) * 512]
        crun = pg[511]
        rgfc = struct.unpack_from('<%dI' % (crun + 1), pg, 0)
        for i in range(crun):
            off = pg[4 * (crun + 1) + i] * 2
            out.append((rgfc[i], rgfc[i + 1], pg[off + 1:off + 1 + pg[off]] if off else b''))
    out.sort(key=lambda r: r[0])
    return out


def sprms(grpprl):
    p = 0
    out = {}
    while p + 2 <= len(grpprl):
        sp = struct.unpack_from('<H', grpprl, p)[0]
        p += 2
        spra = sp >> 13
        if spra == 6:
            ln = grpprl[p]
            val = grpprl[p + 1:p + 1 + ln]
            p += 1 + ln
        else:
            ln = SPRA[spra]
            val = grpprl[p:p + ln]
            p += ln
        out[sp] = val
    return out


# ------------------------------------------------------------------ the pictures
def blips(data):
    """every blip of the Data stream: {offset: (ext, bytes)}"""
    spec = {0xF01A: ('emf', (0x3D4, 0x3D5)), 0xF01B: ('wmf', (0x216, 0x217)), 0xF01C: ('pict', (0x542, 0x543)),
            0xF01D: ('jpg', (0x46A, 0x46B, 0x6E2, 0x6E3)), 0xF01E: ('png', (0x6E0, 0x6E1)), 0xF01F: ('dib', (0x7A8, 0x7A9))}
    found = {}
    for rtype, (ext, insts) in spec.items():
        for m in re.finditer(re.escape(struct.pack('<H', rtype)), data):
            s = m.start() - 2
            if s < 0:
                continue
            vi, _rt, rl = struct.unpack_from('<HHI', data, s)
            inst = vi >> 4
            if (vi & 0xF) != 0 or inst not in insts or s + 8 + rl > len(data) or rl < 40:
                continue
            body = data[s + 8:s + 8 + rl]
            uid = 32 if inst in (0x3D5, 0x217, 0x543, 0x46B, 0x6E3, 0x6E1, 0x7A9) else 16
            if ext in ('emf', 'wmf', 'pict'):
                comp = body[uid:uid + 34][32]
                payload = body[uid + 34:]
                if comp == 0:
                    try:
                        payload = zlib.decompress(payload)
                    except zlib.error:
                        pass
            else:
                payload = body[uid + 1:]
            found[s] = (ext, payload)
    return found


# ------------------------------------------------------------------ the Equation Editor objects (MTEF 3)
def mtef_text(d):
    """a rough plain-text reading of an Equation Native stream (enough to rewrite the formula by hand)"""
    d = d[28:]
    p = 5
    out = []
    while p < len(d):
        t = d[p]
        p += 1
        if t == 0:
            out.append('}')
        elif t == 1:
            out.append('{')
        elif t == 2:
            tf = d[p]
            c = d[p + 1] | (d[p + 2] << 8)
            p += 3
            if tf in (0x83, 0x81) and 0x20 <= c < 0x100 and tf == 0x83:
                c |= 0x400
            out.append(chr(c) if c >= 32 else '?')
        elif t == 3:
            sel, var = d[p], d[p + 1]
            p += 2
            if var & 0x80:
                p += 1
            out.append('<T%d.%d>' % (sel, var & 0x7F))
        elif t in (10,):
            p += 1
    return ''.join(out)


# ------------------------------------------------------------------ main
def main(doc, out):
    out = pathlib.Path(out)
    (out / 'fig').mkdir(parents=True, exist_ok=True)
    ole, wd, tbl = load(doc)
    ccp, bte, clx = fib(wd)
    pcs = pieces(tbl, *clx)
    main_text = full_text(wd, pcs)[:ccp]
    ranges = chpx_ranges(wd, tbl, *bte)
    starts = [r[0] for r in ranges]
    data = ole.openstream('Data').read()
    bl = blips(data)
    offs = sorted(bl)

    pics = []                                              # (cp, picf offset)
    for i, ch in enumerate(main_text):
        if ch != '\x01':
            continue
        fc = cp_to_fc(pcs, i)
        j = bisect.bisect_right(starts, fc) - 1
        sp = sprms(ranges[j][2]) if j >= 0 and ranges[j][0] <= fc < ranges[j][1] else {}
        loc = sp.get(0x6A03)
        if loc is None:
            continue
        loc = struct.unpack('<I', loc)[0]
        lcb = struct.unpack_from('<I', data, loc)[0]
        inside = [o for o in offs if loc <= o < loc + lcb]
        if inside:                                         # a TOC hyperlink also has a 0x01 + field data: no blip
            pics.append((i, inside[0]))
    print('pictures:', len(pics))

    # textutil: html + text
    subprocess.run(['textutil', '-convert', 'html', '-encoding', 'UTF-8', '-output', str(out / 'book.html'), doc], check=True)
    H = (out / 'book.html').read_text(encoding='utf-8')

    # normalized text of the html with a map back to the html index
    norm, idx = [], []
    tag, ent = re.compile(r'<[^>]*>'), re.compile(r'&(#\d+|#x[0-9a-fA-F]+|\w+);')
    i = H.find('<body')
    while i < len(H):
        c = H[i]
        if c == '<':
            i = tag.match(H, i).end()
            continue
        if c == '&':
            m = ent.match(H, i)
            if m:
                for x in html.unescape(m.group(0)):
                    if x.isalnum():
                        norm.append(x.lower())
                        idx.append(i)
                i = m.end()
                continue
        if c.isalnum():
            norm.append(c.lower())
            idx.append(i)
        i += 1
    N = ''.join(norm)

    marks, pos, meta = [], 0, []
    for n, (cp, off) in enumerate(pics, 1):
        seg = ''.join(ch.lower() for ch in main_text[max(0, cp - 400):cp] if ch.isalnum())
        found = None
        for L in (60, 40, 25, 15):
            a = seg[-L:]
            if len(a) < L:
                continue
            k = N.find(a, max(0, pos - len(a)))
            if k >= 0 and k - pos < 150000 and (L >= 40 or k - pos < 6000):
                found = k + len(a)
                break
        if found is None:
            sys.exit('picture %d: no place found' % n)
        pos = found
        q = idx[found - 1] + 1
        if H[q:q + 1] == ';' and H[q - 1] != '>':
            q += 1
        if main_text[cp - 1] == '\x01' and marks:          # a picture right after a picture: the same place
            q = marks[-1][0]
        elif main_text[cp - 1] in '\r\x07':                # the picture starts a paragraph: it goes to the END of the paragraph before it
            e = H.find('</p>', q)
            if e != -1 and not re.search(r'[0-9A-Za-zА-Яа-я]', re.sub(r'<[^>]*>', '', H[q:e])):
                q = e
        else:
            k = 0
            j = cp - 1
            while j >= 0 and main_text[j] in ' ,.:;\xa0)':
                k += 1
                j -= 1
            while k > 0 and q < len(H) and H[q] in ' ,.:;)':
                q += 1
                k -= 1
        marks.append((q, n))
        ext, payload = bl[off]
        (out / 'fig' / ('%03d.%s' % (n, ext))).write_bytes(payload)
        cap = re.sub(r'\s+', ' ', re.sub(r'\x13[^\x14]*\x14', '', main_text[max(0, cp - 160):cp]).replace('\x01', ' ')).strip()
        meta.append({'n': n, 'file': 'fig/%03d.%s' % (n, ext), 'cp': cp, 'before': cap})
    for q, n in sorted(marks, reverse=True):
        H = H[:q] + '⟦%d⟧' % n + H[q:]
    (out / 'marked.html').write_text(H, encoding='utf-8')
    (out / 'pictures.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')

    eq = {}
    for e in ole.listdir():
        if e[0] == 'ObjectPool' and e[2] == 'Equation Native':
            eq[e[1]] = mtef_text(ole.openstream('/'.join(e)).read())
    (out / 'equations.json').write_text(json.dumps(eq, ensure_ascii=False, indent=1), encoding='utf-8')
    print('done:', out)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
