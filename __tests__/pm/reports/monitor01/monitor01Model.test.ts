// The pure part of Monitor01: keys, realtime patching, filters, tabs, totals, the table items, colours, the drill-down filters (kit8/pm/reports/monitor01).
import {
  EMPTY_MONITOR01_FILTERS, Monitor01Row, applyMonitor01VatBasis, applyMonitor01Events, buildMonitor01Items, drillFilterOfNode, drillFilterOfRow, drillFilterOfRows, monitor01MonthKey, monitor01NodeKeys, monitor01ProjectKey, monitor01RoleKey, drillOperands, filterMonitor01Rows, formatMonitor01Number,
  MONITOR01_HEAD, MONITOR01_MEASURES, MONITOR01_MEASURE_FIELD, MONITOR01_MEASURE_GROUP, MONITOR01_MEASURE_TITLE, MONITOR01_VENDOR_INVOICE_HEAD, MONITOR01_CUSTOMER_INVOICE_HEAD, MONITOR01_TABS, monitor01GenusTitle, monitor01DateErrors, monitor01FiltersActive, monitor01Key, monitor01ProjectOptions, monitor01ResourceOptions, monitor01TaskOptions, monitor01Totals, monthLabel, parseMonitor01Row, rowsOfTab, sortMonitor01Rows, totalsByUnit,
} from '../../../../kit8/pm/reports/monitor01/monitor01Model';
import { cellTone, toneBackground } from '../../../../kit8/pm/reports/monitor01/monitor01Colors';

const raw = (over: Record<string, any> = {}) => ({
  rowOwnerGUID: 't1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: 'task01',
  resourceRoleName: 'Data Analyst', qtyPlanned: '24.00', qtyContracted: '24.00', sumForBudget: '480.00', qtyRestToContract: '0.00', qtyReceived: '0', qtyVendorInvoiced: '0', qtyUsed: '0', qtyOnHand: '0', lineCount: 1, hasStalePlan: false, updated_at: '2026-10-14T10:00:00Z', ...over,
});
const row = (over: Record<string, any> = {}): Monitor01Row => parseMonitor01Row(raw(over));

// the example of the sheet "W1 1-MONITOR01"
const sheet = (): Monitor01Row[] => [
  row(),
  row({ rowOwnerGUID: 't3', taskName: 'task03', qtyContracted: 0, qtyRestToContract: 24, sumForBudget: '600.50' }),
  row({ rowOwnerGUID: 't3', taskName: 'task03', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: '10m pipe section', measureUnit: 'unit_pcs', qtyPlanned: 100, qtyContracted: 65, sumForBudget: 1000, qtyRestToContract: 35 }),
  row({ rowOwnerGUID: 't4', taskName: 'task04', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: '10m pipe section', measureUnit: 'unit_pcs', qtyPlanned: 200, qtyContracted: 80, sumForBudget: 2000, qtyRestToContract: 120 }),
];

