#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CAKE2 / RUN1: an independent re-calculation of cake2_plan_json.json + total_costs.csv. It reads ONLY the two files (what the app imports and what the plan
costs) and the recipe / price tables of cake_v1_optimization.py, and checks every number again: cakes, kilograms, worker time, breaks, rests, machines,
links, purchase quantities, money, the order delays, the task lines, and that the csv and the json tell the same story.

    python3 check_cake2_plan.py [cake2_plan_json.json [total_costs.csv]] [--after-post]   -> prints every check; exit code 1 when one fails
    --after-post: the json was READ BACK from the database after the import + Post (the lines must be posted; new row ids are fine)
"""
import collections
import csv
import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cake_opt', HERE / 'cake_v1_optimization.py')
opt = importlib.util.module_from_spec(spec)
sys.modules['cake_opt'] = opt
spec.loader.exec_module(opt)

AFTER_POST = '--after-post' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]
path = Path(args[0]) if len(args) > 0 else HERE / 'cake2_plan_json.json'
csv_path = Path(args[1]) if len(args) > 1 else HERE / 'total_costs.csv'
doc = json.loads(path.read_text(encoding='utf-8'))
tasks = {t['rowGUID']: t for t in doc['tasks']}
csv_rows = list(csv.DictReader(open(csv_path, encoding='utf-8', newline='')))
FAILS = []
N_CAKE, N_BATCH, N_POS = opt.CAKES_PER_POSITION, opt.BATCHES_PER_POSITION, len(opt.CAKE_ORDER)
D1, D2 = dt.date(2026, 1, 1), dt.date(2026, 1, 2)       # the production timeline of the task: from 2026-01-01, 2 days


def ok(cond, what, detail=''):
    print(('   ok   ' if cond else '   FAIL ') + what + (f'  [{detail}]' if detail else ''))
    if not cond:
        FAILS.append(what)


def day(t):
    return dt.date.fromisoformat(t['rowJSON']['manualStartAt'][:10])


def sdt(t):
    """the start of a task in the time-of-day model: the pinned day + taskStartMinute"""
    return dt.datetime.combine(day(t), dt.time(0)) + dt.timedelta(minutes=t['rowJSON'].get('taskStartMinute', 0))


def edt(t):
    return sdt(t) + dt.timedelta(minutes=t['rowJSON'].get('taskDurationMinutes', 0))


def hm(s):
    h, m = s.split(':')
    return int(h) * 60 + int(m)


def cc(t):
    return t['rowJSON'].get('customColumns') or {}


def f(x):
    return float(x) if x != '' else 0.0


leaf = [t for t in doc['tasks'] if t['rowJSON']['rowKind'] != 'stage']

print('0. the file is made for the right project')
ok(doc['project']['rowGUID'] == 'c79ba49f-5795-470f-899d-ed412eeb7cb5', 'project GUID c79ba49f-5795-470f-899d-ed412eeb7cb5')
ok(all(t['projectGUID'] == doc['project']['rowGUID'] for t in doc['tasks']), 'every row carries that project GUID')
ok('8e3e5544-5d86-4831-b116-420e6f9bde87' not in path.read_text(encoding='utf-8'), 'the GUID of the first run (marked "do not use") is nowhere in the file')

print('1. cakes, batches, kilograms')
cake_stages = [t for t in doc['tasks'] if t['treePath'].count('.') == 1 and ' cakes × 5 kg ' in t['rowJSON']['taskDescription']]
ok(len(cake_stages) == N_POS, f'{N_POS} cake positions (1 stage each)', len(cake_stages))
total_cakes = 0
for cs in cake_stages:
    lab = cs['treePath'].split('.')[-1]
    batches = [t for t in doc['tasks'] if t['treePath'].count('.') == 2 and t['treePath'].split('.')[1] == lab]
    cakes = sum(int(x['rowJSON']['taskDescription'].split(' cakes')[0].split('· ')[-1]) for x in batches)
    total_cakes += cakes
    ok(len(batches) == N_BATCH and cakes == N_CAKE, f'{cs["rowJSON"]["taskDescription"][:44]}: {len(batches)} batches = {cakes} cakes = {cakes * 5} kg')
ok(total_cakes == 160, f'160 cakes = 800 kg in total', total_cakes)

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
ok(max(per_batch_w.values()) <= 10 and len(per_batch_w) == N_POS * N_BATCH, f'every batch has <= 10 worker operations (max {max(per_batch_w.values())}, {len(per_batch_w)} batches)')
want_min = sum(o.dmin for c in opt.CAKE_ORDER for o in opt.ROUTING[c] if o.kind == 'W') * N_BATCH
total_min = sum(b - a for v in wk_ops.values() for _, a, b in v)
ok(total_min == want_min, f'worker time = {total_min} min = {total_min / 60:.1f} h (routing x {N_POS * N_BATCH} batches)', want_min)

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
    in_crew = all(((a < 840) == (crew == 'E')) for _, a, _ in v)
    in_days = all(D1 <= d <= D2 for d in days)
    all_ok = not bad and max(wk.values()) <= 5 and net <= opt.SHIFT_NET_MIN and in_crew and in_days
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

print('5. links (time-of-day model: all FS, no lag): no successor starts before its predecessor has finished, to the minute')
bad = 0
for d in doc['dependencies']:
    s_, p_ = tasks[d['rowGUID']], tasks[d['rowDependsOnGUID']]
    if sdt(s_) < edt(p_):
        bad += 1
ok(bad == 0 and all(d['linkType'] == 'FS' and d['lagDays'] == 0 for d in doc['dependencies']), f'{len(doc["dependencies"])} links (FS, lag 0), {bad} successors that start before their predecessor ends')

print('6. purchase plan: quantities, money, the 2-day order delay')
name2code = {v[0]: k for k, v in opt.ING.items()}
need = collections.defaultdict(float)
for cake, r in opt.RECIPES.items():
    for code, q in r['ing'].items():
        need[code] += q * N_CAKE
for code in opt.PACKAGING:
    need[code] += N_POS * N_CAKE
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
        if day(t) != o or o.weekday() > 4 or dv.weekday() == 6 or dv >= D1 or o < dt.date(2025, 12, 29):
            ok(False, 'order day (Mon-Fri) / delivery day (before the production starts, not Sunday)', title)
ok(min(gaps) >= 2, f'{lines} order lines, delivery - order: min {min(gaps)} days, max {max(gaps)} days (>= 2)')
for code in need:
    ex = bought[code] - need[code]
    allowed = need[code] * 0.02 + opt.ING[code][4] + 1e-6      # 2 % waste + one pack of rounding (one lot per ingredient)
    ok(bought[code] >= need[code] - 1e-6 and ex <= allowed, f'{opt.ING[code][0][:46]:46s} need {need[code]:8.2f} {opt.ING[code][1]:3s} bought {bought[code]:8.2f} (+{ex / need[code] * 100:4.1f} %)')
ok(all(c in bought for c in need), 'every ingredient and packaging is bought')
cake_cost = sum(sum(q * opt.ING[c][2] for c, q in r['ing'].items()) * N_CAKE for r in opt.RECIPES.values()) + N_POS * N_CAKE * sum(opt.ING[c][2] for c in opt.PACKAGING)
max_money = sum((need[c] * 1.02 + opt.ING[c][4]) * opt.ING[c][2] for c in need)      # 2 % waste + at most one pack of rounding per ingredient (one lot each)
ok(money >= cake_cost and money <= max_money, f'money: orders {money:,.2f} EUR vs the recipes {cake_cost:,.2f} EUR (+{(money / cake_cost - 1) * 100:.1f} % = waste + whole packs; the most the rules allow: {max_money:,.2f})')
pos = [t for t in doc['tasks'] if t['treePath'].count('.') == 2 and t['rowJSON']['taskDescription'].startswith('PO-')]
ok(len(pos) == len({t['rowJSON']['taskDescription'][:11] for t in pos}), f'{len(pos)} purchase orders, numbers unique')

print('7. the timeline')
first = min(day(t) for t in leaf if t['treePath'].count('.') == 3 and cc(t).get('cc_role') == 'Confectioner')
last = max(day(t) + dt.timedelta(days=t['rowJSON']['durationDays'] - 1) for t in leaf if cc(t).get('cc_role') == 'Confectioner' or cc(t).get('cc_worker') == '(machine)')
ok(first == D1 and last <= D2, f'production starts {first} and ends {last} (2026-01-01 + 2 days)')
ok(min(day(t) for t in leaf) >= dt.date(2025, 12, 29) and max(day(t) for t in leaf) <= D2, 'the purchasing is before the production, nothing after 2026-01-02')
ok(doc['project']['rowJSON']['projectStartDate'] == '2025-12-29', 'project start = 2025-12-29 (the first order day)')

print('8. task lines (what Post takes): hours x rate, quantity x price')
L = doc.get('taskLines', [])
ok(len(L) > 300, f'{len(L)} task lines')
on_leaf = all(tasks[l['rowOwnerGUID']]['rowJSON']['rowKind'] == 'task' and tasks[l['rowOwnerGUID']]['rowJSON']['durationDays'] >= 1 for l in L)
ok(on_leaf, 'every line is on a task (no stage, no milestone)')
ok(all(l['rowJSON']['sumForBudget'] == round(l['rowJSON']['qtyTaskLine'] * l['rowJSON']['priceTaskLine'] + 1e-9, 2) == l['rowJSON']['sumForContract'] == l['rowJSON']['sumForAccounting'] for l in L), 'sum = round(qty x price, 2) on every line')
ok(all(l['rowJSON']['taskIsPosted'] is AFTER_POST and l['rowJSON']['distributionForBudgetTaskLine'] == 'uniformDistribution' and l['rowJSON']['budgetItemTaskLine'] for l in L), f'every line is {"POSTED" if AFTER_POST else "unposted"}, has the uniform distribution and a budget item')
time_l = [l for l in L if l['rowParentGUID'] == 'timeGenus']
mat_l = [l for l in L if l['rowParentGUID'] == 'materialGenus']
rev_l = [l for l in L if l['rowParentGUID'] == 'revenueGenus']
cost_l = time_l + mat_l
worker_tasks = [t for t in doc['tasks'] if cc(t).get('cc_role') in opt.RATES and t['treePath'].count('.') == 3]
ok(len(time_l) == len(worker_tasks), f'one Time line for each of the {len(worker_tasks)} tasks of a person (operations, order lines, goods receipts)')
by_task = collections.defaultdict(list)
for l in time_l:
    by_task[l['rowOwnerGUID']].append(l)
bad = [t['rowJSON']['taskDescription'] for t in worker_tasks if len(by_task[t['rowGUID']]) != 1 or abs(by_task[t['rowGUID']][0]['rowJSON']['qtyTaskLine'] - cc(t)['cc_min'] / 60) > 0.00005 or by_task[t['rowGUID']][0]['rowJSON']['priceTaskLine'] != opt.RATES[cc(t)['cc_role']]]
ok(not bad, 'hours = minutes / 60 and the price = the hourly rate of the role on every Time line', bad[:1])
need_l = collections.defaultdict(float)
for l in mat_l:
    code = next(c for nm, c in name2code.items() if l['rowJSON']['description'].startswith(nm + ' · '))
    need_l[code] += l['rowJSON']['qtyTaskLine']
ok(all(abs(need_l[c] - need[c]) < 1e-6 for c in need) and len(need_l) == len(need), f'material quantities per ingredient and packaging = recipe x {N_CAKE} cakes ({N_POS * N_CAKE} for the packaging)')
got = sum(l['rowJSON']['sumForBudget'] for l in time_l)
mat_money = sum(l['rowJSON']['sumForBudget'] for l in mat_l)
ok(abs(mat_money - cake_cost) < 0.005 * len(mat_l) / 2, f'material money {mat_money:,.2f} EUR = the recipes {cake_cost:,.2f} EUR')
# --- real catalog rows: the ids exist in the generated catalog SQL (a file next to the json) and agree with the catalogs of the generator
cat_path = path.parent / 'CAKE2_CATALOG_DATA.sql'
if cat_path.exists():
    sql = cat_path.read_text(encoding='utf-8')
    known = lambda i: f"'{i}'" in sql
    ok(all(l['rowJSON'].get('taskResourceKind') == 'person' and known(l['rowJSON']['taskResourceItem']) and known(l['rowJSON']['taskResourceContract']) and known(l['rowJSON']['resourceRoleItem']) for l in time_l),
       f'every one of the {len(time_l)} Time lines books a REAL person (catalog row) with his contract and role')
    ok(len({l['rowJSON']['taskResourceItem'] for l in time_l}) == len(names) + 3, f'{len({l["rowJSON"]["taskResourceItem"] for l in time_l})} persons: {len(names)} confectioners + the buyer + 2 keepers')
    ok(all(known(l['rowJSON']['taskResourceItem']) and known(l['rowJSON']['resourceRoleItem']) and known(l['rowJSON']['taskLinePartnerItem']) and known(l['rowJSON']['taskLinePartnerContract']) for l in mat_l + rev_l),
       f'every one of the {len(mat_l)} Material and {len(rev_l)} Deliverable lines books a REAL product with its supplier / customer and a contract')
    ok(all(l['rowJSON']['priceSourceTaskLine'] == 'product' for l in mat_l + rev_l) and all(l['rowJSON']['priceSourceTaskLine'] == 'contract' for l in time_l), 'price sources: person -> contract, material / deliverable -> product')
ok(len(rev_l) == N_POS * N_BATCH and all(l['rowJSON']['qtyTaskLine'] == opt.BATCH_CAKES and l['rowJSON']['budgetItemTaskLine'] == 'saleOfGoodsBudgetItem' for l in rev_l), f'{len(rev_l)} Deliverable lines = one per batch: {opt.BATCH_CAKES} cakes each, budget item Sale of goods')
cc_ = opt.cake_costs()
rev_expect = sum(cc_[c]['wholesale'] * N_CAKE for c in opt.CAKE_ORDER)
rev_got = sum(l['rowJSON']['sumForBudget'] for l in rev_l)
ok(abs(rev_got - rev_expect) < 0.01, f'deliverables {rev_got:,.2f} EUR = 160 cakes x the wholesale price of each cake (cost + {opt.MARKUP * 100:.0f} %) = {rev_expect:,.2f}')
pj = doc['project']['rowJSON']
ok(pj.get('calendarForTaskPlan') == 'sixDayWeekCalendar' and pj.get('currencyForBudget') == 'EUR', 'the project posts with the six day calendar in EUR')
ok(not any(day(t).weekday() == 6 for t in worker_tasks), 'no task of a person on a Sunday')

print('8b. the time-of-day model: settings, minutes, calendars of the persons (what the minute check of Post sees)')
pj = doc['project']['rowJSON']
ok(pj.get('resourceOptimizationMode') == 'hourByHourModel' and pj.get('resourceGrainUnit') == 'minute' and pj.get('resourceSlotMinutes') == 1, 'hour by hour model, grain = minute, step 1 minute')
ok(pj.get('projectWorkWindows') == [{'from': '00:00', 'to': '24:00'}], 'project day = 00:00-24:00 (the chill steps run through the night; WHO works WHEN is the calendar of each person)')
RL = opt.RESOURCE_LEVELING_SETTINGS
ok(all(pj.get(k) == v for k, v in RL.items()) and pj['resourceLevelingFunctionalityEnabled'] is True and pj['resourceLevelingMode'] == 'automatic', f'{len(RL)} resource leveling settings written, master ON, Automatic, Leveling (not Smoothing)')
tk = [t for t in doc['tasks'] if t['rowJSON']['rowKind'] == 'task']
ok(all(t['rowJSON'].get('taskDurationMinutes', 0) >= 1 and 0 <= t['rowJSON'].get('taskStartMinute', 0) <= 1439 and not any(k in t['rowJSON'] for k in ('startHourStart', 'planMinuteStart')) for t in tk), f'{len(tk)} tasks have taskStartMinute + taskDurationMinutes (whole minutes), no old hour / minute fields')
ok(all(t['rowJSON']['taskDurationMinutes'] == cc(t)['cc_min'] for t in tk if 'cc_from' in cc(t)), 'duration in minutes = the Minutes column of every operation / order / receipt (rows with From / To)')
ok(all(f'{sdt(t):%H:%M}' == cc(t)['cc_from'] for t in tk if 'cc_from' in cc(t)), 'start time = the From column')
roster = {opt.person_guid(r['name']): r for r in doc['cake2Roster']}
ok(len(roster) == 11, f'{len(roster)} persons with a calendar: 8 confectioners + 1 buyer + 2 keepers')
fit, ovl = 0, collections.defaultdict(list)
for l in time_l:
    r = roster[l['rowJSON']['taskResourceItem']]
    t = tasks[l['rowOwnerGUID']]
    a, b = sdt(t), edt(t)
    m0, m1 = a.hour * 60 + a.minute, a.hour * 60 + a.minute + t['rowJSON']['taskDurationMinutes']
    if a.weekday() in r['days'] and any(w0 <= m0 and m1 <= w1 for w0, w1 in r['windows']) and l['rowJSON']['qtyTaskLine'] <= t['rowJSON']['taskDurationMinutes'] / 60:
        fit += 1
    ovl[r['name']].append((a, b))
ok(fit == len(time_l), f'{fit} of {len(time_l)} Time lines lie inside a working window of the calendar of their person, on a day he works, never above the capacity of their minutes')
ok(all(b0 <= a1 for v in ovl.values() for (a0, b0), (a1, b1) in zip(sorted(v), sorted(v)[1:])), 'no person has two lines at the same time')
cat_sql = (path.parent / 'CAKE2_CATALOG_DATA.sql').read_text(encoding='utf-8') if (path.parent / 'CAKE2_CATALOG_DATA.sql').exists() else ''
ok(all(f"'ck2-cal-{opt.slug(r['name'])}'" in cat_sql and f'"resourceCalendar": "ck2-cal-{opt.slug(r["name"])}"' in cat_sql for r in roster.values()), 'every person has a calendar in CAKE2_CATALOG_DATA.sql and his contract points to it (resourceCalendar)')
ok(all(l['rowJSON']['taskResourceItem'] and l['rowJSON']['priceTaskLine'] > 0 and l['rowJSON']['sumForBudget'] > 0 for l in time_l), f'Time: {len(time_l)} lines carry the person and his cost')
ok(all(l['rowJSON']['taskResourceItem'] and l['rowJSON']['priceTaskLine'] > 0 and l['rowJSON']['sumForBudget'] > 0 for l in mat_l), f'Material: {len(mat_l)} lines carry the product, the supplier and the cost')
ok(all(l['rowJSON']['taskResourceItem'] and l['rowJSON']['priceTaskLine'] > 0 and l['rowJSON']['sumForBudget'] > 0 for l in rev_l), f'Deliverable: {len(rev_l)} lines carry the cake product, the customer and the price')

print('9. total_costs.csv tells the same story as the json')
sec = collections.defaultdict(list)
for r in csv_rows:
    sec[r['section']].append(r)
conf = [r for r in sec['labour'] if r['detail'].startswith('Confectioner')]
ok(len(conf) == len(names) == f(next(r for r in sec['summary'] if r['item'] == 'confectioners needed')['qty_needed']), f'workers needed: csv {len(conf)} = json {len(names)} = summary row')
ok(abs(sum(f(r['qty_needed']) for r in conf) - total_min / 60) < 0.01, f'confectioner hours in the csv {sum(f(r["qty_needed"]) for r in conf):.2f} = {total_min / 60:.2f} h of the json')
lab_csv = sum(f(r['cost_needed_eur']) for r in sec['labour'])
ok(abs(lab_csv - got) < 0.005 * len(time_l) / 2 + 0.01, f'labour money: csv {lab_csv:,.2f} EUR = Time lines {got:,.2f} EUR')
mat_csv = sum(f(r['cost_needed_eur']) for r in sec['material'] + sec['packaging'])
ok(abs(mat_csv - mat_money) < 0.005 * len(mat_l) / 2 + 0.01, f'material money: csv {mat_csv:,.2f} EUR = Material lines {mat_money:,.2f} EUR')
ord_csv = sum(f(r['cost_ordered_eur']) for r in sec['material'] + sec['packaging'])
ok(abs(ord_csv - money) < 0.01, f'ordered money: csv {ord_csv:,.2f} EUR = order lines of the WBS {money:,.2f} EUR')
tot = next(r for r in sec['total'] if r['item'] == 'TOTAL')
ok(abs(f(tot['cost_needed_eur']) - (lab_csv + mat_csv)) < 0.01 and abs(f(tot['cost_needed_eur']) - sum(l['rowJSON']['sumForBudget'] for l in cost_l)) < 1.0,
   f'TOTAL needed {f(tot["cost_needed_eur"]):,.2f} EUR = the Time + Material lines {sum(l["rowJSON"]["sumForBudget"] for l in cost_l):,.2f} EUR')
rev_csv = next(r for r in sec['total'] if r['item'] == 'revenue (deliverables)')
ok(abs(f(rev_csv['cost_needed_eur']) - rev_got) < 0.01 and len(sec['revenue']) == N_POS, f'revenue: csv {f(rev_csv["cost_needed_eur"]):,.2f} EUR = Deliverable lines {rev_got:,.2f} EUR ({len(sec["revenue"])} rows)')
roi = next(r for r in sec['total'] if r['item'] == 'ROI1 plan-plan (%)')
ok(abs(f(roi['cost_needed_eur']) - (rev_got - f(tot['cost_needed_eur'])) / f(tot['cost_needed_eur']) * 100) < 0.01, f'ROI1 plan-plan in the csv: {f(roi["cost_needed_eur"]):.2f} %')
per_code = {r['detail']: f(r['qty_needed']) for r in sec['material'] + sec['packaging']}
ok(all(abs(per_code[c] - need[c]) < 1e-3 for c in need), 'qty_needed per ingredient in the csv = recipe x cakes')
ok(len(sec['cake']) == N_POS and all(f(r['qty_needed']) == N_CAKE for r in sec['cake']), f'{N_POS} cake rows with the money per cake')

print()
print('ALL CHECKS OK' if not FAILS else f'{len(FAILS)} CHECK(S) FAILED')
sys.exit(1 if FAILS else 0)
