// Budget item key (activity x management genus) + direction: the model helpers, the equality of the TS matrix with the SQL function, and the SQL files of PART 32
// (tables, trigger, CHECK, read-only grants, the seed rows of start4 / start5, the drop in delete_sql_structure.sql). The SQL itself runs in kit8/docker/tests/91_activity_genus.sql.
import {
  BUDGET_ITEM_DIRECTIONS, BUDGET_ITEM_KEY_MATRIX, BUDGET_ITEM_KEY_TABLE, budgetItemActivitiesOfGenus, budgetItemActivityOf, budgetItemActivityOptions, budgetItemDefaultKey,
  budgetItemDirectionError, budgetItemKeyDirection, budgetItemKeyError, budgetItemKeyOf, budgetItemKeyParts, budgetItemKeyPatch, budgetItemsWithoutKey,
} from '../../../kit8/catalog/budget/item/budgetItemKeyModel';
import { budgetItemKeySystemMetaData } from '../../../kit8/catalog/budget/item/budgetItemKeyMetaData';
import { BUDGET_ITEM_TABLE } from '../../../kit8/catalog/budget/item/budgetItemModel';
import { MANAGEMENT_ACTIVITY_GENUS_CODES } from '../../../kit8/catalog/management/activity_genus/managementActivityGenusModel';
import { MANAGEMENT_GENUS } from '../../../kit8/catalog/management/genus/managementGenusModel';
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';

const start4 = readSql('start4_sql_insert_missing.sql');
const start5 = readSql('start5_sql_upsert_all.sql');
const del = readSql('delete_sql_structure.sql');

describe('the matrix', () => {
  it('has 14 allowed cells: operating and investing have all six genus, financing only the two payments genus', () => {
    expect(BUDGET_ITEM_KEY_MATRIX).toHaveLength(14);
    // the six level 2 genus of managementGenusTable, each in the matrix
    const leaves = [MANAGEMENT_GENUS.time, MANAGEMENT_GENUS.material, MANAGEMENT_GENUS.expense, MANAGEMENT_GENUS.revenue, MANAGEMENT_GENUS.inboundPayment, MANAGEMENT_GENUS.outboundPayment];
    for (const g of leaves) expect(BUDGET_ITEM_KEY_MATRIX.some((c) => c.genus === g)).toBe(true);
    for (const a of ['operatingActivity', 'investingActivity']) expect(budgetItemActivitiesOfGenus('timeGenus')).toContain(a);
    expect(BUDGET_ITEM_KEY_MATRIX.filter((c) => c.activity === 'financingActivity').map((c) => c.genus)).toEqual(['inboundPaymentGenus', 'outboundPaymentGenus']);
    expect(budgetItemActivitiesOfGenus('timeGenus')).toEqual(['operatingActivity', 'investingActivity']);
    expect(budgetItemActivitiesOfGenus('inboundPaymentGenus')).toEqual(['operatingActivity', 'investingActivity', 'financingActivity']);
    expect(budgetItemActivitiesOfGenus('costsGenus')).toEqual([]);
  });

  it('the activities of the matrix are the three seed activities, in the order of the cash flow statement', () => {
    expect(Array.from(new Set(BUDGET_ITEM_KEY_MATRIX.map((c) => c.activity)))).toEqual(MANAGEMENT_ACTIVITY_GENUS_CODES);
  });

  it('is the SAME list as the SQL function kit8_budget_item_key_matrix() (activity, genus, default direction, in this order)', () => {
    const fn = /kit8_budget_item_key_matrix\(\)[\s\S]*?FROM \(VALUES([\s\S]*?)\) AS v\(a, g, d\)/.exec(codeSql)![1];
    const sql = Array.from(fn.matchAll(/\('(\w+)', '(\w+)', '(inbound|outbound)'\)/g)).map((m) => ({ activity: m[1], genus: m[2], direction: m[3] }));
    expect(sql).toEqual(BUDGET_ITEM_KEY_MATRIX);
  });

  it('a cost is outbound, revenue inbound, the payments genus carry their own direction', () => {
    expect(budgetItemKeyDirection('operatingActivity.timeGenus')).toBe('outbound');
    expect(budgetItemKeyDirection('investingActivity.revenueGenus')).toBe('inbound');
    expect(budgetItemKeyDirection('financingActivity.inboundPaymentGenus')).toBe('inbound');
    expect(budgetItemKeyDirection('financingActivity.timeGenus')).toBeNull();
    expect(BUDGET_ITEM_DIRECTIONS.map((d) => d.value)).toEqual(['inbound', 'outbound']);
  });
});

