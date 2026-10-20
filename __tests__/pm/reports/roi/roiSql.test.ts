// The SQL of ROI (PARTs 33 + 34) read as text: the pieces are in the right files, the register learns the Revenue lines, the hook into the worker is isolated, the rules agree with the app, the undo part.
// (The SQL itself runs on a real Postgres 15: kit8/docker/tests/92_roi.sql via test_fact_monitor01.sh.)
import { ROI_MONEY_KEYS } from '../../../../kit8/pm/reports/roi/roiModel';
import { PMProjectRoiValues, roiValuesOf } from '../../../../kit8/pm/reports/roi/roiSettings';
import { codeSql, readSql, sqlPart, tablesSql } from '../../../sql/sqlFilesTestKit';

const deleteSql = readSql('delete_sql_structure.sql');
const part33 = sqlPart(codeSql, 33);
const part34 = sqlPart(codeSql, 34);

describe('the tables are in start1, the code in start2, as PART 33 (ROI) and PART 34 (history)', () => {
  it('PART 33 and 34 come after PART 32 in both files', () => {
    for (const src of [tablesSql, codeSql]) {
      expect(src.search(/^-- PART 33: /m)).toBeGreaterThan(src.search(/^-- PART 32: /m));
      expect(src.search(/^-- PART 34: /m)).toBeGreaterThan(src.search(/^-- PART 33: /m));
    }
  });
  it('start1 has the three tables, start2 none', () => {
    for (const t of ['project_status_roi_task_month', 'project_status_month_totals', 'project_status_roi_history']) {
      expect(tablesSql).toContain(`CREATE TABLE IF NOT EXISTS public.${t}`);
      expect(codeSql).not.toContain(`CREATE TABLE IF NOT EXISTS public.${t}`);
    }
  });
  it('each table has the 15 components of the app as NUMERIC(18,2), in the same names', () => {
    for (const t of ['project_status_roi_task_month', 'project_status_month_totals', 'project_status_roi_history']) {
      const from = tablesSql.indexOf(`CREATE TABLE IF NOT EXISTS public.${t}`);
      const ddl = tablesSql.slice(from, tablesSql.indexOf(');', from));
      for (const k of ROI_MONEY_KEYS) expect(ddl).toMatch(new RegExp(`"${k}"\\s+NUMERIC\\(18,2\\) NOT NULL DEFAULT 0`));
    }
  });
  it('the keys: the task row by (task, month) with a cascade; the month by (project, month); the history by (project, day)', () => {
    expect(tablesSql).toContain('"rowOwnerGUID"             UUID          NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE');
    expect(tablesSql).toContain('PRIMARY KEY ("rowOwnerGUID", "rowTurnoverMonth")');
    expect(tablesSql).toContain('PRIMARY KEY ("rowProjectGUID", "rowTurnoverMonth")');
    expect(tablesSql).toContain('PRIMARY KEY ("rowProjectGUID", "rowSnapshotDay")');
  });
  it('no ratio is stored anywhere: no roi1 .. roi4 column in a table', () => {
    for (const t of ['project_status_roi_task_month', 'project_status_month_totals', 'project_status_roi_history']) {
      const from = tablesSql.indexOf(`CREATE TABLE IF NOT EXISTS public.${t}`);
      const ddl = tablesSql.slice(from, tablesSql.indexOf(');', from));
      expect(ddl).not.toMatch(/"roi\d"/);
    }
  });
});

describe('the register learns the Revenue lines; Monitor01 does not', () => {
  it('the plan and the fact registration take the Revenue genus too', () => {
    const plan = codeSql.slice(codeSql.indexOf('FUNCTION public.project_status_register_plan('), codeSql.indexOf('REVOKE ALL ON FUNCTION public.project_status_register_plan'));
    expect((plan.match(/'timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'/g) || []).length).toBe(2);
    const fact = codeSql.slice(codeSql.indexOf('FUNCTION public.project_status_register_fact('), codeSql.indexOf('REVOKE ALL ON FUNCTION public.project_status_register_fact'));
    expect(fact).toContain("'timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'");
    expect(fact).toContain("'ownCost'");
    expect(fact).toContain('pm_line_has_vendor');
  });
  it('project_status_fresh_turnover still keeps a revenue movement only when its kind is sold (the Monitor01 numbers are unchanged)', () => {
    expect(codeSql).toContain(`(s."genusGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus') OR s."rowMovementKind" = 'sold')`);
  });
  it('the stale flag of monitor01_fresh_rows counts the cost plan only, in BOTH definitions of the function', () => {
    const filtered = codeSql.match(/WHERE s\."rowMovementKind" = 'plan'[^\n]*AND s\."genusGUID" IN \('timeGenus', 'materialGenus', 'expenseGenus'\)\n\s+GROUP BY 1, 2, 3, 4, 5/g) || [];
    expect(filtered.length).toBe(2);
  });
});

