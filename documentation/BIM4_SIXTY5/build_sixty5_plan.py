# -*- coding: utf-8 -*-
"""Sixty5 cost + time plan for the project 6c70450d-4e27-4a56-8e7f-4698e30e2ac4 (BIM4 Sixty5).

   python3 -I build_sixty5_plan.py [outdir]      (default: ./out)

Reads sixty5_input.json (1639 BIM tasks with their IFC quantities), builds for every task its Time / Material / Expense lines (sixty5_rules.py, sixty5_catalog.py),
plans the tasks with crews of named persons (no person above 8 h a day: the organization posts in capacityModeBlock) and writes the SQL:
   01_catalog.sql        units, roles + hourly rates, persons, suppliers + contracts, product folders / types / products + purchase prices
   02_calendar.sql       the day rows 2028-2029 of the calendars the project and the persons use (they end 2027-12-31)
   03_project_tasks.sql  project settings + dates / duration of every task and stage (bulk switch on)
   04_lines_NNN.sql      the task lines (Time / Material / Expense), 250 a file
   05_post_NNN.sql       Post of every task = create_task_line_plan (the payload the app's calculateTaskLinePlan would send)
   report.txt            what was built
"""
import sys, os, json, math, uuid, datetime, collections, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sixty5_catalog as C
import sixty5_rules as R

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
PROJECT = '6c70450d-4e27-4a56-8e7f-4698e30e2ac4'
NS = uuid.UUID('b15c0a65-0000-4000-8000-000000000065')
BU = 'bu_team1costs'
OWNER = os.environ.get('SIXTY5_OWNER', '43cdefd5-4a25-4667-973b-337635fe52aa')      # project_table.rowOwnerGUID of the project (the user who posts)
START = datetime.date(2026, 11, 23)                 # a Monday
VAT = 21.0
CAP = 8.0
CAP_USE = 7.6                                        # a person is planned to at most this many hours a day (rounding of the posted days stays below 8)
TARGET_D = 6                                         # a crew is sized to finish a task of one role in about 6 days
CREW_MAX = {'bricklayer': 4, 'cs-fitter': 4, 'concrete-fitter': 5, 'frame-fitter': 6, 'drywaller': 6, 'carpenter': 4, 'labourer': 6}
CREW_DEFAULT = 3


def guid(*parts):
    return str(uuid.uuid5(NS, ':'.join(str(p) for p in parts)))


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def js(o):
    return q(json.dumps(o, ensure_ascii=False, separators=(',', ':'))) + '::jsonb'


# ---------------------------------------------------------------------------------------------------------------- calendar
def workdays(frm, to):
    d, out = frm, []
    while d <= to:
        if d.weekday() < 5: out.append(d)
        d += datetime.timedelta(days=1)
    return out


WD = workdays(START, datetime.date(2030, 12, 31))
WD_INDEX = {d: i for i, d in enumerate(WD)}

# ---------------------------------------------------------------------------------------------------------------- input
data = json.load(open(os.path.join(HERE, 'sixty5_input.json'), encoding='utf8'))
tasks = data['tasks']
stage_guids = {s['name']: s for s in data['stages']}


def floor_of(stage_name):
    return int(stage_name.split(' ')[0])


def gate(f):
    if f < 0: return 8
    if f <= 16: return 110 + 12 * f
    return 110 + 12 * 16 + 8


# ---------------------------------------------------------------------------------------------------------------- work of every task
works = {}
for t in tasks:
    b = R.build(t)
    if b is None:
        raise SystemExit('no rule for %s %s' % (t['class'], t['type']))
    t['_b'] = b
    t['_f'] = floor_of(t['stage'])
    mh = sum(b.lab.values())
    # supervision: a foreman and the site manager of the trade
    if mh > 0:
        b.L('foreman', max(0.5, 0.07 * mh))
        b.L('site-manager', max(0.25, 0.025 * mh))
    # small tools and site costs per man-hour (supervision included)
    mh_all = sum(b.lab.values())
    b.E('smalltool', mh_all)
    b.E('site', mh_all)

# ---------------------------------------------------------------------------------------------------------------- people
random.seed(65)
combos = [(f, l) for l in C.LAST for f in C.FIRST]
random.shuffle(combos)
role_hours = collections.Counter()
for t in tasks:
    for r, h in t['_b'].lab.items(): role_hours[r] += h
