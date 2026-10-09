// Management genus - the tree table (model helpers, metadata) and its SQL files against the seed fixture.
import * as fs from 'fs';
import * as path from 'path';
import seed from './managementGenusSeed.json';
import { MANAGEMENT_GENUS, MANAGEMENT_GENUS_TABLE, managementGenusFolders, managementGenusItems, managementGenusNodes, managementGenusPath } from '../../../kit8/catalog/management/genus/managementGenusModel';
import { managementGenusSystemMetaData } from '../../../kit8/catalog/management/genus/managementGenusMetaData';

const rows = (seed as any).managementGenusTable as any[];
const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/create_management_genus_table.sql'), 'utf8');
const del = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/delete_management_genus_table.sql'), 'utf8');

describe('the tree', () => {
  it('level 1 = folders, level 2 = items: costs > time, material, expense · revenues > revenue · payments > inbound, outbound', () => {
    const children = (g: string) => rows.filter((r) => r.rowParentGUID === g).map((r) => r.rowGUID);
    expect(managementGenusFolders(rows).map((r) => r.rowGUID)).toEqual(['costsGenus', 'revenuesGenus', 'paymentsGenus']);
    expect(children('costsGenus')).toEqual(['timeGenus', 'materialGenus', 'expenseGenus']);
    expect(children('revenuesGenus')).toEqual(['revenueGenus']);
    expect(children('paymentsGenus')).toEqual(['inboundPaymentGenus', 'outboundPaymentGenus']);
    // the second level has no children: items, not folders
    for (const item of managementGenusItems(rows)) expect([item.rowGUID, children(item.rowGUID)]).toEqual([item.rowGUID, []]);
    expect(managementGenusItems(rows)).toHaveLength(6);
    expect(rows).toHaveLength(9);
    expect(Object.values(MANAGEMENT_GENUS).sort()).toEqual(rows.map((r) => r.rowGUID).sort());
    expect(rows.every((r) => r.rowOwnerGUID === 'managementGenusCatalog' && r.rowJSON.title && r.rowJSON.description)).toBe(true);
  });

  it('the tree has the folders only; the path of an item', () => {
    const nodes = managementGenusNodes(rows);
    expect(nodes.map((n) => [n.id, n.parentId, n.title])).toEqual([['costsGenus', null, 'Costs'], ['revenuesGenus', null, 'Revenues'], ['paymentsGenus', null, 'Payments']]);
    expect(managementGenusPath(rows, 'outboundPaymentGenus')).toBe('Payments › Outbound payment');
    expect(managementGenusPath(rows, 'revenueGenus')).toBe('Revenues › Revenue');
    expect(managementGenusPath(rows, 'nope')).toBe('nope');
  });

  it('SystemMetaData entry', () => {
    expect(managementGenusSystemMetaData()).toEqual({ managementGenusReusable: expect.objectContaining({ tableName: 'managementGenusTable', itemLabel: 'Genus' }) });
    expect(MANAGEMENT_GENUS_TABLE.emptyRowJSON()).toEqual({ title: null, description: null });
  });
});

describe('SQL', () => {
  it('create_management_genus_table.sql: the table, secured, in realtime, with exactly the seed rows', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public."managementGenusTable"');
    expect(sql).toContain("SELECT public.kit8_setup_def_table('managementGenusTable')");
    expect(sql).toContain('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public."managementGenusTable"');
    const block = sql.slice(sql.indexOf('INSERT INTO public."managementGenusTable"'));
    expect((block.slice(0, block.indexOf('ON CONFLICT')).match(/^  \('/gm) || [])).toHaveLength(rows.length);
    for (const r of rows) expect(sql).toContain(`('${r.rowGUID}', 'managementGenusCatalog', '${r.rowParentGUID}',`);
  });
  it('an older database: revenueGenus moves into the folder revenuesGenus', () => {
    expect(sql).toContain(`UPDATE public."managementGenusTable" SET "rowParentGUID" = 'revenuesGenus' WHERE "rowGUID" = 'revenueGenus' AND "rowParentGUID" = 'empty'`);
  });
  it('delete_management_genus_table.sql drops it', () => {
    expect(del).toContain('DROP TABLE IF EXISTS public."managementGenusTable"');
  });
});
