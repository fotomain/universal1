// The pure part of Monitor01: keys, realtime patching, filters, tabs, totals, the table items, colours, the drill-down filters (kit8/pm/reports/monitor01).
import {
  EMPTY_MONITOR01_FILTERS, Monitor01Row, applyMonitor01Events, buildMonitor01Items, drillFilterOfRow, drillFilterOfRows, drillOperands, filterMonitor01Rows, formatMonitor01Number,
  monitor01DateErrors, monitor01FiltersActive, monitor01Key, monthLabel, parseMonitor01Row, rowsOfTab, sortMonitor01Rows, totalsByUnit,
} from '../../../../kit8/pm/reports/monitor01/monitor01Model';
import { cellTone, toneBackground } from '../../../../kit8/pm/reports/monitor01/monitor01Colors';

const raw = (over: Record<string, any> = {}) => ({
  rowOwnerGUID: 't1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: 'task01',
  resourceRoleName: 'Data Analyst', qtyPlanned: '24.00', qtyContracted: '24.00', qtyRestToContract: '0.00', qtyDelivered: '0', qtyUsed: '0', qtyOnHand: '0', lineCount: 1, hasStalePlan: false, updated_at: '2026-10-14T10:00:00Z', ...over,
});
const row = (over: Record<string, any> = {}): Monitor01Row => parseMonitor01Row(raw(over));

// the example of the sheet "W1 1-MONITOR01"
const sheet = (): Monitor01Row[] => [
  row(),
  row({ rowOwnerGUID: 't3', taskName: 'task03', qtyContracted: 0, qtyRestToContract: 24 }),
  row({ rowOwnerGUID: 't3', taskName: 'task03', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: '10m pipe section', measureUnit: 'unit_pcs', qtyPlanned: 100, qtyContracted: 65, qtyRestToContract: 35 }),
  row({ rowOwnerGUID: 't4', taskName: 'task04', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: '10m pipe section', measureUnit: 'unit_pcs', qtyPlanned: 200, qtyContracted: 80, qtyRestToContract: 120 }),
];

describe('rows', () => {
  it('numeric columns that arrive as strings become numbers; the generated ones are derived when missing', () => {
    const r = parseMonitor01Row(raw({ qtyRestToContract: undefined, qtyOnHand: undefined, qtyDelivered: '20', qtyUsed: '16', qtyPlanned: '24', qtyContracted: '10' }));
    expect(r.qtyPlanned).toBe(24);
    expect(r.qtyRestToContract).toBe(14);
    expect(r.qtyOnHand).toBe(4);
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
  it('sorted by genus, role, month, task', () => {
    const shuffled = [sheet()[3], sheet()[1], sheet()[2], sheet()[0]];
    expect(sortMonitor01Rows(shuffled).map((r) => r.taskName)).toEqual(['task01', 'task03', 'task03', 'task04']);
  });
});

describe('filters', () => {
  const rows = [
    row(),
    row({ rowOwnerGUID: 't2', taskName: 'task02', periodMonth: '2026-11-01', projectName: 'Beta' }),
    row({ rowOwnerGUID: 't3', taskName: 'task03', periodMonth: '2027-01-01', resourceRoleName: 'Welder' }),
  ];
  it('no filter = all rows; a filter is active when something is typed', () => {
    expect(filterMonitor01Rows(rows, EMPTY_MONITOR01_FILTERS)).toHaveLength(3);
    expect(monitor01FiltersActive(EMPTY_MONITOR01_FILTERS)).toBe(false);
    expect(monitor01FiltersActive({ ...EMPTY_MONITOR01_FILTERS, task: ' x ' })).toBe(true);
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
  it('project / task / resource: contains, case-insensitive', () => {
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, project: 'bet' }).map((r) => r.rowOwnerGUID)).toEqual(['t2']);
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, task: 'TASK03' }).map((r) => r.rowOwnerGUID)).toEqual(['t3']);
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, resource: 'weld' }).map((r) => r.rowOwnerGUID)).toEqual(['t3']);
    expect(filterMonitor01Rows(rows, { ...EMPTY_MONITOR01_FILTERS, resource: 'weld', task: 'task01' })).toEqual([]);
  });
});

describe('totals - per unit, the sheet', () => {
  it('hours and pieces are never added', () => {
    const t = totalsByUnit(sheet());
    expect(t.map((x) => x.unit)).toEqual(['unit_hour', 'unit_pcs']);
    expect(t[0].sums).toMatchObject({ planned: 48, contracted: 24, restToContract: 24 });          // the 48 of the sheet
    expect(t[1].sums).toMatchObject({ planned: 300, contracted: 145, restToContract: 155 });
  });
  it('the table: totals, then every genus with caption, subtotals and rows', () => {
    const items = buildMonitor01Items(sheet());
    expect(items.map((i) => i.kind)).toEqual(['total', 'total', 'group', 'subtotal', 'row', 'row', 'group', 'subtotal', 'row', 'row']);
    expect(items.filter((i) => i.kind === 'row').map((i: any) => i.row.taskName)).toEqual(['task01', 'task03', 'task03', 'task04']);
    expect(buildMonitor01Items([])).toEqual([]);
  });
  it('keys of the items are unique', () => {
    const keys = buildMonitor01Items(sheet()).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
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
    expect(cellTone('delivered', v({}))).toBe('none');
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
  it('under text filters the list is made of the tasks / roles that are shown, so it adds up to the number on the screen', () => {
    const rows = sheet().slice(0, 2);
    const f = drillFilterOfRows(rows, { projectGUID: null, filters: { ...EMPTY_MONITOR01_FILTERS, task: 'task', resource: 'analyst', startDate: '2026-10-14', finishDate: '2026-12-31' } }, { unit: 'unit_hour' });
    expect(f).toEqual({ unit: 'unit_hour', fromMonth: '2026-10-01', toMonth: '2026-12-01', taskGUIDs: ['t1', 't3'], roleGUIDs: ['r1'] });
  });
  it('a derived number is made of two lists with signs', () => {
    expect(drillOperands('planned')).toEqual([{ measure: 'planned', sign: 1 }]);
    expect(drillOperands('restToContract')).toEqual([{ measure: 'planned', sign: 1 }, { measure: 'contracted', sign: -1 }]);
    expect(drillOperands('onHand')).toEqual([{ measure: 'delivered', sign: 1 }, { measure: 'used', sign: -1 }]);
  });
});