POOL = {}
for r, h in role_hours.items():
    base = {'site-manager': 5, 'foreman': 7}.get(r)
    if base is None:
        base = max(2, math.ceil(h / (8 * 0.5 * 290) * 1.25))
    POOL[r] = base
persons = []          # dicts
by_role = collections.defaultdict(list)
for r in C.ROLES_TIME:
    for i in range(POOL.get(r, 0)):
        f, l = combos[len(persons)]
        pid = guid('person', r, i)
        p = {'guid': pid, 'first': f, 'last': l, 'role': r, 'no': 'SX-%03d' % (len(persons) + 1),
             'email': (f + '.' + l).lower().replace(' ', '') .replace("'", '') + '@bouwteam-sixty5.example'}
        persons.append(p); by_role[r].append(p)
usage = {p['guid']: collections.defaultdict(float) for p in persons}
load_total = collections.Counter()

# ---------------------------------------------------------------------------------------------------------------- the plan: tasks one after another, crews of named persons
def ready_of(t, i):
    return gate(t['_f']) + R.PHASE_OFFSET[t['_b'].phase] + (i % 4)


order = sorted(range(len(tasks)), key=lambda i: (ready_of(tasks[i], i), R.PHASE_OFFSET[tasks[i]['_b'].phase], tasks[i]['guid']))
HORIZON = 900


def fits(p, s, d, per_day):
    u = usage[p['guid']]
    for k in range(s, s + d):
        if u[k] + per_day > CAP_USE: return False
    return True


for i in order:
    t = tasks[i]
    b = t['_b']
    roles = []
    for r, h in sorted(b.lab.items()):
        h = round(max(0.25, h), 2)
        cmax = min(len(by_role[r]), CREW_MAX.get(r, CREW_DEFAULT))
        c = max(1, min(cmax, math.ceil(h / (CAP_USE * TARGET_D))))
        if r in ('foreman', 'site-manager'): c = 1
        roles.append((r, h, c))
    d = max(1, max(math.ceil(round(h / c, 2) / CAP_USE) for r, h, c in roles))
    s = ready_of(t, i)
    while True:
        if s > HORIZON: raise SystemExit('no room for task %s' % t['desc'])
        pick = {}
        ok = True
        for r, h, c in roles:
            per_day = round(h / c, 2) / d
            cand = sorted(by_role[r], key=lambda p: (load_total[p['guid']], p['no']))
            chosen = [p for p in cand if fits(p, s, d, per_day)][:c]
            if len(chosen) < c: ok = False; break
            pick[r] = chosen
        if ok: break
        s += 1
    t['_s'], t['_d'] = s, d
    t['_crew'] = []
    for r, h, c in roles:
        qty = round(h / c, 2)
        for p in pick[r]:
            for k in range(s, s + d): usage[p['guid']][k] += qty / d
            load_total[p['guid']] += qty
            t['_crew'].append((r, p, qty))

# ---------------------------------------------------------------------------------------------------------------- dates
def day_of(i): return WD[i]


def finish_excl(s, d):
    return WD[s + d - 1] + datetime.timedelta(days=1)


for t in tasks:
    t['_start'] = day_of(t['_s'])
    t['_finish'] = finish_excl(t['_s'], t['_d'])
proj_start = min(t['_start'] for t in tasks)
proj_finish = max(t['_finish'] for t in tasks)

# ---------------------------------------------------------------------------------------------------------------- lines
def money(x): return round(x + 1e-9, 2)


def base_line(genus, order, desc, role, qty, price, unit, source, budget, vat):
    s = money(qty * price)
    v = money(s * vat / 100.0)
    return {
        'taskManagementGenusLine': genus, 'distributionForBudgetTaskLine': 'uniformDistribution', 'measureUnitTaskLine': unit,
        'qtyTaskLine': qty, 'priceTaskLine': price, 'priceSourceTaskLine': source, 'vatRatioTaskLine': vat,
        'sumForContract': s, 'sumVATForContract': v, 'sumForAccounting': s, 'sumVATForAccounting': v, 'sumForBudget': s, 'sumVATForBudget': v,
        'budgetItemTaskLine': budget, 'businessUnitTaskLine': BU, 'businessUnitSourceTaskLine': 'line', 'taskIsPosted': False,
        'description': desc, 'resourceRoleItem': role, 'priceAutoTaskLine': price,
    }


