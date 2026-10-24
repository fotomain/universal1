// PART 39 of the SQL (the partner balance): the structure file and the code file carry the same part, the delete file drops it, the names the app calls exist, the credit-note check is in both invoice
// tables, the payment rules the app mirrors are in the database. (Docker test on a real Postgres 15: kit8/docker/tests/97_partner_balance.sql - run ./test_fact_monitor01.sh 97.)
import * as fs from 'fs';
import * as path from 'path';
import { PARTNER_BALANCE_LEDGER_TABLE, RPC_PARTNER_BALANCE_FILTER_ITEMS, RPC_PARTNER_BALANCE_MOVEMENTS_LIST, RPC_PARTNER_BALANCE_REPORT } from '../../../../kit8/pm/reports/partner_balance/partnerBalanceApi';
import { MOVEMENT_TYPE_TITLE, SUM_KINDS } from '../../../../kit8/pm/reports/partner_balance/partnerBalanceModel';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const code = read('start2_sql_code.sql');
const del = read('delete_sql_structure.sql');
const cron = read('start3_sql_pg_cron.sql');
const MARK = '-- PART 39: create_partner_balance.sql';
const one = (src: string) => { const i = src.indexOf(MARK); return i < 0 ? '' : src.slice(i, src.indexOf('-- END of start', i)); };

