// PART 28 of the SQL (the purchase order): the structure file and the code file carry the same part, the delete file drops it, and the names the app calls exist in the SQL.
// (Docker tests on a real Postgres 15: kit8/docker/tests/71_purchase_order.sql and 72_purchase_order_and_invoice.sql.)
import * as fs from 'fs';
import * as path from 'path';
import {
  PURCHASE_ORDER_HEADER_TABLE, PURCHASE_ORDER_LINES_TABLE, PURCHASE_ORDER_REGISTRATOR_TYPE, RPC_PO_ADD_LINE, RPC_PO_CANDIDATES, RPC_PO_CREATE, RPC_PO_DELETE, RPC_PO_LINE_PLACES, RPC_PO_LIST, RPC_PO_POST,
  RPC_PO_SET_HEADER, RPC_PO_SET_LINE_TASK, RPC_PO_UNPOST,
} from '../../../../kit8/documents/vendor/purchase_order/purchaseOrderModel';
import { purchaseOrderSystemMetaData } from '../../../../kit8/documents/vendor/purchase_order/purchaseOrderMetaData';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const code = read('start2_sql_code.sql');
const del = read('delete_sql_structure.sql');
const MARK = '-- PART 28: create_purchase_order.sql';
const one = (src: string) => { const i = src.indexOf(MARK); if (i < 0) return ''; const next = src.indexOf('\n-- PART 29:', i); return src.slice(i, next < 0 ? src.indexOf('-- END of start', i) : next); };   // up to PART 29 (PART 30 is the product receipt)
const p = one(tables) + '\n' + one(code);

