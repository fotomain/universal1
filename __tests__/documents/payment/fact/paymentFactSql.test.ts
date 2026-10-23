// PART 38 of the SQL (the payment fact): the structure file and the code file carry the same part, the delete file drops it, the cron file schedules the worker, the names the app calls exist, and the rules
// the TypeScript mirrors are the ones in the database. (Docker test on a real Postgres 15: kit8/docker/tests/96_payment_fact.sql - run ./test_fact_monitor01.sh 96.)
import * as fs from 'fs';
import * as path from 'path';
import {
  CASH_LEDGER_MOVEMENTS_TABLE, PAYMENT_FACT_HEADER_TABLE, PAYMENT_FACT_LINES_TABLE, RPC_CASH_LEDGER_REFRESH, RPC_PAYMENT_FACT_ADD_FROM_PLAN, RPC_PAYMENT_FACT_ADD_LINE, RPC_PAYMENT_FACT_CANDIDATES,
  RPC_PAYMENT_FACT_CREATE, RPC_PAYMENT_FACT_DELETE, RPC_PAYMENT_FACT_LIST, RPC_PAYMENT_FACT_POST, RPC_PAYMENT_FACT_SET_HEADER, RPC_PAYMENT_FACT_SET_LINE_TASK, RPC_PAYMENT_FACT_UNPOST, RPC_TASK_PAYMENT_PAID,
  paymentFactProblemText, skipReasonText,
} from '../../../../kit8/documents/payment/fact/paymentFactModel';
import { paymentFactSystemMetaData } from '../../../../kit8/documents/payment/fact/paymentFactMetaData';
import { MONEY_ACCOUNT_TABLE } from '../../../../kit8/catalog/money_account/moneyAccountModel';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const code = read('start2_sql_code.sql');
const del = read('delete_sql_structure.sql');
const cron = read('start3_sql_pg_cron.sql');
const MARK = '-- PART 38: create_payment_fact.sql';
const one = (src: string) => { const i = src.indexOf(MARK); return i < 0 ? '' : src.slice(i, src.indexOf('-- END of start', i)); };

describe('the part is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 38 exists in both, after PART 37; the tables file has the tables and no code, the code file has the code and no table', () => {
    for (const src of [tables, code]) expect(src.indexOf('-- PART 37:')).toBeLessThan(src.indexOf(MARK));
    for (const t of [PAYMENT_FACT_HEADER_TABLE, PAYMENT_FACT_LINES_TABLE, CASH_LEDGER_MOVEMENTS_TABLE, 'cash_account_ledger_rests', 'cash_account_ledger_dirty']) expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${t} (`);
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public."${MONEY_ACCOUNT_TABLE.table}" (`);
    expect(one(tables)).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(one(code)).toMatch(/CREATE OR REPLACE FUNCTION public\.post_payment_fact\(/);
    expect(one(code)).not.toMatch(/CREATE TABLE/);
  });
  it('the code file refuses to run without the tables', () => {
    expect(one(code)).toContain("to_regclass('public.project_payment_fact_header') IS NULL");
    expect(one(code)).toContain('PART 38 needs the tables: run start1_sql_tables.sql first');
  });
  it('no comment line of the part looks like a banner (the PART scans would take it for one)', () => {
    const lines = (one(code) + '\n' + one(tables)).split('\n').filter((l) => /^-- PART \d+:/.test(l));
    expect(lines).toHaveLength(2);
  });
});

