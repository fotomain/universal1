#!/usr/bin/env python3
"""
BUDGET1 step 2: build documentation/BUDGET1_BOOK.html (the whole book in Russian, one self-contained HTML file).

Run (after extract_doc.py):   python3 documentation/BUDGET1/tools/build_book.py
Input : documentation/BUDGET1/build/marked.html (text, tables, picture markers) + tools/figures/*.py (the 131 pictures redrawn with figkit)
Output: documentation/BUDGET1_BOOK.html

Page numbers: the headings carry the EXACT page of the book (its table of contents); the grey `стр. N` marks in the right gutter are an estimate between two
headings (see bookpages.py). The picture that is not redrawn yet is shown as a grey placeholder with its number (the builder prints how many).
"""
import html
import importlib
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bookpages as bp          # noqa: E402
from figkit import Fig          # noqa: E402

OUT = HERE.parent.parent / 'BUDGET1_BOOK.html'

CSS = r"""
:root{
  --navy:#1f3a5f; --navy2:#2c5282; --teal:#0f7c8a; --tealbg:#e4f1f3; --gray:#f3f5f8; --line:#c9d2de; --ink:#1d2733; --mute:#5d6b7c; --warm:#b45309; --warmbg:#fdf1e3;
  --bg:#ffffff; --panel:#f6f8fb;
}
@media (prefers-color-scheme: dark){
  :root{ --navy:#8db3e8; --navy2:#9bbcec; --teal:#5cc1cf; --tealbg:#16343a; --gray:#1b2431; --line:#3a475a; --ink:#e3e9f1; --mute:#9aa8ba; --warm:#f0a050; --warmbg:#3b2a17; --bg:#10161f; --panel:#151d28; }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:12px}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.62 "Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
a{color:var(--navy2)}
.shell{display:grid;grid-template-columns:340px minmax(0,1fr);min-height:100vh}
nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;background:var(--panel);border-right:1px solid var(--line);padding:18px 14px 40px 18px;font-size:13.5px;line-height:1.4}
nav.toc h2{margin:0 0 10px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
nav.toc ol{list-style:none;margin:0;padding:0}
nav.toc li{margin:0}
nav.toc a{display:flex;gap:8px;justify-content:space-between;text-decoration:none;color:var(--ink);padding:3px 6px;border-radius:5px}
nav.toc a:hover{background:var(--tealbg)}
nav.toc a span.pn{color:var(--mute);font-variant-numeric:tabular-nums;white-space:nowrap}
nav.toc .l1>a{font-weight:700;color:var(--navy);margin-top:8px}
nav.toc .l2>a{padding-left:14px}
nav.toc .l3>a{padding-left:28px;color:var(--mute)}
nav.toc .l4>a{padding-left:42px;color:var(--mute);font-size:12.5px}
main{padding:0 84px 80px 48px;max-width:1040px;margin:0 auto;position:relative;width:100%}
header.cover{margin:0 -84px 28px -48px;padding:44px 84px 30px 48px;background:linear-gradient(135deg,var(--navy) 0%,#2f5d8c 100%);color:#fff}
@media (prefers-color-scheme: dark){ header.cover{background:linear-gradient(135deg,#1b2a41,#25405e);color:#e8eef7} }
header.cover .kicker{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
header.cover h1{margin:6px 0 10px;padding:0;border:0;color:inherit;font-size:32px;line-height:1.2;font-weight:700}
header.cover .meta{opacity:.9;font-size:15px}
header.cover .legend{margin-top:16px;padding:10px 14px;background:rgba(255,255,255,.12);border-radius:8px;font-size:13.5px;line-height:1.5}
section.front p{margin:.4em 0;color:var(--mute);font-size:14px}
section.front p.annot{color:var(--ink);font-size:15.5px}
h1,h2,h3,h4{color:var(--navy);line-height:1.28;font-weight:700}
h1{font-size:27px;margin:2.2em 0 .6em;padding:.45em 0 .3em;border-bottom:3px solid var(--navy)}
h2{font-size:21px;margin:1.9em 0 .5em;padding-bottom:.2em;border-bottom:1px solid var(--line)}
h3{font-size:18px;margin:1.6em 0 .4em}
h4{font-size:16.5px;margin:1.4em 0 .3em;color:var(--navy2)}
h1 .pn,h2 .pn,h3 .pn,h4 .pn{float:right;font-size:12.5px;font-weight:600;color:var(--mute);margin-left:12px;white-space:nowrap}
p{margin:.55em 0;text-align:justify;hyphens:auto}
p.cap{margin:1.4em 0 .5em;font-weight:700;color:var(--navy);text-align:left;font-size:15px;break-after:avoid}
p.note{font-size:14px;color:var(--mute);margin:.4em 0 1em}
ul.bl{margin:.5em 0;padding-left:1.4em}
ul.bl li{margin:.25em 0}
.pgm{height:0;position:relative}
.pgm span{position:absolute;right:-72px;top:-.55em;font-size:11px;color:var(--mute);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:0 7px;line-height:1.55;white-space:nowrap;font-variant-numeric:tabular-nums}
table.tb{border-collapse:collapse;margin:.7em auto 1.3em;font-size:13.5px;line-height:1.35;max-width:100%;display:block;overflow-x:auto}
table.tb td,table.tb th{border:1px solid var(--line);padding:4px 8px;vertical-align:top}
table.tb th{background:var(--navy);color:#fff;font-weight:600;text-align:center;vertical-align:middle}
@media (prefers-color-scheme: dark){ table.tb th{background:#243a57;color:#e8eef7} }
table.tb tr:nth-child(even) td{background:rgba(120,140,170,.07)}
table.tb td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
table.tb td p,table.tb th p{margin:0;text-align:inherit}
table.tb.eq{border:0;font-size:15px}
table.tb.eq td{border:0;background:none!important;text-align:center;vertical-align:middle;padding:2px 6px}
figure.fg{margin:1em 0 1.6em;padding:14px;background:var(--bg);border:1px solid var(--line);border-radius:10px;box-shadow:0 1px 3px rgba(20,40,70,.07)}
figure.fg.ph{background:var(--gray);border-style:dashed;text-align:center;color:var(--mute);padding:26px}
figure.fg.fxwrap{border:0;box-shadow:none;background:none;padding:0;margin:.4em 0 .8em}
.fgc{position:relative;container-type:inline-size;width:100%;margin:0 auto;color:var(--ink)}
.fgs{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.fgs .ln{fill:none;stroke:var(--navy);stroke-width:1.9;vector-effect:none}
.fgs .ln.wide{stroke-width:3.4}
.fgs .ln.dash{stroke-dasharray:5 4}
.fgs .ln.c2{stroke:var(--teal)} .fgs .ln.c3{stroke:var(--warm)} .fgs .ln.mute{stroke:var(--mute)}
.fgs marker path{fill:var(--navy)}
.fgs .pl{fill:none;stroke-width:2.2}
.fgs .pl.c1{stroke:var(--navy2)} .fgs .pl.c2{stroke:var(--teal)} .fgs .pl.c3{stroke:var(--warm)} .fgs .pl.c4{stroke:#7a4aa0}
.fgs .pl.dash{stroke-dasharray:6 4}
.fgs .pl.fill{fill:rgba(15,124,138,.14);stroke:none}
.bx{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;padding:.25cqw .5cqw;line-height:1.16;background:var(--bg);border:1px solid var(--navy);color:var(--ink);overflow:hidden;border-radius:3px}
.bx>span{display:block;max-width:100%;overflow-wrap:anywhere;hyphens:auto}
.bx.k{background:var(--navy);color:#fff;border-color:var(--navy)}
@media (prefers-color-scheme: dark){ .bx.k{background:#2c4a70;color:#e8eef7;border-color:#5f87b8} }
.bx.a{background:var(--tealbg);border-color:var(--teal)}
.bx.g{background:var(--gray);border-color:var(--line)}
.bx.w{background:var(--warmbg);border-color:var(--warm)}
.bx.n{background:none;border:0;border-radius:0;overflow:visible}
.bx.o{background:none}
.bx.d{border-style:dashed}
.bx.b{border-width:2.4px}
.bx.c{border-radius:2em}
.bx.l{justify-content:flex-start;text-align:left}
.bx.r{justify-content:flex-end;text-align:right}
.bx.top{align-items:flex-start}
.bx.bot{align-items:flex-end}
.bx.bold{font-weight:700}
.bx.it{font-style:italic}
.bx.s{box-shadow:0 1px 2px rgba(20,40,70,.25)}
.bx.dim{color:var(--mute)}
.bx.ov{overflow:visible}
.bx.v>span{writing-mode:vertical-rl;transform:rotate(180deg)}
.fx{margin:.7em 0;text-align:center;font-size:17px;line-height:1.9;font-family:"Cambria Math","STIX Two Math","Times New Roman",serif}
.fxi{font-family:"Cambria Math","STIX Two Math","Times New Roman",serif;white-space:nowrap}
.fx i,.fxi i{font-style:italic}
.fr{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;margin:0 .15em}
.fr>.nu{border-bottom:1px solid currentColor;padding:0 .25em .08em}
.fr>.de{padding:.08em .25em 0}
.pa.big{font-size:2.3em;line-height:.6;vertical-align:middle;font-weight:200}
.fxp{margin-left:.15em}
.sq{white-space:nowrap}.sqi{border-top:1px solid currentColor;padding:0 .2em;margin-left:.05em}
ul.ot{list-style:none;margin:0;padding-left:20px}
ul.ot.root{padding-left:0}
ul.ot li{position:relative;padding:3px 0 3px 16px;font-size:13.5px}
ul.ot.root>li{padding-left:0}
ul.ot li::before{content:'';position:absolute;left:0;top:0;bottom:0;border-left:1px solid var(--line)}
ul.ot li::after{content:'';position:absolute;left:0;top:19px;width:12px;border-top:1px solid var(--line)}
ul.ot.root>li::before,ul.ot.root>li::after{display:none}
ul.ot li:last-child::before{height:19px}
.otw{overflow-x:auto}
.nd{display:inline-block;border:1px solid var(--navy);background:var(--bg);border-radius:3px;padding:2px 8px;line-height:1.3}
.nd.k{background:var(--navy);color:#fff}
.nd.a{background:var(--tealbg);border-color:var(--teal)}
.nd.w{background:var(--warmbg);border-color:var(--warm)}
.eg{display:inline-block;font-size:11.5px;color:var(--mute);margin-right:6px;font-style:italic}
footer.end{margin-top:60px;padding-top:18px;border-top:1px solid var(--line);font-size:13px;color:var(--mute)}
@media (max-width:980px){
  .shell{display:block}
  nav.toc{position:static;height:auto;max-height:none;border-right:0;border-bottom:1px solid var(--line)}
  main{padding:0 16px 60px;max-width:none}
  header.cover{margin:0 -16px 22px;padding:30px 16px 22px}
  header.cover h1{font-size:24px}
  .pgm{height:auto;margin:0}
  .pgm span{position:static;display:inline-block;margin:.5em 0 0}
  p{text-align:left}
}
@media print{ nav.toc{display:none} .shell{display:block} main{padding:0;max-width:none} .pgm span{display:none} figure.fg{break-inside:avoid} }
"""

