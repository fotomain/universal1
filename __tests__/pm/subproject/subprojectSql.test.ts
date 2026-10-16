// PART 29 of the SQL (subprojects): both files carry the part, the delete file drops it, the names the app calls exist. (Docker tests on a real Postgres 15: kit8/docker/tests/90_subprojects.sql.)
import { RPC_ORGANIZATION_HAS_SUBPROJECTS, RPC_SUBPROJECT_CANDIDATES, SUBPROJECT_LINK_TABLE } from '../../../kit8/pm/subproject/subprojectApi';
import { SUBPROJECT_ERRORS } from '../../../kit8/pm/subproject/subprojectModel';
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';

const del = readSql('delete_sql_structure.sql');
const tablesPart = sqlPart(tablesSql, 29);
const codePart = sqlPart(codeSql, 29);

describe('the part is in both files: the table in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 29 exists in both; the tables file has the table and no code, the code file has the code and no table', () => {
    expect(tablesPart).toContain(`CREATE TABLE IF NOT EXISTS public.${SUBPROJECT_LINK_TABLE} (`);
    expect(tablesPart).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(codePart).not.toMatch(/CREATE TABLE/);
    expect(codePart).toMatch(/CREATE OR REPLACE FUNCTION public\.subproject_sync_origin_task\(/);
  });
  it('it comes after PART 28 and before the end marker, in both', () => {
    for (const src of [tablesSql, codeSql]) {
      expect(src.indexOf('-- PART 28: create_purchase_order.sql')).toBeLessThan(src.indexOf('-- PART 29: create_subprojects.sql'));
      expect(src.indexOf('-- PART 29: create_subprojects.sql')).toBeLessThan(src.indexOf('-- END of start'));
    }
  });
  it('no column is added to an existing table: the settings are keys of rowJSON', () => {
    expect(tablesPart).not.toMatch(/ALTER TABLE/);
  });
});

describe('the names the app calls', () => {
  it('the RPCs of the screens are granted to authenticated', () => {
    for (const rpc of [RPC_SUBPROJECT_CANDIDATES, RPC_ORGANIZATION_HAS_SUBPROJECTS]) {
      expect(codePart).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
      expect(codePart).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
    }
  });
  it('every error code the app maps is raised by the SQL', () => {
    for (const code of Object.keys(SUBPROJECT_ERRORS)) expect(codePart).toContain(`${code}:`);
  });
  it('the table is read-only for the app: SELECT only, RLS, a policy, realtime', () => {
    expect(codePart).toContain(`GRANT SELECT ON public.${SUBPROJECT_LINK_TABLE} TO authenticated`);
    expect(codePart).toContain(`ALTER TABLE public.${SUBPROJECT_LINK_TABLE} ENABLE ROW LEVEL SECURITY`);
    expect(codePart).toContain(`ADD TABLE public.${SUBPROJECT_LINK_TABLE}`);
    expect(codePart).not.toMatch(new RegExp(`GRANT (INSERT|UPDATE|DELETE)[^;]*${SUBPROJECT_LINK_TABLE}`));
  });
});

describe('the settings keys of the SQL are the keys of the app', () => {
  it.each([
    'subprojectsFunctionalityEnabled', 'autoChangeOriginTaskBasedOnSubprojects', 'autoChangeStartAndFinishDatesForOriginTask',
    'aggregateTimeFromSubprojectToTheOriginTask', 'aggregateMaterialFromSubprojectToTheOriginTask', 'aggregateExpenceFromSubprojectToTheOriginTask', 'taskIsSubproject', 'taskSubprojectGUID',
  ])('%s', (key) => expect(codePart).toContain(key));
  it('the defaults: the master switch and the three aggregate switches are false when missing, the follow and dates switches true', () => {
    expect(codePart).toContain("subproject_setting(p_project, 'autoChangeOriginTaskBasedOnSubprojects', true)");
    expect(codePart).toContain("subproject_setting(p_project, 'autoChangeStartAndFinishDatesForOriginTask', true)");
    expect(codePart).toContain("subproject_setting(p_project, 'aggregateTimeFromSubprojectToTheOriginTask', false)");
    expect(codePart).toContain("subproject_setting(p_project, 'aggregateMaterialFromSubprojectToTheOriginTask', false)");
    expect(codePart).toContain("subproject_setting(p_project, 'aggregateExpenceFromSubprojectToTheOriginTask', false)");
    expect(codePart).toContain('"subprojectsFunctionalityEnabled": true');
  });
});

describe('the hooks into the older parts', () => {
  it('pm_apply_schedule propagates the dates, create_task_line_plan refuses a cycle, monitor01_apply queues the origin tasks, refresh_now covers them, the drill-down follows', () => {
    expect(codeSql).toContain('PERFORM public.subproject_propagate_dates(p_project_guid, 0)');
    expect(codeSql).toContain('PERFORM public.subproject_assert_no_cycle(v_project)');
    expect(codeSql).toContain('PERFORM public.subproject_queue_origins(p_tasks)');
    expect(codeSql).toContain('FROM public.project_subproject_link k) x');
    expect(codeSql).toContain("public.subproject_drill_match(f->>'taskGUID'");
  });
  it('monitor01_fresh_rows is replaced AFTER PART 25 (a SQL function cannot call a function that does not exist yet)', () => {
    const i = codeSql.lastIndexOf('CREATE OR REPLACE FUNCTION public.monitor01_fresh_rows(');
    expect(i).toBeGreaterThan(codeSql.indexOf('-- PART 29: create_subprojects.sql'));
    expect(codeSql.slice(i, i + 3000)).toContain('subproject_agg_sources');
  });
});

describe('the delete file drops what PART 29 made', () => {
  it('the table, the triggers, every function', () => {
    expect(del).toContain(`DROP TABLE IF EXISTS public.${SUBPROJECT_LINK_TABLE} CASCADE`);
    const made = Array.from(codePart.matchAll(/CREATE OR REPLACE (?:FUNCTION|PROCEDURE) public\.(\w+)\(/g)).map((m) => m[1]).filter((n) => n !== 'monitor01_fresh_rows');
    expect(made.length).toBeGreaterThan(15);
    for (const fn of made) expect(del).toContain(`DROP FUNCTION IF EXISTS public.${fn}(`);
    const triggers = Array.from(codePart.matchAll(/CREATE TRIGGER (\w+)/g)).map((m) => m[1]).filter((t) => t !== 'trg_project_subproject_link_touch');
    expect(triggers.length).toBeGreaterThanOrEqual(7);
    for (const trg of triggers) expect(del).toContain(`DROP TRIGGER IF EXISTS ${trg} ON`);
  });
});
