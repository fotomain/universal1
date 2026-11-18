// SQL PART 53 (documentation/RESOURCE_LEVELING_HOURS_WBS.html) as TEXT: where things live. The behaviour is tested by Docker: kit8/docker/tests/101_time_of_day.sql and 102_time_of_day_post.sql.
import * as fs from 'fs';
import * as path from 'path';
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const t53 = sqlPart(tablesSql, 53);
const c53 = sqlPart(codeSql, 53);
const del = readSql('delete_sql_structure.sql');
const dockerDir = path.join(__dirname, '../../kit8/docker/tests');

describe('PART 53 tables (start1): only the hour table', () => {
  it('task_line_plan_hour_movements is a table of the structure file, with the slice rules', () => {
    expect(t53).toContain('CREATE TABLE IF NOT EXISTS public.task_line_plan_hour_movements');
    expect(t53).toContain('task_line_plan_hour_movements_minutes_chk');
    expect(t53).toContain('UNIQUE ("rowParentGUID", "periodDay", "minuteFrom")');
    for (const col of ['periodDay', 'minuteFrom', 'minuteTo', 'periodStart', 'periodEnd', 'minutes', 'rowCoefficient', 'qtyTaskLine', 'resourceKind', 'resourceGUID', 'planMovementStatus']) expect(t53).toContain(`"${col}"`);
  });
  it('no function, trigger, policy or grant in the tables file part', () => {
    expect(t53).not.toMatch(/^\s*CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY|VIEW)/m);
    expect(t53).not.toMatch(/^\s*(GRANT|REVOKE) /m);
  });
});

describe('PART 53 code (start2)', () => {
  it('the functions of the plan', () => {
    for (const f of ['hm_clock_minutes', 'organization_calendar_day_windows', 'organization_resource_capacity_windows', 'organization_calendar_day_windows_check', 'project_task_hour_keys_check',
      'project_resource_leveling_inputs_hours', 'task_line_plan_hours_write', 'organization_resource_busy_check_hours']) {
      expect(c53).toContain(`CREATE OR REPLACE FUNCTION public.${f}(`);
    }
  });
  it('the hour rows: owner reads, nobody writes by hand; the writer is not callable from outside', () => {
    expect(c53).toContain('ALTER TABLE public.task_line_plan_hour_movements ENABLE ROW LEVEL SECURITY');
    expect(c53).toContain('GRANT SELECT ON public.task_line_plan_hour_movements TO authenticated');
    expect(c53).toContain('REVOKE ALL ON FUNCTION public.task_line_plan_hours_write(uuid, uuid, uuid, text, jsonb, numeric, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated');
  });
  it('the triggers: the windows of a day and the minute keys of a task', () => {
    expect(c53).toContain('trg_management_calendar_day_windows BEFORE INSERT OR UPDATE OF "rowJSON" ON public."managementCalendarDaysTable"');
    expect(c53).toContain('trg_project_task_hour_keys_chk BEFORE INSERT OR UPDATE OF "rowJSON" ON public.project_task_table');
  });
  it('the inputs of an hour run are guarded by the project permission and read no title', () => {
    const f = /CREATE OR REPLACE FUNCTION public\.project_resource_leveling_inputs_hours\([\s\S]*?\n\$\$;/.exec(c53)![0];
    expect(f).toContain("perm_can_in('project_resource_leveling_run', 'R', p_project)");
    expect(f).not.toContain('taskDescription');
  });
});

describe('PART 42 / PART 15 changed in place for the time-of-day model', () => {
  it('apply / clear / undo write and read the key that the run says (days or minutes)', () => {
    expect(codeSql).toContain("p_run->'options'->>'delayUnit' = 'minutes' THEN 'taskLevelingDelayMinutes'");
    expect(codeSql).toContain(`t."rowJSON" - 'taskLevelingDelayDays' - 'taskLevelingDelayMinutes' FROM pg_temp.prl_clear`);
    expect(codeSql).toContain(`"runOptions"->>'delayUnit' = 'minutes' THEN 'taskLevelingDelayMinutes'`);
  });
  it('the server plan takes a problem v = 2 on the virtual axis and keeps v = 1', () => {
    expect(codeSql).toContain("COALESCE(p_problem->>'v', '') NOT IN ('1', '2')");
    expect(codeSql).toContain("app.prl_max_search");
  });
  it('a template does not keep the delay in minutes', () => {
    expect(codeSql).toContain("- 'taskLevelingDelayDays' - 'taskLevelingDelayMinutes' - 'taskConstraintDate'");
  });
  it('Post writes the slices only for a project in the time-of-day model and checks the minutes there', () => {
    const post = /CREATE OR REPLACE FUNCTION public\.create_task_line_plan\([\s\S]*?\n\$\$;/.exec(codeSql)![0];
    expect(post).toContain("= 'hourByHourModel' INTO v_hourmodel");
    expect(post).toContain('IF v_hourmodel AND jsonb_typeof(v_line->\'hours\') = \'array\'');
    expect(post).toContain('organization_resource_busy_check_hours(v_task, v_org)');
    expect(post).toContain('organization_resource_busy_check(v_task, v_org)'); // the day check stays for every other project
    expect(post).toContain('DELETE FROM public.task_line_plan_hour_movements WHERE "rowOwnerGUID" = v_task');
  });
});

describe('the other files', () => {
  it('the delete file drops the part first (the newest) and numbers it', () => {
    expect(del).toContain('PART 1a-00000000000000000000: delete_time_of_day_model.sql');
    expect(del.indexOf('PART 1a-00000000000000000000:')).toBeLessThan(del.indexOf('PART 1a-0000000000000000000:'));
    expect(del).toContain('DROP TABLE IF EXISTS public.task_line_plan_hour_movements CASCADE');
  });
  it('the Docker tests of the part exist', () => {
    expect(fs.existsSync(path.join(dockerDir, '101_time_of_day.sql'))).toBe(true);
    expect(fs.existsSync(path.join(dockerDir, '102_time_of_day_post.sql'))).toBe(true);
  });
});
