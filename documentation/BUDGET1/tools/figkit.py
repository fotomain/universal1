"""
BUDGET1: the kit that redraws the pictures of the book as HTML + CSS.

A scheme is a box of the SAME proportions as the picture in the book (W x H px of the original): every box / label is placed in percent of it, the font size in
container query units (cqw), so the scheme scales with the width of the page and never needs a script. The arrows are one inline SVG layer on top
(the only thing CSS cannot draw: a line with an arrowhead that bends).

    scheme(W, H, [box(x, y, w, h, 'text', 'k'), arr([(x1, y1), (x2, y2)]), txt(x, y, w, 'text'), ...], fs=12.5)
    fx('...html of a formula...')                    # a formula: display (own line) ; fxi(...) = inline in a sentence
    frac(num, den) / sub(x, i) / sup(x, i) / it(x)  # the pieces of a formula

Box classes (the colours are in build_book.py, section CSS):   ''  white box, navy border      'k' navy fill, white text      'a' light-teal fill
                                                              'g' light-gray fill            'w' warm (orange) accent       'n' no border (text only)
                                                              'd' dashed border              'b' thick border               'c' pill / rounded
Alignment letters in the class list: 'l' text to the left, 'r' to the right; 'top' text at the top of the box; 'bold' bold text.
"""
from dataclasses import dataclass
import html as _html


@dataclass
class Fig:
    html: str
    kind: str = 'block'          # 'block' (scheme / chart / table), 'display' (a formula on its own line), 'inline' (a formula inside a sentence)
    alt: str = ''                # plain text (for the page text / search / the alt of the figure)


def esc(s):
    return _html.escape(s, quote=False)


def _t(text):
    """text of a box: '\n' = new line; **bold**; the rest is escaped (html allowed after a leading '!')"""
    if text.startswith('!'):
        return text[1:]
    s = esc(text).replace('\n', '<br>')
    parts = s.split('**')
    return ''.join(('<b>%s</b>' % p) if i % 2 else p for i, p in enumerate(parts))


class _Item:
    pass


def box(x, y, w, h, text='', cls='', fs=None):
    it = _Item()
    it.t, it.x, it.y, it.w, it.h, it.text, it.cls, it.fs = 'box', x, y, w, h, text, cls, fs
    return it


def txt(x, y, w, text, cls='', h=None, fs=None):
    """a label without a border (cls: 'l' | 'r' to align, 'bold', 'it' italic)"""
    it = _Item()
    it.t, it.x, it.y, it.w, it.h, it.text, it.cls, it.fs = 'box', x, y, w, h or 20, text, 'n ' + cls, fs
    return it


def arr(points, head='end', dash=False, wide=False, cls=''):
    """a polyline with an arrowhead: head 'end' | 'start' | 'both' | 'none'"""
    it = _Item()
    it.t, it.pts, it.head, it.dash, it.wide, it.cls = 'arr', points, head, dash, wide, cls
    return it


def line(points, dash=False, wide=False, cls=''):
    return arr(points, 'none', dash, wide, cls)


def poly(points, cls='', fill=False):
    """a curve / area of a chart (many points); cls: 'c1'..'c4' (series colours) """
    it = _Item()
    it.t, it.pts, it.cls, it.fill = 'poly', points, cls, fill
    return it


def scheme(W, H, items, fs=14.5, alt='', cls=''):
    """-> Fig(block). W, H = pixels of the original picture; fs = font size in the pixels of the original"""
    boxes, shapes = [], []
    for it in items:
        if it.t == 'box':
            classes = ['bx'] + it.cls.split()
            if it.text == '' and 'n' not in classes:
                classes.append('o')                       # a frame without a text (a group): transparent, so the arrows inside stay visible
            size = it.fs or fs
            style = 'left:%.3f%%;top:%.3f%%;width:%.3f%%;height:%.3f%%;font-size:%.3fcqw' % (it.x / W * 100, it.y / H * 100, it.w / W * 100, it.h / H * 100, size / W * 100)
            boxes.append('<div class="%s" style="%s"><span>%s</span></div>' % (' '.join(classes), style, _t(it.text)))
        elif it.t == 'arr':
            d = 'M' + ' L'.join('%.1f %.1f' % p for p in it.pts)
            ms = ' marker-end="url(#ah)"' if it.head in ('end', 'both') else ''
            mst = ' marker-start="url(#ahs)"' if it.head in ('start', 'both') else ''
            c = 'ln' + (' dash' if it.dash else '') + (' wide' if it.wide else '') + ((' ' + it.cls) if it.cls else '')
            shapes.append('<path class="%s" d="%s"%s%s/>' % (c, d, ms, mst))
        elif it.t == 'poly':
            d = 'M' + ' L'.join('%.1f %.1f' % p for p in it.pts)
            shapes.append('<path class="pl %s%s" d="%s"/>' % (it.cls, ' fill' if it.fill else '', d))
    svg = ('<svg class="fgs" viewBox="0 0 %d %d" preserveAspectRatio="none" aria-hidden="true"><defs>'
           '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="%.1f" markerHeight="%.1f" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 z"/></marker>'
           '<marker id="ahs" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="%.1f" markerHeight="%.1f" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M10 0 L0 5 L10 10 z"/></marker>'
           '</defs>%s</svg>') % (W, H, W / 55, W / 55, W / 55, W / 55, ''.join(shapes))
    h = '<div class="fgc%s" style="max-width:%dpx;aspect-ratio:%d/%d">%s%s</div>' % ((' ' + cls) if cls else '', W, W, H, svg, ''.join(boxes))
    return Fig(h, 'block', alt)


