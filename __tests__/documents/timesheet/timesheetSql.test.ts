// PART 36 of the SQL (the time sheet): the structure file and the code file carry the same part, the delete file drops it, the names the app calls exist, and the rules the app mirrors are in the code.
// (Docker test on a real Postgres 15: kit8/docker/tests/93_timesheet.sql - run ./test_fact_monitor01.sh 93.)
import * as fs from 'fs';
import * as path from 'path';
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';
const readFileSync = (rel: string) => fs.readFileSync(path.join(__dirname, '../../..', rel), 'utf8');
import {
  RPC_TS_ADD_LINE, RPC_TS_ALL_WORK_CENTERS, RPC_TS_BUDGET_ITEMS, RPC_TS_BUSINESS_UNITS, RPC_TS_CREATE, RPC_TS_CREATE_MY_WORK_CENTER, RPC_TS_DELETE, RPC_TS_DELETE_LINE, RPC_TS_FROM_TASK, RPC_TS_LIST, RPC_TS_MY_WORK_CENTER,
  RPC_TS_ONLY_CURRENT_MONTH, RPC_TS_INSERT_LINE, RPC_TS_MOVE_LINE, RPC_TS_POST, RPC_TS_ROLES, RPC_TS_SET_HEADER, RPC_TS_SET_HOURS, RPC_TS_SET_LINE, RPC_TS_UNPOST, TIMESHEET_ENTERED_TABLE, TIMESHEET_HEADER_TABLE, TIMESHEET_LINES_TABLE, TIMESHEET_MAX_DAYS,
  TIMESHEET_MAX_HOURS_A_DAY,
} from '../../../kit8/documents/timesheet/timesheetModel';
import { timesheetSystemMetaData } from '../../../kit8/documents/timesheet/timesheetMetaData';

const del = readSql('delete_sql_structure.sql');
const t = sqlPart(tablesSql, 36);
const c = sqlPart(codeSql, 36);

describe('PART 36 is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('after PART 35; the tables file has the three tables and no code, the code file has the code and no table', () => {
    for (const src of [tablesSql, codeSql]) expect(src.indexOf('-- PART 35:')).toBeLessThan(src.indexOf('-- PART 36:'));
    for (const name of [TIMESHEET_HEADER_TABLE, TIMESHEET_LINES_TABLE, TIMESHEET_ENTERED_TABLE]) expect(t).toContain(`CREATE TABLE IF NOT EXISTS public.${name} (`);
    expect(t).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(t).not.toMatch(/\bINSERT INTO\b/);
    expect(c).toMatch(/CREATE OR REPLACE FUNCTION public\.post_timesheet\(/);
    expect(c).not.toMatch(/CREATE TABLE/);
  });
  it('the code file refuses to run without the tables', () => {
    expect(c).toContain("to_regclass('public.project_timesheet_header') IS NULL");
    expect(c).toContain('PART 36 needs the tables: run start1_sql_tables.sql first');
  });
  it('the columns the app reads are in the tables', () => {
    for (const col of ['"timesheetWorkCenter"', '"startDate"', '"finishDate"', '"rowOrganizationGUID"']) expect(t).toContain(col);
    for (const col of ['"timesheetLineProject"', '"timesheetLineTask"', '"timesheetLineRole"', '"timesheetLineBudgetItem"', '"timesheetLineBusinessUnit"', '"timesheetLineHours"', '"unitSumForBudget"']) expect(t).toContain(col);
    for (const col of ['"rowLineGUID"', '"timesheetDay"', '"timesheetHours"']) expect(t).toContain(col);
  });
  it('one row per ENTERED cell: unique (line, day), hours above 0 and at most 24', () => {
    expect(t).toMatch(/idx_project_timesheet_data_entered_cell ON public\.project_timesheet_lines_data_entered \("rowLineGUID", "timesheetDay"\)/);
    expect(t).toContain('"timesheetHours" > 0 AND "timesheetHours" <= 24');
    expect(TIMESHEET_MAX_HOURS_A_DAY).toBe(24);
  });
});

