// PART 40 of the SQL (the task templates): both structure files carry the part, the delete file drops it, the names the app calls exist, the organization can read.
// (Docker test on a real Postgres 15: kit8/docker/tests/98_task_template.sql - run ./test_fact_monitor01.sh 98.)
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';
import { pmRpcTaskTemplateFill, pmRpcTaskTemplateSave, pmRpcTaskTemplateSetTitle, taskTemplateHeaderTable } from '../../../kit8/pm/tasktemplate/model/taskTemplateTypes';

const tables40 = sqlPart(tablesSql, 40);
const code40 = sqlPart(codeSql, 40);
const del = readSql('delete_sql_structure.sql');

describe('the part is in both files', () => {
  it('PART 40 exists in both, after PART 39; the tables file has the four tables and no code, the code file has the code and no table', () => {
    for (const src of [tablesSql, codeSql]) expect(src.indexOf('-- PART 39:')).toBeLessThan(src.indexOf('-- PART 40:'));
    for (const t of ['task_template_header', 'task_template_task', 'task_template_dependency', 'task_template_line']) expect(tables40).toContain(`CREATE TABLE IF NOT EXISTS public.${t} (`);
    expect(tables40).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(code40).not.toMatch(/CREATE TABLE/);
    expect(code40).toContain('start2_sql_code.sql PART 40 needs the tables: run start1_sql_tables.sql first');
  });
  it('the names the app calls exist as RPCs, the table the app reads exists', () => {
    expect(code40).toContain(`FUNCTION public.${pmRpcTaskTemplateSave}(`);
    expect(code40).toContain(`FUNCTION public.${pmRpcTaskTemplateFill}(`);
    expect(code40).toContain(`FUNCTION public.${pmRpcTaskTemplateSetTitle}(`);
    expect(tables40).toContain(`public.${taskTemplateHeaderTable} (`);
  });
  it('the argument names are the ones the API sends', () => {
    expect(code40).toMatch(/task_template_save\(p_task uuid, p_title text, p_description text DEFAULT NULL\)/);
    expect(code40).toMatch(/task_template_fill\(p_template uuid, p_task uuid, p_replace boolean DEFAULT false\)/);
    expect(code40).toMatch(/task_template_set_title\(p_template uuid, p_title text, p_description text DEFAULT NULL\)/);
  });
});

describe('access: the whole organization reads, nobody writes but the RPCs', () => {
  it('RLS is on for the four tables and the select policies look at the organization of the user', () => {
    for (const t of ['task_template_header', 'task_template_task', 'task_template_dependency', 'task_template_line']) expect(code40).toContain(`ALTER TABLE public.${t}`);
    expect(code40).toContain('"rowOrganizationGUID" = public.organization_of_current_user()');
    expect(code40).toContain('public.task_template_visible("rowTemplateGUID")');
  });
  it('the client may only SELECT (and DELETE a header: the creator or the administrator); the RPCs are SECURITY DEFINER and not for anon', () => {
    expect(code40).toContain('GRANT SELECT, DELETE ON public.task_template_header TO authenticated;');
    expect(code40).toContain('GRANT SELECT ON public.task_template_task, public.task_template_dependency, public.task_template_line TO authenticated;');
    expect(code40).toMatch(/"rowOwnerGUID" = public.app_user_guid\(\) OR public.organization_is_admin\("rowOrganizationGUID"\)/);
    for (const fn of ['task_template_save(uuid, text, text)', 'task_template_fill(uuid, uuid, boolean)', 'task_template_set_title(uuid, text, text)']) {
      expect(code40).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon;`);
      expect(code40).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated;`);
    }
  });
});

