// monitor01Fields: the numeric fields of the table (the columns that Settings → Fields shows or hides), the settings a View keeps and how a View is applied safely.
import {
  DEFAULT_MONITOR01_SETTINGS, MONITOR01_FIELDS, MONITOR01_FIELD_GROUPS, MONITOR01_FIELD_IDS, MONITOR01_REPORT_GUID, isMonitor01FieldId, monitor01SetFieldsChecked, monitor01VisibleFields, monitor01VisibleGroups,
  normalizeHiddenFields, normalizeMonitor01Settings, restoreMonitor01Filters,
} from '../../../../kit8/pm/reports/monitor01/monitor01Fields';
import { EMPTY_MONITOR01_FILTERS, MONITOR01_MEASURE_TITLE, parseMonitor01Row } from '../../../../kit8/pm/reports/monitor01/monitor01Model';
import { REPORTS, reportDef, reportViewsEnabled } from '../../../../kit8/pm/reports/common/reportRegistry';

const row = (over: Record<string, any> = {}) => parseMonitor01Row({
  rowOwnerGUID: 't1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: 'task01', resourceRoleName: 'Analyst', qtyPlanned: 1, ...over,
});

describe('the field list', () => {
  it('has the 12 numeric fields of the table, in the order of the columns, in the 4 groups of the header', () => {
    expect(MONITOR01_FIELD_IDS).toEqual(['planned', 'contracted', 'restToContract', 'sumForBudget', 'ordered', 'received', 'used', 'onHand', 'vendorInvoiced', 'sumVendorInvoiced', 'customerInvoiced', 'sumCustomerInvoiced']);
    expect(MONITOR01_FIELD_GROUPS).toEqual(['Plan', 'Fact', 'Vendor Invoice', 'Customer Invoice']);
    expect(MONITOR01_FIELDS.map((f) => f.group)).toEqual(['Plan', 'Plan', 'Plan', 'Plan', 'Fact', 'Fact', 'Fact', 'Fact', 'Vendor Invoice', 'Vendor Invoice', 'Customer Invoice', 'Customer Invoice']);
    expect(MONITOR01_FIELDS.filter((f) => f.kind === 'amount').map((f) => f.id)).toEqual(['sumForBudget', 'sumVendorInvoiced', 'sumCustomerInvoiced']);
  });
  it('the titles are the header texts of the table', () => {
    const t = Object.fromEntries(MONITOR01_FIELDS.map((f) => [f.id, f.title]));
    expect(t).toMatchObject({ planned: MONITOR01_MEASURE_TITLE.planned, restToContract: 'Rest to contract', sumForBudget: 'Budget', used: 'Actually used', onHand: 'On-hand', vendorInvoiced: 'Quantity', sumVendorInvoiced: 'Amount', customerInvoiced: 'Quantity', sumCustomerInvoiced: 'Amount' });
  });
  it('every id is known once', () => {
    expect(new Set(MONITOR01_FIELD_IDS).size).toBe(12);
    expect(isMonitor01FieldId('planned')).toBe(true);
    expect(isMonitor01FieldId('qtyPlanned')).toBe(false);
    expect(isMonitor01FieldId(5)).toBe(false);
  });
});

describe('checked and hidden fields', () => {
  it('all fields are checked by default: nothing is hidden', () => {
    expect(DEFAULT_MONITOR01_SETTINGS.hiddenFields).toEqual([]);
    expect(monitor01VisibleFields(undefined)).toHaveLength(12);
    expect(monitor01VisibleFields([])).toHaveLength(12);
  });
  it('a hidden field is not visible; the others keep the order of the table', () => {
    expect(monitor01VisibleFields(['contracted', 'onHand']).map((f) => f.id)).toEqual(['planned', 'restToContract', 'sumForBudget', 'ordered', 'received', 'used', 'vendorInvoiced', 'sumVendorInvoiced', 'customerInvoiced', 'sumCustomerInvoiced']);
  });
  it('normalizeHiddenFields drops unknown ids and doubles and sorts in the order of the table', () => {
    expect(normalizeHiddenFields(['onHand', 'nope', 'planned', 'onHand', 7, null])).toEqual(['planned', 'onHand']);
    expect(normalizeHiddenFields('x')).toEqual([]);
    expect(normalizeHiddenFields(undefined)).toEqual([]);
  });
  it('monitor01SetFieldsChecked unchecks and checks a set of fields (Select all / Clear all of a folder)', () => {
    expect(monitor01SetFieldsChecked([], ['planned', 'contracted'], false)).toEqual(['planned', 'contracted']);
    expect(monitor01SetFieldsChecked(['planned', 'contracted', 'onHand'], ['planned', 'contracted'], true)).toEqual(['onHand']);
    expect(monitor01SetFieldsChecked(['onHand'], MONITOR01_FIELD_IDS, true)).toEqual([]);          // Select all
    expect(monitor01SetFieldsChecked([], MONITOR01_FIELD_IDS, false)).toEqual(MONITOR01_FIELD_IDS);   // Clear all
    expect(monitor01SetFieldsChecked(['onHand'], ['bogus'], false)).toEqual(['onHand']);
  });
  it('a group without a shown field has no group header', () => {
    expect(monitor01VisibleGroups(monitor01VisibleFields([])) ).toEqual(MONITOR01_FIELD_GROUPS);
    expect(monitor01VisibleGroups(monitor01VisibleFields(['ordered', 'received', 'used', 'onHand']))).toEqual(['Plan', 'Vendor Invoice', 'Customer Invoice']);
    expect(monitor01VisibleGroups(monitor01VisibleFields(MONITOR01_FIELD_IDS))).toEqual([]);
  });
});

