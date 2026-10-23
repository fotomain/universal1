// PART 37 of the SQL (the payment plan): the tables file and the code file carry the same part, the delete file drops it, the names the app calls exist, and the rules the app mirrors are in the code.
// (Docker test on a real Postgres 15: kit8/docker/tests/95_payment_plan.sql - run ./test_fact_monitor01.sh 95.)
import { codeSql, readSql, sqlPart, tablesSql } from '../../../../sql/sqlFilesTestKit';
import { rpcPostTaskPaymentPlan, rpcUnpostTaskPaymentPlan, taskPaymentPlanMovementsTable, taskPaymentPlanTable } from '../../../../../kit8/pm/view/task/payments/paymentPlanModel';
import { PAYMENT_POST_PROBLEM_TEXT } from '../../../../../kit8/pm/view/task/payments/paymentPlanApi';
import { taskPaymentPlanSystemMetaData } from '../../../../../kit8/pm/view/task/payments/paymentPlanMetaData';

const del = readSql('delete_sql_structure.sql');
const t = sqlPart(tablesSql, 37);
const c = sqlPart(codeSql, 37);

describe('PART 37 is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('after PART 36; the tables file has the two tables and no code, the code file has the code and no table', () => {
    for (const src of [tablesSql, codeSql]) expect(src.indexOf('-- PART 36:')).toBeLessThan(src.indexOf('-- PART 37:'));
    for (const name of [taskPaymentPlanTable, taskPaymentPlanMovementsTable]) expect(t).toContain(`CREATE TABLE IF NOT EXISTS public.${name} (`);
    expect(t).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(t).not.toMatch(/\bINSERT INTO\b/);
    expect(c).not.toMatch(/CREATE TABLE/);
  });
  it('the code file refuses to run without the tables', () => {
    expect(c).toContain("to_regclass('public.task_payment_plan_lines') IS NULL");
    expect(c).toContain('PART 37 needs the tables: run start1_sql_tables.sql first');
  });
  it('the numbers at the top of both files list PART 37', () => {
    for (const src of [tablesSql, codeSql]) expect(src.slice(0, src.indexOf('-- PART 1:'))).toMatch(/^--\s+37\. create_payment_plan\.sql/m);
  });
});

describe('the table of the payments', () => {
  it('a payment belongs to a task (cascade) and a project; the direction is the parent; the guards are CHECKs', () => {
    expect(t).toContain('REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE');
    expect(t).toContain(`CHECK ("rowParentGUID" IN ('inbound', 'outbound'))`);
    for (const chk of ['task_payment_plan_shift_chk', 'task_payment_plan_anchor_chk', 'task_payment_plan_payee_chk', 'task_payment_plan_person_dir_chk', 'task_payment_plan_date_chk', 'task_payment_plan_sum_chk', 'task_payment_plan_currency_chk']) expect(t).toContain(chk);
    expect(t).toContain("IN ('', 'taskStart', 'taskEnd')");
    expect(t).toContain(`("rowJSON"->>'paymentPlanTimelineShiftDays')::numeric >= 0`);
  });
  it('a movement is unique per payment and cascades with it', () => {
    expect(t).toContain('REFERENCES public.task_payment_plan_lines("rowGUID") ON DELETE CASCADE');
    expect(t).toContain('task_payment_plan_movements_line_uq UNIQUE ("rowParentGUID")');
  });
});

describe('the code', () => {
  it('RLS by the owner of the project; the client can only READ the movements', () => {
    expect(c).toContain('ALTER TABLE public.task_payment_plan_lines ENABLE ROW LEVEL SECURITY');
    expect(c).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_payment_plan_lines TO authenticated');
    expect(c).toContain('GRANT SELECT ON public.task_payment_plan_movements TO authenticated');
    expect(c).toContain('public.pm_owns_project("rowProjectGUID")');
  });
  it('the RPCs the app calls exist and are granted to signed-in users only', () => {
    expect(c).toContain(`CREATE OR REPLACE FUNCTION public.${rpcPostTaskPaymentPlan}(p_task uuid, p_task_start date, p_task_end date)`);
    expect(c).toContain(`CREATE OR REPLACE FUNCTION public.${rpcUnpostTaskPaymentPlan}(p_task uuid)`);
    expect(c).toContain('GRANT EXECUTE ON FUNCTION public.post_task_payment_plan(uuid, date, date) TO authenticated');
    expect(c).toContain('REVOKE ALL ON FUNCTION public.post_task_payment_plan(uuid, date, date) FROM PUBLIC, anon');
  });
  it('every problem the app has a sentence for is a problem Post can answer, and the other way round', () => {
    const post = c.slice(c.indexOf('CREATE OR REPLACE FUNCTION public.post_task_payment_plan'), c.indexOf('CREATE OR REPLACE FUNCTION public.unpost_task_payment_plan'));
    const inSql = [...post.matchAll(/\('(\w+Missing|budgetItemNotPayment|dateBeforeTaskStart|dateAfterTaskEnd)',/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual(Object.keys(PAYMENT_POST_PROBLEM_TEXT).sort());
  });
  it('Post is all or nothing and writes the movements in the same transaction as the flag', () => {
    expect(c).toContain("'status', 'refused'");
    expect(c).toContain("PERFORM set_config('app.payment_plan_post', 'on', true)");
    expect(c).toContain(`'{"paymentIsPosted": true, "paymentEverPosted": true}'`);
  });
  it('a changed payment is unposted, the budget item must be of the payments genus, a moved task unposts its payments', () => {
    expect(c).toContain("(OLD.\"rowJSON\" - 'paymentIsPosted') IS DISTINCT FROM (NEW.\"rowJSON\" - 'paymentIsPosted')");
    expect(c).toContain("'inboundPaymentGenus' ELSE 'outboundPaymentGenus'");
    expect(c).toContain('CREATE TRIGGER trg_task_payment_plan_unpost_on_dates');
    expect(c).toContain('AFTER UPDATE OF "rowJSON", "rowDuration" ON public.project_task_table');
  });
  it('the project switch reads TRUE unless it is stored false', () => {
    expect(c).toContain("p.\"rowJSON\"->>'paymentPlanAfterTaskFinishEnabled' IS DISTINCT FROM 'false'");
  });
});

describe('the delete file drops PART 37 first, with its data', () => {
  const part = del.slice(del.indexOf('-- PART 1a-00000: delete_payment_plan.sql'), del.indexOf('-- PART 1a-0000: delete_timesheet.sql'));
  it('both tables, the trigger on the tasks and the functions', () => {
    expect(part.length).toBeGreaterThan(300);
    for (const name of [taskPaymentPlanMovementsTable, taskPaymentPlanTable]) expect(part).toContain(`DROP TABLE IF EXISTS public.${name} CASCADE;`);
    expect(part).toContain('DROP TRIGGER IF EXISTS trg_task_payment_plan_unpost_on_dates ON public.project_task_table;');
    expect(del.indexOf('-- PART 1a-00000:')).toBeLessThan(del.indexOf('-- PART 1a-0000:'));
  });
  it('every function the code file creates in PART 37 is dropped', () => {
    const created = [...c.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBe(5);
    for (const name of created) expect(part).toContain(`DROP FUNCTION IF EXISTS public.${name}(`);
  });
});

describe('the redux entity', () => {
  it('reads the table of the payments', () => {
    expect(Object.values(taskPaymentPlanSystemMetaData())[0].tableName).toBe(taskPaymentPlanTable);
  });
});