# ------------------------------------------------------------------ inline cleaning
FIELD = [re.compile(r'\s*HYPERLINK\s+\\l\s+"[^"]*"\s*'), re.compile(r'\s*EMBED\s+[A-Za-z]+\.\d+\s*')]


def inline(h):
    """the inner html of a paragraph / cell: keep b, i, sub, sup, br; drop spans, classes, field codes"""
    h = re.sub(r'<span class="Apple-converted-space">[\xa0 ]*</span>', ' ', h)
    h = re.sub(r'<span class="Apple-tab-span">\s*</span>', '&emsp;', h)
    h = re.sub(r'</?span[^>]*>', '', h)
    for r in FIELD:
        h = r.sub(' ', h)
    h = h.replace('\xa0', '&nbsp;')
    for _ in range(3):
        h = re.sub(r'</b>(\s*)<b>', r'\1', h)
        h = re.sub(r'</i>(\s*)<i>', r'\1', h)
    h = re.sub(r'<(b|i|sub|sup)>\s*</\1>', '', h)
    h = re.sub(r'(<br>\s*)+$', '', h.strip())
    return re.sub(r'[ \t\r\n]+', ' ', h).strip()


def plain(h):
    return bp.clean_text(html.unescape(re.sub(r'<[^>]+>', '', h)).replace('\xa0', ' '))