describe('the column Ordered (posted purchase orders)', () => {
  it('it is the first measure of the Fact group, before Received', () => {
    expect([...MONITOR01_MEASURES]).toEqual(['planned', 'contracted', 'restToContract', 'ordered', 'received', 'vendorInvoiced', 'used', 'onHand', 'customerInvoiced']);
    expect(MONITOR01_MEASURE_FIELD.ordered).toBe('qtyOrdered');
    expect(MONITOR01_MEASURE_TITLE.ordered).toBe('Ordered');
    expect(MONITOR01_MEASURE_GROUP.ordered).toBe('Fact');
  });
  it('Customer Invoice is the LAST 1st level group (after Vendor Invoice) with Qty = qtyCustomerInvoiced and Sum = the money sumCustomerInvoiced (parsed, per unit, totals, tree lines)', () => {
    expect(MONITOR01_MEASURE_GROUP.customerInvoiced).toBe('Customer Invoice');
    expect(MONITOR01_MEASURE_FIELD.customerInvoiced).toBe('qtyCustomerInvoiced');
    expect(MONITOR01_CUSTOMER_INVOICE_HEAD).toEqual({ group: 'Customer Invoice', qty: 'Quantity', sum: 'Amount' });
    expect(row({ qtyCustomerInvoiced: '4', sumCustomerInvoiced: '500.25' })).toMatchObject({ qtyCustomerInvoiced: 4, sumCustomerInvoiced: 500.25 });
    expect(row({})).toMatchObject({ qtyCustomerInvoiced: 0, sumCustomerInvoiced: 0 });
    const rows = [row({ qtyCustomerInvoiced: 2, sumCustomerInvoiced: 10.1 }), row({ rowOwnerGUID: 't2', qtyCustomerInvoiced: 1, sumCustomerInvoiced: 20.2 }), row({ rowOwnerGUID: 't3', measureUnit: 'unit_pcs', sumCustomerInvoiced: 5 })];
    expect(totalsByUnit(rows).map((x) => [x.unit, x.sumCustomerInvoiced, x.sums.customerInvoiced])).toEqual([['unit_hour', 30.3, 3], ['unit_pcs', 5, 0]]);
    expect(monitor01Totals(rows).sumCustomerInvoiced).toBe(35.3);
    expect(buildMonitor01Items(rows).filter((i) => i.kind === 'total').map((i: any) => i.sumCustomerInvoiced)).toEqual([30.3, 5]);
    expect(drillOperands('customerInvoiced')).toEqual([{ measure: 'customerInvoiced', sign: 1 }]);
  });
  it('the Deliverable (Revenue) genus has a tab of its own and is in All; its rows have only the customer invoice numbers', () => {
    expect(MONITOR01_TABS.map((t) => t.id)).toEqual(['time', 'material', 'expense', 'deliverable', 'all']);
    const rows = [row({ genusGUID: 'timeGenus' }), row({ rowOwnerGUID: 't2', genusGUID: 'revenueGenus', qtyCustomerInvoiced: 1 })];
    expect(rowsOfTab(rows, 'deliverable').map((r) => r.genusGUID)).toEqual(['revenueGenus']);
    expect(rowsOfTab(rows, 'time').map((r) => r.genusGUID)).toEqual(['timeGenus']);
    expect(rowsOfTab(rows, 'all')).toHaveLength(2);
    expect(monitor01GenusTitle('revenueGenus')).toBe('Deliverable');
  });
  it('Vendor Invoice has a 1st level group after Fact; its Qty is qtyVendorInvoiced and its Sum is the money sumVendorInvoiced (parsed, summed per unit, in the totals and the tree lines)', () => {
    expect(MONITOR01_MEASURE_GROUP.vendorInvoiced).toBe('Vendor Invoice');
    expect(MONITOR01_VENDOR_INVOICE_HEAD).toEqual({ group: 'Vendor Invoice', qty: 'Quantity', sum: 'Amount' });
    expect(row({ sumVendorInvoiced: '120.50' }).sumVendorInvoiced).toBe(120.5);
    expect(row({}).sumVendorInvoiced).toBe(0);
    const rows = [row({ sumVendorInvoiced: 100.1, qtyVendorInvoiced: 2 }), row({ rowOwnerGUID: 't2', sumVendorInvoiced: 20.2, qtyVendorInvoiced: 1 }), row({ rowOwnerGUID: 't3', measureUnit: 'unit_pcs', sumVendorInvoiced: 5 })];
    expect(totalsByUnit(rows).map((x) => [x.unit, x.sumVendorInvoiced, x.sums.vendorInvoiced])).toEqual([['unit_hour', 120.3, 3], ['unit_pcs', 5, 0]]);
    expect(monitor01Totals(rows).sumVendorInvoiced).toBe(125.3);
    const items = buildMonitor01Items(rows);
    expect(items.filter((i) => i.kind === 'total').map((i: any) => i.sumVendorInvoiced)).toEqual([120.3, 5]);
    expect(items.filter((i) => i.kind === 'node').every((i: any) => typeof i.sumVendorInvoiced === 'number')).toBe(true);
  });
  it('it is summed per unit like the other quantities (hours and pieces are never added)', () => {
    const t = totalsByUnit([row({ qtyOrdered: 3 }), row({ rowOwnerGUID: 't2', qtyOrdered: 4.5 }), row({ rowOwnerGUID: 't3', measureUnit: 'unit_pcs', qtyOrdered: 10 })]);
    expect(t.map((x) => [x.unit, x.sums.ordered])).toEqual([['unit_hour', 7.5], ['unit_pcs', 10]]);
  });
  it('it has no tone (nothing is critical about a quantity ordered)', () => {
    expect(cellTone('ordered', row({ qtyOrdered: 5 }))).toBe('none');
  });
});

describe('rows', () => {
  it('numeric columns that arrive as strings become numbers; the generated ones are derived when missing', () => {
    const r = parseMonitor01Row(raw({ qtyRestToContract: undefined, qtyOnHand: undefined, qtyReceived: '20', qtyUsed: '16', qtyPlanned: '24', qtyContracted: '10' }));
    expect(r.qtyPlanned).toBe(24);
    expect(r.qtyRestToContract).toBe(14);
    expect(r.qtyOnHand).toBe(4);
    expect(parseMonitor01Row(raw({ qtyVendorInvoiced: '8.50' })).qtyVendorInvoiced).toBe(8.5);
    expect(parseMonitor01Row(raw({ qtyVendorInvoiced: undefined })).qtyVendorInvoiced).toBe(0);
    expect(parseMonitor01Row(raw({ qtyOrdered: '11.00' })).qtyOrdered).toBe(11);
    expect(parseMonitor01Row(raw({ qtyOrdered: undefined })).qtyOrdered).toBe(0);
    expect(r.periodMonth).toBe('2026-10-01');
  });
  it('the key is the primary key of the table', () => {
    expect(monitor01Key(row())).toBe('t1|timeGenus|r1|unit_hour|2026-10-01');
    expect(monitor01Key(row({ resourceRoleGUID: '' }))).toBe('t1|timeGenus||unit_hour|2026-10-01');
    expect(monitor01Key({ ...row(), periodMonth: '2026-10-01T00:00:00+00:00' })).toBe(monitor01Key(row()));
  });
  it('month label is year-month: a project can cross years', () => {
    expect(monthLabel('2026-10-01')).toBe('Oct 2026');
    expect(monthLabel('2027-01-01')).toBe('Jan 2027');
    expect(monthLabel('')).toBe('');
  });
  it('numbers: facts without data are blank, the rest show their 0', () => {
    expect(formatMonitor01Number(24)).toBe('24');
    expect(formatMonitor01Number(12.5)).toBe('12.5');
    expect(formatMonitor01Number(0)).toBe('0');
    expect(formatMonitor01Number(0, true)).toBe('');
  });
});