def hrow(x, y, w, h, gap, texts, cls='', arrows=True, fs=None, classes=None):
    """a row of boxes of one size with arrows between them -> items (cls for all, or classes[i] per box)"""
    items = []
    for i, t in enumerate(texts):
        c = (classes[i] if classes else cls)
        bx = x + i * (w + gap)
        items.append(box(bx, y, w, h, t, c, fs))
        if arrows and i:
            items.append(arr([(bx - gap, y + h / 2), (bx, y + h / 2)]))
    return items


def vcol(x, y, w, h, gap, texts, cls='', arrows=True, fs=None, classes=None):
    """a column of boxes with arrows between them"""
    items = []
    for i, t in enumerate(texts):
        c = (classes[i] if classes else cls)
        by = y + i * (h + gap)
        items.append(box(x, by, w, h, t, c, fs))
        if arrows and i:
            items.append(arr([(x + w / 2, by - gap), (x + w / 2, by)]))
    return items


# ------------------------------------------------------------------ formulas
def it(x):
    return '<i>%s</i>' % x


def sub(x, i):
    return '%s<sub>%s</sub>' % (x, i)


def sup(x, i):
    return '%s<sup>%s</sup>' % (x, i)


def frac(num, den):
    return '<span class="fr"><span class="nu">%s</span><span class="de">%s</span></span>' % (num, den)


def par(x, kind='()', big=False):
    l, r = kind[0], kind[1]
    return '<span class="pa%s">%s</span>%s<span class="pa%s">%s</span>' % (' big' if big else '', l, x, ' big' if big else '', r)


def sqrt(x):
    return '<span class="sq">√<span class="sqi">%s</span></span>' % x


def fx(*parts, alt=''):
    """a display formula (own line)"""
    return Fig('<div class="fx">%s</div>' % ''.join(parts), 'display', alt or _html.unescape(''.join(parts)))


def fxi(*parts):
    """an inline formula"""
    return Fig('<span class="fxi">%s</span>' % ''.join(parts), 'inline', _html.unescape(''.join(parts)))


def fxs(*parts):
    """a formula that STARTS the next paragraph of the book (the picture is at the end of the previous one): it is put in front of that paragraph"""
    return Fig('<span class="fxi">%s</span>' % ''.join(parts), 'prefix', _html.unescape(''.join(parts)))


def table_fig(rows, head=1, cls='', alt='', widths=None):
    """a small table that the book has as a picture"""
    out = ['<table class="tb %s">' % cls]
    for i, r in enumerate(rows):
        tag = 'th' if i < head else 'td'
        out.append('<tr>%s</tr>' % ''.join('<%s%s>%s</%s>' % (tag, (' class="num"' if (i >= head and _isnum(c)) else ''), _t(c) if isinstance(c, str) else c, tag) for c in r))
    out.append('</table>')
    return Fig(''.join(out), 'block', alt)


def _isnum(c):
    s = str(c).replace(' ', '').replace('\xa0', '').replace(',', '.').replace('%', '').replace('(', '').replace(')', '').replace('-', '').replace('+', '').replace('−', '')
    try:
        float(s)
        return True
    except ValueError:
        return False


# ------------------------------------------------------------------ outline tree (a dense scheme of the book as a readable indented tree)
def outline(root, alt='', note_cls='nt'):
    """root = (text, [children], cls?, edge?) ; text '**bold**' allowed; edge = a small label on the line to the node. -> Fig(block)"""
    def node(n):
        text, kids = n[0], (n[1] if len(n) > 1 else [])
        cls = n[2] if len(n) > 2 else ''
        edge = n[3] if len(n) > 3 else ''
        lab = '<span class="nd %s">%s</span>' % (cls, _t(text))
        if edge:
            lab = '<span class="eg">%s</span>' % esc(edge) + lab
        if kids:
            return '<li>%s<ul class="ot">%s</ul></li>' % (lab, ''.join(node(k) for k in kids))
        return '<li>%s</li>' % lab
    return Fig('<div class="otw"><ul class="ot root">%s</ul></div>' % node(root), 'block', alt)


# ------------------------------------------------------------------ charts
def axes(W, H, x0, y0, x1, y1, xlabel='', ylabel='', arrows=True):
    """the two axes of a chart: origin (x0, y0) bottom-left, (x1, y0) right end, (x0, y1) top end (pixels of the original); -> items"""
    items = [arr([(x0, y0), (x1, y0)], 'end' if arrows else 'none'), arr([(x0, y0), (x0, y1)], 'end' if arrows else 'none')]
    return items


def ticks(x0, y0, xs, ys=None, length=4):
    items = []
    for x in xs:
        items.append(line([(x, y0), (x, y0 + length)]))
    for y in (ys or []):
        items.append(line([(x0 - length, y), (x0, y)]))
    return items


def curve(f, xa, xb, mapx, mapy, n=60):
    """points of y = f(x) for x in [xa, xb]; mapx / mapy turn a value into a pixel"""
    pts = []
    for i in range(n + 1):
        x = xa + (xb - xa) * i / n
        pts.append((mapx(x), mapy(f(x))))
    return pts