describe('the part is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 28 exists in both; the tables file has the tables and no code, the code file has the code and no table', () => {
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${PURCHASE_ORDER_HEADER_TABLE} (`);
    expect(one(tables)).toContain(`CREATE TABLE IF NOT EXISTS public.${PURCHASE_ORDER_LINES_TABLE} (`);
    expect(one(tables)).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(one(code)).toMatch(/CREATE OR REPLACE FUNCTION public\.post_purchase_order\(/);
    expect(one(code)).not.toMatch(/CREATE TABLE/);
    expect(p.length).toBeGreaterThan(30000);
  });
  it('it comes after PART 27 and before the end marker, in both', () => {
    for (const src of [tables, code]) {
      expect(src.indexOf('-- PART 27: create_project_cost_total.sql')).toBeLessThan(src.indexOf(MARK));
      expect(src.indexOf(MARK)).toBeGreaterThan(0);
      expect(src.indexOf(MARK)).toBeLessThan(src.indexOf('-- END of start'));
    }
  });
});

describe('the names the app calls', () => {
  it('the tables and the RPCs, each granted to authenticated', () => {
    for (const rpc of [RPC_PO_CANDIDATES, RPC_PO_CREATE, RPC_PO_SET_HEADER, RPC_PO_ADD_LINE, RPC_PO_SET_LINE_TASK, RPC_PO_LINE_PLACES, RPC_PO_POST, RPC_PO_UNPOST, RPC_PO_DELETE, RPC_PO_LIST]) {
      expect(p).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
      expect(p).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
    }
  });
  it('the registrator type of the movements is the entity name; the kind is "ordered"', () => {
    expect(p).toContain(`'${PURCHASE_ORDER_REGISTRATOR_TYPE}'`);
    expect(p).toContain("SELECT 'ordered', COALESCE(NULLIF(h.\"rowJSON\"->>'purchaseOrderDateTime', '')::timestamptz, h.\"created_at\")");
    expect(p).not.toContain("'invoiced'");
  });
  it('the redux entities read the tables of the SQL; the lines save the real columns the trigger computes from', () => {
    const m = purchaseOrderSystemMetaData();
    expect(Object.values(m).map((e: any) => e.tableName)).toEqual([PURCHASE_ORDER_HEADER_TABLE, PURCHASE_ORDER_LINES_TABLE]);
    const lines = Object.values(m)[1] as any;
    expect(lines.rootColumns).toEqual(['qtyOrdered', 'priceOrdered', 'vatRatioOrdered', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT']);
    for (const col of lines.rootColumns) expect(p).toContain(`"${col}"`);
    expect(() => (Object.values(m)[0] as any).prepareCreateApi()).toThrow('create_purchase_orders');
    expect(() => lines.prepareCreateApi()).toThrow('task lines');
  });
});

describe('the rules in the database (the twins of the vendor invoice rules)', () => {
  it('ONE vendor + ONE contract per document: the pair changes only while the document is UNPOSTED, the contract is a contract of the vendor', () => {
    expect(p).toContain('the vendor and the contract of a POSTED purchase order cannot be changed');
    expect(p).toContain('is not a contract of the vendor');
  });
  it('the header is written only by the RPCs (select + delete of a draft by policy); the lines: select, update and delete of a DRAFT by the owner of the project, no insert', () => {
    expect(p).toContain('GRANT SELECT, DELETE ON public.purchase_order_header TO authenticated;');
    expect(p).toContain('GRANT SELECT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;');
    expect(p).not.toMatch(/GRANT[^;]*INSERT[^;]*purchase_order/);
    expect(p).toContain('CREATE POLICY purchase_order_lines_update');
    expect(p).toContain("public.purchase_order_state(\"rowHeaderGUID\") = 'draft' AND public.pm_owns_project(\"rowProjectGUID\")");
  });
  it('Post writes the register in the SAME transaction (a function call, not pg_cron); Unpost deletes it', () => {
    expect(p).toContain('PERFORM public.project_status_register_order(p_header);');
    expect(p).toContain('PERFORM public.project_status_unregister(p_header);');
    expect(p).not.toMatch(/cron\.schedule\('purchase/);
  });
  it('the number of a document is PO-nnnnn from its own sequence', () => {
    expect(p).toContain("'PO-' || lpad(nextval('public.purchase_order_document_seq')::text, 5, '0')");
    expect(p).toContain('CREATE SEQUENCE IF NOT EXISTS public.purchase_order_document_seq;');
  });
  it('the quantity of a new line is what is not on a PURCHASE ORDER yet - never counted against vendor invoices', () => {
    expect(p).toContain('FROM public.purchase_order_lines i WHERE i."taskLineGUID" = l."rowGUID"');
    expect(p).not.toContain('vendor_invoice_lines');
  });
  it('Multi Project: the move of a line is allowed only inside the RPC (a session flag), reset after it; the setting that is OFF by default', () => {
    expect(p).toContain("current_setting('app.purchase_order_line_move', true)");
    expect(p).toContain("set_config('app.purchase_order_line_move', 'on', true)");
    expect(p).toContain("set_config('app.purchase_order_line_move', 'off', true)");
    expect(p).toContain('vendor_project_setting_on(NULLIF(h."rowJSON"->>\'purchaseOrderProject\', \'\')::uuid, \'multiProjectVendorInvoceNeeded\')');
    expect(p).toContain('multi project purchase orders are switched off in the project settings (Vendor)');
  });
  it('the vendors of the lines are the ones of the vendor invoice (one rule, one function)', () => {
    expect(p).toContain('SELECT public.vendor_invoice_candidates(p_task, p_lines);');
  });
  it('the legal entity of a purchase order is not deleted (the guard of PART 26 knows the table)', () => {
    expect(code).toContain("to_regclass('public.purchase_order_header') IS NOT NULL AND EXISTS (SELECT 1 FROM public.purchase_order_header h WHERE h.\"rowOwnerGUID\" = OLD.\"rowGUID\")");
  });
  it('a RAISE message has exactly as many arguments as placeholders (% alone is a placeholder, %% is a percent sign)', () => {
    const raises = [...p.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'([^;]*);/g)];
    expect(raises.length).toBeGreaterThan(20);
    for (const m of raises) {
      const placeholders = (m[1].replace(/%%/g, '').match(/%/g) || []).length;
      const beforeUsing = m[2].split(/\s+USING\s+/)[0];
      const args = beforeUsing.trim() === '' ? 0 : beforeUsing.split(',').filter((x) => x.trim() !== '').length;
      expect({ message: m[1], placeholders }).toEqual({ message: m[1], placeholders: args });
    }
  });
});

describe('the delete file', () => {
  it('drops the tables (data included) and the sequence', () => {
    for (const t of ['public.purchase_order_lines', 'public.purchase_order_header']) expect(del).toContain(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    expect(del).toContain('DROP SEQUENCE IF EXISTS public.purchase_order_document_seq;');
  });
  it('every function of the part is dropped', () => {
    const created = [...one(code).matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(12);
    for (const fn of created) expect(del).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(`));
  });
});