describe('the names the app calls exist in the code file', () => {
  it.each([RPC_TS_CREATE, RPC_TS_SET_HEADER, RPC_TS_ADD_LINE, RPC_TS_SET_LINE, RPC_TS_DELETE_LINE, RPC_TS_DELETE, RPC_TS_SET_HOURS, RPC_TS_POST, RPC_TS_UNPOST, RPC_TS_LIST, RPC_TS_FROM_TASK, RPC_TS_MY_WORK_CENTER,
    RPC_TS_CREATE_MY_WORK_CENTER, RPC_TS_ROLES, RPC_TS_BUDGET_ITEMS, RPC_TS_BUSINESS_UNITS, RPC_TS_ALL_WORK_CENTERS, RPC_TS_ONLY_CURRENT_MONTH, RPC_TS_INSERT_LINE, RPC_TS_MOVE_LINE,
    'fx_base_currency', 'fx_ratio_on_day', 'fx_pair_rate', 'fx_miss_text', 'fx_convert', 'contract_hour_price', 'person_contract_on_day', 'role_hour_rate', 'timesheet_hour_price', 'timesheet_cell_money'])('function %s', (name) => {
    expect(c).toContain(`CREATE OR REPLACE FUNCTION public.${name}(`);
  });
  it('the SECURITY DEFINER RPCs are granted to signed-in users only', () => {
    for (const fn of ['post_timesheet(uuid)', 'timesheet_set_hours(uuid, date, numeric)', 'create_timesheet_from_task(uuid, uuid)']) {
      expect(c).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon;`);
      expect(c).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated;`);
    }
    expect(c).toMatch(/REVOKE ALL ON public\.project_timesheet_header FROM anon, authenticated;\s+GRANT SELECT, DELETE ON public\.project_timesheet_header TO authenticated;/);
    expect(c).toMatch(/GRANT SELECT ON public\.project_timesheet_lines_data_entered TO authenticated;/);
  });
});

describe('the rules the app mirrors', () => {
  it('the period: one month (today\'s) or at most 62 days', () => {
    expect(TIMESHEET_MAX_DAYS).toBe(62);
    expect(c).toContain('> 62 THEN');
    expect(c).toContain('timesheetOnlyCurrentMonthInputEnabled is on');
  });
  it('the switches: the Person, then the Organization, then the built-in default (false / true)', () => {
    expect(c).toContain("COALESCE(public.timesheet_setting(public.timesheet_user_person(), 'timesheetAllWorkCenterInputAvailable'), 'false') = 'true'");
    expect(c).toContain("COALESCE(public.timesheet_setting(public.timesheet_user_person(), 'timesheetOnlyCurrentMonthInputEnabled'), 'true') <> 'false'");
    expect(c).toMatch(/SELECT NULLIF\(p\."rowJSON"->>p_key, ''\) FROM public\."personTable"/);
    expect(c).toMatch(/SELECT NULLIF\(o\."rowJSON"->>p_key, ''\) FROM public\."organizationTable"/);
  });
  it('a normal task only (not a stage, not a milestone)', () => {
    expect(c).toContain("only a normal task can be chosen (not a stage, not a milestone)");
  });
  it('Post writes the ENTERED rows as used movements of the register, registrator timesheetHeader', () => {
    expect(c).toMatch(/INSERT INTO public\.project_status_movements/);
    expect(c).toContain("'used', ((d.\"timesheetDay\" + TIME '12:00') AT TIME ZONE 'UTC')");
    expect(c).toContain("'timesheetHeader'");
    expect(c).toContain('FROM public.project_timesheet_header h\n    JOIN public.project_timesheet_lines_data_entered d ON d."rowHeaderGUID" = h."rowGUID"');
  });
  it('never more than 24 hours a day: in the cell trigger and at Post over the posted sheets of the work center', () => {
    expect(c).toContain('IF v_others + NEW."timesheetHours" > 24 THEN');
    expect(c).toContain("'dayOver24'");
  });
  it('the Person of a user is made at login, by organization_ensure_user', () => {
    expect(c).toContain('CREATE OR REPLACE FUNCTION public.person_ensure_user(');
    expect(sqlPart(codeSql, 20)).toContain("to_regprocedure('public.person_ensure_user(text,text,text)') IS NOT NULL");
    expect(sqlPart(codeSql, 20)).toContain('PERFORM public.person_ensure_user(v_email,');
  });
  it('Monitor01 lists the entered hours of the posted sheets among the sources of Used', () => {
    expect(codeSql).toContain("'projectTimesheetLinesDataEntered'::text");
  });
});

