// PART 31 of the SQL (the customer invoice): the structure file and the code file carry the same part, the delete file drops it, the names the app calls exist, and the Monitor01 pipeline carries the
// group Customer Invoice. (Docker test on a real Postgres 15: kit8/docker/tests/74_customer_invoice.sql - run ./test_fact_monitor01.sh 74.)
import * as fs from 'fs';
import * as path from 'path';
import {
  CUSTOMER_INVOICE_HEADER_TABLE, CUSTOMER_INVOICE_LINES_TABLE, CUSTOMER_INVOICE_REGISTRATOR_TYPE, RPC_CUSTOMER_ADD_LINE, RPC_CUSTOMER_CANDIDATES, RPC_CUSTOMER_CREATE, RPC_CUSTOMER_DELETE, RPC_CUSTOMER_LIST, RPC_CUSTOMER_POST,
  RPC_CUSTOMER_SET_HEADER, RPC_CUSTOMER_UNPOST,
} from '../../../../kit8/documents/customer/invoice/customerInvoiceModel';
import { customerInvoiceSystemMetaData } from '../../../../kit8/documents/customer/invoice/customerInvoiceMetaData';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const code = read('start2_sql_code.sql');
const del = read('delete_sql_structure.sql');
const MARK = '-- PART 31: create_customer_invoice.sql';
const one = (src: string) => { const i = src.indexOf(MARK); return i < 0 ? '' : src.slice(i, src.indexOf('-- upgrade 2026-10-18', i) > 0 && src === code ? src.indexOf('-- upgrade 2026-10-18', i) : src.indexOf('-- END of start', i)); };
const p = one(tables) + '\n' + one(code);

