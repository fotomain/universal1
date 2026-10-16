// The structure is two files: start1_sql_tables.sql (ONLY tables) and start2_sql_code.sql (everything else of the structure, no seeds). start1_sql_structure.sql is gone.
// (The SQL itself is run on a real Postgres 15 by kit8/docker/test_sql.sh: the two files give the same schema as the old single file, install twice, delete, install again.)
import * as fs from 'fs';
import * as path from 'path';
import { codeSql, readSql, sqlDir, sqlStatements, tablesSql } from './sqlFilesTestKit';

const tableStatements = sqlStatements(tablesSql);
const codeStatements = sqlStatements(codeSql);
const head = (s: string) => s.replace(/\s+/g, ' ').trim();
const kind = (s: string) => {
  const h = head(s);
  const m = /^(CREATE (?:OR REPLACE )?(?:UNIQUE |UNLOGGED )?\w+|ALTER \w+|DROP \w+|DO|INSERT|UPDATE|DELETE|SELECT|GRANT|REVOKE|NOTIFY|WITH|COMMENT)/.exec(h);
  return m ? m[1] : h.slice(0, 20);
};

describe('the files', () => {
  it('start1_sql_structure.sql is removed; the two files and the seeds are there', () => {
    const files = fs.readdirSync(sqlDir);
    expect(files).not.toContain('start1_sql_structure.sql');
    for (const f of ['start1_sql_tables.sql', 'start2_sql_code.sql', 'start3_sql_insert_missing.sql', 'start5_sql_upsert_all.sql', 'delete_sql_structure.sql']) expect(files).toContain(f);
  });
});

