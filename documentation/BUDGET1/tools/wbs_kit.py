"""
BUDGET1: the little language the WBS is written in (the spec files spec_*.py use it) + the scheduler.

    S(code, 'Title', 'anchor', [children...], after=['3.2'], start='2001-02-12')     a stage / sub-stage (summary row)
    T(code, 'Title', 'anchor', d=5, lines=[...], note='...', par=True, after=[...])  a task = ONE budgeting document or ONE operation of the book (rule 1)
    M(code, 'Title', after=[...])                                                    a milestone (0 days)

    lines:  TL(role, hours)  time of a role (price = the rate of the role)            ML(role, qty, unit, price)  material
            EL(role, qty, price) expense (qty 1 = the whole estimate line)            RL(role, qty, price)  revenue = deliverable
            W(('r_planner', 16), ('r_head_peu', 4))  = several TL lines

The NAME of every stage / sub-stage / task is  "<title> (<page of the book>)":  the page of a heading is exact (table of contents of the book),
the page of a document / operation is looked up by its anchor (a phrase at the start of a paragraph of the book) in the estimate of bookpages.py.
"""
import datetime as dt
import re

import bookpages as bp
import budget1_catalogs as cat

_BLOCKS = None


def blocks():
    global _BLOCKS
    if _BLOCKS is None:
        _BLOCKS = bp.load()[0]
    return _BLOCKS


_CACHE = {}
ANCHOR_ERRORS = []


def page_of(anchor, after=None):
    """page (int) of the first block that starts with / contains the anchor; heading text -> the exact page of the heading"""
    key = (anchor, after)
    if key in _CACHE:
        return _CACHE[key]
    b = blocks()
    try:
        start = bp.find(b, after) if after else 0
        i = bp.find(b, anchor, start)
        _CACHE[key] = b[i]['page']
    except SystemExit as e:                         # collect every wrong anchor, report them all at the end (build_wbs_sql.py)
        ANCHOR_ERRORS.append(str(e))
        _CACHE[key] = 0
    return _CACHE[key]


# ------------------------------------------------------------------ lines
class Line:
    def __init__(self, genus, role, qty, unit, price, item=None, bu=None, note=''):
        self.genus, self.role, self.qty, self.unit, self.price, self.item, self.bu, self.note = genus, role, qty, unit, price, item, bu, note


def TL(role, hours, item=None, bu=None, price=None, note=''):
    rt = cat.ROLES[role]
    return Line('timeGenus', role, hours, 'unit_hour', price if price is not None else rt[2], item or cat.ITEM_WAGES, bu or rt[3], note)


def W(*pairs):
    return [TL(r, h) for r, h in pairs]


def ML(role, qty, unit, price, item=None, bu=None, note=''):
    rt = cat.ROLES[role]
    return Line('materialGenus', role, qty, unit, price, item or cat.ROLE_ITEM[role], bu or rt[3], note)


def EL(role, qty, price, item=None, bu=None, note=''):
    rt = cat.ROLES[role]
    return Line('expenseGenus', role, qty, 'unit_pcs', price, item or cat.ROLE_ITEM[role], bu or rt[3], note)


def RL(role, qty, price, item=None, bu=None, note=''):
    rt = cat.ROLES[role]
    return Line('revenueGenus', role, qty, 'unit_ton', price, item or cat.ROLE_ITEM[role], bu or rt[3], note)


# ------------------------------------------------------------------ nodes
class Node:
    def __init__(self, kind, code, title, anchor, kids=(), d=0, lines=(), note='', after=(), par=False, start=None, page=None, ss=(), at=None, side=False):
        self.kind, self.code, self.title, self.anchor = kind, code, title, anchor
        self.kids = list(kids)
        self.d, self.lines, self.note = d, list(lines or []), note
        self.after, self.par, self.start, self.ss, self.at, self.side = list(after), par, start, list(ss), at, side
        self.page_override = page
        self.parent = None
        self.s = self.f = None                      # scheduled start (date) and finish (date, exclusive)

    @property
    def page(self):
        if self.page_override:
            return self.page_override
        a = self.anchor
        if not a:
            return None
        return page_of(a)

    @property
    def name(self):
        p = self.page
        return '%s (%d)' % (self.title, p) if p else self.title


def S(code, title, anchor, kids, **kw):
    return Node('stage', code, title, anchor, kids, **kw)


def T(code, title, anchor, d=3, lines=(), **kw):
    return Node('task', code, title, anchor, (), d=d, lines=lines, **kw)


def M(code, title, anchor=None, **kw):
    return Node('milestone', code, title, anchor, (), d=0, **kw)


def walk(nodes, parent=None):
    for n in nodes:
        n.parent = parent
        yield n
        yield from walk(n.kids, n)


# ------------------------------------------------------------------ calendar (Monday-Friday) and the scheduler
def is_wd(d):
    return d.weekday() < 5


