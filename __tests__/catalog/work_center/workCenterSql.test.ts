// SQL of the work center (PART 35 of start1_sql_tables.sql + start2_sql_code.sql, PART 1a-000 of delete_sql_structure.sql): the table, the trigger rules, Copy Variant settings, the kind
// 'workCenter' of a Time line and its capacity branches in PARTs 21-23. The behaviour itself is run on Postgres 15: kit8/docker/tests/35_work_center.sql.
import { codeSql, readSql, tablesSql } from '../../sql/sqlFilesTestKit';

const deleteSql = readSql('delete_sql_structure.sql');
const part = (src: string, n: number, next: number) => {
  const from = src.search(new RegExp(`^-- PART ${n}: `, 'm'));
  const rest = src.slice(from);
  const to = rest.search(new RegExp(`^-- PART ${next}: `, 'm'));
  return to > 0 ? rest.slice(0, to) : rest.slice(0, rest.search(/^-- END of /m) > 0 ? rest.search(/^-- END of /m) : undefined);
};
const tables35 = part(tablesSql, 35, 36);
const code35 = part(codeSql, 35, 36);

describe('PART 35 is in both files with the same title', () => {
  it('start1 has the table, start2 the code', () => {
    expect(tablesSql).toContain('-- PART 35: create_work_center.sql');
    expect(codeSql).toContain('-- PART 35: create_work_center.sql');
    expect(tables35).toContain('CREATE TABLE IF NOT EXISTS public."workCenterTable"');
    expect(code35).not.toMatch(/CREATE (UNLOGGED )?TABLE/);
  });
});

describe('workCenterTable', () => {
  it('has the generic columns, owner workCenterCatalog, the kind CHECK and the unique base per kind', () => {
    expect(tables35).toContain(`"rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'workCenterCatalog'`);
    expect(tables35).toContain(`CHECK ("rowJSON"->>'workCenterKind' IN ('person', 'equipment', 'partner'))`);
    expect(tables35).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_workCenterTable_base" ON public."workCenterTable" (("rowJSON"->>'workCenterKind'), ("rowJSON"->>'workCenterBase'))`);
  });
  it('is a catalog like the equipment: RLS + the standard setup, signed-in users, realtime', () => {
    expect(code35).toContain(`SELECT public.kit8_setup_def_table('workCenterTable')`);
    expect(code35).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated');
    expect(code35).toContain(`ALTER PUBLICATION supabase_realtime ADD TABLE public."workCenterTable"`);
  });
});

describe('the trigger work_center_check', () => {
  it('needs a kind, a base of that kind, a business unit; the folder and rowJSON.businessUnit are kept equal', () => {
    expect(code35).toContain('workCenterKind is required (person | equipment | partner)');
    expect(code35).toContain('workCenterBase is required');
    expect(code35).toContain('businessUnit is required');
    expect(code35).toContain(`NEW."rowParentGUID" := v_unit`);
    expect(code35).toContain(`jsonb_build_object('businessUnit', v_unit`);
    expect(code35).toContain('CREATE TRIGGER trg_workCenterTable_check BEFORE INSERT OR UPDATE ON public."workCenterTable"');
  });
  it('a Partner needs partnerIsSupplier, checked when the base is new (a flag removed later changes nothing); one base, one work center', () => {
    expect(code35).toContain(`x."rowJSON"->>'partnerIsSupplier' = 'true'`);
    expect(code35).toContain('IF v_changed THEN');
    expect(code35).toContain('is already the base of the work center');
  });
  it('the base variant is a variant of the base; the work center variant is made by the copy only', () => {
    expect(code35).toContain('is not a variant of the base');
    expect(code35).toContain('use Copy Variant settings');
  });
  it('never reads OLD on an INSERT (plpgsql: an unassigned record)', () => {
    const body = code35.slice(code35.indexOf('FUNCTION public.work_center_check()'), code35.indexOf('trg_workCenterTable_check BEFORE'));
    const lines = body.split('\n').map((l) => l.replace(/--.*$/, '')).filter((l) => /\bOLD\b/.test(l));
    for (const l of lines) expect(l).toMatch(/v_old\s*:=|v_old_parent\s*:=/);
  });
});