describe('the delete file and the cron file', () => {
  it('the delete file drops the tables, the sequence, the trigger on the exchange rates, the cron job and every function of the part; it runs first (before the payment plan)', () => {
    for (const t of [PAYMENT_FACT_HEADER_TABLE, PAYMENT_FACT_LINES_TABLE, CASH_LEDGER_MOVEMENTS_TABLE, 'cash_account_ledger_rests', 'cash_account_ledger_dirty']) expect(del).toContain(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
    expect(del).toContain(`DROP TABLE IF EXISTS public."${MONEY_ACCOUNT_TABLE.table}" CASCADE;`);
    expect(del).toContain('DROP SEQUENCE IF EXISTS public.payment_fact_document_seq;');
    expect(del).toContain('DROP TRIGGER IF EXISTS trg_cash_ledger_rate ON public."currencyExchangeRateTable";');
    expect(del).toContain("cron.unschedule('cash_ledger_tick')");
    const part = del.slice(del.indexOf('-- PART 1a-000000: delete_payment_fact.sql'), del.indexOf('-- PART 1a-00000: delete_payment_plan.sql'));
    expect(part.length).toBeGreaterThan(500);
    expect(del.indexOf('-- PART 1a-000000:')).toBeLessThan(del.indexOf('-- PART 1a-00000:'));
    const fns = Array.from(one(code).matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)).map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(25);
    for (const f of fns) expect(part).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${f}\\(`));
  });
  it('the schedule: the worker cash_ledger_process_dirty every 10 seconds, only when the function exists', () => {
    expect(cron).toContain("cron.schedule('cash_ledger_tick', '10 seconds', 'SELECT public.cash_ledger_process_dirty()')");
    expect(cron).toContain("to_regprocedure('public.cash_ledger_process_dirty(integer)') IS NOT NULL");
    expect(cron).toContain("'cash_ledger_tick'");
  });
});

describe('the names the app calls exist in the code file', () => {
  it.each([RPC_PAYMENT_FACT_CREATE, RPC_PAYMENT_FACT_SET_HEADER, RPC_PAYMENT_FACT_ADD_FROM_PLAN, RPC_PAYMENT_FACT_ADD_LINE, RPC_PAYMENT_FACT_SET_LINE_TASK, RPC_PAYMENT_FACT_CANDIDATES, RPC_PAYMENT_FACT_POST,
    RPC_PAYMENT_FACT_UNPOST, RPC_PAYMENT_FACT_DELETE, RPC_PAYMENT_FACT_LIST, RPC_TASK_PAYMENT_PAID, RPC_CASH_LEDGER_REFRESH])('function %s is granted to the signed-in user', (name) => {
    expect(one(code)).toContain(`CREATE OR REPLACE FUNCTION public.${name}(`);
    expect(one(code)).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(`));
  });
  it('the redux entities point at the two tables', () => {
    const meta = paymentFactSystemMetaData();
    expect(Object.values(meta).map((m: any) => m.tableName)).toEqual([PAYMENT_FACT_HEADER_TABLE, PAYMENT_FACT_LINES_TABLE]);
  });
  it('the worker, the recalculation and the rebuild of the rests are NOT callable by the client', () => {
    for (const f of ['cash_ledger_recalc', 'cash_ledger_process_dirty', 'cash_ledger_rebuild_rests', 'cash_ledger_rests_calc', 'cash_ledger_fresh', 'cash_ledger_verify', 'cash_ledger_rebuild']) {
      expect(one(code)).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`));
    }
  });
});

describe('the rules in the database', () => {
  it('the number of a document is PF-nnnnn from its own sequence', () => {
    expect(one(tables)).toContain('CREATE SEQUENCE IF NOT EXISTS public.payment_fact_document_seq;');
    expect(one(code)).toContain("'PF-' || lpad(nextval('public.payment_fact_document_seq')::text, 5, '0')");
  });
  it('every problem code the TypeScript knows is a code Post can return, and the other way round', () => {
    const post = one(code).slice(one(code).indexOf('CREATE OR REPLACE FUNCTION public.post_payment_fact('), one(code).indexOf('CREATE OR REPLACE FUNCTION public.unpost_payment_fact('));
    const sqlCodes = new Set(Array.from(post.matchAll(/'(\w+(?:Missing|NotPayment|IsPosted|NoLines|BeforeOpening|YourProject))'/g)).map((m) => m[1]));
    const tsCodes = ['documentIsPosted', 'documentHasNoLines', 'paymentFactNumberMissing', 'paymentFactDateMissing', 'moneyAccountMissing', 'accountCurrencyMissing', 'dateBeforeOpening', 'payeeMissing', 'directionMissing',
      'budgetItemMissing', 'budgetItemNotPayment', 'contractMissing', 'currencyMissing', 'sumMissing', 'notYourProject', 'sumForAccountingMissing', 'sumForBudgetMissing', 'sumForMoneyAccountMissing'];
    for (const c of tsCodes) { expect(sqlCodes.has(c)).toBe(true); expect(paymentFactProblemText(c)).not.toBe(c); }
    for (const c of sqlCodes) expect(tsCodes).toContain(c);
  });
  it('the reasons "Get from plan" skips a payment are the ones the TypeScript has a sentence for', () => {
    const add = one(code).slice(one(code).indexOf('CREATE OR REPLACE FUNCTION public.payment_fact_add_from_plan('), one(code).indexOf('CREATE OR REPLACE FUNCTION public.payment_fact_create('));
    const reasons = Array.from(add.matchAll(/'reason', '(\w+)'/g)).map((m) => m[1]);
    expect([...new Set(reasons)].sort()).toEqual(['nothingOpen', 'notYourProject', 'planPaymentNotPosted', 'wrongDirection', 'wrongPayee'].sort());
    for (const r of reasons) expect(skipReasonText(r)).not.toBe(r);
  });
  it('the sums are converted in the line trigger with the rate types of the project and the rate of the date of the document; the register is signed; the rests are rebuilt under a lock of the account', () => {
    const c = one(code);
    expect(c).toContain("COALESCE(NULLIF(btrim(pj->>'exchangeRateTypeForAccounting'), ''), 'Default')");
    expect(c).toContain("COALESCE(NULLIF(btrim(pj->>'exchangeRateTypeForBudget'), ''), 'Budget')");
    expect(c).toContain('public.fx_convert(v_sum, v_cur, v_acc, v_acc_t, v_day)');
    expect(c).toContain("v_sign := CASE WHEN v_dir = 'inbound' THEN 1 ELSE -1 END;");
    expect(c).toContain("pg_advisory_xact_lock(hashtextextended('cash_ledger:'");
    expect(c).toContain('PERFORM public.cash_ledger_rebuild_rests(h."rowOrganizationGUID", v_acct, v_day);');
  });
  it('a rate change: the trigger is on currencyExchangeRateTable, does nothing while no payment was ever posted, and queues [date, next rate)', () => {
    const c = one(code);
    expect(c).toContain('CREATE TRIGGER trg_cash_ledger_rate AFTER INSERT OR UPDATE OR DELETE ON public."currencyExchangeRateTable"');
    expect(c).toContain('IF NOT EXISTS (SELECT 1 FROM public.cash_account_ledger_movements LIMIT 1) THEN');
    expect(c).toContain('INSERT INTO public.cash_account_ledger_dirty ("fromDay", "toDay", "currency") VALUES (v_from, v_next, v_cur);');
  });
  it('the client reads the movements and the rests and writes neither; the queue has no grant', () => {
    const c = one(code);
    expect(c).toContain('GRANT SELECT ON public.cash_account_ledger_movements TO authenticated;');
    expect(c).toContain('GRANT SELECT ON public.cash_account_ledger_rests TO authenticated;');
    expect(c).toContain('REVOKE ALL ON public.cash_account_ledger_dirty FROM anon, authenticated;');
    expect(c).toContain('GRANT SELECT, DELETE ON public.project_payment_fact_header TO authenticated;');
    expect(c).not.toMatch(/GRANT [A-Z, ]*INSERT[A-Z, ]* ON public\.project_payment_fact_header/);
  });
  it('the money account: its currency, opening date and opening balance are fixed once it has movements; a used account is not deleted', () => {
    const c = one(code);
    expect(c).toContain('the account has posted payments - its currency, opening date and opening balance cannot change');
    expect(c).toContain('is used by a payment fact - deactivate it instead');
  });
});
