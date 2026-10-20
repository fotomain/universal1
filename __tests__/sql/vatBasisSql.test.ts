// The SQL of the VAT basis read as text (documentation/VENDOR_INVOICE_DOC.html): the columns in start1, the functions and triggers in start2, the undo in delete_sql_structure.sql.
// The numbers themselves are proved on a real Postgres 15: kit8/docker/tests/75_vat_basis.sql (+ 52, 70, 71, 74).
import { codeSql, readSql, tablesSql } from './sqlFilesTestKit';

const deleteSql = readSql('delete_sql_structure.sql');
const LINE_TABLES = ['vendor_invoice_lines', 'purchase_order_lines', 'product_receipt_lines', 'customer_invoice_lines'];

describe('start1: the columns', () => {
  it.each(LINE_TABLES)('%s gets the three accounting parts, the budget VAT and the VAT that is cost', (t) => {
    for (const c of ['sumForAccountingBeforeVAT', 'sumForAccountingVAT', 'vatForBudget', 'vatInCostForBudget', 'vatInCostForAccounting']) {
      expect(tablesSql).toContain(`ALTER TABLE public.${t} ADD COLUMN IF NOT EXISTS "${c}"`);
    }
  });
  it('the register, the plan movements, the turnover, monitor01_view, the fact lines and the cost total carry the VAT parts', () => {
    expect(tablesSql).toContain('ALTER TABLE public.project_status_movements ADD COLUMN IF NOT EXISTS "vatInCostForBudget"');
    expect(tablesSql).toContain('ALTER TABLE public.task_line_plan_movements ADD COLUMN IF NOT EXISTS "vatForBudget"');
    expect(tablesSql).toContain('ALTER TABLE public.project_status_month_turnover ADD COLUMN IF NOT EXISTS "vatInCostForBudgetPlan"');
    for (const c of ['vatBudget', 'vatInCostBudget', 'vatVendorInvoiced', 'vatInCostVendorInvoiced', 'vatCustomerInvoiced']) expect(tablesSql).toContain(`ALTER TABLE public.monitor01_view ADD COLUMN IF NOT EXISTS "${c}"`);
    for (const c of ['vatForContract', 'vatForBudget', 'vatForAccounting', 'vatInCostForBudget', 'vatInCostForAccounting']) expect(tablesSql).toContain(`ALTER TABLE public.task_fact_usage_timeline ADD COLUMN IF NOT EXISTS "${c}"`);
    expect(tablesSql).toContain('ALTER TABLE public.project_task_cost_total ADD COLUMN IF NOT EXISTS "costTotalForBudgetWithVAT"');
  });
  it('no function in the tables file (it only ALTERs)', () => {
    expect(tablesSql).not.toContain('FUNCTION public.vat_line_calc');
    expect(tablesSql).not.toContain('FUNCTION public.vat_basis_amount');
  });
});

describe('start2: the functions', () => {
  it('vat_basis_amount knows cost, net and gross and refuses another basis', () => {
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.vat_basis_amount(');
    for (const b of ["'cost'", "'net'", "'gross'"]) expect(codeSql).toContain(`p_basis = ${b}`);
    expect(codeSql).toContain('the basis must be cost, net or gross');
  });
  it('the four line triggers call vat_line_calc and read the rate from the catalog; the old calculation is gone', () => {
    expect((codeSql.match(/FROM public\.vat_line_calc\(/g) || []).length).toBe(4);
    expect((codeSql.match(/FROM public\.vat_rate_lookup\(/g) || []).length).toBe(4);
    expect(codeSql).not.toContain('v_plan_price := CASE WHEN jsonb_typeof(NEW."rowJSON"->\'priceTaskLine\')');
    expect((codeSql.match(/app\.vat_backfill/g) || []).length).toBeGreaterThanOrEqual(5);      // the four triggers + the backfill
  });
  it('a line that came from a task line may change ONLY the rate keys of its rowJSON', () => {
    expect((codeSql.match(/\{vatRateGUID,vatTablePercent,vatRecoverablePercent\}/g) || []).length).toBe(8);   // new and old, in each of the four triggers
  });
  it('the register gets the NET accounting sum (BeforeVAT) and the VAT beside it', () => {
    expect((codeSql.match(/COALESCE\(l\."sumForAccountingBeforeVAT", 0\), COALESCE\(l\."sumForAccountingVAT", 0\), COALESCE\(l\."vatForBudget", 0\), COALESCE\(l\."vatInCostForBudget", 0\), COALESCE\(l\."vatInCostForAccounting", 0\)/g) || []).length).toBe(4);
  });
  it('the plan distributes the VAT of the budget sum; the fingerprint of the plan includes it', () => {
    expect(codeSql).toContain("ARRAY['qtyTaskLine', 'sumForBudget', 'sumForContract', 'sumForAccounting', 'vatForBudget', 'vatInCostForBudget']");
    expect(codeSql).toContain('COALESCE(m."vatForBudget", 0)::numeric(18,2), COALESCE(m."vatInCostForBudget", 0)::numeric(18,2)');
  });
  it('the cost total has the cost basis and the with-VAT pair; the rebuild, the hot path and verify carry both', () => {
    expect(codeSql).toContain('SUM(m."sumForBudgetPlan" + m."vatInCostForBudgetPlan")');
    expect(codeSql).toContain('SUM(m."sumForBudgetPlan" + m."vatForBudgetPlan")');
    expect(codeSql).toContain('DROP FUNCTION IF EXISTS public.project_cost_fresh(uuid);');
  });
  it('the backfill is idempotent (it recognizes an old row by the empty new column) and queues the worker', () => {
    expect(codeSql).toContain('WHERE "sumForAccountingBeforeVAT" IS NULL AND "sumForAccountingVAT" IS NULL AND "vatForBudget" IS NULL');
    expect(codeSql).toContain("set_config('app.vat_backfill', 'on', true)");
    expect(codeSql).toContain('INSERT INTO public.project_cost_dirty ("rowProjectGUID")');
  });
});

describe('the undo', () => {
  it('delete_sql_structure.sql drops the three helpers', () => {
    expect(deleteSql).toContain('DROP FUNCTION IF EXISTS public.vat_basis_amount(numeric, numeric, numeric, text);');
    expect(deleteSql).toContain('DROP FUNCTION IF EXISTS public.vat_rate_lookup(text);');
    expect(deleteSql).toContain('DROP FUNCTION IF EXISTS public.vat_line_calc(');
  });
});
