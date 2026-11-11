// RACI genus (SQL PART 44, documentation/PERMISSIONS_WBS.html section 3): the model helpers, the SystemMetaData entry, the SQL files (table, read only grants, trigger, backfill, seeds, delete)
// The column of the Time tab is __tests__/pm/view/task/finances/taskLineRaciColumn.test.tsx. The behaviour in the database is kit8/docker/tests/47_raci.sql.
import {
  isRaciGuid, MANAGEMENT_RACI_GENUS_TABLE, RACI_ACCOUNTABLE_GUID, RACI_CONSULTED_GUID, RACI_DEFAULT_GUID, RACI_GUIDS, RACI_INFORMED_GUID, RACI_RESPONSIBLE_GUID, RACI_TITLES,
  raciItemOf, raciOptions, raciTitle, raciWarning,
} from '../../../kit8/catalog/management/raci_genus/raciGenusModel';
import { managementRACIGenusSystemMetaData } from '../../../kit8/catalog/management/raci_genus/raciGenusMetaData';
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';

const row = (guid: string, title: string | null, order: number) => ({ rowGUID: guid, rowOwnerGUID: 'managementRACIGenusCatalog', rowParentGUID: 'empty', orderInList: order, rowJSON: { title, description: null } }) as any;
const seedRows = () => [row(RACI_INFORMED_GUID, 'Informed', 4000), row(RACI_RESPONSIBLE_GUID, 'Responsible', 1000), row(RACI_CONSULTED_GUID, 'Consulted', 3000), row(RACI_ACCOUNTABLE_GUID, 'Accountable', 2000)];

describe('the model', () => {
  it('the four PMBOK items with the GUIDs of the owner, in the order R A C I', () => {
    expect(RACI_GUIDS).toEqual(['raciResponsibleGUID', 'raciAccountableGUID', 'raciConsultedGUID', 'raciInformedGUID']);
    expect(RACI_TITLES).toEqual({ raciResponsibleGUID: 'Responsible', raciAccountableGUID: 'Accountable', raciConsultedGUID: 'Consulted', raciInformedGUID: 'Informed' });
    expect(RACI_DEFAULT_GUID).toBe('raciResponsibleGUID');
  });
  it('a linear read only catalog: its own table, entity and owner', () => {
    const t = MANAGEMENT_RACI_GENUS_TABLE;
    expect([t.table, t.entity, t.catalogOwner]).toEqual(['managementRACIGenusTable', 'managementRACIGenusReusable', 'managementRACIGenusCatalog']);
    expect(t.emptyRowJSON()).toEqual({ title: null, description: null });
  });
  it('isRaciGuid knows only the four GUIDs (not the code names, not a title)', () => {
    for (const g of RACI_GUIDS) expect(isRaciGuid(g)).toBe(true);
    for (const v of ['raciResponsible', 'Responsible', '', null, undefined, 7]) expect(isRaciGuid(v)).toBe(false);
  });
  it('raciTitle: the catalog title, else the seed title, an unknown GUID as it is, nothing for empty', () => {
    expect(raciTitle([row(RACI_CONSULTED_GUID, 'Asked before', 3000)], RACI_CONSULTED_GUID)).toBe('Asked before');
    expect(raciTitle([], RACI_CONSULTED_GUID)).toBe('Consulted');
    expect(raciTitle(null, 'boss')).toBe('boss');
    expect(raciTitle([], null)).toBe('');
  });
  it('raciOptions: value = GUID, label = the translated title, by orderInList; the seed items while the catalog is not read', () => {
    const upper = (t: string) => t.toUpperCase();
    expect(raciOptions(seedRows(), upper)).toEqual([
      { value: 'raciResponsibleGUID', label: 'RESPONSIBLE' }, { value: 'raciAccountableGUID', label: 'ACCOUNTABLE' },
      { value: 'raciConsultedGUID', label: 'CONSULTED' }, { value: 'raciInformedGUID', label: 'INFORMED' },
    ]);
    expect(raciOptions([], upper).map((o) => o.value)).toEqual([...RACI_GUIDS]);
    expect(raciOptions(undefined).map((o) => o.label)).toEqual(['Responsible', 'Accountable', 'Consulted', 'Informed']);
    // a row that is not one of the four is not offered
    expect(raciOptions([...seedRows(), row('boss', 'Boss', 5000)]).map((o) => o.value)).toEqual([...RACI_GUIDS]);
  });
  it('raciItemOf: the line item, else Responsible (an old line before the backfill reached the client)', () => {
    expect(raciItemOf({ raciItem: RACI_INFORMED_GUID })).toBe(RACI_INFORMED_GUID);
    expect(raciItemOf({})).toBe(RACI_RESPONSIBLE_GUID);
    expect(raciItemOf({ raciItem: 'boss' })).toBe(RACI_RESPONSIBLE_GUID);
    expect(raciItemOf(null)).toBe(RACI_RESPONSIBLE_GUID);
  });
  it('raciWarning: more than one Accountable on the lines of a task is a warning text; one or none is not', () => {
    const acc = { rowJSON: { raciItem: RACI_ACCOUNTABLE_GUID } };
    const res = { rowJSON: { raciItem: RACI_RESPONSIBLE_GUID } };
    expect(raciWarning([acc, res, acc])).toBe('More than one Accountable on this task');
    expect(raciWarning([acc, res])).toBe('');
    expect(raciWarning([res, res])).toBe('');
    expect(raciWarning([])).toBe('');
  });
});

