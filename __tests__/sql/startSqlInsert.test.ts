// start3_sql_insert_missing.sql is the seed data EXTRACTED from the structure (start1_sql_tables.sql + start2_sql_code.sql): the structure file has no seed rows any more, the insert file has no DDL, every PART of the insert file is
// a PART of the structure file, and a seed is idempotent. (The SQL itself is run on a real Postgres 15 by kit8/docker/test_sql.sh: install twice = same objects and same row counts,
// the structure alone = 0 seed rows, delete leaves nothing.)
import * as fs from 'fs';
import * as path from 'path';

const dir = path.join(__dirname, '../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const structure = read('start1_sql_tables.sql') + '\n' + read('start2_sql_code.sql');
const insert = read('start3_sql_insert_missing.sql');

/** the top-level statements of a file: split at ";" followed by a line end, outside strings, dollar quotes and comments */
function statements(src: string): string[] {
  const out: string[] = [];
  let i = 0, start = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "'") { i++; while (i < n && !(src[i] === "'" && src[i + 1] !== "'")) i += src[i] === "'" ? 2 : 1; i++; }
    else if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(src.slice(i, i + 40));
      if (m) { const j = src.indexOf(m[0], i + m[0].length); i = j < 0 ? n : j + m[0].length; } else i++;
    } else if (c === '-' && src[i + 1] === '-') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; }
    else if (c === ';') { i++; out.push(src.slice(start, i).replace(/^(\s|--[^\n]*\n)+/g, '')); start = i; }
    else i++;
  }
  return out.filter((s) => s.trim());
}
const kindOf = (s: string) => s.trim().split(/\s+/)[0].toUpperCase();
const structureStatements = statements(structure);
const insertStatements = statements(insert);

describe('the structure file has no seed rows', () => {
  it('its only top-level INSERTs are the backfills of data that already exists', () => {
    const targets = structureStatements.filter((s) => kindOf(s) === 'INSERT').map((s) => /INSERT\s+INTO\s+public\.("?\w+"?)/i.exec(s)![1].replace(/"/g, ''));
    // (the backfill of userTable from auth.users is inside a DO block: a database that has the organization rule needs organization_ensure_user for it)
    // (monitor01_dirty five times: the first fill of the Monitor01 queue and the upgrade steps that queue the tasks that have fact documents / a plan that is not in the register yet / posted vendor invoices / posted purchase orders)
    expect(targets.sort()).toEqual(['monitor01_dirty', 'monitor01_dirty', 'monitor01_dirty', 'monitor01_dirty', 'monitor01_dirty', 'project_user_settings_table', 'task_line_plan_timeline']);
  });
  it('says where the seeds are', () => {
    expect(structure).toContain('start3_sql_insert_missing.sql');
    expect(structure).toMatch(/NO seed rows/);
  });
});

describe('the insert file has only data', () => {
  it('no DDL: every statement is an INSERT, a seed UPDATE, a data-modifying WITH, a guard / fill DO block or the schema reload', () => {
    const kinds = new Set(insertStatements.map(kindOf));
    expect([...kinds].sort()).toEqual(['DO', 'INSERT', 'NOTIFY', 'UPDATE', 'WITH']);
    expect(insertStatements.filter((s) => kindOf(s) === 'INSERT').length).toBeGreaterThan(80);
  });
  it('is idempotent: an INSERT has ON CONFLICT or a NOT EXISTS guard', () => {
    for (const s of insertStatements.filter((x) => kindOf(x) === 'INSERT')) expect(s).toMatch(/ON CONFLICT|WHERE NOT EXISTS|NOT EXISTS \(/i);
  });
  it('refuses to run before the structure', () => {
    expect(insert).toContain("Run start1_sql_tables.sql + start2_sql_code.sql first");
  });
  it('the same order as the structure: its PARTs are PARTs of the structure file, ascending', () => {
    const parts = Array.from(insert.matchAll(/^-- PART (\d+): (\S+)\s+\(seed data\)/gm)).map((m) => [Number(m[1]), m[2]] as const);
    expect(parts.length).toBeGreaterThan(15);
    for (const [n, title] of parts) expect(structure).toContain(`-- PART ${n}: ${title}`);
    const nums = parts.map(([n]) => n);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });
});

describe('what moved', () => {
  it.each([
    ['countries', 'INSERT INTO public."countryTable"'],
    ['the ECB rates', 'INSERT INTO public."currencyExchangeRateTable"'],
    ['the products', 'INSERT INTO public."productTable"'],
    ['the management genus', 'INSERT INTO public."managementGenusTable"'],
    ['the business units', 'INSERT INTO public."businessUnitTable"'],
    ['the budget scenarios', 'INSERT INTO public."budgetScenarioTable"'],
    ['the equipment', 'INSERT INTO public."equipmentTable"'],
    ['the calendars', 'INSERT INTO public."managementCalendarTable"'],
  ])('%s are in the insert file, not in the structure file', (_what, head) => {
    expect(insert).toContain(head);
    expect(structure).not.toMatch(new RegExp(`^${head.replace(/[."]/g, '\\$&')}`, 'm'));       // a top-level statement (an INSERT inside a function body is not a seed)
  });
  it('the calendar days of the seeded calendars are filled by the insert file', () => {
    expect(insert).toContain("fill_management_calendar('workingDaysCalendar'");
    expect(structure).not.toContain("fill_management_calendar('workingDaysCalendar'");
  });
  it('the delete file still drops everything (tables go with their rows)', () => {
    const del = read('delete_sql_structure.sql');
    expect(del).toContain('DROP TABLE IF EXISTS public."countryTable"');
  });
});
