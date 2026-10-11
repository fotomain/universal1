// task_line_plan - the SQL file against the rules of the documents "W1 Post Task" and "0333 Effect" (the file is also run on a real PostgreSQL 15
// when it changes: 100.00 on 3 days = 33.33 + 33.33 + 33.34, 0.01 on 3 days = 0.00 + 0.00 + 0.01, 100.00 on 7 days ends with 14.26).
import * as fs from 'fs';
import * as path from 'path';

const dir = path.join(__dirname, '../../../../../kit8/sql');
const sql = fs.readFileSync(path.join(dir, 'init/create_task_line_plan_table.sql'), 'utf8');
const all = fs.readFileSync(path.join(dir, 'run_fresh_data.sql'), 'utf8');

describe('the table', () => {
  it('has the structure of the document: project / task / LINE, the period, the coefficient, the three amounts rounded to 2 digits', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.task_line_plan');
    expect(sql).toMatch(/"rowProjectGUID"\s+UUID\s+NOT NULL REFERENCES public.project_table\("rowGUID"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/"rowOwnerGUID"\s+UUID\s+NOT NULL REFERENCES public.project_task_table\("rowGUID"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/"rowParentGUID"\s+UUID\s+NOT NULL REFERENCES public.task_line_table\("rowGUID"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/"rowPeriodDatetime"\s+TIMESTAMPTZ\s+NOT NULL/);
    expect(sql).toMatch(/"rowCoefficient"\s+NUMERIC\(14,10\)/);
    for (const col of ['qtyTaskLine', 'sumForBudget', 'sumForContract']) expect(sql).toMatch(new RegExp(`"${col}"\\s+NUMERIC\\(18,2\\)`));
    expect(sql).toContain('UNIQUE ("rowParentGUID", "rowPeriodDatetime")');
  });
  it('the app only reads it: a select policy, no insert / update / delete', () => {
    expect(sql).toContain('GRANT SELECT ON public.task_line_plan TO authenticated');
    expect(sql).not.toMatch(/CREATE POLICY task_line_plan_(insert|update|delete)/);
  });
});

describe('create_task_line_plan(taskLinePlanJSON) - ONE transaction', () => {
  it('is a single plpgsql function taking the JSON, owner checked, task locked', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_task_line_plan("taskLinePlanJSON" jsonb) RETURNS jsonb');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('public.pm_owns_project(v_project)');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.create_task_line_plan(jsonb) TO authenticated');
  });
  it('replaces the earlier rows, multiplies and rounds to 2 digits', () => {
    expect(sql).toContain('DELETE FROM public.task_line_plan WHERE "rowOwnerGUID" = v_task');
    expect(sql).toMatch(/round\(\(v_line->>'sumForBudget'\)::numeric\s+\* round\(\(e\.value->>'c'\)::numeric, 10\), 2\)/);
  });
  it('Correct033: the difference goes to the LAST row with a non-zero coefficient - coefficients and the three amounts, and is verified', () => {
    expect(sql).toContain('ORDER BY (p."rowCoefficient" > 0) DESC, p."rowPeriodDatetime" DESC LIMIT 1');
    expect(sql).toContain("FOREACH v_col IN ARRAY ARRAY['qtyTaskLine', 'sumForBudget', 'sumForContract']");
    expect(sql).toContain('v_diff := v_total - v_sum');
    expect(sql).toContain('UPDATE public.task_line_plan SET "rowCoefficient" = "rowCoefficient" + v_diff');
    expect(sql).toMatch(/abs\(v_diff\) > v_n \* 0\.005/); // more than the rounding can lose = a bug, not a rounding
    expect(sql).toContain('adds up to %, not to %'); // the verification
  });
  it('marks the lines posted with the base of the distribution (a merge: no other key is lost)', () => {
    expect(sql).toContain("jsonb_build_object('taskIsPosted', true, 'baseOfDistribution'");
    expect(sql).toContain('l."rowJSON" ||');
  });
  it('a change of the start / finish DAY of the task unposts its lines', () => {
    expect(sql).toContain('CREATE TRIGGER trg_task_line_plan_unpost_on_dates');
    expect(sql).toContain('AFTER UPDATE OF "rowJSON", "rowDuration" ON public.project_task_table');
    expect(sql).toContain("'{\"taskIsPosted\": false}'");
  });
});

describe('the files around it', () => {
  it('the delete file, run_fresh_data.sql and the order of RUN_ORDER.md', () => {
    expect(fs.existsSync(path.join(dir, 'init/delete_task_line_plan_table.sql'))).toBe(true);
    expect(all).toContain('CREATE OR REPLACE FUNCTION public.create_task_line_plan');
    expect(all.indexOf('create_pm_task_line_table.sql')).toBeLessThan(all.indexOf('CREATE TABLE IF NOT EXISTS public.task_line_plan'));
    expect(all.indexOf('CREATE TABLE IF NOT EXISTS public."managementCalendarTable"')).toBeLessThan(all.indexOf('CREATE TABLE IF NOT EXISTS public.task_line_plan'));
    expect(fs.readFileSync(path.join(dir, 'init/RUN_ORDER.md'), 'utf8')).toContain('create_task_line_plan_table.sql');
  });
});