describe('realtime patching', () => {
  const start = (): Map<string, Monitor01Row> => new Map(sheet().map((r) => [monitor01Key(r), r]));
  it('an UPDATE replaces ONLY the row of its key; the other rows are the same objects', () => {
    const before = start();
    const after = applyMonitor01Events(before, [{ eventType: 'UPDATE', new: raw({ qtyPlanned: 30, qtyRestToContract: 6, updated_at: '2026-10-14T10:00:02Z' }) }]);
    expect(after).not.toBe(before);
    expect(after.get('t1|timeGenus|r1|unit_hour|2026-10-01')!.qtyPlanned).toBe(30);
    const other = 't4|materialGenus|r2|unit_pcs|2026-10-01';
    expect(after.get(other)).toBe(before.get(other));
    expect(before.get('t1|timeGenus|r1|unit_hour|2026-10-01')!.qtyPlanned).toBe(24);   // the old map is untouched
  });
  it('an INSERT adds, a DELETE removes (the old row of the event carries the key)', () => {
    const before = start();
    const inserted = applyMonitor01Events(before, [{ eventType: 'INSERT', new: raw({ rowOwnerGUID: 't9', taskName: 'new' }) }]);
    expect(inserted.size).toBe(before.size + 1);
    const deleted = applyMonitor01Events(inserted, [{ eventType: 'DELETE', old: raw({ rowOwnerGUID: 't9' }) }]);
    expect(deleted.size).toBe(before.size);
    expect(deleted.has('t9|timeGenus|r1|unit_hour|2026-10-01')).toBe(false);
  });
  it('nothing changed = the SAME map (the screen does not render)', () => {
    const before = start();
    expect(applyMonitor01Events(before, [])).toBe(before);
    expect(applyMonitor01Events(before, [{ eventType: 'DELETE', old: raw({ rowOwnerGUID: 'nobody' }) }])).toBe(before);
    expect(applyMonitor01Events(before, [{ eventType: 'UPDATE', new: raw() }])).toBe(before);       // the same version again (a replay)
    expect(applyMonitor01Events(before, [{ eventType: 'UPDATE' }])).toBe(before);
  });
  it('several events of one burst are applied in order', () => {
    const after = applyMonitor01Events(new Map(), [
      { eventType: 'INSERT', new: raw({ qtyPlanned: 1, updated_at: '1' }) },
      { eventType: 'UPDATE', new: raw({ qtyPlanned: 2, updated_at: '2' }) },
      { eventType: 'UPDATE', new: raw({ qtyPlanned: 3, updated_at: '3' }) },
    ]);
    expect(after.size).toBe(1);
    expect([...after.values()][0].qtyPlanned).toBe(3);
  });
});

describe('tabs and the order of the sheet', () => {
  it('Time · Material · Expense · All', () => {
    const rows = sheet();
    expect(rowsOfTab(rows, 'time')).toHaveLength(2);
    expect(rowsOfTab(rows, 'material')).toHaveLength(2);
    expect(rowsOfTab(rows, 'expense')).toHaveLength(0);
    expect(rowsOfTab(rows, 'all')).toHaveLength(4);
  });
  it('sorted by project, genus, role, MONTH ASCENDING, task', () => {
    const shuffled = [sheet()[3], sheet()[1], sheet()[2], sheet()[0]];
    expect(sortMonitor01Rows(shuffled).map((r) => r.taskName)).toEqual(['task01', 'task03', 'task03', 'task04']);
    const months = [row({ periodMonth: '2027-01-01' }), row({ periodMonth: '2026-12-01' }), row({ periodMonth: '2026-02-01' }), row({ periodMonth: '2026-10-01' })];
    expect(sortMonitor01Rows(months).map((r) => r.periodMonth)).toEqual(['2026-02-01', '2026-10-01', '2026-12-01', '2027-01-01']);      // across a year too
    const projects = [row({ rowProjectGUID: 'p2', projectName: 'Beta' }), row({ rowProjectGUID: 'p1', projectName: 'Alpha', periodMonth: '2026-11-01' })];
    expect(sortMonitor01Rows(projects).map((r) => r.projectName)).toEqual(['Alpha', 'Beta']);
  });
});

