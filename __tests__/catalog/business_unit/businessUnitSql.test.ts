// The business unit SQL (PART 18 of kit8/sql/start/start1_sql_structure.sql, PART 15 of delete_sql_structure.sql) against the model: the same tables, the same
// seed, the same rules, the same files. (The SQL itself is run on a real Postgres 15 by kit8/docker/test_sql.sh; start2_sql_code.sql + start5_sql_upsert_all.sql are the
// same part cut in two and must hold it too.)
import fs from 'fs';
import path from 'path';
import { CFR_TYPE_SEED } from '../../../kit8/catalog/business_unit/cfrTypeModel';
import { unitRows } from './businessUnitTestKit';

const dir = path.join(__dirname, '../../../kit8/sql/start');
const start = fs.readFileSync(path.join(dir, 'start1_sql_structure.sql'), 'utf8');
const code = fs.readFileSync(path.join(dir, 'start2_sql_code.sql'), 'utf8');
const data = fs.readFileSync(path.join(dir, 'start5_sql_upsert_all.sql'), 'utf8');
const insert = fs.readFileSync(path.join(dir, 'start3_sql_insert_missing.sql'), 'utf8');
const del = fs.readFileSync(path.join(dir, 'delete_sql_structure.sql'), 'utf8');
const part = start.slice(start.indexOf('-- PART 18: create_business_unit_tables.sql'));
const insertPart = insert.slice(insert.indexOf('-- PART 18: create_business_unit_tables.sql'));       // the seed rows (start3_sql_insert_missing.sql)
const codePart = code.slice(code.indexOf('-- PART 18: create_business_unit_tables.sql'));
const delPart = del.slice(del.indexOf('-- PART 15: delete_business_unit_tables.sql'), del.indexOf('-- PART 16:'));

describe('the structure file', () => {
  it('has the part and lists it', () => {
    expect(start).toContain('18. create_business_unit_tables.sql');
    expect(part).toContain('CREATE TABLE IF NOT EXISTS public."cfrTypeTable"');
    expect(part).toContain('CREATE TABLE IF NOT EXISTS public."businessUnitTable"');
  });
  it('the enumeration: the 4 values with the flags of the model; read only (SELECT only, a trigger refuses a write)', () => {
    for (const s of CFR_TYPE_SEED) {
      const line = insertPart.split('\n').find((l) => l.includes(`('${s.value}',`))!;
      expect(line).toContain(`"acceptsCosts": ${s.acceptsCosts}`);
      expect(line).toContain(`"acceptsRevenues": ${s.acceptsRevenues}`);
    }
    expect(part).toContain("GRANT SELECT ON public.%I TO authenticated");
    expect(part).toContain('trg_cfrTypeTable_readonly');
    expect(part).toContain("current_user NOT IN ('postgres', 'supabase_admin')");
    expect(part).toContain("cfrTypeTable is an enumeration");
  });
  it('the units: the 29 of the document, each parent before its child; the guards', () => {
    expect(unitRows()).toHaveLength(29);
    for (const g of ['the parent "%" does not exist', 'a loop', 'cannot be its own parent', 'is not a value of cfrTypeTable', 'Deactivate it instead', 'posted day(s) of this unit']) expect(part).toContain(g);
    expect(part).toContain('kit8_business_unit_cfr');
    expect(part).toContain('kit8_cfr_accepts');
  });
  it('businessUnitAssigned: the six catalogs, the line and the four project centers are checked', () => {
    for (const t of ['budgetItemTable', 'resourceRoleTable', 'contractTable', 'personTable', 'equipmentTable', 'productTable']) expect(part).toContain(`'${t}'`);
    expect(part).toContain("kit8_check_business_unit_ref('businessUnitTaskLine')");
    expect(part).toContain("'projectCostCenter:cost', 'projectRevenueCenter:revenue', 'projectProfitCenter=profitCenter', 'projectInvestmentCenter=investmentCenter'");
  });
  it('Post: create_task_line_plan refuses a cost on a revenue center and keeps the unit and the kind ON THE POSTED DAYS', () => {
    const plan = start.slice(start.indexOf('-- PART 15: create_task_line_plan_table.sql'), start.indexOf('-- PART 16:'));
    expect(plan).toContain('kit8_cfr_accepts(public.kit8_business_unit_cfr(v_unit), v_kind)');
    expect(plan).toContain("cannot be posted to the business unit");
    expect(plan).toContain("jsonb_build_object('businessUnitAssigned', to_jsonb(v_unit), 'budgetKind', to_jsonb(v_kind))");
    expect(plan).toContain("costsGenus' THEN 'cost' WHEN 'revenuesGenus' THEN 'revenue'");
  });
  it('the Departments catalog is gone from the structure (only the delete file still drops an old table)', () => {
    expect(start).not.toMatch(/CREATE TABLE IF NOT EXISTS public\."departamentTable"/);
    expect(code).not.toMatch(/CREATE TABLE IF NOT EXISTS public\."departamentTable"/);
    expect(del).toContain('DROP TABLE IF EXISTS public."departamentTable"');
  });
});

describe('the delete file', () => {
  it('drops the tables, the functions and the triggers; runs BEFORE the helper kit8_touch_updated_at is dropped', () => {
    expect(del).toContain('15. delete_business_unit_tables.sql');
    for (const g of ['DROP TABLE IF EXISTS public."businessUnitTable"', 'DROP TABLE IF EXISTS public."cfrTypeTable"', 'DROP FUNCTION IF EXISTS public.kit8_cfr_accepts', 'DROP FUNCTION IF EXISTS public.kit8_business_unit_guard', 'trg_project_table_business_unit']) expect(delPart).toContain(g);
    expect(del.indexOf('PART 15: delete_business_unit_tables.sql')).toBeLessThan(del.indexOf('DROP FUNCTION IF EXISTS public.kit8_touch_updated_at()'));
  });
  it('the parts are numbered one after the other', () => {
    const nums = Array.from(del.matchAll(/^-- PART (\d+):/gm)).map((m) => Number(m[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
});

describe('start2_sql_code.sql + start5_sql_upsert_all.sql hold the same part, cut in two', () => {
  it('the code file: the tables, the functions, the triggers, the Post check; no seed rows', () => {
    expect(codePart.length).toBeGreaterThan(0);
    for (const g of ['CREATE TABLE IF NOT EXISTS public."cfrTypeTable"', 'CREATE TABLE IF NOT EXISTS public."businessUnitTable"', 'kit8_business_unit_guard', 'kit8_check_business_unit_ref', "ARRAY['cfrTypeTable', 'businessUnitTable']"]) expect(codePart).toContain(g);
    expect(codePart).not.toMatch(/\('bu_enterprise1'/);
    expect(code).toContain('kit8_cfr_accepts(public.kit8_business_unit_cfr(v_unit), v_kind)');
    expect(code).toContain("'businessUnitAssigned', to_jsonb(v_unit)");
  });
  it('the data file: the 4 values and the 29 units as upserts', () => {
    // up to the next part (PART 19 = budget scenarios)
    const from = data.indexOf('Business units (PART 18');
    const to = data.indexOf('Budget scenarios (PART 19');
    const tail = data.slice(from, to > from ? to : undefined);
    expect(tail).toContain('INSERT INTO public."cfrTypeTable"');
    expect(tail).toContain('INSERT INTO public."businessUnitTable"');
    expect((tail.match(/DO UPDATE SET/g) || []).length).toBe(2);
    expect((tail.match(/\('bu_[a-z0-9]+',/g) || []).length).toBe(29);
    for (const s of CFR_TYPE_SEED) expect(tail).toContain(`('${s.value}',`);
  });
});