lines = []            # (lineGUID, taskGUID, genus, order, json)
by_task = collections.defaultdict(list)
for t in tasks:
    tg = t['guid']; b = t['_b']; n = 0
    # Time: one line per person
    accountable_done = False
    for (r, p, qty) in sorted(t['_crew'], key=lambda x: (x[0], x[1]['no'])):
        rate = C.ROLES_TIME[r][1]
        j = base_line('timeGenus', n, '%s · %s %s' % (C.ROLES_TIME[r][0].split(' (')[0], p['first'], p['last']), 'bld-role-' + r, qty, rate, 'unit_hour', 'role', 'employeeWagesBudgetItem', 0)
        j['taskResourceKind'] = 'person'; j['taskResourceItem'] = p['guid']
        j['raciItem'] = 'raciAccountableGUID' if r == 'site-manager' else 'raciResponsibleGUID'
        n += 1
        lid = guid('line', tg, 'time', p['guid'])
        by_task[tg].append((lid, 'timeGenus', 1024 * n, j))
    # Material
    n = 0
    for k, qty in sorted(b.mat.items()):
        title, item, unit, price, sup, cat, note = C.MAT[k]
        qty = math.ceil(qty - 1e-9) if unit == 'unit_pcs' else round(qty, 2)
        if qty <= 0 or money(qty * price) < 0.5: continue
        j = base_line('materialGenus', n, '%s · %s' % (title, C.SUPPLIERS[sup][0]), 'bld-role-m-' + cat, qty, price, unit, 'product', C.MAT_BUDGET[cat], VAT)
        j['taskResourceItem'] = 'bld-prd-' + k; j['taskLinePartnerItem'] = 'bld-ptn-' + sup; j['taskLinePartnerContract'] = 'bld-ct-sup-' + sup
        n += 1
        by_task[tg].append((guid('line', tg, 'mat', k), 'materialGenus', 1024 * n, j))
    # Expense
    n = 0
    for k, qty in sorted(b.exp.items()):
        title, item, unit, price, sup, cat, budget, note = C.EXP[k]
        qty = round(qty, 2)
        if qty <= 0 or money(qty * price) < 0.5: continue
        j = base_line('expenseGenus', n, '%s · %s' % (title, C.SUPPLIERS[sup][0]), 'bld-role-e-' + cat, qty, price, unit, 'product', budget, VAT)
        j['taskResourceItem'] = 'bld-prd-' + k; j['taskLinePartnerItem'] = 'bld-ptn-' + sup; j['taskLinePartnerContract'] = 'bld-ct-sup-' + sup
        n += 1
        by_task[tg].append((guid('line', tg, 'exp', k), 'expenseGenus', 1024 * n, j))

# ---------------------------------------------------------------------------------------------------------------- SQL 01: catalog
def write(name, text):
    with open(os.path.join(OUT, name), 'w', encoding='utf8') as f: f.write(text)


def upsert(table, rows):
    """rows = [(guid, owner, parent, order, json)]"""
    vals = ',\n'.join('  (%s, %s, %s, %s, %s)' % (q(g), q(o), q(p), od, js(j)) for g, o, p, od, j in rows)
    return ('INSERT INTO public."%s" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES\n%s\n'
            'ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowParentGUID" = EXCLUDED."rowParentGUID", "rowJSON" = EXCLUDED."rowJSON";\n') % (table, vals)


cat = ['-- Sixty5 (BIM4) catalogs: roles + hourly rates, persons, suppliers + contracts, products + purchase prices. Generated by build_sixty5_plan.py. Idempotent.\n'
       '-- Every id starts with bld- (persons / lines: uuid5). Needs start1 + start2 + start4.\n'
       'DO $$ BEGIN IF to_regclass(\'public."personTable"\') IS NULL OR to_regclass(\'public."productPriceTable"\') IS NULL THEN RAISE EXCEPTION \'Run start1 + start2 + start4 first\'; END IF; END $$;\n'
       'BEGIN;\n']