# ------------------------------------------------------------------ figures
def load_figs():
    figs = {}
    d = HERE / 'figures'
    if d.exists():
        sys.path.insert(0, str(d))
        for f in sorted(d.glob('figs_*.py')):
            m = importlib.import_module(f.stem)
            for n, fig in m.FIGS.items():
                if n in figs:
                    raise SystemExit('figure %d is defined twice' % n)
                figs[n] = fig
    return figs


def fig_html(n, fig, pictures):
    cap = pictures.get(n, {}).get('before', '')
    if fig is None:
        return ('<figure class="fg ph" id="pic%d"><div>Рисунок %d книги: перерисовка в работе</div></figure>' % (n, n)), 'block'
    if fig.kind == 'display':
        return '<figure class="fg fxwrap" id="pic%d">%s</figure>' % (n, fig.html), 'display'
    if fig.kind in ('inline', 'prefix'):
        return fig.html, fig.kind
    alt = html.escape(fig.alt or cap, quote=True)
    return '<figure class="fg" id="pic%d" role="img" aria-label="%s">%s</figure>' % (n, alt, fig.html), 'block'


# ------------------------------------------------------------------ blocks -> html
CAPTION = re.compile(r'^(Схема|Рис\.|Таблица|Продолжение табл|Окончание табл)')
BULLET = re.compile(r'^[•·]\s*')


