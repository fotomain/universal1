#!/usr/bin/env python3
"""BUDGET1: a page that shows the redrawn figures NEXT TO the originals (to check them by eye).
   python3 tools/preview_fig.py 17 18 19      -> documentation/BUDGET1/build/preview.html  (open it through a local http server)"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_book as bb  # noqa: E402

side = '--side' in sys.argv
nums = [int(a) for a in sys.argv[1:] if a.isdigit()]
figs = bb.load_figs()
css = bb.CSS
rows = []
for n in nums:
    f = figs.get(n)
    orig = next((p for p in (HERE.parent / 'build' / 'fig').glob('%03d.*' % n)), None)
    h, _kind = bb.fig_html(n, f, {})
    o = '<img src="fig/%s" style="max-width:100%%">' % orig.name if orig and orig.suffix == '.png' else '(wmf)'
    rows.append('<h3>Рисунок %d</h3><div style="display:grid;grid-template-columns:%s;gap:18px;align-items:start"><div>%s</div>%s</div>' % (n, '1fr 1fr' if side else '1fr', h, ('<div>%s</div>' % o) if side else ''))
page = '<!doctype html><html lang="ru"><meta charset="utf-8"><title>preview</title><style>%s body{padding:16px;max-width:1500px;margin:auto}</style><body>%s</body></html>' % (css, ''.join(rows))
(HERE.parent / 'build' / 'preview.html').write_text(page, encoding='utf-8')
print('preview.html:', len(nums), 'figures')