describe('the SystemMetaData entry', () => {
  it('one entity on managementRACIGenusTable', () => {
    const e = managementRACIGenusSystemMetaData();
    expect(Object.keys(e)).toEqual(['managementRACIGenusReusable']);
    expect(e.managementRACIGenusReusable.tableName).toBe('managementRACIGenusTable');
  });
  it('is registered in kit8/redux/SystemMetaData.ts', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../../kit8/redux/SystemMetaData.ts'), 'utf8') as string;
    expect(src).toContain('managementRACIGenusSystemMetaData');
  });
});

describe('the SQL (PART 44)', () => {
  const t = sqlPart(tablesSql, 44);
  const c = sqlPart(codeSql, 44);
  it('start1: the table with the universal columns and the owner default; start2: setup + read only + trigger + backfill + realtime', () => {
    expect(t).toContain('CREATE TABLE IF NOT EXISTS public."managementRACIGenusTable"');
    expect(t).toContain("DEFAULT 'managementRACIGenusCatalog'");
    expect(c).toContain(`kit8_setup_def_table('managementRACIGenusTable')`);
    expect(c).toContain('GRANT SELECT ON public."managementRACIGenusTable" TO authenticated');
    expect(c).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*managementRACIGenusTable/);
    expect(c).toContain('CREATE TRIGGER trg_task_line_raci BEFORE INSERT OR UPDATE OF "rowJSON", "rowParentGUID" ON public.task_line_table');
    expect(c).toContain("'raciResponsibleGUID'");
    expect(c).toContain('DISABLE TRIGGER USER');
    expect(c).toContain('ENABLE TRIGGER USER');
    expect(c).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.\"managementRACIGenusTable\"");
  });
  it('a RAISE placeholder is a single percent sign', () => {
    const raise = c.split('\n').find((l) => l.includes('RAISE EXCEPTION') && l.includes('raciItem'))!;
    expect(raise).not.toContain('%%');
    expect(raise).toContain('"%"');
  });
  it('start4 and start5 seed exactly the four items; start5 upserts', () => {
    for (const [file, mode] of [['start4_sql_insert_missing.sql', 'DO NOTHING'], ['start5_sql_upsert_all.sql', 'DO UPDATE']] as const) {
      const sql = readSql(file);
      const block = sql.slice(sql.indexOf('INSERT INTO public."managementRACIGenusTable"'));
      for (const g of RACI_GUIDS) expect(block).toContain(`('${g}', 'managementRACIGenusCatalog', 'empty'`);
      expect(block.slice(0, block.indexOf(';'))).toContain(`ON CONFLICT ("rowGUID") ${mode}`);
      expect((block.slice(0, block.indexOf(';')).match(/'managementRACIGenusCatalog'/g) || []).length).toBe(4);
    }
  });
  it('the titles of the seed rows are the titles of the model', () => {
    const sql = readSql('start4_sql_insert_missing.sql');
    for (const g of RACI_GUIDS) expect(sql).toContain(`('${g}', 'managementRACIGenusCatalog', 'empty', `);
    for (const g of RACI_GUIDS) expect(sql).toContain(`"title": "${RACI_TITLES[g]}"`);
  });
  it('the drop is in delete_sql_structure.sql (trigger, function, table)', () => {
    const del = readSql('delete_sql_structure.sql');
    expect(del).toContain('DROP TRIGGER IF EXISTS trg_task_line_raci ON public.task_line_table');
    expect(del).toContain('DROP FUNCTION IF EXISTS public.kit8_task_line_raci()');
    expect(del).toContain('DROP TABLE IF EXISTS public."managementRACIGenusTable" CASCADE');
  });
});