def render_cell(td):
    inner = re.sub(r'^<td[^>]*>|</td>$', '', td.strip())
    paras = re.findall(r'<p class="p\d+">(.*?)</p>', inner, re.S)
    txt = '<br>'.join(x for x in (inline(p) for p in paras) if x and x != '<br>') if paras else inline(inner)
    return txt


def render_table(b, caption_before, figs, pictures, used):
    t = b['html']
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S)
    out_rows, bold_first = [], False
    for ri, r in enumerate(rows):
        cells = re.findall(r'(<td[^>]*>.*?</td>)', r, re.S)
        out = []
        for c in cells:
            attrs = ''.join(' %s="%s"' % (k, v) for k, v in re.findall(r'\b(rowspan|colspan)="(\d+)"', c.split('>')[0]))
            out.append((attrs, render_cell(c)))
        out_rows.append(out)
    if not out_rows:
        return ''
    first = out_rows[0]
    bold_first = len(out_rows) > 2 and all('<b>' in c for _, c in first if c)
    head = len(out_rows) > 2 and (bold_first or caption_before)
    if len(out_rows) == 1:
        cls = 'tb eq'
    else:
        cls = 'tb'
    html_rows = []
    for ri, out in enumerate(out_rows):
        tag = 'th' if (head and ri == 0) else 'td'
        cells = []
        for attrs, c in out:
            c = bp.PIC_RE.sub(lambda m: _inline_fig(int(m.group(1)), figs, pictures, used), c)
            numeric = (tag == 'td') and _is_num(plain(c))
            cells.append('<%s%s%s>%s</%s>' % (tag, attrs, ' class="num"' if numeric else '', c, tag))
        html_rows.append('<tr>%s</tr>' % ''.join(cells))
    return '<table class="%s">%s</table>' % (cls, ''.join(html_rows))