describe('Copy Variant settings', () => {
  it('is an RPC for signed-in users: refuses without a base variant, copies the variant row and its values, owned by the work center', () => {
    expect(code35).toContain('FUNCTION public.work_center_copy_variant_settings(p_work_center text, p_overwrite boolean DEFAULT false)');
    expect(code35).toContain('GRANT EXECUTE ON FUNCTION public.work_center_copy_variant_settings(text, boolean) TO authenticated');
    expect(code35).toContain('choose the base variant (workCenterBaseVariant) first');
    expect(code35).toContain('INSERT INTO public."variantTable"');
    expect(code35).toContain('INSERT INTO public."variantValueTable"');
  });
  it('an existing variant is overwritten only when the caller says so', () => {
    expect(code35).toContain('the work center has a variant already - confirm to overwrite it');
    expect(code35).toContain('IF NOT COALESCE(p_overwrite, false) THEN');
  });
  it('a work center that a Time line books is not deleted; its own variants go with it', () => {
    expect(code35).toContain('is booked by a Time line - deactivate it instead');
    expect(code35).toContain('CREATE TRIGGER trg_workCenterTable_delete BEFORE DELETE');
  });
});

describe('the kind workCenter of a Time line and its capacity (PARTs 17, 21, 22, 23)', () => {
  it('the CHECK of task_line_table allows it, for new databases (PART 17) and existing ones (PART 35 rebuilds the old check)', () => {
    expect(tablesSql).toContain(`IN ('person', 'equipment', 'workCenter')`);
    expect(tables35).toContain('pg_get_constraintdef(oid) NOT LIKE');
    expect(tables35).toContain('DROP CONSTRAINT task_line_resource_kind_chk');
  });
  it('the calendar of a work center is checked, guarded against deletion and locked like the other resources', () => {
    expect(codeSql.match(/ARRAY\['personTable', 'equipmentTable', 'workCenterTable', 'contractTable', 'templateResourceContractTable'\]/g)).toHaveLength(2);
    expect(codeSql).toContain(`FOREACH t IN ARRAY ARRAY['personTable', 'equipmentTable', 'workCenterTable'] LOOP`);
    expect(codeSql).toContain(`WHEN 'workCenterTable' THEN 'workCenter'`);
  });
  it('the capacity of a work center is its calendar, else the Standard work week (it has no contract)', () => {
    expect(codeSql).toContain(`p_kind NOT IN ('person', 'equipment', 'workCenter')`);
    expect(codeSql).toContain(`ELSIF p_kind = 'workCenter' THEN`);
    expect(codeSql).toContain(`FROM public."workCenterTable" x WHERE p_kind = 'workCenter' AND x."rowGUID" = p_guid`);
  });
  it('the cost budget gate knows the switch projectTimeOfPartnerNeeded (default off)', () => {
    expect(codeSql).toContain(`project_cost_flag(p_json, 'projectTimeOfPartnerNeeded', false)`);
  });
});

describe('PART 1a-000 of the delete file', () => {
  const undo = deleteSql.slice(deleteSql.indexOf('-- PART 1a-000:'), deleteSql.indexOf('-- PART 1a-00:'));
  it('runs first and does not use the pattern the numbering test scans', () => {
    expect(deleteSql.indexOf('-- PART 1a-000:')).toBeGreaterThan(0);
    expect(deleteSql.indexOf('-- PART 1a-000:')).toBeLessThan(deleteSql.indexOf('-- PART 1a-00:'));
    expect(undo).not.toMatch(/^-- PART \d+:/m);
    expect(deleteSql).toContain('1a-000. delete_work_center.sql');
  });
  it('drops the table with the variants the work centers own, the triggers and every work_center_ function', () => {
    expect(undo).toContain('DROP TABLE IF EXISTS public."workCenterTable" CASCADE');
    expect(undo).toContain('DELETE FROM public."variantTable" v WHERE v."rowOwnerGUID" IN (SELECT w."rowGUID" FROM public."workCenterTable" w)');
    const created = [...code35.matchAll(/CREATE OR REPLACE FUNCTION public\.(work_center_\w+)\(/g)].map((m) => m[1]);
    expect(created.sort()).toEqual(['work_center_base_title', 'work_center_check', 'work_center_copy_variant_settings', 'work_center_delete_guard', 'work_center_title_of']);
    for (const f of created) expect(undo).toContain(`DROP FUNCTION IF EXISTS public.${f}(`);
  });
});