cat.append('-- measureUnitTable\n' + upsert('measureUnitTable', [(u, 'measureUnitCatalog', 'empty', od, {'code': code, 'title': title}) for u, title, code, od in C.NEW_UNITS]))
rf = [('bld-fld-role-trades', 'resourceRoleFolderCatalog', 'empty', 95000, {'title': 'Sixty5 · bouwvakkers (trades)'}),
      ('bld-fld-role-materials', 'resourceRoleFolderCatalog', 'empty', 95100, {'title': 'Sixty5 · materialen (materials)'}),
      ('bld-fld-role-expenses', 'resourceRoleFolderCatalog', 'empty', 95200, {'title': 'Sixty5 · kosten (expenses)'})]
cat.append('-- resourceRoleFolderTable\n' + upsert('resourceRoleFolderTable', rf))
rt = [('bld-roletype-trades', 'resourceRoleTypeCatalog', 'empty', 95000, {'title': 'Sixty5 bouwvakkers (building trades)', 'baseUnit': 'unit_hour', 'isActive': True, 'variantSet': None,
        'description': 'Trades of the building site: hour costed with the all-in hourly cost (CAO bouw + overhead), no VAT on own employees', 'propertySet': None, 'variantMode': 'none',
        'uniqueVariants': True, 'managementGenus': 'timeGenus', 'roleVATDefaultRate': 'vat_0', 'variantTitleTemplate': None}),
      ('bld-roletype-materials', 'resourceRoleTypeCatalog', 'empty', 95100, {'title': 'Sixty5 bouwmaterialen (building materials)', 'baseUnit': 'unit_m2', 'isActive': True, 'variantSet': None,
        'description': 'Building materials and finished goods bought per m2, m3, piece, kg', 'propertySet': None, 'variantMode': 'none', 'uniqueVariants': True,
        'managementGenus': 'materialGenus', 'roleVATDefaultRate': 'vat_21', 'variantTitleTemplate': None}),
      ('bld-roletype-expenses', 'resourceRoleTypeCatalog', 'empty', 95200, {'title': 'Sixty5 bouwplaatskosten (site expenses)', 'baseUnit': 'unit_hour', 'isActive': True, 'variantSet': None,
        'description': 'Crane, hoist, access, waste, drilling, survey, small tools', 'propertySet': None, 'variantMode': 'none', 'uniqueVariants': True,
        'managementGenus': 'expenseGenus', 'roleVATDefaultRate': 'vat_21', 'variantTitleTemplate': None})]
cat.append('-- resourceRoleTypeTable\n' + upsert('resourceRoleTypeTable', rt))
roles = []
od = 96000
for k, (title, rate, desc) in C.ROLES_TIME.items():
    od += 100
    roles.append(('bld-role-' + k, 'bld-roletype-trades', 'bld-fld-role-trades', od, {'title': title, 'isActive': True, 'description': desc + ' (Sixty5, %.2f EUR per hour all-in)' % rate, 'roleVATRate': 'vat_0'}))
for k, title in C.MAT_CATS.items():
    od += 100
    roles.append(('bld-role-m-' + k, 'bld-roletype-materials', 'bld-fld-role-materials', od, {'title': title, 'isActive': True, 'description': title + ' (Sixty5)', 'roleVATRate': 'vat_21'}))
for k, title in C.EXP_CATS.items():
    od += 100
    roles.append(('bld-role-e-' + k, 'bld-roletype-expenses', 'bld-fld-role-expenses', od, {'title': title, 'isActive': True, 'description': title + ' (Sixty5)', 'roleVATRate': 'vat_21'}))
