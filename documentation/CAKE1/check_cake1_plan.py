#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CAKE1: an independent re-calculation of cake1_plan_json.json. It reads ONLY the json (what the app imports) and the recipe / price tables of
cake_v0_month200_optimization.py, and checks every number again: cakes, kilograms, worker time, breaks, rests, machines, links, purchase quantities, money.

    python3 check_cake1_plan.py [cake1_plan_json.json]        -> prints every check; exit code 1 when one fails
"""
import collections
import datetime as dt
import importlib.util
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cake_opt', HERE / 'cake_v0_month200_optimization.py')
opt = importlib.util.module_from_spec(spec)
sys.modules['cake_opt'] = opt
spec.loader.exec_module(opt)

path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'cake1_plan_json.json'
doc = json.loads(path.read_text(encoding='utf-8'))
tasks = {t['rowGUID']: t for t in doc['tasks']}
FAILS = []


def ok(cond, what, detail=''):
    print(('   ok   ' if cond else '   FAIL ') + what + (f'  [{detail}]' if detail else ''))
    if not cond:
        FAILS.append(what)


def day(t):
    return dt.date.fromisoformat(t['rowJSON']['manualStartAt'][:10])


def hm(s):
    h, m = s.split(':')
    return int(h) * 60 + int(m)


def cc(t):
    return t['rowJSON'].get('customColumns') or {}


leaf = [t for t in doc['tasks'] if t['rowJSON']['rowKind'] != 'stage']

print('1. cakes, batches, kilograms')
cake_stages = [t for t in doc['tasks'] if t['treePath'].count('.') == 1 and ' cakes × 5 kg ' in t['rowJSON']['taskDescription']]
ok(len(cake_stages) == 8, '8 cake positions (1 stage each)', len(cake_stages))
total_cakes = 0
for cs in cake_stages:
    lab = cs['treePath'].split('.')[-1]
    batches = [t for t in doc['tasks'] if t['treePath'].count('.') == 2 and t['treePath'].split('.')[1] == lab]
    cakes = sum(int(x['rowJSON']['taskDescription'].split(' cakes')[0].split('· ')[-1]) for x in batches)
    total_cakes += cakes
    ok(len(batches) == 20 and cakes == 200, f'{cs["rowJSON"]["taskDescription"][:44]}: 20 batches = {cakes} cakes = {cakes * 5} kg')
ok(total_cakes == 1600, '1600 cakes = 8000 kg in total', total_cakes)

print('2. worker operations (<= 10 per cake, <= 80 min, inside the shift windows, no break touched)')
wk_ops = collections.defaultdict(list)
per_batch_w = collections.Counter()
for t in doc['tasks']:
    c = cc(t)
    if c.get('cc_role') == 'Confectioner' and t['treePath'].count('.') == 3:
        a, b = hm(c['cc_from']), hm(c['cc_to'])
        per_batch_w[t['treePath'].rsplit('.', 1)[0]] += 1
        ok_win = any(w0 <= a and b <= w1 for sh in opt.SHIFTS.values() for (w0, w1) in sh)
        if not ok_win or b - a != c['cc_min'] or b - a > 80 or t['rowJSON']['durationDays'] != 1:
            ok(False, 'operation window / minutes', t['rowJSON']['taskDescription'])
        wk_ops[c['cc_worker']].append((day(t), a, b))
ok(max(per_batch_w.values()) <= 10 and len(per_batch_w) == 160, f'every batch has <= 10 worker operations (max {max(per_batch_w.values())}, {len(per_batch_w)} batches)')
total_min = sum(b - a for v in wk_ops.values() for _, a, b in v)
ok(total_min == 57200, f'worker time = {total_min} min = {total_min / 60:.1f} h (routing x 160 batches)', total_min)

print('3. workers: rest rules')
names = list(wk_ops)
ok(len(names) == len(set(names)) and len(names) >= 7, f'{len(names)} confectioners, unique fictional names')
for n, v in sorted(wk_ops.items()):
    v.sort()
    crew = 'E' if v[0][1] < 840 else 'L'
    bad = []
    for (d0, a0, b0), (d1, a1, b1) in zip(v, v[1:]):
        if d0 == d1 and a1 < b0:
            bad.append('overlap')
    days = collections.Counter(d for d, _, _ in v)
    wk = collections.Counter(d - dt.timedelta(days=d.weekday()) for d in days)
    net = max(sum(b - a for dd, a, b in v if dd == d) for d in days)
    offs = {d.weekday() for d in days}
    in_crew = all(((a < 840) == (crew == 'E')) for _, a, _ in v)
    sun = any(d.weekday() == 6 or d == dt.date(2026, 1, 1) for d in days)
    all_ok = not bad and max(wk.values()) <= 5 and net <= opt.SHIFT_NET_MIN and in_crew and not sun
    util = sum(b - a for _, a, b in v) / (len(days) * opt.SHIFT_NET_MIN) * 100
    ok(all_ok, f'{n:18s} {"Early" if crew == "E" else "Late ":5s} {len(days):2d} shifts, max {max(wk.values())} a week, max {net} min a day (<= 435), {util:.0f} % of the net shift time')

print('4. machines: no unit used by two steps at the same time')
by_unit = collections.defaultdict(list)
for t in doc['tasks']:
    c = cc(t)
    if c.get('cc_res') and t['treePath'].count('.') == 3:
        d0 = day(t)
        s = dt.datetime.combine(d0, dt.time(0)) + dt.timedelta(minutes=hm(c['cc_from']))
        e = dt.datetime.combine(d0 + dt.timedelta(days=t['rowJSON']['durationDays'] - 1), dt.time(0)) + dt.timedelta(minutes=hm(c['cc_to']))
        by_unit[c['cc_res']].append((s, e, t['rowJSON']['taskDescription']))
over = 0
for u, v in by_unit.items():
    v.sort()
    for x, y in zip(v, v[1:]):
        if y[0] < x[1]:
            over += 1
ok(over == 0, f'{len(by_unit)} machine units, {sum(len(v) for v in by_unit.values())} bookings, {over} overlaps', ', '.join(sorted(by_unit)))

print('5. links: every link gives exactly the day of the successor (FS: day after the end + lag, SS: start + lag)')
bad = 0
for d in doc['dependencies']:
    s, p = tasks[d['rowGUID']], tasks[d['rowDependsOnGUID']]
    ps, pe = day(p), day(p) + dt.timedelta(days=p['rowJSON']['durationDays'] - 1)
    want = pe + dt.timedelta(days=1 + d['lagDays']) if d['linkType'] == 'FS' else ps + dt.timedelta(days=d['lagDays'])
    if day(s) < want:   # a link may have slack (the successor is pinned later) but never be violated
        bad += 1
ok(bad == 0, f'{len(doc["dependencies"])} links, {bad} successors earlier than their link allows')
exact = sum(1 for d in doc['dependencies'] if day(tasks[d['rowGUID']]) == ((day(tasks[d['rowDependsOnGUID']]) + dt.timedelta(days=tasks[d['rowDependsOnGUID']]['rowJSON']['durationDays'] + d['lagDays'])) if d['linkType'] == 'FS' else day(tasks[d['rowDependsOnGUID']]) + dt.timedelta(days=d['lagDays'])))
print(f'        ({exact} links are exact, {len(doc["dependencies"]) - exact} have slack because the successor is pinned later)')

print('6. purchase plan: quantities, money, the 2-day order delay')
name2code = {v[0]: k for k, v in opt.ING.items()}
need = collections.defaultdict(float)
for cake, r in opt.RECIPES.items():
    for code, q in r['ing'].items():
        need[code] += q * 200
for code in opt.PACKAGING:
    need[code] += 1600
bought = collections.defaultdict(float)
money = 0.0
lines = 0
gaps = []
for t in doc['tasks']:
    c = cc(t)
    if c.get('cc_role') == 'Purchasing manager' and 'cc_qty' in c:
        title = t['rowJSON']['taskDescription']
        code = next(code for nm, code in name2code.items() if title.endswith(nm))
        q, price = c['cc_qty'], opt.ING[code][2]
        bought[code] += q
        lines += 1
        if abs(round(q * price, 2) - c['cc_eur']) > 0.005:
            ok(False, 'line money = qty x price', title)
        money += c['cc_eur']
        o, dv = dt.date.fromisoformat(c['cc_order']), dt.date.fromisoformat(c['cc_deliv'])
        gaps.append((dv - o).days)
        if day(t) != o or o.weekday() > 4 or dv.weekday() == 6 or dv < dt.date(2026, 1, 3) or o < dt.date(2026, 1, 1):
            ok(False, 'order day / delivery day', title)
ok(min(gaps) >= 2, f'{lines} order lines, delivery - order: min {min(gaps)} days, max {max(gaps)} days (>= 2)')
worst = 0
for code in need:
    ex = bought[code] - need[code]
    allowed = need[code] * 0.02 + opt.ING[code][4] * 8 + 1e-6   # 2 % waste + one pack of rounding per lot (at most 8 lots)
    ok(bought[code] >= need[code] - 1e-6 and ex <= allowed, f'{opt.ING[code][0][:46]:46s} need {need[code]:9.2f} {opt.ING[code][1]:3s} bought {bought[code]:9.2f} (+{ex / need[code] * 100:4.1f} %)')
    worst = max(worst, ex / need[code])
ok(all(c in bought for c in need), 'every ingredient and packaging is bought')
cake_cost = sum(sum(q * opt.ING[c][2] for c, q in r['ing'].items()) * 200 for r in opt.RECIPES.values()) + 1600 * sum(opt.ING[c][2] for c in opt.PACKAGING)
ok(money >= cake_cost and money <= cake_cost * 1.12, f'money: orders {money:,.2f} EUR vs the recipes {cake_cost:,.2f} EUR (+{(money / cake_cost - 1) * 100:.1f} % = waste + pack rounding)')
pos = [t for t in doc['tasks'] if t['treePath'].count('.') == 2 and t['rowJSON']['taskDescription'].startswith('PO-')]
ok(len(pos) == len({t['rowJSON']['taskDescription'][:11] for t in pos}), f'{len(pos)} purchase orders, numbers unique')

print('7. the month')
first = min(day(t) for t in leaf if t['treePath'].count('.') == 3 and 'cc_worker' in cc(t) and cc(t).get('cc_role') == 'Confectioner')
last = max(day(t) + dt.timedelta(days=t['rowJSON']['durationDays'] - 1) for t in leaf)
ok(dt.date(2026, 1, 1) <= first and last <= dt.date(2026, 1, 31), f'everything is inside January 2026: production {first} .. {last}')
print('8. task lines (what Post takes): hours x rate, quantity x price')
L = doc.get('taskLines', [])
ok(len(L) == 3252, f'{len(L)} task lines')
on_leaf = all(tasks[l['rowOwnerGUID']]['rowJSON']['rowKind'] == 'task' and tasks[l['rowOwnerGUID']]['rowJSON']['durationDays'] >= 1 for l in L)
ok(on_leaf, 'every line is on a task (no stage, no milestone)')
ok(all(l['rowJSON']['sumForBudget'] == round(l['rowJSON']['qtyTaskLine'] * l['rowJSON']['priceTaskLine'] + 1e-9, 2) == l['rowJSON']['sumForContract'] == l['rowJSON']['sumForAccounting'] for l in L), 'sum = round(qty x price, 2) on every line (budget = contract = accounting: everything is EUR)')
ok(all(l['rowJSON']['taskIsPosted'] is False and l['rowJSON']['distributionForBudgetTaskLine'] == 'uniformDistribution' and l['rowJSON']['budgetItemTaskLine'] for l in L), 'every line is unposted, has the uniform distribution and a budget item')
time_l = [l for l in L if l['rowParentGUID'] == 'timeGenus']
mat_l = [l for l in L if l['rowParentGUID'] == 'materialGenus']
worker_tasks = [t for t in doc['tasks'] if cc(t).get('cc_role') in opt.RATES and t['treePath'].count('.') == 3]
ok(len(time_l) == len(worker_tasks) == 1332, f'one Time line for each of the {len(worker_tasks)} tasks of a person (operations, order lines, goods receipts)')
by_task = collections.defaultdict(list)
for l in time_l:
    by_task[l['rowOwnerGUID']].append(l)
bad = [t['rowJSON']['taskDescription'] for t in worker_tasks if len(by_task[t['rowGUID']]) != 1 or abs(by_task[t['rowGUID']][0]['rowJSON']['qtyTaskLine'] - cc(t)['cc_min'] / 60) > 0.00005 or by_task[t['rowGUID']][0]['rowJSON']['priceTaskLine'] != opt.RATES[cc(t)['cc_role']]]
ok(not bad, 'hours = minutes / 60 and the price = the hourly rate of the role on every Time line', bad[:1])
hours = sum(l['rowJSON']['qtyTaskLine'] for l in time_l if 'Confectioner' in l['rowJSON']['description'])
ok(abs(hours - 57200 / 60) < 0.5, f'confectioner hours {hours:.2f} = worker time 57 200 min / 60 = {57200 / 60:.2f}')
exact = sum(cc(t)['cc_min'] / 60 * opt.RATES[cc(t)['cc_role']] for t in worker_tasks)
got = sum(l['rowJSON']['sumForBudget'] for l in time_l)
ok(abs(got - exact) < 0.005 * len(time_l) / 2, f'time money {got:,.2f} EUR vs exact {exact:,.2f} (only cent rounding)')
need_l = collections.defaultdict(float)
for l in mat_l:
    code = next(c for nm, c in name2code.items() if l['rowJSON']['description'].startswith(nm + ' · '))
    need_l[code] += l['rowJSON']['qtyTaskLine']
ok(all(abs(need_l[c] - need[c]) < 1e-6 for c in need) and len(need_l) == len(need), 'material quantities per ingredient and packaging = recipe x 200 cakes (1 600 for the packaging)')
mat_money = sum(l['rowJSON']['sumForBudget'] for l in mat_l)
ok(abs(mat_money - cake_cost) < 0.005 * len(mat_l) / 2, f'material money {mat_money:,.2f} EUR = the recipes {cake_cost:,.2f} EUR')
ok(abs(sum(l['rowJSON']['sumForBudget'] for l in L) - (got + mat_money)) < 0.01, f'all lines {sum(l["rowJSON"]["sumForBudget"] for l in L):,.2f} EUR = time + material')
pj = doc['project']['rowJSON']
ok(pj.get('calendarForTaskPlan') == 'sixDayWeekCalendar' and pj.get('currencyForBudget') == 'EUR', 'the project posts with the six day calendar (Saturdays, 1 Jan) in EUR')
sat = [t for t in leaf if t['treePath'].count('.') == 3 and cc(t).get('cc_role') in opt.RATES and day(t).weekday() == 5]
ok(len(sat) > 0 and not any(day(t).weekday() == 6 for t in worker_tasks), f'{len(sat)} tasks with lines are on a Saturday (a Mon-Fri calendar would refuse them), none on a Sunday')

print()
print('ALL CHECKS OK' if not FAILS else f'{len(FAILS)} CHECK(S) FAILED')
sys.exit(1 if FAILS else 0)