describe('the key helpers', () => {
  it('builds and splits a key', () => {
    expect(budgetItemKeyOf('investingActivity', 'materialGenus')).toBe('investingActivity.materialGenus');
    expect(budgetItemKeyParts('investingActivity.materialGenus')).toEqual({ activity: 'investingActivity', genus: 'materialGenus' });
    expect(budgetItemKeyParts(null)).toEqual({ activity: '', genus: '' });
    expect(budgetItemActivityOf({ budgetItemGenericKey: 'financingActivity.outboundPaymentGenus' })).toBe('financingActivity');
    expect(budgetItemActivityOf({})).toBe('');
  });

  it('a new item gets the OPERATING key of its genus (an old item stays what it was)', () => {
    expect(budgetItemDefaultKey('materialGenus')).toBe('operatingActivity.materialGenus');
    expect(budgetItemDefaultKey('outboundPaymentGenus')).toBe('operatingActivity.outboundPaymentGenus');
    expect(budgetItemDefaultKey('costsGenus')).toBeNull();
  });

  it('the Activity column offers only the activities of the genus of the row, as keys, with the short title', () => {
    const rows = [{ rowGUID: 'operatingActivity', rowOwnerGUID: 'c', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Operating activity' } }];
    expect(budgetItemActivityOptions('timeGenus', rows)).toEqual([
      { value: 'operatingActivity.timeGenus', label: 'Operating' },
      { value: 'investingActivity.timeGenus', label: 'investingActivity' },     // no row loaded: the code
    ]);
    expect(budgetItemActivityOptions('inboundPaymentGenus', []).map((o) => o.value)).toEqual([
      'operatingActivity.inboundPaymentGenus', 'investingActivity.inboundPaymentGenus', 'financingActivity.inboundPaymentGenus']);
  });

  it('the key is obligatory, allowed and a key of the genus of the item', () => {
    expect(budgetItemKeyError(null, 'timeGenus')).toMatch(/needs an activity/);
    expect(budgetItemKeyError('empty', 'timeGenus')).toMatch(/needs an activity/);
    expect(budgetItemKeyError('financingActivity.timeGenus', 'timeGenus')).toMatch(/not an allowed/);
    expect(budgetItemKeyError('operatingActivity.materialGenus', 'timeGenus')).toMatch(/not a key of the management genus/);
    expect(budgetItemKeyError('operatingActivity.timeGenus', 'timeGenus')).toBeNull();
  });

  it('the direction is inbound / outbound and equals the one of the key - only a correction may reverse it', () => {
    expect(budgetItemDirectionError(null, 'operatingActivity.timeGenus')).toMatch(/inbound or outbound/);
    expect(budgetItemDirectionError('sideways', 'operatingActivity.timeGenus')).toMatch(/inbound or outbound/);
    expect(budgetItemDirectionError('outbound', 'operatingActivity.timeGenus')).toBeNull();
    expect(budgetItemDirectionError('inbound', 'operatingActivity.timeGenus')).toMatch(/correction/);
    expect(budgetItemDirectionError('inbound', 'operatingActivity.timeGenus', true)).toBeNull();
  });

  it('after a change the key follows the genus and the direction follows the key', () => {
    expect(budgetItemKeyPatch({ managementGenusItem: 'timeGenus', budgetItemGenericKey: 'operatingActivity.timeGenus', direction: 'outbound' })).toEqual({});
    // no key, no direction -> the defaults
    expect(budgetItemKeyPatch({ managementGenusItem: 'revenueGenus' })).toEqual({ budgetItemGenericKey: 'operatingActivity.revenueGenus', direction: 'inbound' });
    // the genus changed from time (outbound) to revenue: the key and the direction of the new genus
    expect(budgetItemKeyPatch({ managementGenusItem: 'revenueGenus', budgetItemGenericKey: 'investingActivity.timeGenus', direction: 'outbound' }))
      .toEqual({ budgetItemGenericKey: 'operatingActivity.revenueGenus', direction: 'inbound' });
    // a correction keeps its reversed direction even when the key is repaired
    expect(budgetItemKeyPatch({ managementGenusItem: 'revenueGenus', budgetItemGenericKey: 'operatingActivity.timeGenus', direction: 'outbound', isCorrection: true }))
      .toEqual({ budgetItemGenericKey: 'operatingActivity.revenueGenus' });
    // a valid other activity is kept
    expect(budgetItemKeyPatch({ managementGenusItem: 'materialGenus', budgetItemGenericKey: 'investingActivity.materialGenus', direction: 'outbound' })).toEqual({});
    expect(budgetItemKeyPatch({ title: 'no genus yet' })).toEqual({});
  });

  it('lists the items without a valid key or direction (folders are not items: the caller passes the items)', () => {
    const item = (guid: string, json: any) => ({ rowGUID: guid, rowOwnerGUID: 'c', rowParentGUID: 'costsBudgetFolder', orderInList: 1, rowJSON: json });
    const ok = item('ok', { managementGenusItem: 'timeGenus', budgetItemGenericKey: 'investingActivity.timeGenus', direction: 'outbound' });
    const noKey = item('noKey', { managementGenusItem: 'timeGenus', direction: 'outbound' });
    const noDir = item('noDir', { managementGenusItem: 'timeGenus', budgetItemGenericKey: 'operatingActivity.timeGenus' });
    const reversed = item('reversed', { managementGenusItem: 'timeGenus', budgetItemGenericKey: 'operatingActivity.timeGenus', direction: 'inbound' });
    const credit = item('credit', { managementGenusItem: 'timeGenus', budgetItemGenericKey: 'operatingActivity.timeGenus', direction: 'inbound', isCorrection: true });
    expect(budgetItemsWithoutKey([ok, noKey, noDir, reversed, credit]).map((r) => r.rowGUID)).toEqual(['noKey', 'noDir', 'reversed']);
  });
});

describe('the model and the metadata', () => {
  it('the budget item has the new keys in its empty row', () => {
    expect(BUDGET_ITEM_TABLE.emptyRowJSON()).toEqual(expect.objectContaining({
      managementGenusItem: null, budgetItemGenericKey: null, direction: null, isCorrection: false, isPolicyItem: false, webIfrsName: null, d365foName: null, sapName: null }));
  });
  it('the key table is a redux entity (read through the saga)', () => {
    const md = budgetItemKeySystemMetaData();
    expect(md[BUDGET_ITEM_KEY_TABLE.entity]).toEqual(expect.objectContaining({ tableName: 'budgetItemGenericKeyTable' }));
    expect(BUDGET_ITEM_KEY_TABLE.catalogOwner).toBe('budgetItemGenericKeyCatalog');
  });
});

describe('the SQL of PART 32', () => {
  const t1 = sqlPart(tablesSql, 32);
  const t2 = sqlPart(codeSql, 32);
  const t3 = sqlPart(start4, 32);

  it('start1: the two tables (the def-table shape) and the index of the key; no function, trigger or policy', () => {
    for (const t of ['managementActivityGenusTable', 'budgetItemGenericKeyTable']) {
      expect(t1).toContain(`CREATE TABLE IF NOT EXISTS public."${t}"`);
      expect(t1).toContain(`CREATE INDEX IF NOT EXISTS "idx_${t}_owner_order"`);
    }
    expect(t1).toContain(`"rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'managementActivityGenusCatalog'`);
    expect(t1).toContain(`"rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'budgetItemGenericKeyCatalog'`);
    expect(t1).toContain(`"idx_budgetItemTable_key"`);
    expect(t1).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/i);
  });

  it('start2: refuses without the tables, the catalogs are READ ONLY for the signed-in user, realtime, the matrix, the trigger, the backfill BEFORE the CHECK', () => {
    expect(t2).toContain('PART 32 needs the tables');
    expect(t2).toContain("kit8_setup_def_table('managementActivityGenusTable')");
    expect(t2).toContain("kit8_setup_def_table('budgetItemGenericKeyTable')");
    expect(t2).toContain("GRANT SELECT ON public.%I TO authenticated");
    expect(t2).not.toMatch(/GRANT SELECT, INSERT/);
    expect(t2).toContain('CREATE OR REPLACE FUNCTION public.kit8_budget_item_key_matrix()');
    expect(t2).toContain('CREATE OR REPLACE FUNCTION public.kit8_budget_item_check_key()');
    expect(t2).toContain('CREATE TRIGGER "trg_budgetItemTable_key" BEFORE INSERT OR UPDATE ON public."budgetItemTable"');
    expect(t2).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE');
    expect(t2.indexOf('SET "rowJSON" = "rowJSON"')).toBeGreaterThan(0);
    expect(t2.indexOf('SET "rowJSON" = "rowJSON"')).toBeLessThan(t2.indexOf('ADD CONSTRAINT "budgetItemTable_key_chk"'));
    expect(t2.indexOf('CREATE TRIGGER "trg_budgetItemTable_key"')).toBeLessThan(t2.indexOf('SET "rowJSON" = "rowJSON"'));
  });

  it('the trigger name sorts AFTER the genus trigger (it relies on a checked genus)', () => {
    expect('trg_budgetItemTable_genus' < 'trg_budgetItemTable_key').toBe(true);
    expect(sqlPart(codeSql, 8)).toContain('"trg_budgetItemTable_genus"');
  });

  it('the CHECK is not in the tables file (a data fix has to run before it)', () => {
    expect(tablesSql).not.toContain('budgetItemTable_key_chk');
  });

  it('start4: the seed rows: 3 activities, 14 keys, 36 possible budget items - every field of the tree', () => {
    const rowsOf = (table: string) => Array.from(t3.matchAll(new RegExp(`INSERT INTO public\\."${table}"[\\s\\S]*?ON CONFLICT`, 'g'))).map((m) => m[0]);
    const tuples = (block: string) => Array.from(block.matchAll(/^  \('([^']+)', '([^']+)', '([^']+)', (\d+), '(\{.*\})'::jsonb\)/gm)).map((m) => ({ guid: m[1], owner: m[2], parent: m[3], json: JSON.parse(m[5].replace(/''/g, "'")) }));
    const activities = tuples(rowsOf('managementActivityGenusTable')[0]);
    const keys = tuples(rowsOf('budgetItemGenericKeyTable')[0]);
    const items = tuples(rowsOf('budgetItemTable')[0]);
    expect(activities.map((a) => a.guid)).toEqual(MANAGEMENT_ACTIVITY_GENUS_CODES);
    for (const a of activities) {
      expect(a.owner).toBe('managementActivityGenusCatalog');
      expect(a.parent).toBe('empty');
      for (const f of ['title', 'description', 'webIfrsName', 'd365foName', 'sapName']) expect(String(a.json[f] ?? '')).not.toBe('');
    }
    expect(keys.map((k) => k.guid)).toEqual(BUDGET_ITEM_KEY_MATRIX.map((c) => budgetItemKeyOf(c.activity, c.genus)));
    for (const k of keys) {
      expect(k.json.directionDefault).toBe(budgetItemKeyDirection(k.guid));
      expect(budgetItemKeyParts(k.guid)).toEqual({ activity: k.json.activityGenus, genus: k.json.managementGenusItem });
      expect(String(k.json.d365foName)).not.toBe('');
      expect(String(k.json.sapName)).not.toBe('');
    }
    expect(items).toHaveLength(36);
    expect(new Set(items.map((i) => i.guid)).size).toBe(36);
    for (const i of items) {
      expect(i.owner).toBe('budgetItemCatalog');
      expect(['costsBudgetFolder', 'revenuesBudgetFolder', 'paymentsBudgetFolder']).toContain(i.parent);
      expect(budgetItemKeyError(i.json.budgetItemGenericKey, i.json.managementGenusItem)).toBeNull();
      expect(budgetItemDirectionError(i.json.direction, i.json.budgetItemGenericKey, i.json.isCorrection)).toBeNull();
      expect(typeof i.json.isPolicyItem).toBe('boolean');
      for (const f of ['title', 'description', 'webIfrsName', 'd365foName', 'sapName']) expect(String(i.json[f] ?? '')).not.toBe('');
      // the folder of the item = the folder of its genus
      expect(i.parent).toBe(i.json.managementGenusItem.startsWith('revenue') ? 'revenuesBudgetFolder' : i.json.managementGenusItem.endsWith('PaymentGenus') ? 'paymentsBudgetFolder' : 'costsBudgetFolder');
    }
    expect(items.filter((i) => i.json.isPolicyItem).map((i) => i.json.title).sort()).toEqual(['Dividends paid', 'Dividends received', 'Interest paid', 'Interest received']);
    // per activity: 18 operating (incl. the customer receipts and the vendor payments), 11 investing, 7 financing
    const per = (a: string) => items.filter((i) => budgetItemActivityOf(i.json) === a).length;
    expect([per('operatingActivity'), per('investingActivity'), per('financingActivity')]).toEqual([18, 11, 7]);
  });

  it('start5 has the same rows as start4 (upserts), start4 only inserts what is missing', () => {
    const codes = (src: string) => Array.from(src.matchAll(/^  \('([^']+)', '(?:budgetItemCatalog|budgetItemGenericKeyCatalog|managementActivityGenusCatalog)'/gm)).map((m) => m[1]).sort();
    const s5 = start5.slice(start5.indexOf('Activity genus, budget item keys'));
    expect(codes(s5)).toEqual(codes(t3));
    expect(codes(t3)).toHaveLength(53);          // 3 activities + 14 keys + 36 items = the 53 rows of the tree
    expect(t3).toMatch(/ON CONFLICT \("rowGUID"\) DO NOTHING/);
    expect(t3).not.toMatch(/DO UPDATE/);
    expect(s5).toMatch(/DO UPDATE SET/);
    expect(s5).not.toMatch(/DO NOTHING/);
  });

  it('the seed of the six default items (PART 8) comes first and needs no key: the trigger gives them the operating one', () => {
    expect(start4.indexOf('-- PART 8: create_budget_item_table.sql')).toBeLessThan(start4.indexOf('-- PART 32: create_activity_genus.sql'));
    expect(sqlPart(start4, 8)).not.toContain('budgetItemGenericKey');
  });

  it('delete_sql_structure.sql drops the two catalogs and the three functions', () => {
    for (const t of ['managementActivityGenusTable', 'budgetItemGenericKeyTable']) expect(del).toContain(`'${t}'`);
    for (const f of ['kit8_budget_item_check_key()', 'kit8_budget_item_key_direction(text)', 'kit8_budget_item_key_matrix()']) expect(del).toContain(`DROP FUNCTION IF EXISTS public.${f};`);
    // the direction function (LANGUAGE sql) depends on the matrix function: it goes first
    expect(del.indexOf('kit8_budget_item_key_direction(text)')).toBeLessThan(del.indexOf('kit8_budget_item_key_matrix()'));
  });
});