cat.append('-- resourceRoleTable\n' + upsert('resourceRoleTable', roles))
rp = [('bld-rp-' + k, 'bld-role-' + k, 'empty', 95000 + i, {'price': rate, 'validFrom': '2026-01-01', 'measureUnit': 'unit_hour', 'priceTypeGUID': 'pt_cost'}) for i, (k, (title, rate, desc)) in enumerate(C.ROLES_TIME.items())]
cat.append('-- rolePriceTable\n' + upsert('rolePriceTable', rp))
prs = []
for i, p in enumerate(persons):
    title = C.ROLES_TIME[p['role']][0].split(' (')[0]
    prs.append((p['guid'], 'personCatalog', 'empty', 95000 + i, {'isActive': True, 'personType': 'personTypeEmployee', 'personEmail': p['email'], 'personPhone': '+31 6 5%07d' % (1000000 + i * 137),
                'personTitle': '%s %s' % (p['first'], p['last']), 'employeeData': {'position': title, 'department': 'Uitvoering Sixty5', 'employeeNumber': p['no']},
                'personLastName': p['last'], 'personFirstName': p['first'], 'personIsEmployee': True}))
cat.append('-- personTable (%d persons)\n' % len(persons) + upsert('personTable', prs))
ptn, ct = [], []
for i, (k, (name, city, what)) in enumerate(C.SUPPLIERS.items()):
    ptn.append(('bld-ptn-' + k, 'partnerCatalog', 'empty', 95000 + i, {'isActive': True, 'partnerKind': 'company', 'partnerTitle': name, 'partnerLegalName': name, 'partnerIsSupplier': True, 'partnerIsCustomer': False,
                'supplierData': {'notes': 'Supplier of %s (%s)' % (what, city), 'defaultCurrency': 'EUR', 'paymentTimelineShiftDays': 30, 'paymentTermsDays': 30}}))
    ct.append(('bld-ct-sup-' + k, 'bld-ptn-' + k, 'partner', -95000 - i, {'notes': 'Framework supply agreement Sixty5, payment 30 days', 'contractVAT': 21, 'contractType': 'Supply',
                'contractTitle': 'Raamovereenkomst levering 2026-2028 - %s' % name, 'contractTotal': 0, 'contractNumber': 'SX-SUP-%03d' % (i + 1), 'contractStatus': 'active', 'contractVATRate': 21,
                'contractCurrency': 'EUR', 'contractPartyType': 'partner', 'contractStartDate': '2026-11-01', 'contractFinishDate': '2028-12-31', 'contractSignedDate': '2026-10-15',
                'contractSumBeforeVAT': 0, 'contractPaymentsPeriod': 'Month'}))
cat.append('-- partnerTable (suppliers)\n' + upsert('partnerTable', ptn))
cat.append('-- contractTable (supply agreements)\n' + upsert('contractTable', ct))
pf = [('bld-fld-root', 'productFolderCatalog', 'empty', 95000, {'title': 'Sixty5 bouwmaterialen'})]
for i, (k, title) in enumerate(C.MAT_CATS.items()):
    pf.append(('bld-fld-' + k, 'productFolderCatalog', 'bld-fld-root', 95100 + i, {'title': title}))
for i, (k, title) in enumerate(C.EXP_CATS.items()):
    pf.append(('bld-fld-e-' + k, 'productFolderCatalog', 'bld-fld-root', 95300 + i, {'title': title}))
cat.append('-- productFolderTable\n' + upsert('productFolderTable', pf))
pt = [('bld-type-material', 'productTypeCatalog', 'empty', 95000, {'title': 'Bouwmateriaal (building material)', 'baseUnit': 'unit_m2', 'isActive': True, 'variantSet': '', 'propertySet': '', 'variantMode': 'none', 'uniqueVariants': True, 'productVATDefaultRate': 'vat_21'}),
      ('bld-type-service', 'productTypeCatalog', 'empty', 95100, {'title': 'Bouwplaatsdienst (site service)', 'baseUnit': 'unit_hour', 'isActive': True, 'variantSet': '', 'propertySet': '', 'variantMode': 'none', 'uniqueVariants': True, 'productVATDefaultRate': 'vat_21'})]
cat.append('-- productTypeTable\n' + upsert('productTypeTable', pt))
prods, prices = [], []
i = 0
for k, (title, item, unit, price, sup, c_, note) in C.MAT.items():
    i += 1
    prods.append(('bld-prd-' + k, 'bld-type-material', 'bld-fld-' + c_, 95000 + i, {'sku': 'SX-' + item, 'itemNumber': item, 'searchName': title.split(' ')[0].upper() + ' ' + item, 'title': title, 'isActive': True,
                  'description': '%s. Supplier: %s. Price list 2026.' % (note, C.SUPPLIERS[sup][0]), 'measureUnitDefault': unit, 'measureUnitForInventory': unit}))
    prices.append(('bld-pp-' + k, 'bld-prd-' + k, 'empty', 95000 + i, {'price': price, 'validFrom': '2026-01-01', 'measureUnit': unit, 'priceTypeGUID': 'pt_purchase'}))