def _is_num(s):
    s = s.replace('\xa0', '').replace(' ', '').replace(',', '.').replace('−', '-').replace('—', '-')
    s = re.sub(r'^[+\-]', '', s).rstrip('%')
    s = re.sub(r'\(.*\)$', '', s)
    return bool(re.fullmatch(r'\d+(\.\d+)?', s))


def _inline_fig(n, figs, pictures, used):
    used.add(n)
    h, kind = fig_html(n, figs.get(n), pictures)
    return h


def render_paragraph(b, figs, pictures, used):
    """-> list of html chunks (a paragraph with pictures can become paragraph + figure + paragraph)"""
    inner = inline(b['html'])
    out = []
    cur = ''
    parts = re.split(r'⟦(\d+)⟧', inner)
    pending_block = []                                   # figures to put after the current paragraph
    for i, p in enumerate(parts):
        if i % 2 == 0:
            cur += p
            continue
        n = int(p)
        used.add(n)
        fig = figs.get(n)
        h, kind = fig_html(n, fig, pictures)
        if kind == 'inline':
            cur += h
        elif kind == 'prefix':
            out.append(('prefix', h))
        else:
            if plain(cur):
                out.append(('p', cur))
            cur = ''
            out.append(('fig', h, kind))
    if plain(cur) or re.search(r'<(sub|sup|i|b)>', cur) and plain(cur):
        out.append(('p', cur))
    elif out and cur.strip() and out[-1][0] == 'fig' and out[-1][2] == 'display':
        pass
    return out


