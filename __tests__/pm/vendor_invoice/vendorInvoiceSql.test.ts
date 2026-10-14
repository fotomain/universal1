// PART 26 of the SQL (legal entity, main vendor, vendor invoice): the structure file and the code file carry the same part, the delete file drops it, and the names the app calls exist in the SQL.
import * as fs from 'fs';
import * as path from 'path';
import {
  RPC_VENDOR_CANDIDATES, RPC_VENDOR_CREATE, RPC_VENDOR_DELETE, RPC_VENDOR_LIST, RPC_VENDOR_POST, RPC_VENDOR_SET_HEADER, RPC_VENDOR_UNPOST, VENDOR_INVOICE_HEADER_TABLE, VENDOR_INVOICE_LINES_TABLE,
  VENDOR_INVOICE_REGISTRATOR_TYPE,
} from '../../../kit8/pm/vendor_invoice/vendorInvoiceModel';
import { vendorInvoiceSystemMetaData } from '../../../kit8/pm/vendor_invoice/vendorInvoiceMetaData';

const sqlDir = path.join(__dirname, '../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const code = read('start2_sql_code.sql');
const structure = tables + '\n' + code;
const del = read('delete_sql_structure.sql');
const one = (src: string) => { const i = src.indexOf('-- PART 26: create_vendor_invoice.sql'); return i < 0 ? '' : src.slice(i, src.indexOf('-- END of start', i)); };
const part = (_src?: string) => one(tables) + '\n' + one(code);

describe('the part is in both files: the tables in start1_sql_tables.sql, the code in start2_sql_code.sql', () => {
  it('PART 26 exists in both; the tables file has the tables and no code, the code file has the code and no table', () => {
    expect(part(structure).length).toBeGreaterThan(20000);
    expect(one(tables)).toContain('CREATE TABLE IF NOT EXISTS public.vendor_invoice_header (');
    expect(one(tables)).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
    expect(one(code)).toMatch(/CREATE OR REPLACE FUNCTION public\.post_vendor_invoice\(/);
    expect(one(code)).not.toMatch(/CREATE TABLE/);
  });
  it('it comes after PART 25 and before the end marker', () => {
    for (const src of [tables, code]) {
      expect(src.indexOf('-- PART 25: create_monitor01.sql')).toBeLessThan(src.indexOf('-- PART 26: create_vendor_invoice.sql'));
      expect(src.indexOf('-- PART 26: create_vendor_invoice.sql')).toBeLessThan(src.indexOf('-- END of start'));
    }
  });
});

describe('the names the app calls', () => {
  it('the tables and the RPCs', () => {
    const p = part(structure);
    expect(p).toContain(`CREATE TABLE IF NOT EXISTS public.${VENDOR_INVOICE_HEADER_TABLE} (`);
    expect(p).toContain(`CREATE TABLE IF NOT EXISTS public.${VENDOR_INVOICE_LINES_TABLE} (`);
    for (const rpc of [RPC_VENDOR_CANDIDATES, RPC_VENDOR_CREATE, RPC_VENDOR_SET_HEADER, RPC_VENDOR_POST, RPC_VENDOR_UNPOST, RPC_VENDOR_DELETE, RPC_VENDOR_LIST]) {
      expect(p).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
      expect(p).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
    }
  });
  it('the registrator type of the movements is the entity name', () => {
    expect(part(structure)).toContain(`'${VENDOR_INVOICE_REGISTRATOR_TYPE}'`);
  });
  it('the redux entities read the tables of the SQL; the lines save the real columns the trigger computes from', () => {
    const m = vendorInvoiceSystemMetaData();
    expect(Object.values(m).map((e: any) => e.tableName)).toEqual([VENDOR_INVOICE_HEADER_TABLE, VENDOR_INVOICE_LINES_TABLE]);
    const lines = Object.values(m)[1] as any;
    for (const col of lines.rootColumns) expect(part(structure)).toContain(`"${col}"`);
    expect(() => (Object.values(m)[0] as any).prepareCreateApi()).toThrow('create_vendor_invoices');
    expect(() => lines.prepareCreateApi()).toThrow('task lines');
  });
});

describe('the rules in the database (the twins of the app rules)', () => {
  const p = part(structure);
  it('ONE vendor + ONE contract per document: the pair never changes, the contract is a contract of the vendor', () => {
    expect(p).toContain('the vendor and the contract of a vendor invoice cannot be changed');
    expect(p).toContain('is not a contract of the vendor');
  });
  it('the header is written only by the RPCs (select + delete of a draft by policy); the lines: select, update and delete of a DRAFT by the owner of the project, no insert', () => {
    expect(p).toContain('GRANT SELECT, DELETE ON public.vendor_invoice_header TO authenticated;');
    expect(p).toContain('GRANT SELECT, UPDATE, DELETE ON public.vendor_invoice_lines TO authenticated;');
    expect(p).not.toMatch(/GRANT[^;]*INSERT[^;]*vendor_invoice/);
    expect(p).toContain("CREATE POLICY vendor_invoice_lines_update");
    expect(p).toContain("public.vendor_invoice_state(\"rowHeaderGUID\") = 'draft' AND public.pm_owns_project(\"rowProjectGUID\")");
  });
  it('the legal entity of a contract is optional but must exist; the main vendor guard: a contract needs its vendor and must be the vendor\'s', () => {
    expect(p).toContain('CREATE TRIGGER trg_contract_legal_entity_guard BEFORE INSERT OR UPDATE OF "rowJSON" ON public."contractTable"');
    expect(p).toContain('mainVendorContractGUID needs mainVendorGUID');
    for (const table of ['partnerTable', 'equipmentTable', 'productTable']) expect(p).toContain(`CREATE TRIGGER trg_main_vendor_guard BEFORE INSERT OR UPDATE OF "rowJSON" ON public."${table}"`);
  });
  it('Post writes the register in the SAME transaction (a function call, not pg_cron); Unpost deletes it', () => {
    expect(p).toContain('PERFORM public.project_status_register_invoice(p_header);');
    expect(p).toContain('PERFORM public.project_status_unregister(p_header);');
    expect(p).not.toMatch(/cron\.schedule\('vendor/);
  });
  it('the 0333Effect rounding correction is NOT built (the user said so)', () => {
    const withoutComments = p.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(withoutComments).not.toMatch(/0333/i);                // no column, no function, no header key of it (the comment that says so is allowed)
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
  it('drops the tables (data included), the sequence, the functions and the guards', () => {
    for (const t of ['public.vendor_invoice_lines', 'public.vendor_invoice_header', 'public."legalEntityTable"']) expect(del).toContain(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    expect(del).toContain('DROP SEQUENCE IF EXISTS public.vendor_invoice_document_seq;');
    for (const fn of ['vendor_invoice_list(jsonb, integer, integer)', 'delete_vendor_invoice(uuid)', 'unpost_vendor_invoice(uuid)', 'post_vendor_invoice(uuid)', 'vendor_invoice_set_header(uuid, jsonb)', 'create_vendor_invoices(uuid, jsonb, text)', 'vendor_invoice_candidates(uuid, uuid[])', 'project_status_register_invoice(uuid)']) {
      expect(del).toContain(`DROP FUNCTION IF EXISTS public.${fn};`);
    }
    expect(del).toContain('DROP FUNCTION IF EXISTS public.main_vendor_guard() CASCADE;');
    expect(del).toContain('DROP FUNCTION IF EXISTS public.contract_legal_entity_guard() CASCADE;');
  });
  it('every function of the part is dropped', () => {
    const created = [...part(structure).matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(12);
    for (const fn of created) expect(del).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(`));
  });
});