for k, (title, item, unit, price, sup, c_, budget, note) in C.EXP.items():
    i += 1
    prods.append(('bld-prd-' + k, 'bld-type-service', 'bld-fld-e-' + c_, 95000 + i, {'sku': 'SX-' + item, 'itemNumber': item, 'searchName': 'EXP ' + item, 'title': title, 'isActive': True,
                  'description': '%s. Supplier: %s. Rate 2026.' % (note, C.SUPPLIERS[sup][0]), 'measureUnitDefault': unit, 'measureUnitForInventory': unit}))
    prices.append(('bld-pp-' + k, 'bld-prd-' + k, 'empty', 95000 + i, {'price': price, 'validFrom': '2026-01-01', 'measureUnit': unit, 'priceTypeGUID': 'pt_purchase'}))
cat.append('-- productTable (%d)\n' % len(prods) + upsert('productTable', prods))
cat.append('-- productPriceTable\n' + upsert('productPriceTable', prices))
cat.append('COMMIT;\n')
write('01_catalog.sql', '\n'.join(cat))

# ---------------------------------------------------------------------------------------------------------------- SQL 02: calendars 2028-2029
cal = ['-- Day rows 2028-2030 of workingDaysCalendar and standardWorkWeekCalendar (they end 2027-12-31; the plan runs into 2028). Same rows as the app\'s "Fill in Management calendars". Idempotent.\nBEGIN;']
rows = []
d = datetime.date(2028, 1, 1)
order_in_list = 21184
while d <= datetime.date(2030, 12, 31):
    wk = d.weekday() < 5
    for c_ in ('workingDaysCalendar', 'standardWorkWeekCalendar'):
        j = {'day': d.isoformat(), 'isActive': wk, 'reason': 'fill' if wk else 'weekend'}
        if c_ == 'standardWorkWeekCalendar': j['hours'] = 8 if wk else 0
        rows.append("  ('%s:%s', '%s', '%d', %d, %s)" % (c_, d.isoformat(), c_, d.year, order_in_list, js(j)))
    order_in_list += 1
    d += datetime.timedelta(days=1)
cal.append('INSERT INTO public."managementCalendarDaysTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES\n' + ',\n'.join(rows) + '\nON CONFLICT ("rowGUID") DO NOTHING;')
cal.append('COMMIT;\n')
write('02_calendar.sql', '\n'.join(cal))

# ---------------------------------------------------------------------------------------------------------------- SQL 03: project + tasks
stage_span = {}
for t in tasks:
    sp = stage_span.setdefault(t['stageGuid'], [t['_start'], t['_finish']])
    sp[0] = min(sp[0], t['_start']); sp[1] = max(sp[1], t['_finish'])
tv = []
for t in tasks:
    tv.append("  (%s::uuid, %s, %s, %d, %s)" % (q(t['guid']), q(t['_start'].isoformat() + 'T00:00:00.000Z'), q(t['_start'].isoformat() + 'T00:00:00+00:00'), t['_d'], q(t['_finish'].isoformat() + ' 00:00:00+00')))
sv = []
for g, (a, b_) in stage_span.items():
    sv.append("  (%s::uuid, %s, %s, %s)" % (q(g), q(a.isoformat() + 'T00:00:00+00:00'), q(b_.isoformat() + ' 00:00:00+00'), 0))