describe('the part is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 31 exists in both, after PART 30; the tables file has the tables and no code, the code file has the code and no table', () => {
    for (const src of [tables, code]) expect(src.indexOf('-- PART 30:')).toBeLessThan(src.indexOf(MARK));
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${CUSTOMER_INVOICE_HEADER_TABLE} (`);
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${CUSTOMER_INVOICE_LINES_TABLE} (`);
    expect(one(tables)).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(one(code)).toMatch(/CREATE OR REPLACE FUNCTION public\.post_customer_invoice\(/);
    expect(one(code)).not.toMatch(/CREATE TABLE/);
  });
  it('the code file refuses to run without the tables', () => {
    expect(one(code)).toContain("to_regclass('public.customer_invoice_header') IS NULL");
    expect(one(code)).toContain('PART 31 needs the tables: run start1_sql_tables.sql first');
  });
  it('the delete file drops the tables, the sequence and every function of the part', () => {
    for (const t of [CUSTOMER_INVOICE_HEADER_TABLE, CUSTOMER_INVOICE_LINES_TABLE]) expect(del).toContain(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
    expect(del).toContain('DROP SEQUENCE IF EXISTS public.customer_invoice_document_seq;');
    const fns = Array.from(one(code).matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)).map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(10);
    for (const f of fns) expect(del).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${f}\\(`));
  });
});

describe('the names the app calls exist in the code file', () => {
  it.each([RPC_CUSTOMER_CANDIDATES, RPC_CUSTOMER_CREATE, RPC_CUSTOMER_SET_HEADER, RPC_CUSTOMER_ADD_LINE, RPC_CUSTOMER_POST, RPC_CUSTOMER_UNPOST, RPC_CUSTOMER_DELETE, RPC_CUSTOMER_LIST])('function %s', (name) => {
    expect(one(code)).toContain(`CREATE OR REPLACE FUNCTION public.${name}(`);
  });
  it('the registrator type and the kind of the movements are the ones the SQL writes (kind sold, no change of the kind check)', () => {
    expect(CUSTOMER_INVOICE_REGISTRATOR_TYPE).toBe('customerInvoiceHeader');
    expect(one(code)).toContain("'customerInvoiceHeader'");
    expect(one(code)).toContain("SELECT 'sold',");
    expect(tables).toContain("'plan', 'ordered', 'received', 'invoiced', 'used', 'sold'");
  });
  it('the redux entities point at the two tables; only qty / price / VAT % of a line are saved columns', () => {
    const meta = customerInvoiceSystemMetaData();
    expect(Object.values(meta).map((m: any) => m.tableName)).toEqual([CUSTOMER_INVOICE_HEADER_TABLE, CUSTOMER_INVOICE_LINES_TABLE]);
    expect((meta.customerInvoiceLinesReusable as any).rootColumns).toEqual(['qtyInvoiced', 'priceInvoiced', 'vatRatioInvoiced', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT']);
  });
});

describe('the rules in the database', () => {
  it('the number of a document is CI-nnnnn from its own sequence; the lines are Revenue lines only', () => {
    expect(p).toContain("'CI-' || lpad(nextval('public.customer_invoice_document_seq')::text, 5, '0')");
    expect(p).toContain('CREATE SEQUENCE IF NOT EXISTS public.customer_invoice_document_seq;');
    expect(p).toContain(`CONSTRAINT customer_invoice_lines_genus_chk CHECK ("genusGUID" = 'revenueGenus')`);
    expect(p).toContain("l.\"rowParentGUID\" = 'revenueGenus'");
  });
  it('the switch customerInvoiceFunctionalityEnabled is checked by the creation of a document and of an independent line (true while never saved)', () => {
    const c = one(code);
    expect(c.match(/vendor_project_setting\(v_project, 'customerInvoiceFunctionalityEnabled'\)/g)!.length).toBe(2);
    expect(c).toContain('customer invoices are switched off in the project settings (Customer)');
  });
  it('a line without a customer takes the main customer of the project (Project settings → Partners)', () => {
    expect(one(code)).toContain(`'mainCustomerGUID'`);
    expect(one(code)).toContain(`'mainCustomerContractGUID'`);
  });
});

describe('the Monitor01 pipeline carries the group Customer Invoice (Qty, Sum)', () => {
  it('the turnover has qtySold / sumForBudgetSold, monitor01_view has qtyCustomerInvoiced / sumCustomerInvoiced and a check that allows the Revenue genus', () => {
    const t = one(tables);
    for (const c of ['"qtySold"', '"sumForBudgetSold"', '"qtyCustomerInvoiced"', '"sumCustomerInvoiced"']) expect(t).toContain(c);
    expect(t).toContain(`'expenseGenus', 'revenueGenus'`);
    expect(tables).toContain(`CONSTRAINT monitor01_view_genus_chk CHECK ("genusGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'))`);
  });
  it('the fresh turnover sums the sold movements and reads the Revenue genus ONLY through them; the fresh rows, apply and verify carry both numbers', () => {
    expect(code).toContain(`FILTER (WHERE s."rowMovementKind" = 'sold')`);
    expect(code).toContain(`OR s."rowMovementKind" = 'sold')`);
    expect(code).toContain('sum(f."qtySold") AS "qtyCustomerInvoiced", sum(f."sumForBudgetSold") AS "sumCustomerInvoiced"');
    expect(code).toContain('"qtyReceived", "qtyCustomerInvoiced", "sumCustomerInvoiced", "vatBudget", "vatInCostBudget", "vatVendorInvoiced", "vatInCostVendorInvoiced", "vatCustomerInvoiced", "lineCount", "hasStalePlan")');
    expect(code).toContain('"qtySold" = EXCLUDED."qtySold", "sumForBudgetSold" = EXCLUDED."sumForBudgetSold"');
  });
  it('the drill-down measure customerInvoiced lists the sold movements with the number of the invoice', () => {
    expect(code).toContain("ELSIF p_measure = 'customerInvoiced' THEN");
    expect(code).toContain("JOIN public.customer_invoice_header h ON h.\"rowGUID\" = s.\"rowRegistratorGUID\"");
    expect(code).toContain("h.\"rowJSON\"->>'customerInvoiceNumber' AS \"documentNumber\"");
  });
});