describe('the settings of a View', () => {
  it('a View of any shape becomes settings the report can apply: every unreadable key falls back to the default', () => {
    expect(normalizeMonitor01Settings(undefined)).toEqual(DEFAULT_MONITOR01_SETTINGS);
    expect(normalizeMonitor01Settings('x')).toEqual(DEFAULT_MONITOR01_SETTINGS);
    expect(normalizeMonitor01Settings([1])).toEqual(DEFAULT_MONITOR01_SETTINGS);
    expect(normalizeMonitor01Settings({ tab: 'nope', projectKind: 'nope', vatBasis: 'nope', filters: 'x', hiddenFields: 5 })).toEqual(DEFAULT_MONITOR01_SETTINGS);
  });
  it('a good View is kept as it is', () => {
    const s = { version: 1, hiddenFields: ['onHand', 'planned'], tab: 'time', projectKind: 'all', vatBasis: 'gross', filters: { startDate: '2026-01-01', finishDate: '2026-03-31', projectGUID: 'p1', taskGUID: 't1', resourceGUID: 'r1' } };
    expect(normalizeMonitor01Settings(s)).toEqual({ ...s, hiddenFields: ['planned', 'onHand'] });
  });
  it('the filters of a View are strings only', () => {
    expect(normalizeMonitor01Settings({ filters: { startDate: 5, finishDate: null, projectGUID: 'p1' } }).filters).toEqual({ ...EMPTY_MONITOR01_FILTERS, projectGUID: 'p1' });
  });
});

describe('applying the filters of a View', () => {
  const rows = [row(), row({ rowOwnerGUID: 't2', taskName: 'task02', resourceRoleGUID: 'r2', resourceRoleName: 'Welder' })];
  const saved = { startDate: '2026-01-01', finishDate: '2026-03-31', projectGUID: 'p1', taskGUID: 't2', resourceGUID: 'r2' };
  it('keeps what exists in the loaded rows', () => {
    expect(restoreMonitor01Filters(saved, rows, 'standalone')).toEqual({ filters: saved, dropped: false });
  });
  it('the project mode has no Project filter: it is cleared (not reported as dropped - it never existed there)', () => {
    expect(restoreMonitor01Filters(saved, rows, 'project')).toEqual({ filters: { ...saved, projectGUID: '' }, dropped: false });
  });
  it('a task or a resource that is not in the rows any more is cleared, and the screen is told', () => {
    const r = restoreMonitor01Filters({ ...saved, taskGUID: 'gone', resourceGUID: 'gone2' }, rows, 'standalone');
    expect(r.filters).toEqual({ ...saved, taskGUID: '', resourceGUID: '' });
    expect(r.dropped).toBe(true);
    expect(restoreMonitor01Filters({ ...saved, projectGUID: 'gone' }, rows, 'standalone').filters.projectGUID).toBe('');
  });
  it('while no row is loaded nothing can be checked: the filters are kept', () => {
    expect(restoreMonitor01Filters(saved, [], 'standalone')).toEqual({ filters: saved, dropped: false });
  });
});

describe('the report registry', () => {
  it('Monitor01 is registered under the GUID "Monitor01", with its Views always on', () => {
    expect(MONITOR01_REPORT_GUID).toBe('Monitor01');
    expect(reportDef('Monitor01')).toEqual({ guid: 'Monitor01', title: 'Monitor01', viewsAlwaysOn: true });
    expect(reportViewsEnabled('Monitor01')).toBe(true);
    expect(REPORTS.map((r) => r.guid)).toContain('Monitor01');
  });
  it('an unknown report has no Views', () => {
    expect(reportViewsEnabled('Other')).toBe(false);
    expect(reportDef('Other')).toBeUndefined();
  });
});