proj_json = {
    'currencyForBudget': 'EUR', 'currencyForAccounting': 'EUR', 'currencyForContract': 'EUR', 'calendarForTaskPlan': 'workingDaysCalendar', 'skipWeekends': True,
    'projectStartDate': proj_start.isoformat(), 'projectStartAt': proj_start.isoformat() + 'T00:00:00.000Z', 'projectFinishDate': proj_finish.isoformat(),
    'projectExpenseBudgetNeeded': True, 'projectTimeCostsNeeded': True, 'projectTimeOfPersonNeeded': True, 'projectTimeOfEquipmentNeeded': False,
    'projectMaterialCostsNeeded': True, 'projectExpenseCostsNeeded': True, 'projectBusinessUnitsRequired': True,
    'notes': ('BIM import of arc.ifc: 19 stages, 1639 tasks. Cost and time plan of the finishing scope of the model (walls, facade, frames, doors, floors, ceilings, fixtures): '
              'Time lines (named crews, no one above 8 h a day), Material lines (products + suppliers), Expense lines (crane, access, waste, small tools). '
              'Not in the model and not in the plan: piles, foundation, concrete structure, mechanical / electrical installations. Prices EUR excl. VAT, level 2026. '
              'Plan %s - %s.' % (proj_start.isoformat(), proj_finish.isoformat())),
}
p3 = ['-- Project settings + the dates of every task and stage of BIM4 Sixty5. Generated by build_sixty5_plan.py. Idempotent.\nBEGIN;',
      "SELECT set_config('app.task_bulk', 'on', true);",
      "UPDATE public.project_table SET \"rowJSON\" = \"rowJSON\" || %s, \"rowDuration\" = %s WHERE \"rowGUID\" = %s::uuid;" % (js(proj_json), q(proj_finish.isoformat() + ' 00:00:00+00'), q(PROJECT)),
      'UPDATE public.project_task_table t SET "rowJSON" = t."rowJSON" || jsonb_build_object(\'manualStartAt\', v.m, \'startAt\', v.s, \'durationDays\', v.d), "rowDuration" = v.f::timestamptz\n'
      '  FROM (VALUES\n' + ',\n'.join(tv) + '\n  ) AS v(g, m, s, d, f) WHERE t."rowGUID" = v.g;',
      'UPDATE public.project_task_table t SET "rowJSON" = jsonb_set(t."rowJSON", \'{startAt}\', to_jsonb(v.s::text)), "rowDuration" = v.f::timestamptz\n'
      '  FROM (VALUES\n' + ',\n'.join(sv) + '\n  ) AS v(g, s, f, z) WHERE t."rowGUID" = v.g;',
      'COMMIT;\n']
write('03_project_tasks.sql', '\n'.join(p3))

# ---------------------------------------------------------------------------------------------------------------- SQL 04: lines
flat = []
for t in tasks:
    for (lid, genus, od, j) in by_task[t['guid']]:
        flat.append((lid, t['guid'], genus, od, j))
