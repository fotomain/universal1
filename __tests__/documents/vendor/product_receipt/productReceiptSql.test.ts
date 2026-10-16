// PART 30 of the SQL (the product receipt): the structure file and the code file carry the same part, the delete file drops it, and the names the app calls exist in the SQL.
// (Docker test on a real Postgres 15: kit8/docker/tests/73_product_receipt.sql - run ./test_fact_monitor01.sh 73.)
import * as fs from 'fs';
import * as path from 'path';
import {
  PRODUCT_RECEIPT_HEADER_TABLE, PRODUCT_RECEIPT_LINES_TABLE, PRODUCT_RECEIPT_REGISTRATOR_TYPE, RPC_PR_ADD_LINE, RPC_PR_DELETE, RPC_PR_FROM_ORDER, RPC_PR_LINE_PLACES, RPC_PR_LIST, RPC_PR_POST, RPC_PR_SET_HEADER, RPC_PR_UNPOST,
  RPC_VI_FROM_RECEIPT,
} from '../../../../kit8/documents/vendor/product_receipt/productReceiptModel';
import { productReceiptSystemMetaData } from '../../../../kit8/documents/vendor/product_receipt/productReceiptMetaData';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const code = read('start2_sql_code.sql');
const del = read('delete_sql_structure.sql');
const MARK = '-- PART 30: create_product_receipt.sql';
const one = (src: string) => { const i = src.indexOf(MARK); return i < 0 ? '' : src.slice(i, src.indexOf('-- END of start', i)); };
const p = one(tables) + '\n' + one(code);

describe('the part is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 30 exists in both, after PART 29; the tables file has the tables and no code, the code file has the code and no table', () => {
    for (const src of [tables, code]) expect(src.indexOf('-- PART 29:')).toBeLessThan(src.indexOf(MARK));
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${PRODUCT_RECEIPT_HEADER_TABLE} (`);
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${PRODUCT_RECEIPT_LINES_TABLE} (`);
    expect(one(tables)).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(one(code)).toMatch(/CREATE OR REPLACE FUNCTION public\.post_product_receipt\(/);
    expect(one(code)).not.toMatch(/CREATE TABLE/);
  });
  it('the code file refuses to run without the tables', () => {
    expect(one(code)).toContain("to_regclass('public.product_receipt_header') IS NULL");
    expect(one(code)).toContain('PART 30 needs the tables: run start1_sql_tables.sql first');
  });
});

describe('the names the app calls exist in the code file', () => {
  it.each([RPC_PR_FROM_ORDER, RPC_VI_FROM_RECEIPT, RPC_PR_SET_HEADER, RPC_PR_ADD_LINE, RPC_PR_LINE_PLACES, RPC_PR_POST, RPC_PR_UNPOST, RPC_PR_DELETE, RPC_PR_LIST])('function %s', (name) => {
    expect(one(code)).toContain(`CREATE OR REPLACE FUNCTION public.${name}(`);
  });
  it('the registrator type of the movements is the one the SQL writes', () => {
    expect(PRODUCT_RECEIPT_REGISTRATOR_TYPE).toBe('productReceiptHeader');
    expect(one(code)).toContain("'productReceiptHeader'");
    expect(one(code)).toContain("SELECT 'received',");
  });
  it('the redux entities point at the two tables; only qty / price / VAT % of a line are saved columns', () => {
    const meta = productReceiptSystemMetaData();
    expect(Object.values(meta).map((m: any) => m.tableName)).toEqual([PRODUCT_RECEIPT_HEADER_TABLE, PRODUCT_RECEIPT_LINES_TABLE]);
    expect((meta.productReceiptLinesReusable as any).rootColumns).toEqual(['qtyReceived', 'priceReceived', 'vatRatioReceived']);
    expect(() => (meta.productReceiptHeader as any).prepareCreateApi()).toThrow(/purchase order/);
  });
});

describe('the rules in the database', () => {
  it('the number of a document is PR-nnnnn from its own sequence', () => {
    expect(p).toContain("'PR-' || lpad(nextval('public.product_receipt_document_seq')::text, 5, '0')");
    expect(p).toContain('CREATE SEQUENCE IF NOT EXISTS public.product_receipt_document_seq;');
  });
  it('a receipt is made from a POSTED purchase order only; the quantity is what the order still has to deliver', () => {
    expect(one(code)).toContain("post the purchase order first: a product receipt is made from a posted purchase order");
    expect(one(code)).toContain('FROM public.product_receipt_lines r WHERE r."purchaseOrderLineGUID" = l."rowGUID" AND r."rowHeaderGUID" <> v_header');
    expect(one(code)).toContain("'nothingLeftToReceive'");
  });
  it('a vendor invoice is made from a POSTED receipt only; it remembers the receipt line and counts what was invoiced of it', () => {
    expect(one(code)).toContain('post the product receipt first: a vendor invoice is made from a posted product receipt');
    expect(one(code)).toContain(`l."rowJSON" || jsonb_build_object('productReceiptLineGUID', l."rowGUID")`);
    expect(one(code)).toContain(`i."rowJSON"->>'productReceiptLineGUID' = l."rowGUID"::text`);
    expect(one(code)).toContain("'vendorInvoiceProductReceipt', p_receipt");
    expect(one(code)).toContain("'nothingLeftToInvoice'");
    expect(one(tables)).toContain('idx_vendor_invoice_lines_receipt_line');
  });
  it('the lines point to the lines of the purchase order and are frozen like those of the order', () => {
    expect(one(tables)).toContain('"purchaseOrderLineGUID" UUID        REFERENCES public.purchase_order_lines("rowGUID") ON DELETE SET NULL');
    expect(one(code)).toContain('NEW."purchaseOrderLineGUID" IS DISTINCT FROM OLD."purchaseOrderLineGUID" AND NEW."purchaseOrderLineGUID" IS NOT NULL');
    expect(one(code)).toContain("product receipt: only the quantity, the price and the VAT %% of a line can be changed");
  });
  it('the register: Post writes the received movements in the same transaction, Unpost removes them', () => {
    expect(one(code)).toContain('PERFORM public.project_status_register_receipt(p_header);');
    expect(one(code)).toContain('PERFORM public.project_status_unregister(p_header);');
  });
  it('the database refuses what the form cannot: a posted receipt needs its vendor and its legal entity; RLS by the organization', () => {
    expect(one(code)).toContain('a posted product receipt needs its vendor (productReceiptPartner)');
    expect(one(code)).toContain('a posted product receipt needs its legal entity');
    expect(one(code)).toContain('ALTER TABLE public.product_receipt_header ENABLE ROW LEVEL SECURITY;');
    expect(one(code)).toContain('ALTER TABLE public.product_receipt_lines ENABLE ROW LEVEL SECURITY;');
  });
});

describe('the delete file', () => {
  it('drops the tables, the sequence and every function of the part - before the purchase order', () => {
    for (const t of [PRODUCT_RECEIPT_LINES_TABLE, PRODUCT_RECEIPT_HEADER_TABLE]) expect(del).toContain(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
    expect(del).toContain('DROP SEQUENCE IF EXISTS public.product_receipt_document_seq;');
    const fns = Array.from(one(code).matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)).map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(12);
    for (const f of fns) expect(del).toContain(`DROP FUNCTION IF EXISTS public.${f}(`);
    expect(del.indexOf('DROP TABLE IF EXISTS public.product_receipt_lines')).toBeLessThan(del.indexOf('DROP TABLE IF EXISTS public.purchase_order_lines'));
  });
});