describe('the worker step', () => {
  it('step 5 of monitor01_apply is roi_apply, isolated so that an ROI error never stops Monitor01', () => {
    const apply = codeSql.slice(codeSql.indexOf('CREATE OR REPLACE FUNCTION public.monitor01_apply'));
    const body = apply.slice(0, apply.indexOf('$$;', apply.indexOf('p_deleted  :=')));
    expect(body).toContain('PERFORM public.roi_apply(p_tasks);');
    expect(body.indexOf('roi_apply')).toBeGreaterThan(body.indexOf('subproject_queue_origins'));
    expect(body).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING 'roi_apply failed/);
  });
  it('the project months are written by statement triggers with transition tables (a task deleted by a cascade is covered too)', () => {
    for (const w of ['AFTER INSERT ON public.project_status_roi_task_month REFERENCING NEW TABLE', 'AFTER UPDATE ON public.project_status_roi_task_month REFERENCING OLD TABLE AS old_rows NEW TABLE', 'AFTER DELETE ON public.project_status_roi_task_month REFERENCING OLD TABLE']) expect(part33).toContain(w);
  });
  it('only the rows whose numbers changed are written, a vanished row is deleted', () => {
    const apply = part33.slice(part33.indexOf('FUNCTION public.roi_apply'), part33.indexOf('REVOKE ALL ON FUNCTION public.roi_apply'));
    expect(apply).toContain('IS DISTINCT FROM');
    expect(apply).toContain('DELETE FROM public.project_status_roi_task_month');
  });
});

describe('the rules agree with the app', () => {
  it('roi_ratio: no cost = NULL; roi_cost: net + (all VAT | the VAT that is cost); roi_revenue: net + (VAT | 0)', () => {
    expect(part33).toMatch(/roi_ratio\(p_revenue numeric, p_cost numeric\)[\s\S]*?CASE WHEN COALESCE\(p_cost, 0\) = 0 THEN NULL ELSE \(COALESCE\(p_revenue, 0\) - p_cost\) \/ p_cost END/);
    expect(part33).toMatch(/COALESCE\(p_net, 0\) \+ CASE WHEN p_include_vat THEN COALESCE\(p_vat, 0\) ELSE COALESCE\(p_vat_in_cost, 0\) END/);
    expect(part33).toMatch(/COALESCE\(p_net, 0\) \+ CASE WHEN p_include_vat THEN COALESCE\(p_vat, 0\) ELSE 0 END/);
  });
  it('the cost fact = the vendor invoices + the own cost; the four ratios are the four kinds', () => {
    expect(part33).toContain('"costInvoicedNet", s."costInvoicedVat", s."costInvoicedVatInCost", s."pur") + public.roi_cost(s."costOwnNet"');
    expect(part33).toContain('public.roi_ratio(v."planRevenue", v."planCost") AS "roi1"');
    expect(part33).toContain('public.roi_ratio(v."usedRevenue", v."planCost") AS "roi2"');
    expect(part33).toContain('public.roi_ratio(v."billedRevenue", v."planCost") AS "roi3"');
    expect(part33).toContain('public.roi_ratio(v."billedRevenue", v."factCost") AS "roi4"');
  });
  it('every switch is read with vendor_project_setting_on (a missing key is OFF) and the key names are the app\'s', () => {
    const keys = Object.keys(roiValuesOf(null)) as (keyof PMProjectRoiValues)[];
    for (const k of ['roiForTasksFunctionalityEnabled', 'roiHistoryFunctionalityEnabled', 'projectROIIncludeAllTaxes', 'projectROIIncludeSaleVAT', 'projectROIIncludePurchaseVAT']) {
      expect(keys).toContain(k);
      expect(part33 + part34).toContain(`'${k}'`);
    }
    expect(part33 + part34).not.toContain("vendor_project_setting(");        // that one reads a missing key as TRUE
    expect(part33).toContain("vendor_project_setting_on(p_project, 'roiForTasksFunctionalityEnabled')");
    expect(part34).toContain("vendor_project_setting_on(p, 'roiHistoryFunctionalityEnabled')");
  });
  it('the task lines are returned only while the task switch is ON', () => {
    const fn = part33.slice(part33.indexOf('FUNCTION public.roi_task_lines'), part33.indexOf('REVOKE ALL ON FUNCTION public.roi_task_lines'));
    expect(fn).toContain("public.vendor_project_setting_on(p_project, 'roiForTasksFunctionalityEnabled')");
  });
});