CH = 250
for k in range(0, len(flat), CH):
    part = flat[k:k + CH]
    vals = ',\n'.join('  (%s::uuid, %s::uuid, %s, %d, %s)' % (q(lid), q(tg), q(gn), od, js(j)) for lid, tg, gn, od, j in part)
    write('04_lines_%03d.sql' % (k // CH + 1), '-- Sixty5 task lines %d..%d of %d. Idempotent (same ids).\nBEGIN;\n'
          'INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES\n%s\n'
          'ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON", "orderInList" = EXCLUDED."orderInList";\nCOMMIT;\n' % (k + 1, k + len(part), len(flat), vals))
n_line_files = (len(flat) + CH - 1) // CH

# ---------------------------------------------------------------------------------------------------------------- SQL 05: Post payloads
SCALE = 10 ** 10


def coefs(n):
    units = [round(SCALE / n)] * n
    diff = SCALE - sum(units)
    units[-1] += diff
    return [u / SCALE for u in units]


payloads = []
for t in tasks:
    ds = [WD[k].isoformat() for k in range(t['_s'], t['_s'] + t['_d'])]
    cf = coefs(len(ds))
    ls = []
    for (lid, genus, od, j) in sorted(by_task[t['guid']], key=lambda x: ({'timeGenus': 0, 'materialGenus': 1, 'expenseGenus': 2}[x[1]], x[2])):
        ls.append({'lineGUID': lid, 'baseOfDistribution': 1, 'qtyTaskLine': j['qtyTaskLine'], 'sumForBudget': j['sumForBudget'], 'sumForContract': j['sumForContract'],
                   'sumForAccounting': j['sumForAccounting'], 'days': [{'d': d_, 'c': c_} for d_, c_ in zip(ds, cf)]})
    payloads.append({'taskGUID': t['guid'], 'timeZone': 'UTC', 'lines': ls})
PCH = 40
for k in range(0, len(payloads), PCH):
    part = payloads[k:k + PCH]
    vals = ',\n'.join('  (%s::jsonb)' % q(json.dumps(p, separators=(',', ':'))) for p in part)
    write('05_post_%03d.sql' % (k // PCH + 1), '-- Post of tasks %d..%d (create_task_line_plan; "busy" must be empty). Runs as the OWNER of the project: the procedure asks perm_can_in, which a bare postgres session does not pass.\n'
          'BEGIN;\nSET LOCAL ROLE authenticated;\n'
          "SELECT set_config('request.jwt.claims', '{\"sub\":\"%s\",\"role\":\"authenticated\"}', true), set_config('request.jwt.claim.sub', '%s', true);\n"
          "SET LOCAL statement_timeout = '300s';\n"
          'SELECT x ->> \'taskGUID\' AS task, r ->> \'lines\' AS lines, r ->> \'rows\' AS "rows", r -> \'busy\' AS busy FROM (VALUES\n%s\n) AS v(x), LATERAL (SELECT public.create_task_line_plan(v.x) AS r) q;\nCOMMIT;\n' % (k + 1, k + len(part), OWNER, OWNER, vals))
n_post_files = (len(payloads) + PCH - 1) // PCH

# ---------------------------------------------------------------------------------------------------------------- report
tot = collections.Counter(); per_storey = collections.defaultdict(lambda: collections.Counter())
for t in tasks:
    for (lid, genus, od, j) in by_task[t['guid']]:
        tot[genus] += j['sumForBudget']; tot[genus + '_n'] += 1
        per_storey[t['stage']][genus] += j['sumForBudget']
hours = collections.Counter()
for t in tasks:
    for r, p, qty in t['_crew']: hours[r] += qty
peak_sets = collections.defaultdict(set)
for t in tasks:
    for k in range(t['_s'], t['_s'] + t['_d']):
        for r, p, qty in t['_crew']: peak_sets[k].add(p['guid'])
peak = {k: len(v) for k, v in peak_sets.items()}
rep = ['SIXTY5 plan report',
       'project %s  %s .. %s  (%d working days)' % (PROJECT, proj_start, proj_finish, WD_INDEX[proj_finish - datetime.timedelta(days=1)] - WD_INDEX[proj_start] + 1 if (proj_finish - datetime.timedelta(days=1)) in WD_INDEX else 0),
       'tasks %d, lines %d (Time %d, Material %d, Expense %d), persons %d, suppliers %d, products %d' % (len(tasks), len(flat), tot['timeGenus_n'], tot['materialGenus_n'], tot['expenseGenus_n'], len(persons), len(C.SUPPLIERS), len(prods)),
       'money EUR excl. VAT: time %.2f  material %.2f  expense %.2f  total %.2f' % (tot['timeGenus'], tot['materialGenus'], tot['expenseGenus'], tot['timeGenus'] + tot['materialGenus'] + tot['expenseGenus']),
       'hours by role:']
for r, h in hours.most_common(): rep.append('   %-16s %9.1f h  persons %d  rate %.2f' % (r, h, len(by_role[r]), C.ROLES_TIME[r][1]))
rep.append('peak people on site on one day: %d' % max(peak.values()))
rep.append('max hours of a person on one day: %.2f' % max(max(u.values()) if u else 0 for u in usage.values()))
rep.append('storeys:')
for st in sorted(per_storey, key=floor_of):
    c_ = per_storey[st]
    rep.append('   %-22s time %12.2f  material %12.2f  expense %10.2f' % (st, c_['timeGenus'], c_['materialGenus'], c_['expenseGenus']))
rep.append('files: 01_catalog.sql 02_calendar.sql 03_project_tasks.sql 04_lines_001..%03d.sql 05_post_001..%03d.sql' % (n_line_files, n_post_files))
write('report.txt', '\n'.join(rep) + '\n')
print('\n'.join(rep))
json.dump({'lines': n_line_files, 'post': n_post_files, 'tasks': len(tasks), 'nlines': len(flat)}, open(os.path.join(OUT, 'manifest.json'), 'w'))
