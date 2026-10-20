// Management activity genus - the model helpers and the SystemMetaData entry (the SQL and the seed rows are checked in __tests__/catalog/budget/budgetItemKey.test.ts and run in
// kit8/docker/tests/91_activity_genus.sql).
import {
  MANAGEMENT_ACTIVITY_GENUS, MANAGEMENT_ACTIVITY_GENUS_CODES, MANAGEMENT_ACTIVITY_GENUS_ROUTES, MANAGEMENT_ACTIVITY_GENUS_TABLE, managementActivityGenusRows,
  managementActivityGenusShortTitle, managementActivityGenusTitle,
} from '../../../kit8/catalog/management/activity_genus/managementActivityGenusModel';
import { managementActivityGenusSystemMetaData } from '../../../kit8/catalog/management/activity_genus/managementActivityGenusMetaData';

const row = (guid: string, title: string | null, order = 0) => ({ rowGUID: guid, rowOwnerGUID: 'managementActivityGenusCatalog', rowParentGUID: 'empty', orderInList: order, rowJSON: { title } });

describe('the model', () => {
  it('the three activities of the cash flow statement, in this order', () => {
    expect(MANAGEMENT_ACTIVITY_GENUS).toEqual({ operating: 'operatingActivity', investing: 'investingActivity', financing: 'financingActivity' });
    expect(MANAGEMENT_ACTIVITY_GENUS_CODES).toEqual(['operatingActivity', 'investingActivity', 'financingActivity']);
  });
  it('a linear catalog: its own table, entity, owner and route', () => {
    const t = MANAGEMENT_ACTIVITY_GENUS_TABLE;
    expect([t.table, t.entity, t.catalogOwner]).toEqual(['managementActivityGenusTable', 'managementActivityGenusReusable', 'managementActivityGenusCatalog']);
    expect(MANAGEMENT_ACTIVITY_GENUS_ROUTES.list).toBe('/catalog/management/activity_genus/list');
    expect(t.emptyRowJSON()).toEqual({ title: null, description: null, webIfrsName: null, d365foName: null, sapName: null });
  });
  it('the title and the short title (without the word "activity"); the code when there is no title', () => {
    expect(managementActivityGenusTitle(row('operatingActivity', 'Operating activity'))).toBe('Operating activity');
    expect(managementActivityGenusShortTitle(row('operatingActivity', 'Operating activity'))).toBe('Operating');
    expect(managementActivityGenusTitle(row('financingActivity', null))).toBe('financingActivity');
    expect(managementActivityGenusTitle(undefined)).toBe('');
  });
  it('sorts by orderInList', () => {
    expect(managementActivityGenusRows([row('c', 'C', 3), row('a', 'A', 1), row('b', 'B', 2)]).map((r) => r.rowGUID)).toEqual(['a', 'b', 'c']);
  });
});

describe('the SystemMetaData entry', () => {
  it('reads the table through the reusable saga', () => {
    const md = managementActivityGenusSystemMetaData();
    const e = md[MANAGEMENT_ACTIVITY_GENUS_TABLE.entity];
    expect(e.tableName).toBe('managementActivityGenusTable');
    expect(e.itemLabel).toBe('Activity genus');
    expect(e.prepareCreateApi({ action: { payload: { a: 1 } } })).toEqual({ newItem: { a: 1 } });
  });
});