describe('filters', () => {
  const rows = [
    row(),
    row({ rowOwnerGUID: 't2', taskName: 'task02', periodMonth: '2026-11-01', projectName: 'Beta', rowProjectGUID: 'p2' }),
    row({ rowOwnerGUID: 't3', taskName: 'task03', periodMonth: '2027-01-01', resourceRoleGUID: 'r2', resourceRoleName: 'Welder' }),
  ];
  it('no filter = all rows; a filter is active when something is picked', () => {
    expect(filterMonitor01Rows(rows, EMPTY_MONITOR01_FILTERS)).toHaveLength(3);
    expect(monitor01FiltersActive(EMPTY_MONITOR01_FILTERS)).toBe(false);
    expect(monitor01FiltersActive({ ...EMPTY_MONITOR01_FILTERS, taskGUID: 't1' })).toBe(true);
  });
  it('startDate / finishDate cut MONTHS that overlap the window', () => {
    const f = (startDate: string, finishDate: string) => filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, startDate, finishDate }).map((r) => r.rowOwnerGUID);
    expect(f('2026-10-20', '')).toEqual(['t1', 't2', 't3']);        // the 20th of October overlaps the month of October
    expect(f('2026-11-01', '')).toEqual(['t2', 't3']);
    expect(f('', '2026-10-05')).toEqual(['t1']);
    expect(f('2026-11-15', '2026-11-20')).toEqual(['t2']);
    expect(f('2026-11-01', '2026-10-01')).toEqual([]);
  });
  it('an unreadable date is an error of the field, not a filter', () => {
    const bad = { ...EMPTY_MONITOR01_FILTERS, startDate: 'soon', finishDate: '2026-13-40' };
    expect(monitor01DateErrors(bad)).toEqual({ startDate: true, finishDate: true });
    expect(filterMonitor01Rows(rows, bad)).toHaveLength(3);
    expect(monitor01DateErrors({ ...EMPTY_MONITOR01_FILTERS, startDate: '14.10.2026' })).toEqual({ startDate: false, finishDate: false });
  });
  it('project / task / resource: the exact GUID picked from the list, never a name search', () => {
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, projectGUID: 'p2' }).map((r) => r.rowOwnerGUID)).toEqual(['t2']);
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, taskGUID: 't3' }).map((r) => r.rowOwnerGUID)).toEqual(['t3']);
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, resourceGUID: 'r2' }).map((r) => r.rowOwnerGUID)).toEqual(['t3']);
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, resourceGUID: 'r2', taskGUID: 't1' })).toEqual([]);     // combined: both must match
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, projectGUID: 'does-not-exist' })).toEqual([]);         // an unknown GUID matches nothing (never "everything")
  });
});

describe('the items of the Project / Task / Resource selects (picked from the data, not typed)', () => {
  const rows = [
    row(),                                                                                                                 // p1 Alpha, t1 task01, r1 Data Analyst
    row({ rowOwnerGUID: 't2', taskName: 'task02', projectName: 'Beta', rowProjectGUID: 'p2', resourceRoleGUID: 'r2', resourceRoleName: 'Welder' }),
    row({ rowOwnerGUID: 't1', taskName: 'task01', genusGUID: 'materialGenus', measureUnit: 'unit_pcs', resourceRoleGUID: '' }),      // the same task again, a line with NO resource role
  ];
  it('distinct projects, sorted by name', () => {
    expect(monitor01ProjectOptions(rows)).toEqual([{ value: 'p1', label: 'Alpha' }, { value: 'p2', label: 'Beta' }]);
  });
  it('distinct tasks, sorted by name, narrowed to one project when it is given', () => {
    expect(monitor01TaskOptions(rows)).toEqual([{ value: 't1', label: 'task01' }, { value: 't2', label: 'task02' }]);
    expect(monitor01TaskOptions(rows, 'p2')).toEqual([{ value: 't2', label: 'task02' }]);
    expect(monitor01TaskOptions(rows, 'does-not-exist')).toEqual([]);
  });
  it('distinct resource roles, narrowed the same way; a row with no role is not offered (its GUID is empty)', () => {
    expect(monitor01ResourceOptions(rows)).toEqual([{ value: 'r1', label: 'Data Analyst' }, { value: 'r2', label: 'Welder' }]);
    expect(monitor01ResourceOptions(rows, 'p2')).toEqual([{ value: 'r2', label: 'Welder' }]);
    expect(monitor01ResourceOptions(rows, 'p1')).toEqual([{ value: 'r1', label: 'Data Analyst' }]);
  });
  it('an empty name falls back to the GUID as the label', () => {
    expect(monitor01ProjectOptions([row({ rowProjectGUID: 'p9', projectName: '' })])).toEqual([{ value: 'p9', label: 'p9' }]);
  });
  it('no rows = no items', () => {
    expect(monitor01ProjectOptions([])).toEqual([]);
    expect(monitor01TaskOptions([])).toEqual([]);
    expect(monitor01ResourceOptions([])).toEqual([]);
  });
});