describe('the part is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 39 exists in both, after PART 38; the tables file has the two tables and no code, the code file has the code and no table', () => {
    for (const src of [tables, code]) expect(src.indexOf('-- PART 38:')).toBeLessThan(src.indexOf(MARK));
    expect(one(tables)).toContain('CREATE TABLE IF NOT EXISTS public.partner_balance_movements (');
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${PARTNER_BALANCE_LEDGER_TABLE} (`);
    expect(one(tables)).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(one(code)).not.toMatch(/CREATE TABLE/);
    expect(one(code)).toContain('start2_sql_code.sql PART 39 needs the tables: run start1_sql_tables.sql first');
  });
  it('no comment line of the part looks like a banner (the PART scans would take it for one)', () => {
    const lines = (one(code) + '\n' + one(tables)).split('\n').filter((l) => /^-- PART \d+:/.test(l));
    expect(lines).toHaveLength(2);
  });
  it('the register: signed sums, the operation types tied to the role, one row per source line, a currency is empty or an ISO code', () => {
    const t = one(tables);
    expect(t).toContain('CONSTRAINT partner_balance_movements_line_uq UNIQUE ("registratorKind", "registratorLineGUID")');
    expect(t).toContain(`CHECK ("registratorKind" IN ('vendorInvoice', 'customerInvoice', 'paymentFact'))`);
    for (const type of Object.keys(MOVEMENT_TYPE_TITLE)) expect(t).toContain(`'${type}'`);
    expect(t).toContain(`CHECK ("balanceRole" IN ('customer', 'vendor'))`);
    for (const k of SUM_KINDS) expect(t).toContain(`"${k.column}"`);
  });
  it('the ledger key has no plan line (an invoice never knows it), the register keeps it', () => {
    const ledger = one(tables).slice(one(tables).indexOf('CREATE TABLE IF NOT EXISTS public.partner_balance_ledger'));
    expect(ledger).not.toContain('projectPaymentPlanLineGUID');
    expect(one(tables).slice(0, one(tables).indexOf('CREATE TABLE IF NOT EXISTS public.partner_balance_ledger'))).toContain('"projectPaymentPlanLineGUID"');
  });
});

describe('credit notes: ONE negative factor', () => {
  it('both invoice line tables refuse only a line with BOTH factors negative (new database and upgrade of an old one)', () => {
    for (const k of ['vendor', 'customer']) {
      expect(tables).toContain(`CONSTRAINT ${k}_invoice_lines_qty_chk CHECK (NOT ("qtyInvoiced" < 0 AND "priceInvoiced" < 0) AND`);
      expect(tables).toContain(`ALTER TABLE public.${k}_invoice_lines DROP CONSTRAINT IF EXISTS ${k}_invoice_lines_qty_chk;`);
      expect(tables).toContain(`ALTER TABLE public.${k}_invoice_lines ADD CONSTRAINT ${k}_invoice_lines_qty_chk CHECK (NOT ("qtyInvoiced" < 0 AND "priceInvoiced" < 0)`);
    }
    expect(tables).not.toContain('CHECK ("qtyInvoiced" >= 0 AND "priceInvoiced" >= 0');
  });
  it('the purchase order and the product receipt are NOT changed (only the two invoices may be negative)', () => {
    expect(tables).toContain('CHECK ("qtyOrdered" >= 0 AND "priceOrdered" >= 0');
    expect(tables).toContain('CHECK ("qtyReceived" >= 0 AND "priceReceived" >= 0');
  });
});

describe('the code', () => {
  const c = one(code);
  it('the rows are written by triggers in the Post transaction: the two invoice headers, the cash movements; the ledger by statement triggers; a register row is never updated', () => {
    expect(c).toContain('CREATE TRIGGER trg_vendor_invoice_partner_balance AFTER UPDATE ON public.vendor_invoice_header');
    expect(c).toContain('CREATE TRIGGER trg_customer_invoice_partner_balance AFTER UPDATE ON public.customer_invoice_header');
    expect(c).toContain('CREATE TRIGGER trg_cash_ledger_partner_balance_insert AFTER INSERT ON public.cash_account_ledger_movements REFERENCING NEW TABLE AS newrows FOR EACH STATEMENT');
    expect(c).toContain('CREATE TRIGGER trg_cash_ledger_partner_balance_delete AFTER DELETE ON public.cash_account_ledger_movements REFERENCING OLD TABLE AS oldrows FOR EACH STATEMENT');
    expect(c).toContain('CREATE TRIGGER trg_partner_balance_ledger_insert AFTER INSERT ON public.partner_balance_movements REFERENCING NEW TABLE AS newrows FOR EACH STATEMENT');
    expect(c).toContain('CREATE TRIGGER trg_partner_balance_ledger_delete AFTER DELETE ON public.partner_balance_movements REFERENCING OLD TABLE AS oldrows FOR EACH STATEMENT');
    expect(c).toContain('CREATE TRIGGER trg_partner_balance_no_update BEFORE UPDATE ON public.partner_balance_movements');
  });
  it('the signs: a vendor invoice is negative, a customer invoice positive, a payment is the cash movement turned round; a payment to a person (no partner) makes no row', () => {
    expect(c).toMatch(/-round\(COALESCE\(l\."sumForContract", 0\) \+ COALESCE\(l\."vatForContract", 0\), 2\)/);
    expect(c).toContain('-m."sumForContract", -COALESCE(m."sumForAccounting", 0), -COALESCE(m."sumForBudget", 0)');
    expect(c).toContain('WHERE m."partner" IS NOT NULL');
  });
  it('the role of a payment: the header field, else the invoice it pays, else the direction', () => {
    expect(c).toContain(`COALESCE(NULLIF(h."rowJSON"->>'paymentFactBalanceRole', ''),`);
    expect(c).toContain(`CASE l."rowJSON"->>'paymentFactInvoiceKind' WHEN 'customer' THEN 'customer' WHEN 'vendor' THEN 'vendor' END`);
  });
  it('the client reads the two tables and writes none; the ledger is in the realtime publication; the maintenance functions are not callable by the client', () => {
    expect(c).toContain('GRANT SELECT ON public.partner_balance_movements TO authenticated;');
    expect(c).toContain('GRANT SELECT ON public.partner_balance_ledger TO authenticated;');
    expect(c).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_balance_ledger;');
    for (const f of ['partner_balance_rebuild(text)', 'partner_balance_verify(text)', 'partner_balance_register_missing()', 'partner_balance_insert_payments(uuid[])']) expect(c).toContain(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC, anon, authenticated;`);
  });
  it('the names the app calls exist and are granted to the client', () => {
    for (const rpc of [RPC_PARTNER_BALANCE_REPORT, RPC_PARTNER_BALANCE_FILTER_ITEMS, RPC_PARTNER_BALANCE_MOVEMENTS_LIST]) {
      expect(c).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
      expect(c).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(.*\\) TO authenticated;`));
    }
  });
  it('the report: the display sign of the vendor, the sums bigger / smaller than with the borders INCLUDED, the three sorts, the task group needs a partner and a contract', () => {
    expect(c).toContain(`v_sign numeric := CASE WHEN p_role = 'vendor' THEN -1 ELSE 1 END;`);
    expect(c).toContain('t.co_kind_end >= v_big');
    expect(c).toContain('t.co_kind_end <= v_small');
    for (const s of ['partnerName', 'sumForBudgetEnd', 'contractFinishDate']) expect(c).toContain(`'${s}'`);
    expect(c).toContain('the task group needs the partner and the contract');
  });
  it('the backfill of an existing database is the last statement of the part', () => {
    expect(c).toMatch(/SELECT public\.partner_balance_register_missing\(\);\s*-- =+\s*$/);
  });
  it('no pg_cron job: the rows are written in the Post transaction (start3 is untouched)', () => {
    expect(cron).not.toContain('partner_balance');
  });
});

describe('the payment fact (PART 38, changed in place)', () => {
  it('Post refuses a payment with business units of different first level roots when a project of its lines says so (the setting is TRUE unless stored false)', () => {
    expect(code).toContain(`NOT public.vendor_project_setting(l."rowProjectGUID", 'paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled')`);
    expect(code).toContain(`'businessUnitsOfDifferentRoots'`);
  });
  it('the header takes the balance role (customer | vendor | empty) and the list gives it back', () => {
    expect(code).toContain(`IF p_patch ? 'paymentFactBalanceRole' THEN`);
    expect(code).toContain(`COALESCE(h."rowJSON"->>'paymentFactBalanceRole', '') AS "balanceRole"`);
  });
  it('a payment made from an invoice needs the contract of the invoice', () => {
    expect(code).toContain('has no contract: a payment needs one - unpost the invoice, choose its contract and post it again');
  });
});

describe('the delete file', () => {
  const part = del.slice(del.indexOf('-- PART 1a-0000000: delete_partner_balance.sql'), del.indexOf('-- PART 1a-000000: delete_payment_fact.sql'));
  it('runs first (before the payment fact), drops both tables, the triggers on the other tables and every function of the part', () => {
    expect(del.indexOf('-- PART 1a-0000000:')).toBeLessThan(del.indexOf('-- PART 1a-000000:'));
    expect(part.length).toBeGreaterThan(500);
    expect(part).toContain('DROP TABLE IF EXISTS public.partner_balance_ledger CASCADE;');
    expect(part).toContain('DROP TABLE IF EXISTS public.partner_balance_movements CASCADE;');
    for (const t of [['trg_vendor_invoice_partner_balance', 'vendor_invoice_header'], ['trg_customer_invoice_partner_balance', 'customer_invoice_header'], ['trg_cash_ledger_partner_balance_insert', 'cash_account_ledger_movements'], ['trg_cash_ledger_partner_balance_delete', 'cash_account_ledger_movements']]) {
      expect(part).toContain(`DROP TRIGGER IF EXISTS ${t[0]} ON public.${t[1]};`);
    }
    const fns = Array.from(one(code).matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)).map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(14);
    for (const f of fns) expect(part).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${f}\\(`));
  });
  it('the header list of the delete file names the part', () => {
    expect(del).toContain('1a-0000000. delete_partner_balance.sql - PART 39');
  });
});