def next_wd(d):
    while not is_wd(d):
        d += dt.timedelta(days=1)
    return d


def add_wd(start, n):
    """the working day that is n working days after `start` (n >= 0; start is a working day) = the EXCLUSIVE finish of a task of n days that starts on `start`"""
    d = start
    left = n
    while left > 0:
        d += dt.timedelta(days=1)
        if is_wd(d):
            left -= 1
    return d


def parse(s):
    return dt.date.fromisoformat(s)


def schedule(roots, project_start):
    """forward pass (CPM without resources): sequential siblings (FS), `par` = starts with the previous sibling (SS), `after` = FS from other nodes,
    `start` = start no earlier than a date; a stage covers its children. Fills n.s / n.f (exclusive finish) and returns the project finish."""
    index = {n.code: n for n in walk(roots)}

    def go(nodes, start):
        prev = None
        fin = start
        maxf = start
        for n in nodes:
            s = start
            if prev is not None and not n.par:
                s = max(s, maxf)
            elif prev is not None and n.par:
                s = max(start, prev.s)
            for c in n.after:
                if index[c].f is None:
                    raise SystemExit('%s: "after" %s is not scheduled yet (put it earlier in the WBS)' % (n.code, c))
                s = max(s, index[c].f)
            for c in n.ss:
                s = max(s, index[c].s)
            if n.start:
                s = max(s, parse(n.start))
            if n.at:                                   # an exact start (a parallel line of work that begins at a given date); only `after` can push it later
                s = parse(n.at)
                for c in n.after:
                    s = max(s, index[c].f)
            s = next_wd(s)
            n.s = s
            if n.kids:
                f = go(n.kids, s)
                n.f = f
            else:
                n.f = add_wd(s, max(n.d, 0)) if n.d > 0 else s
            if n.side:                                 # a line of milestones that does not gate its siblings
                continue
            prev = n
            maxf = max(maxf, n.f)
            fin = max(fin, n.f)
        return fin

    return go(roots, next_wd(project_start))


# ------------------------------------------------------------------ headings of the book as stages
def heading(code):
    """(title, exact page) of the heading of the book: code 'Глава 3' / '3.5' / '7.3.1.1'"""
    for b in blocks():                                  # an exact title first ('Заключение' is also the start of 'Заключение к главе 5')
        if 'heading' in b and b['title'] == code:
            return b['title'], b['heading'][1]
    for b in blocks():
        if 'heading' not in b:
            continue
        t = b['title']
        if code.startswith('Глава'):
            if t.startswith(code + '.'):
                return t, b['heading'][1]
        elif t.startswith(code + '. ') or t.startswith(code + ' ') or t == code:
            return t, b['heading'][1]
    ANCHOR_ERRORS.append('heading not found: ' + code)
    return code, 0


def H(code, kids, **kw):
    """a stage whose title and page are the heading of the book (the page is EXACT)"""
    title, page = heading(code)
    n = Node('stage', code, title, None, kids, page=page, **kw)
    return n


# ------------------------------------------------------------------ the tables of the book as documents (rule 1: a table = a budgeting document = a task)
_TABLES = None


def table_index():
    """{number: (caption, block index, page, rows of the table that follows)} for every caption 'Таблица N. ...' of the book"""
    global _TABLES
    if _TABLES is None:
        _TABLES = {}
        b = blocks()
        for i, x in enumerate(b):
            if x.get('drop') or x['kind'] != 'p':
                continue
            m = re.match(r'^Таблица (\d+)\. (.+)$', bp.clean_text(bp.PIC_RE.sub('', x['text'])))
            if not m or len(x['text']) > 400:
                continue
            n = int(m.group(1))
            if n in _TABLES:
                continue
            rows = 0
            for j in range(i + 1, min(i + 4, len(b))):
                if b[j]['kind'] == 'table':
                    rows = b[j]['rows']
                    break
            _TABLES[n] = ('Таблица %d. %s' % (n, m.group(2).strip()), i, x['page'], rows)
    return _TABLES


def TB(n, roles, d=None, par=False, hours=None, note='', lines=(), **kw):
    """the task of the table n of the book: title = its caption, effort of the roles in `roles` = [(role, share)] of the hours estimated from the size of the table"""
    cap, _i, _pg, rows = table_index()[n]
    h = hours if hours is not None else max(6, min(40, 6 + rows * 0.6))
    ln = [TL(r, round(h * sh)) for r, sh in roles] + list(lines)
    return T('t%d' % n, cap, 'Таблица %d.' % n, d if d is not None else max(1, int(round(h / 8.0))), ln, note=note or 'Документ книги: %s (%d строк таблицы).' % (cap[:60], rows), par=par, **kw)


def TBS(numbers, roles, par=True, **kw):
    """tasks for several tables (all start together when par=True: the analysts work in parallel)"""
    out = []
    for k, n in enumerate(numbers):
        out.append(TB(n, roles, par=(par and k > 0), **kw))
    return out