def build(argv):
    pictures = {p['n']: p for p in json.loads((bp.BUILD / 'pictures.json').read_text(encoding='utf-8'))}
    figs = load_figs()
    blocks, toc, heads, w = bp.load()
    used = set()
    body, navs = [], []
    last_page = 0
    in_list = False
    front_done = False
    prev_caption = False
    pending_prefix = []
    first_head = heads[0]

    def close_list():
        nonlocal in_list
        if in_list:
            body.append('</ul>')
            in_list = False

    # front matter (the title, the annotation, the copyright)
    front = []
    for b in blocks[:first_head]:
        if b.get('drop') or b['kind'] != 'p':
            continue
        t = plain(b['html'])
        if t:
            front.append(t)
    title = 'Бюджетирование деятельности промышленных предприятий России'
    author = 'Щиборщ К.В.'
    annot = [t for t in front if len(t) > 140 and not t.startswith('Полное') and 'All rights' not in t][:3]
    legal = [t for t in front if t.startswith('©') or t.startswith('ISBN') or t.startswith('ББК') or t.startswith('Бюджетирование деятельности промышленных предприятий России. —')]
    ep = [t for t in front if t.startswith('Figures matter') or t.startswith('(Цифры') or t.startswith('Милтон')]

    for i, b in enumerate(blocks):
        if b.get('drop') or i < first_head and False:
            continue
        if i < first_head:
            continue
        if 'heading' in b:
            close_list()
            lvl, page = b['heading']
            t = html.escape(b['title'])
            hid = 'h%d' % len(navs)
            navs.append((lvl, b['title'], page, hid))
            tag = 'h%d' % min(lvl, 4)
            body.append('<%s id="%s">%s<span class="pn" title="страница книги (по оглавлению)">стр. %d</span></%s>' % (tag, hid, t, page, tag))
            last_page = page
            prev_caption = False
            continue
        pg = b['page']
        if pg > last_page:
            close_list()
            body.append('<div class="pgm"><span>стр. %d</span></div>' % pg)
            last_page = pg
        if b['kind'] == 'table':
            close_list()
            h = render_table(b, prev_caption, figs, pictures, used)
            body.append(h)
            prev_caption = False
            continue
        text = plain(bp.PIC_RE.sub('', b['html']))
        raw_empty = not re.sub(r'[\s\xa0]', '', re.sub(r'<[^>]+>', '', inline(bp.PIC_RE.sub('', b['html']))))
        has_pic = bool(bp.PIC_RE.search(b['html']))
        if raw_empty and not has_pic:
            continue
        chunks = render_paragraph(b, figs, pictures, used)
        for ch in chunks:
            if ch[0] == 'prefix':
                pending_prefix.append(ch[1])
                continue
            if ch[0] == 'p' and pending_prefix:
                ch = ('p', ''.join(pending_prefix) + ' ' + ch[1])
                pending_prefix.clear()
            if ch[0] == 'fig':
                close_list()
                body.append(ch[1])
                prev_caption = False
                continue
            h = ch[1]
            t = plain(h)
            if BULLET.match(t):
                if not in_list:
                    body.append('<ul class="bl">')
                    in_list = True
                body.append('<li>%s</li>' % re.sub(r'^\s*[•·]\s*', '', h))
                continue
            close_list()
            if CAPTION.match(t) and len(t) < 330:
                body.append('<p class="cap">%s</p>' % h)
                prev_caption = t.startswith('Таблица') or t.startswith('Продолжение') or t.startswith('Окончание')
            elif t.startswith('Примечание') or t.startswith('(*)'):
                body.append('<p class="note">%s</p>' % h)
                prev_caption = False
            else:
                body.append('<p>%s</p>' % h)
                prev_caption = False
    close_list()

    missing = sorted(set(range(1, 132)) - set(figs))
    unused = sorted(set(figs) - used)
    # the contents
    nav = ['<nav class="toc" aria-label="Содержание"><h2>Содержание</h2><ol>']
    for lvl, t, page, hid in navs:
        if lvl > 3:
            continue
        nav.append('<li class="l%d"><a href="#%s"><span>%s</span><span class="pn">%d</span></a></li>' % (lvl, hid, html.escape(t), page))
    nav.append('</ol></nav>')

    cover = ['<header class="cover"><div class="kicker">UNIVERSAL1 · BUDGET1 · книга в HTML</div><h1>%s</h1><div class="meta">%s · М.: Издательство «Дело и Сервис», 2001 · 544 с. · ISBN 5-8018-0092-1</div>'
             % (html.escape(title), html.escape(author)),
             '<div class="legend">Книга переведена из Word (.doc) в HTML: текст и таблицы сохранены, <b>57 схем, 11 рисунков и все формулы перерисованы средствами HTML + CSS</b>. '
             'Номера страниц у заголовков (<b>стр. N</b> справа) взяты из оглавления книги и точны; серые отметки <b>стр. N</b> в правом поле между заголовками — оценка '
             '(интерполяция по объёму текста, таблиц и рисунков, ±1–2 страницы). Задачи WBS проекта BUDGET1 ссылаются на эти страницы.</div></header>']
    front_html = ['<section class="front">']
    for t in annot:
        front_html.append('<p class="annot">%s</p>' % html.escape(t))
    for t in legal:
        front_html.append('<p>%s</p>' % html.escape(t))
    for t in ep:
        front_html.append('<p><i>%s</i></p>' % html.escape(t))
    front_html.append('</section>')

    foot = ('<footer class="end">Источник: К.В. Щиборщ, «Бюджетирование деятельности промышленных предприятий России», 2001 (электронная версия «Serg &amp; Co», 2003). '
            'Файл собран скриптами <code>documentation/BUDGET1/tools</code> (extract_doc.py → build_book.py). Схемы нарисованы заново, не вырезаны из оригинала; оригиналы рисунков — '
            '<code>documentation/BUDGET1/figures_original</code>.</footer>')
    page = ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Бюджетирование промышленных предприятий (BUDGET1)</title><style>%s</style></head><body><div class="shell">%s<main>%s%s%s%s</main></div></body></html>'
            % (CSS, ''.join(nav), ''.join(cover), ''.join(front_html), ''.join(body), foot))
    OUT.write_text(page, encoding='utf-8')
    print('written', OUT, '%.1f MB' % (len(page.encode('utf-8')) / 1e6))
    print('headings', len(navs), '| pictures redrawn', len(figs), '| missing', len(missing), missing[:40], '| defined but not placed', unused)


if __name__ == '__main__':
    build(sys.argv[1:])