describe('security', () => {
  it('the tables are read by the owner of the project and written by nobody but the SECURITY DEFINER functions; the views run as the reader', () => {
    expect(part33).toContain("USING (public.pm_owns_project(\"rowProjectGUID\"))");
    expect(part33).toContain('REVOKE ALL ON public.%I FROM anon, authenticated');
    expect(part33).toContain('GRANT SELECT ON public.%I TO authenticated');
    for (const v of ['project_status_totals', 'project_status_month_roi', 'project_status_roi_history_v']) expect(part33).toContain(`CREATE OR REPLACE VIEW public.${v} WITH (security_invoker = true)`);
  });
  it('roi_verify is a maintenance function (not for users); roi_rebuild checks the ownership', () => {
    expect(part33).toContain('REVOKE ALL ON FUNCTION public.roi_verify(uuid) FROM PUBLIC, anon, authenticated;');
    const rebuild = part33.slice(part33.indexOf('FUNCTION public.roi_rebuild'));
    expect(rebuild.slice(0, rebuild.indexOf('$$;', 100))).toContain('public.pm_owns_project(p_project)');
  });
  it('month totals and history are in the Realtime publication', () => {
    expect(part33).toContain("ARRAY['project_status_month_totals', 'project_status_roi_history']");
  });
});

describe('the history (PART 34)', () => {
  it('is written only for projects with the switch ON, only when the totals differ from the newest row, at most one row per day', () => {
    expect(part34).toContain("vendor_project_setting_on(p, 'roiHistoryFunctionalityEnabled')");
    expect(part34).toContain('l."rowProjectGUID" IS NULL OR');
    expect(part34).toContain('ON CONFLICT ("rowProjectGUID", "rowSnapshotDay") DO UPDATE');
  });
  it('the first row is written at once when the switch is turned ON (a trigger on project_table)', () => {
    expect(part34).toContain('CREATE TRIGGER trg_roi_history_switch AFTER UPDATE OF "rowJSON" ON public.project_table');
    expect(part34).toContain("OLD.\"rowJSON\"->>'roiHistoryFunctionalityEnabled' IS DISTINCT FROM 'true'");
  });
  it('the reasons say what changed: plan, fact input, vendor invoice, customer invoice', () => {
    for (const r of ["'plan'", "'fact input'", "'vendor invoice'", "'customer invoice'", "'history on'"]) expect(part34).toContain(r);
  });
});

describe('the undo part drops everything PART 33 / 34 created', () => {
  const creates = [...(part33 + part34 + tablesSql).matchAll(/CREATE (?:OR REPLACE )?(?:TABLE IF NOT EXISTS|VIEW|FUNCTION) public\.((?:project_status_(?:roi_task_month|month_totals|roi_history|totals|month_roi|roi_history_v))|(?:roi_\w+)|pm_line_has_vendor)/g)].map((m) => m[1]);
  it('finds the objects', () => { expect(new Set(creates).size).toBeGreaterThanOrEqual(20); });
  it('each is dropped in PART 1a-00', () => {
    const undo = deleteSql.slice(deleteSql.indexOf('-- PART 1a-00:'), deleteSql.indexOf('-- PART 1a-0:'));
    for (const name of new Set(creates)) expect(undo).toMatch(new RegExp(`DROP (?:TABLE|VIEW|FUNCTION) IF EXISTS public\\.${name}\\b`));
    expect(undo).toContain('DROP TRIGGER IF EXISTS trg_roi_history_switch ON public.project_table');
  });
  it('PART 1a-00 runs first (before 1a-0) and does not use the pattern the numbering test scans', () => {
    expect(deleteSql.indexOf('-- PART 1a-00:')).toBeLessThan(deleteSql.indexOf('-- PART 1a-0:'));
    expect(deleteSql.slice(deleteSql.indexOf('-- PART 1a-00:'), deleteSql.indexOf('-- PART 1a-0:'))).not.toMatch(/^-- PART \d+:/m);
  });
});