describe('totals - per unit, the sheet', () => {
  it('hours and pieces are never added', () => {
    const t = totalsByUnit(sheet());
    expect(t.map((x) => x.unit)).toEqual(['unit_hour', 'unit_pcs']);
    expect(t[0].sums).toMatchObject({ planned: 48, contracted: 24, restToContract: 24 });          // the 48 of the sheet
    expect(t[1].sums).toMatchObject({ planned: 300, contracted: 145, restToContract: 155 });
  });
  it('sumForBudget is a number of the row (a missing one is 0) and is added per unit', () => {
    expect(row().sumForBudget).toBe(480);
    expect(parseMonitor01Row({ ...raw(), sumForBudget: undefined }).sumForBudget).toBe(0);
    const t = totalsByUnit(sheet());
    expect(t.map((x) => x.sumForBudget)).toEqual([1080.5, 3000]);
  });
  it('the TotalsRow: the money of all the rows and the quantities per unit', () => {
    const t = monitor01Totals(sheet());
    expect(t.sumForBudget).toBe(4080.5);
    expect(t.qty.map((x) => [x.unit, x.sums.planned, x.sumForBudget])).toEqual([['unit_hour', 48, 1080.5], ['unit_pcs', 300, 3000]]);
    expect(monitor01Totals([])).toMatchObject({ sumForBudget: 0, qty: [] });
  });
  it('items carry the money: total, the subtotal of every node', () => {
    const items = buildMonitor01Items(sheet());
    expect((items[0] as any).sumForBudget).toBe(1080.5);
    const nodes = items.filter((i) => i.kind === 'node') as any[];
    expect(nodes.filter((n) => n.level === 'project').map((n) => [n.unit, n.sumForBudget])).toEqual([['unit_hour', 1080.5], ['unit_pcs', 3000]]);
    expect(nodes.filter((n) => n.level === 'role').map((n) => n.sumForBudget)).toEqual([1080.5, 3000]);
    expect(nodes.filter((n) => n.level === 'month').map((n) => n.sumForBudget)).toEqual([1080.5, 3000]);
  });
  it('every header text starts with a capital letter; "Task name", not task.name', () => {
    const titles = [...Object.values(MONITOR01_MEASURE_TITLE), ...Object.values(MONITOR01_HEAD)];
    titles.forEach((t) => expect(t[0]).toBe(t[0].toUpperCase()));
    expect(MONITOR01_HEAD.task).toBe('Task name');
  });
  it('the table: the totals, then the tree Project → Resource role → Month → Task, every node with its subtotal', () => {
    const items = buildMonitor01Items(sheet());
    expect(items.map((i) => (i.kind === 'node' ? `${i.level}${i.first ? '' : '+'}` : i.kind))).toEqual(['total', 'total', 'project', 'project+', 'role', 'month', 'row', 'row', 'role', 'month', 'row', 'row']);
    expect(items.filter((i) => i.kind === 'row').map((i: any) => i.row.taskName)).toEqual(['task01', 'task03', 'task03', 'task04']);
    expect(buildMonitor01Items([])).toEqual([]);
  });
  it('keys of the items are unique', () => {
    const keys = buildMonitor01Items(sheet()).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the collapsible tree: Project → Resource role → Month (ascending) → Task name', () => {
  // two projects; project Alpha: role r1 (time) in Oct and Nov 2026 + Jan 2027, role r2 (material, pieces) in Oct; project Beta: one row
  const tree = (): Monitor01Row[] => [
    row({ rowOwnerGUID: 'a2', taskName: 'task02', periodMonth: '2026-11-01', qtyPlanned: 10, sumForBudget: 100 }),
    row({ rowOwnerGUID: 'a1', taskName: 'task01', periodMonth: '2026-10-01', qtyPlanned: 24, sumForBudget: 480 }),
    row({ rowOwnerGUID: 'a3', taskName: 'task03', periodMonth: '2027-01-01', qtyPlanned: 5, sumForBudget: 50 }),
    row({ rowOwnerGUID: 'a1', taskName: 'task01', periodMonth: '2026-10-01', qtyPlanned: 4, sumForBudget: 40, resourceRoleGUID: 'r9', resourceRoleName: 'Analyst Junior' }),
    row({ rowOwnerGUID: 'a1', taskName: 'task01', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: 'Pipe', measureUnit: 'unit_pcs', qtyPlanned: 100, sumForBudget: 1000 }),
    row({ rowOwnerGUID: 'b1', rowProjectGUID: 'p2', projectName: 'Beta', taskName: 'taskB', qtyPlanned: 8, sumForBudget: 80 }),
  ];
  const nodes = (items: ReturnType<typeof buildMonitor01Items>) => items.filter((i) => i.kind === 'node') as any[];

  it('projects by name, inside a project the genus order then the role name, inside a role the months ASCENDING, inside a month the tasks', () => {
    const items = buildMonitor01Items(tree());
    const path = items.filter((i) => i.kind !== 'total').map((i: any) => (i.kind === 'node' ? `${i.level}:${i.label}` : `row:${i.row.taskName}`));
    expect(path).toEqual([
      'project:Alpha', 'project:Alpha',                                           // hours and pieces: two subtotal lines of the project
      'role:Analyst Junior', 'month:Oct 2026', 'row:task01',
      'role:Data Analyst', 'month:Oct 2026', 'row:task01', 'month:Nov 2026', 'row:task02', 'month:Jan 2027', 'row:task03',
      'role:Pipe', 'month:Oct 2026', 'row:task01',
      'project:Beta', 'role:Data Analyst', 'month:Oct 2026', 'row:taskB',
    ]);
  });
  it('every node has the subtotal of what is below it, per unit (hours and pieces are never added)', () => {
    const n = nodes(buildMonitor01Items(tree()));
    const alpha = n.filter((x) => x.level === 'project' && x.label === 'Alpha');
    expect(alpha.map((x) => [x.unit, x.first, x.sums.planned, x.sumForBudget])).toEqual([['unit_hour', true, 43, 670], ['unit_pcs', false, 100, 1000]]);
    const dataAnalyst = n.find((x) => x.level === 'role' && x.label === 'Data Analyst' && x.projectGUID === 'p1');
    expect([dataAnalyst.sums.planned, dataAnalyst.sumForBudget]).toEqual([39, 630]);
    const nov = n.find((x) => x.level === 'month' && x.label === 'Nov 2026');
    expect([nov.sums.planned, nov.sumForBudget]).toEqual([10, 100]);
    // a month with one task has the subtotal of that task; the totals on top are all projects together
    expect(buildMonitor01Items(tree()).filter((i) => i.kind === 'total').map((i: any) => [i.unit, i.sums.planned])).toEqual([['unit_hour', 51], ['unit_pcs', 100]]);
  });
  it('a collapsed node shows its subtotal only; its children (and theirs) are not in the list', () => {
    const all = buildMonitor01Items(tree());
    const alphaRole = monitor01RoleKey({ rowProjectGUID: 'p1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1' });
    const noRole = buildMonitor01Items(tree(), new Set([alphaRole]));
    expect(noRole.some((i: any) => i.kind === 'row' && i.row.taskName === 'task02')).toBe(false);      // the months and the tasks of that role are gone
    expect(nodes(noRole).filter((n) => n.nodeKey === alphaRole).map((n) => [n.expanded, n.first])).toEqual([[false, true]]);
    expect(noRole.some((i: any) => i.kind === 'node' && i.label === 'Pipe')).toBe(true);               // the other roles stay
    expect(noRole.length).toBeLessThan(all.length);
    const noMonth = buildMonitor01Items(tree(), new Set([monitor01MonthKey({ rowProjectGUID: 'p1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', periodMonth: '2026-11-01' })]));
    expect(noMonth.some((i: any) => i.kind === 'row' && i.row.taskName === 'task02')).toBe(false);
    expect(noMonth.some((i: any) => i.kind === 'row' && i.row.taskName === 'task03')).toBe(true);        // the next month is open
    const noProject = buildMonitor01Items(tree(), new Set([monitor01ProjectKey('p1')]));
    expect(noProject.filter((i) => i.kind === 'row').map((i: any) => i.row.taskName)).toEqual(['taskB']);   // Alpha is closed (both unit lines stay), Beta is open
    expect(nodes(noProject).filter((n) => n.level === 'project' && n.label === 'Alpha')).toHaveLength(2);
  });
  it('collapse all = the keys of every node; with them only the Project lines are left; nothing collapsed = everything', () => {
    const keys = monitor01NodeKeys(tree());
    expect(keys.size).toBe(2 + 4 + 6);                      // 2 projects, 4 roles, 6 months
    const closed = buildMonitor01Items(tree(), keys);
    expect(closed.filter((i) => i.kind === 'node').every((i: any) => i.level === 'project' && !i.expanded)).toBe(true);
    expect(closed.some((i) => i.kind === 'row')).toBe(false);
    expect(buildMonitor01Items(tree(), new Set()).filter((i) => i.kind === 'row')).toHaveLength(6);
  });
  it('a collapsed key of rows that are gone changes nothing; keys of the items stay unique', () => {
    const items = buildMonitor01Items(tree(), new Set(['p|nobody']));
    expect(items).toEqual(buildMonitor01Items(tree()));
    const keys = buildMonitor01Items(tree()).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('the first line of a node carries the chevron, the lines of its other units do not (first=false); every line is expanded or collapsed together', () => {
    const closed = nodes(buildMonitor01Items(tree(), new Set([monitor01ProjectKey('p1')]))).filter((n) => n.label === 'Alpha');
    expect(closed.map((n) => [n.first, n.expanded])).toEqual([[true, false], [false, false]]);
  });
  it('the drill-down of a node line: its unit, the project, the role (and genus) from the role level, the month at the month level', () => {
    const scope = { projectGUID: null, filters: EMPTY_MONITOR01_FILTERS };
    const n = nodes(buildMonitor01Items(tree()));
    const project = n.find((x) => x.level === 'project' && x.unit === 'unit_pcs')!;
    expect(drillFilterOfNode(project, scope)).toEqual({ unit: 'unit_pcs', projectGUID: 'p1' });
    const role = n.find((x) => x.level === 'role' && x.label === 'Pipe')!;
    expect(drillFilterOfNode(role, scope)).toEqual({ unit: 'unit_pcs', genusGUID: 'materialGenus', projectGUID: 'p1', roleGUID: 'r2' });
    const month = n.find((x) => x.level === 'month' && x.label === 'Nov 2026')!;
    expect(drillFilterOfNode(month, scope)).toEqual({ unit: 'unit_hour', genusGUID: 'timeGenus', projectGUID: 'p1', roleGUID: 'r1', month: '2026-11-01' });
    // under a task filter the list is made of the tasks that are shown
    const f = drillFilterOfNode(project, { projectGUID: null, filters: { ...EMPTY_MONITOR01_FILTERS, taskGUID: 'a1' } });
    expect(f.taskGUIDs).toEqual(['a1']);
  });
});

describe('colours of the critical cells', () => {
  const v = (o: Partial<Monitor01Row>) => ({ ...row(), ...o });
  it('rest to contract: > 0 warn, < 0 bad, = 0 with a plan good', () => {
    expect(cellTone('restToContract', v({ qtyRestToContract: 24 }))).toBe('warn');
    expect(cellTone('restToContract', v({ qtyRestToContract: -5 }))).toBe('bad');
    expect(cellTone('restToContract', v({ qtyRestToContract: 0, qtyPlanned: 24 }))).toBe('good');
    expect(cellTone('restToContract', v({ qtyRestToContract: 0, qtyPlanned: 0 }))).toBe('none');
  });
  it('on-hand: < 0 bad, used up warn', () => {
    expect(cellTone('onHand', v({ qtyOnHand: -1 }))).toBe('bad');
    expect(cellTone('onHand', v({ qtyOnHand: 0, qtyUsed: 5 }))).toBe('warn');
    expect(cellTone('onHand', v({ qtyOnHand: 0, qtyUsed: 0 }))).toBe('none');
    expect(cellTone('onHand', v({ qtyOnHand: 4, qtyUsed: 16 }))).toBe('none');
  });
  it('planned: a stale plan is a warning; the other columns have no colour', () => {
    expect(cellTone('planned', { ...v({}), hasStalePlan: true })).toBe('warn');
    expect(cellTone('planned', v({}))).toBe('none');
    expect(cellTone('contracted', v({}))).toBe('none');
    expect(cellTone('received', v({}))).toBe('none');
  });
  it('a tone has a background in light and dark; none has none', () => {
    for (const t of ['good', 'warn', 'bad'] as const) {
      expect(toneBackground(t, false)).toMatch(/^#/);
      expect(toneBackground(t, true)).toMatch(/^#/);
      expect(toneBackground(t, true)).not.toBe(toneBackground(t, false));
    }
    expect(toneBackground('none', false)).toBeUndefined();
  });
});

describe('the Sum explorer filters', () => {
  it('a cell: exactly the keys of its row', () => {
    expect(drillFilterOfRow(row())).toEqual({ taskGUID: 't1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', month: '2026-10-01' });
  });
  it('a total / subtotal without filters: only what the rows share', () => {
    const f = drillFilterOfRows(sheet(), { projectGUID: null, filters: EMPTY_MONITOR01_FILTERS }, { genus: 'materialGenus', unit: 'unit_pcs' });
    expect(f).toEqual({ genusGUID: 'materialGenus', unit: 'unit_pcs' });
    expect(drillFilterOfRows(sheet(), { projectGUID: 'p1', filters: EMPTY_MONITOR01_FILTERS }, { unit: '' })).toEqual({ unit: '', projectGUID: 'p1' });
  });
  it('under a Project / Task / Resource filter the list is made of the tasks / roles that are shown, so it adds up to the number on the screen', () => {
    const rows = sheet().slice(0, 2);
    const f = drillFilterOfRows(rows, { projectGUID: null, filters: { ...EMPTY_MONITOR01_FILTERS, taskGUID: 't1', resourceGUID: 'r1', startDate: '2026-10-14', finishDate: '2026-12-31' } }, { unit: 'unit_hour' });
    expect(f).toEqual({ unit: 'unit_hour', fromMonth: '2026-10-01', toMonth: '2026-12-01', taskGUIDs: ['t1', 't3'], roleGUIDs: ['r1'] });
  });
  it('a derived number is made of two lists with signs', () => {
    expect(drillOperands('planned')).toEqual([{ measure: 'planned', sign: 1 }]);
    expect(drillOperands('restToContract')).toEqual([{ measure: 'planned', sign: 1 }, { measure: 'contracted', sign: -1 }]);
    expect(drillOperands('vendorInvoiced')).toEqual([{ measure: 'vendorInvoiced', sign: 1 }]);
    expect(drillOperands('ordered')).toEqual([{ measure: 'ordered', sign: 1 }]);
    expect(drillOperands('onHand')).toEqual([{ measure: 'received', sign: 1 }, { measure: 'used', sign: -1 }]);
  });
});

describe('the stamp (the safety net under Realtime)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { monitor01LocalStamp, monitor01StampDiffers, parseMonitor01Stamp } = require('../../../../kit8/pm/reports/monitor01/monitor01Model');
  const r = (updated_at?: string) => row({ updated_at });
  it('the answer of monitor01_stamp is typed; a missing field never throws', () => {
    expect(parseMonitor01Stamp({ count: '5', maxUpdatedAt: '2026-10-14T10:00:00Z', queued: 2, queuedAgeSeconds: '7.5' })).toEqual({ count: 5, maxUpdatedAt: Date.parse('2026-10-14T10:00:00Z'), queued: 2, queuedAgeSeconds: 7.5 });
    expect(parseMonitor01Stamp(null)).toEqual({ count: 0, maxUpdatedAt: null, queued: 0, queuedAgeSeconds: 0 });
    expect(parseMonitor01Stamp({ maxUpdatedAt: 'not a time' }).maxUpdatedAt).toBeNull();
  });
  it('the stamp of the rows the screen holds: the number and the newest time', () => {
    expect(monitor01LocalStamp([r('2026-10-14T09:00:00Z'), r('2026-10-14T10:00:00Z'), r('2026-10-14T08:00:00Z')])).toEqual({ count: 3, maxUpdatedAt: Date.parse('2026-10-14T10:00:00Z') });
    expect(monitor01LocalStamp([])).toEqual({ count: 0, maxUpdatedAt: null });
    expect(monitor01LocalStamp([r(undefined)])).toEqual({ count: 1, maxUpdatedAt: null });
  });
  it('another number, or a newer change, is a difference; the same instant in another written form is not', () => {
    const local = { count: 2, maxUpdatedAt: Date.parse('2026-10-14T10:00:00Z') };
    expect(monitor01StampDiffers({ count: 2, maxUpdatedAt: Date.parse('2026-10-14T10:00:00Z') }, local)).toBe(false);
    expect(monitor01StampDiffers({ count: 2, maxUpdatedAt: Date.parse('2026-10-14T12:00:00+02:00') }, local)).toBe(false);
    expect(monitor01StampDiffers({ count: 3, maxUpdatedAt: local.maxUpdatedAt }, local)).toBe(true);
    expect(monitor01StampDiffers({ count: 2, maxUpdatedAt: Date.parse('2026-10-14T10:00:01Z') }, local)).toBe(true);
    expect(monitor01StampDiffers({ count: 0, maxUpdatedAt: null }, { count: 0, maxUpdatedAt: null })).toBe(false);
    expect(monitor01StampDiffers({ count: 2, maxUpdatedAt: null }, { count: 2, maxUpdatedAt: local.maxUpdatedAt })).toBe(false);     // nothing to compare by time
  });
});

describe('the VAT basis of the three money columns (documentation/VENDOR_INVOICE_DOC.html section 13)', () => {
  const vatRows = (): Monitor01Row[] => [
    row({ sumForBudget: '100', vatBudget: '21', vatInCostBudget: '0', sumVendorInvoiced: '50', vatVendorInvoiced: '10.5', vatInCostVendorInvoiced: '10.5', sumCustomerInvoiced: '200', vatCustomerInvoiced: '42' }),
  ];
  it('the rows carry the VAT parts (missing = 0)', () => {
    const r = vatRows()[0];
    expect([r.vatBudget, r.vatInCostBudget, r.vatVendorInvoiced, r.vatInCostVendorInvoiced, r.vatCustomerInvoiced]).toEqual([21, 0, 10.5, 10.5, 42]);
    expect(row().vatBudget).toBe(0);
  });
  it('Net: the rows as they are', () => {
    const rows = vatRows();
    expect(applyMonitor01VatBasis(rows, 'net')).toBe(rows);
  });
  it('Cost: net + the VAT that is cost; a customer invoice\'s VAT is never cost', () => {
    const r = applyMonitor01VatBasis(vatRows(), 'cost')[0];
    expect([r.sumForBudget, r.sumVendorInvoiced, r.sumCustomerInvoiced]).toEqual([100, 60.5, 200]);
  });
  it('With VAT: net + all the VAT', () => {
    const r = applyMonitor01VatBasis(vatRows(), 'gross')[0];
    expect([r.sumForBudget, r.sumVendorInvoiced, r.sumCustomerInvoiced]).toEqual([121, 60.5, 242]);
  });
  it('everything downstream works on the shown amounts: the totals row follows the basis', () => {
    expect(monitor01Totals(applyMonitor01VatBasis(vatRows(), 'gross')).sumForBudget).toBe(121);
    expect(monitor01Totals(applyMonitor01VatBasis(vatRows(), 'cost')).sumForBudget).toBe(100);
  });
  it('the quantities are not touched by the basis', () => {
    expect(applyMonitor01VatBasis(vatRows(), 'gross')[0].qtyPlanned).toBe(vatRows()[0].qtyPlanned);
  });
});