describe('what is not copied', () => {
  it('the keys of ONE project are cut from the tasks, the posting state and the sums in the project currencies from the lines', () => {
    for (const k of ['startAt', 'manualStartAt', 'lastEditPlace', 'customColumns', 'taskIsSubproject', 'taskSubprojectGUID']) expect(code40).toContain(`- '${k}'`);
    for (const k of ['baseOfDistribution', 'sumForAccounting', 'sumForBudget', 'fxSnapshotTaskLine']) expect(code40).toContain(`- '${k}'`);
    expect(code40).toContain(`'{"taskIsPosted": false}'::jsonb`);
  });
});

describe('big templates', () => {
  it('a row with more than 5000 rows inside is refused at save', () => {
    expect(code40).toContain('v_max      constant int := 5000;');
    expect(code40).toContain("RAISE EXCEPTION 'task_template: the row has more than % rows inside it");
  });
  it('fill switches the per-row work of the project tables off (app.task_bulk) and does it once at the end; the three triggers it skips read the switch', () => {
    expect(code40).toContain("PERFORM set_config('app.task_bulk', 'on', true);");
    expect(code40).toContain("PERFORM set_config('app.task_bulk', 'off', true);");
    expect(code40).toContain('PERFORM public.pm_recalc_project_progress(v_target."projectGUID");');
    expect(code40).toContain('PERFORM public.pm_rebuild_dependency_closure(v_target."projectGUID");');
    for (const fn of ['pm_task_after_progress_change', 'pm_task_dependency_after_delete', 'user_calendar_project_task_sync']) {
      const body = codeSql.slice(codeSql.indexOf(`FUNCTION public.${fn}()`), codeSql.indexOf('$$;', codeSql.indexOf(`FUNCTION public.${fn}()`) + 40));
      expect(body).toContain("current_setting('app.task_bulk', true) = 'on'");
    }
    const dep = codeSql.slice(codeSql.indexOf('FUNCTION public.pm_task_dependency_before_insert()'));
    expect(dep.slice(0, dep.indexOf('$$;', 40))).toContain("current_setting('app.task_bulk', true) IS DISTINCT FROM 'on'");
  });
  it('the progress of a project is calculated through the index of the tree path, not through a CTE of the whole project (n x n)', () => {
    const fn = codeSql.slice(codeSql.indexOf('FUNCTION public.pm_recalc_project_progress('), codeSql.indexOf('$$;', codeSql.indexOf('FUNCTION public.pm_recalc_project_progress(') + 40));
    expect(fn).not.toContain('WITH rows AS');
    expect(fn).toContain('generate_series(2, nlevel(l."treePath") - 1)');
  });
  it('save reads the links and the lines through the rows of the template (indexed), the parent of a row from its path', () => {
    expect(code40).toContain('FROM public.task_template_task a\n    JOIN public.task_line_table l ON l."rowOwnerGUID" = a."rowGUID"');
    expect(code40).toContain("replace(subpath(t.\"treePath\", nlevel(t.\"treePath\") - 2, 1)::text, '_', '-')::uuid");
  });
});

describe('the delete file and the comment lines', () => {
  it('delete_sql_structure.sql drops the four tables and the functions, first of all parts', () => {
    expect(del).toContain('1a-00000000. delete_task_template.sql - PART 40');
    const part = del.slice(del.indexOf('-- PART 1a-00000000: delete_task_template.sql'), del.indexOf('-- PART 1a-0000000: delete_partner_balance.sql'));
    for (const t of ['task_template_line', 'task_template_dependency', 'task_template_task', 'task_template_header']) expect(part).toContain(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
    for (const f of ['task_template_save(uuid, text, text)', 'task_template_fill(uuid, uuid, boolean)', 'task_template_set_title(uuid, text, text)', 'task_template_visible(uuid)']) expect(part).toContain(`DROP FUNCTION IF EXISTS public.${f};`);
  });
  it('no comment line inside the part looks like a banner (the PART scans would take it for one)', () => {
    expect((code40 + '\n' + tables40).split('\n').filter((l) => /^-- PART \d+:/.test(l))).toHaveLength(2);
  });
});