describe('the cost of an hour in SQL (section 14)', () => {
  it('the line keeps where the price comes from, the price, its currency and the contract', () => {
    for (const col of ['"rateSource"', '"unitPrice"', '"unitPriceCurrency"', '"unitPriceContract"']) expect(t).toContain(col);
  });
  it('the working hours of a contract period are the constants of the TypeScript (taskLineContractCost.ts)', () => {
    expect(c).toContain("WHEN 'Day' THEN 8 WHEN 'Week' THEN 40 WHEN 'Month' THEN 168 WHEN 'Quarter' THEN 504 WHEN 'Year' THEN 2016");
    const ts = readFileSync('kit8/pm/view/task/finances/taskLineContractCost.ts');
    expect(ts).toContain('WORKING_HOURS_PER_DAY = 8');
    expect(ts).toContain('WORKING_DAYS_PER_WEEK = 5');
    expect(ts).toContain('WORKING_DAYS_PER_MONTH = 21');
  });
  it('the base currency is the key baseCurrency of the organization, else EUR', () => {
    expect(c).toContain("o.\"rowJSON\"->>'baseCurrency'");
    expect(c).toMatch(/NULLIF\(upper\(btrim\(\(SELECT o\."rowJSON"->>'baseCurrency'[\s\S]*'EUR'\)/);
  });
  it('the price list: the FIRST one that fits roles (appliesTo empty or with resourceRoleType), the rows with no variant, the latest validFrom', () => {
    expect(c).toContain("pt.\"rowJSON\"->'appliesTo' ? 'resourceRoleType'");
    expect(c).toContain('ORDER BY pt."orderInList", pt."rowGUID" LIMIT 1');
    expect(c).toContain("x.\"rowJSON\"->>'validFrom' DESC");
  });
  it('Post prices every entered cell (timesheet_cell_money) and names what is missing; the register uses the same function', () => {
    expect(c).toContain('timesheet_cell_money(r."rowGUID", c.day, c.hours)');
    expect(c).toContain('CROSS JOIN LATERAL public.timesheet_cell_money(l."rowGUID", d."timesheetDay", d."timesheetHours") m');
    for (const p of ['noContractRate', 'noRoleRate', 'noExchangeRate']) expect(c).toContain(`'${p}'`);
  });
  it('the unique key of a sheet is for COMPLETE lines only (any number of unfinished lines)', () => {
    expect(t).toContain('idx_project_timesheet_lines_key2');
    expect(t).toContain('WHERE "timesheetLineTask" IS NOT NULL AND "timesheetLineRole" IS NOT NULL');
  });
});

describe('the delete file drops PART 36 first, with its data', () => {
  it('the three tables, the sequence, the functions, person_ensure_user and the movements', () => {
    const part = del.slice(del.indexOf('-- PART 1a-0000: delete_timesheet.sql'), del.indexOf('-- PART 1a-000: delete_work_center.sql'));
    expect(part.length).toBeGreaterThan(500);
    for (const name of [TIMESHEET_ENTERED_TABLE, TIMESHEET_LINES_TABLE, TIMESHEET_HEADER_TABLE]) expect(part).toContain(`DROP TABLE IF EXISTS public.${name} CASCADE;`);
    expect(part).toContain('DROP SEQUENCE IF EXISTS public.project_timesheet_document_seq;');
    expect(part).toContain('DROP FUNCTION IF EXISTS public.person_ensure_user(text, text, text);');
    expect(part).toContain("s.\"rowRegistratorType\" = 'timesheetHeader'");
    expect(del.indexOf('-- PART 1a-0000:')).toBeLessThan(del.indexOf('-- PART 1a-000:'));
  });
  it('every function the code file creates in PART 36 is dropped', () => {
    const created = [...c.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(30);
    for (const name of created) expect(del).toContain(`DROP FUNCTION IF EXISTS public.${name}(`);
  });
});

describe('the redux entity of the list', () => {
  it('reads the header table; it is never made by the table', () => {
    const md = timesheetSystemMetaData();
    expect(Object.values(md)[0].tableName).toBe(TIMESHEET_HEADER_TABLE);
    expect(() => Object.values(md)[0].prepareCreateApi()).toThrow(/timesheet_create/);
  });
});
