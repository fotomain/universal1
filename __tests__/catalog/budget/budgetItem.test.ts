// Budget item - the tree table (model helpers, metadata) and its SQL files against the management genus seed.
import * as fs from 'fs';
import * as path from 'path';
import { budgetSeedRows } from './budgetItemTestKit';
import { genusRows } from '../resourcerole/resourceRoleTestKit';
import {
  BUDGET_ITEM, BUDGET_ITEM_TABLE, budgetItemFolders, budgetItemGenusError, budgetItemGenusOptions, budgetItemNodes, budgetItemPath, budgetItems, budgetItemsOfGenus, budgetItemsWithoutGenus,
} from '../../../kit8/catalog/budget/item/budgetItemModel';
import { budgetItemSystemMetaData } from '../../../kit8/catalog/budget/item/budgetItemMetaData';

const rows = budgetSeedRows();
const genus = genusRows() as any[];
const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/create_budget_item_table.sql'), 'utf8');
const del = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/delete_budget_item_table.sql'), 'utf8');
const runFresh = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/run_fresh_data.sql'), 'utf8');

describe('the tree', () => {
  it('the folder structure of the management genus: costs > time, material, expense · revenues > revenue · payments > inbound, outbound', () => {
    const children = (g: string) => rows.filter((r) => r.rowParentGUID === g).map((r) => r.rowGUID);
    expect(budgetItemFolders(rows).map((r) => r.rowGUID)).toEqual(['costsBudgetFolder', 'revenuesBudgetFolder', 'paymentsBudgetFolder']);
    expect(children('costsBudgetFolder')).toEqual(['timeBudgetItem', 'materialBudgetItem', 'expenseBudgetItem']);
    expect(children('revenuesBudgetFolder')).toEqual(['revenueBudgetItem']);
    expect(children('paymentsBudgetFolder')).toEqual(['inboundPaymentBudgetItem', 'outboundPaymentBudgetItem']);
    expect(budgetItems(rows)).toHaveLength(6);
    expect(Object.values(BUDGET_ITEM).sort()).toEqual(rows.map((r) => r.rowGUID).sort());
    // same shape as the genus table: one budget row per genus row
    expect(rows).toHaveLength(genus.length);
  });

  it('every item has a managementGenusItem = a level 2 row of managementGenusTable; folders have none', () => {
    for (const i of budgetItems(rows)) expect(budgetItemGenusError(i.rowJSON.managementGenusItem, genus)).toBeNull();
    expect(budgetItemsWithoutGenus(rows, genus)).toEqual([]);
    for (const f of budgetItemFolders(rows)) expect(f.rowJSON.managementGenusItem).toBeUndefined();
    expect(budgetItemsOfGenus(rows, 'timeGenus').map((r) => r.rowGUID)).toEqual(['timeBudgetItem']);
  });

  it('the genus is obligatory: empty, unknown and a genus FOLDER are refused', () => {
    expect(budgetItemGenusError(null, genus)).toMatch(/needs a management genus/);
    expect(budgetItemGenusError('', genus)).toMatch(/needs a management genus/);
    expect(budgetItemGenusError('empty', genus)).toMatch(/needs a management genus/);
    expect(budgetItemGenusError('nope', genus)).toMatch(/does not exist/);
    expect(budgetItemGenusError('costsGenus', genus)).toMatch(/genus folder/);
    expect(budgetItemGenusError('timeGenus', genus)).toBeNull();
    // the genus table is not loaded yet: only "set" is checked
    expect(budgetItemGenusError('timeGenus', [])).toBeNull();
    expect(budgetItemGenusError(null, [])).not.toBeNull();
  });

  it('the genus choices are the 6 genus items, with their path', () => {
    const options = budgetItemGenusOptions(genus);
    expect(options.map((o) => o.value)).toEqual(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus', 'inboundPaymentGenus', 'outboundPaymentGenus']);
    expect(options[0].label).toBe('Costs › Time');
  });

  it('the tree has the folders only; the path of an item', () => {
    expect(budgetItemNodes(rows).map((n) => [n.id, n.parentId, n.title])).toEqual([['costsBudgetFolder', null, 'Costs'], ['revenuesBudgetFolder', null, 'Revenues'], ['paymentsBudgetFolder', null, 'Payments']]);
    expect(budgetItemPath(rows, 'outboundPaymentBudgetItem')).toBe('Payments › Outbound payment');
  });

  it('SystemMetaData entry', () => {
    expect(budgetItemSystemMetaData()).toEqual({ budgetItemReusable: expect.objectContaining({ tableName: 'budgetItemTable', itemLabel: 'Budget item' }) });
    expect(BUDGET_ITEM_TABLE.emptyRowJSON()).toEqual({ title: null, description: null, managementGenusItem: null });
    expect(BUDGET_ITEM_TABLE.catalogOwner).toBe('budgetItemCatalog');
  });
});

describe('SQL', () => {
  it('create_budget_item_table.sql: the table, the obligatory genus, secured, in realtime, rows generated from the genus', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public."budgetItemTable"');
    expect(sql).toContain("SELECT public.kit8_setup_def_table('budgetItemTable')");
    expect(sql).toContain('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public."budgetItemTable"');
    // managementGenusItem: set (CHECK) and an item of managementGenusTable (trigger)
    expect(sql).toContain(`CHECK ("rowParentGUID" = 'empty' OR coalesce("rowJSON"->>'managementGenusItem', '') NOT IN ('', 'empty'))`);
    expect(sql).toContain(`g."rowGUID" = NEW."rowJSON"->>'managementGenusItem' AND g."rowParentGUID" <> 'empty'`);
    // generated: genus folders -> budget folders, genus items -> budget items with their genus
    expect(sql).toContain(`regexp_replace(g."rowGUID", 'Genus$', 'BudgetFolder')`);
    expect(sql).toContain(`regexp_replace(g."rowGUID", 'Genus$', 'BudgetItem')`);
    expect(sql).toContain(`'managementGenusItem', g."rowGUID"`);
  });
  it('stops with a message when managementGenusTable is missing', () => {
    expect(sql).toContain('Run kit8/sql/init/create_management_genus_table.sql first');
  });
  it('delete_budget_item_table.sql drops it', () => {
    expect(del).toContain('DROP TABLE IF EXISTS public."budgetItemTable"');
  });
  it('run_fresh_data.sql has it after the management genus', () => {
    const at = runFresh.indexOf('CREATE TABLE IF NOT EXISTS public."budgetItemTable"');
    expect(at).toBeGreaterThan(runFresh.indexOf('CREATE TABLE IF NOT EXISTS public."managementGenusTable"'));
  });
});