describe('start1_sql_tables.sql has only tables', () => {
  it('every top-level statement is a table definition (extension, schema, table, index, sequence, ALTER TABLE, DROP INDEX), a DO block of table changes, or the one helper pm_ltree_label', () => {
    const kinds = new Set(tableStatements.map(kind));
    expect([...kinds].sort()).toEqual(['ALTER TABLE', 'CREATE EXTENSION', 'CREATE INDEX', 'CREATE OR REPLACE FUNCTION', 'CREATE SCHEMA', 'CREATE SEQUENCE', 'CREATE TABLE', 'CREATE UNIQUE INDEX', 'CREATE UNLOGGED TABLE', 'DO', 'DROP INDEX'].sort());
    const fns = tableStatements.filter((s) => kind(s) === 'CREATE OR REPLACE FUNCTION');
    expect(fns).toHaveLength(1);
    expect(fns[0]).toContain('public.pm_ltree_label(');
  });
  it('no trigger, policy, grant, view, realtime, data and no cron in it - also not inside a DO block', () => {
    for (const s of tableStatements.filter((x) => kind(x) === 'DO')) {
      expect(s).not.toMatch(/\b(CREATE|DROP) (TRIGGER|POLICY|VIEW|FUNCTION)\b|\bGRANT\b|\bREVOKE\b|PUBLICATION|cron\.|\bINSERT\b|\bUPDATE public|\bDELETE FROM\b|\bPERFORM\b/);
    }
    expect(tablesSql).not.toMatch(/^\s*(CREATE TRIGGER|CREATE POLICY|GRANT |REVOKE |NOTIFY |INSERT |UPDATE |CREATE VIEW|CREATE OR REPLACE VIEW)/m);
    expect(tablesSql).not.toMatch(/ENABLE ROW LEVEL SECURITY|REPLICA IDENTITY/);
  });
  it('a table definition calls no function but pm_ltree_label (a function of the code file would not exist yet)', () => {
    const userFns = [...codeSql.matchAll(/CREATE OR REPLACE (?:FUNCTION|PROCEDURE) public\.(\w+)\(/g)].map((m) => m[1]).filter((f) => f !== 'pm_ltree_label');
    const text = tableStatements.filter((s) => kind(s) !== 'CREATE OR REPLACE FUNCTION').join('\n').replace(/--[^\n]*/g, '');
    for (const fn of userFns) expect(text).not.toMatch(new RegExp(`\\b${fn}\\s*\\(`));
  });
  it('has the tables the app needs (spot check across the parts)', () => {
    for (const t of ['public.project_table', 'public.project_task_table', 'public.task_line_table', 'public."contractTable"', 'public."equipmentTable"', 'public."businessUnitTable"',
      'public.task_fact_usage_timeline', 'public.monitor01_view', 'public.project_status_movements', 'public.project_status_month_turnover', 'public.vendor_invoice_header', 'public.vendor_invoice_lines', 'public."legalEntityTable"']) {
      expect(tablesSql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
    expect(tablesSql).toContain("'googleDriveCommandTable'");      // the generic tables are made by one loop
    expect(tableStatements.filter((s) => /^CREATE (UNLOGGED )?TABLE/.test(head(s))).length).toBeGreaterThan(75);
  });
});

describe('start2_sql_code.sql has everything else, and no table definition', () => {
  it('no CREATE TABLE at the top level and none inside a DO block', () => {
    expect(codeStatements.filter((s) => /^CREATE (UNLOGGED )?TABLE/.test(head(s)))).toHaveLength(0);
    for (const s of codeStatements.filter((x) => kind(x) === 'DO')) expect(s).not.toMatch(/CREATE (UNLOGGED )?TABLE/);
  });
  it('has the functions, triggers, policies, grants, views, realtime and cron', () => {
    const kinds = new Set(codeStatements.map(kind));
    for (const k of ['CREATE OR REPLACE FUNCTION', 'CREATE TRIGGER', 'CREATE POLICY', 'GRANT', 'REVOKE', 'DO', 'NOTIFY', 'CREATE OR REPLACE VIEW', 'CREATE OR REPLACE PROCEDURE']) expect(kinds).toContain(k);
    expect(codeSql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE');
    expect(codeSql).toContain("cron.schedule('monitor01_tick'");
    expect(codeSql).toContain("PERFORM public.kit8_setup_def_table(t);");
  });
  it('refuses to run before the tables exist, and says which file to run first', () => {
    expect(codeSql).toContain("RAISE EXCEPTION 'Run start1_sql_tables.sql first (the tables), then this file'");
    const guard = codeSql.indexOf('Run start1_sql_tables.sql first');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(codeSql.indexOf('CREATE OR REPLACE FUNCTION'));
  });
  it('has the same seed-free rule as before: the only INSERTs are the backfills of data that already exists', () => {
    const targets = codeStatements.filter((s) => kind(s) === 'INSERT').map((s) => /INSERT\s+INTO\s+public\.("?\w+"?)/i.exec(s)![1].replace(/"/g, ''));
    expect(targets.sort()).toEqual(['monitor01_dirty', 'monitor01_dirty', 'monitor01_dirty', 'monitor01_dirty', 'monitor01_dirty', 'project_user_settings_table', 'task_line_plan_timeline']);
  });
  it('a unique index / NOT NULL that needs the data fix right before it stays here, after the fix', () => {
    const fix = codeSql.indexOf('UPDATE public."organizationTable" o');
    const idx = codeSql.indexOf('"uq_organizationTable_one_per_user"');
    expect(fix).toBeGreaterThan(0);
    expect(idx).toBeGreaterThan(fix);
    expect(tablesSql).not.toContain('uq_organizationTable_one_per_user');
    const upd = codeSql.indexOf('UPDATE public.project_status_month_turnover SET "sumForContractUsed"');
    expect(upd).toBeGreaterThan(0);
    expect(codeSql.indexOf('ALTER COLUMN "sumForContractUsed" SET NOT NULL')).toBeGreaterThan(upd);
  });
});

describe('the two files carry the same parts', () => {
  const parts = (src: string) => Array.from(src.matchAll(/^-- PART (\d+): (\S+)/gm)).map((m) => [Number(m[1]), m[2]] as const);
  it('the code file has every part, 1..29, ascending; the tables file has the parts that have tables, with the same titles, ascending', () => {
    const code = parts(codeSql);
    const tables = parts(tablesSql);
    expect(code.map(([n]) => n)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    const nums = tables.map(([n]) => n);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(tables.length).toBeGreaterThan(15);
    for (const [n, title] of tables) expect(code).toContainEqual([n, title]);
  });
  it('the number lists at the top of both files name the same 29 parts as the banners', () => {
    for (const src of [tablesSql, codeSql]) {
      const list = Array.from(src.slice(0, src.indexOf('-- PART 1:')).matchAll(/^--\s+(\d+)\. ((?:create|update|insert)_\S+)/gm)).map((m) => [Number(m[1]), m[2]] as const);
      expect(list.length).toBe(29);
      for (const [n, title] of list) expect(codeSql).toContain(`-- PART ${n}: ${title}`);
    }
  });
  it('both end with their own marker', () => {
    expect(tablesSql.trimEnd().split('\n').slice(-2)[0]).toBe('-- END of start1_sql_tables.sql');
    expect(codeSql.trimEnd().split('\n').slice(-2)[0]).toBe('-- END of start2_sql_code.sql');
  });
});

describe('pm_ltree_label is the one function in both files: the two copies are the same', () => {
  const fn = (src: string) => /CREATE OR REPLACE FUNCTION public\.pm_ltree_label[\s\S]*?\$\$;/.exec(src)![0];
  it('identical', () => {
    expect(fn(tablesSql)).toBe(fn(codeSql));
  });
});

describe('the seeds and the delete file follow the split', () => {
  it('the seed file asks for both files first', () => {
    expect(readSql('start3_sql_insert_missing.sql')).toContain('start1_sql_tables.sql + start2_sql_code.sql');
  });
  it('the delete file names the two files it undoes', () => {
    expect(readSql('delete_sql_structure.sql')).toContain('start1_sql_tables.sql + start2_sql_code.sql');
    expect(path.basename(sqlDir)).toBe('start');
  });
});
