// Multi Project vendor invoice: the model (modes, the chevron, the list fields), the API calls, and the SQL it needs (mirror of the Docker test tests/70_vendor_invoice.sql section 9).
import fs from 'fs';
import path from 'path';
import {
  RPC_VENDOR_LINE_PLACES, RPC_VENDOR_SET_LINE_TASK, VENDOR_INVOICE_LINE_PLACE_FIELDS, VENDOR_INVOICE_PROJECT_MODES, VendorInvoiceHeaderView, canChooseProjectMode, parseListAnswer, vendorInvoiceProjectMode,
} from '../../../../kit8/documents/vendor/invoice/vendorInvoiceModel';
import { fetchVendorInvoiceLinePlaces, setVendorInvoiceHeader, setVendorInvoiceLineTask } from '../../../../kit8/documents/vendor/invoice/vendorInvoiceApi';

const h = (over: Partial<VendorInvoiceHeaderView> = {}): VendorInvoiceHeaderView => ({
  guid: 'd', number: 'VI-1', status: 'draft', vendorInvoiceNumber: '', day: '', legalEntityGUID: '', partnerGUID: '', contractGUID: null, currency: '', authorName: '', partnerTitle: '', contractInfo: '', legalEntityTitle: '', ...over,
});

describe('the project mode', () => {
  it('two modes: Single Project and Multi Project; a document is single unless the header says multi', () => {
    expect(VENDOR_INVOICE_PROJECT_MODES.map((m) => m.title)).toEqual(['Single Project', 'Multi Project']);
    expect(vendorInvoiceProjectMode(h())).toBe('single');
    expect(vendorInvoiceProjectMode(h({ multiProject: true }))).toBe('multi');
    expect(vendorInvoiceProjectMode(null)).toBe('single');
  });
  it('the chevron is offered on a DRAFT when the project setting is on (or the document is multi already); never on a posted one', () => {
    expect(canChooseProjectMode(h())).toBe(false);
    expect(canChooseProjectMode(h({ multiProjectAvailable: true }))).toBe(true);
    expect(canChooseProjectMode(h({ multiProject: true }))).toBe(true);
    expect(canChooseProjectMode(h({ multiProjectAvailable: true, status: 'posted' }))).toBe(false);
  });
  it('the three line fields of the Multi Project lines', () => {
    expect([...VENDOR_INVOICE_LINE_PLACE_FIELDS]).toEqual(['vendorInvoiceLineProject', 'vendorInvoiceTaskGUID', 'vendorInvoiceTaskLineGUID']);
  });
  it('the list rows carry multiProject and multiProjectAvailable (missing = false)', () => {
    const a = parseListAnswer({ totalCount: 2, rows: [{ documentGUID: 'a', multiProject: true, multiProjectAvailable: true }, { documentGUID: 'b' }] });
    expect(a.rows.map((r) => [r.multiProject, r.multiProjectAvailable])).toEqual([[true, true], [false, false]]);
  });
});

describe('the API calls', () => {
  it('set_header carries vendorInvoiceMultiProject', async () => {
    const rpc = jest.fn(async () => ({ error: null }));
    await setVendorInvoiceHeader({ rpc }, 'd1', { vendorInvoiceMultiProject: true });
    expect(rpc).toHaveBeenCalledWith('vendor_invoice_set_header', { p_header: 'd1', p_patch: { vendorInvoiceMultiProject: true } });
  });
  it('set_line_task: line, task, task line (null = clear); an error becomes an exception', async () => {
    const rpc = jest.fn(async () => ({ error: null }));
    await setVendorInvoiceLineTask({ rpc }, 'l1', null, 'tl1');
    expect(rpc).toHaveBeenCalledWith(RPC_VENDOR_SET_LINE_TASK, { p_line: 'l1', p_task: null, p_task_line: 'tl1' });
    await expect(setVendorInvoiceLineTask({ rpc: async () => ({ error: { message: 'not your project' } }) }, 'l1', 't', null)).rejects.toThrow('not your project');
  });
  it('line_places: { line: place }', async () => {
    const rpc = jest.fn(async () => ({ data: { l1: { projectGUID: 'p', projectName: 'P1', taskGUID: 't', taskName: 'T', taskLineGUID: null } }, error: null }));
    const places = await fetchVendorInvoiceLinePlaces({ rpc }, 'd1');
    expect(rpc).toHaveBeenCalledWith(RPC_VENDOR_LINE_PLACES, { p_header: 'd1' });
    expect(places.l1).toMatchObject({ projectName: 'P1', taskName: 'T', taskLineGUID: null });
  });
});

describe('the SQL (start2_sql_code.sql PART 26; the Docker test is tests/70_vendor_invoice.sql section 9)', () => {
  const dir = path.join(__dirname, '../../../../kit8/sql/start');
  const start2 = fs.readFileSync(path.join(dir, 'start2_sql_code.sql'), 'utf8');
  const del = fs.readFileSync(path.join(dir, 'delete_sql_structure.sql'), 'utf8');
  it('the functions exist, are granted to authenticated only, and are dropped by the delete file', () => {
    for (const [fn, args] of [['vendor_project_setting_on', 'uuid, text'], ['vendor_invoice_set_line_task', 'uuid, uuid, uuid'], ['vendor_invoice_line_places', 'uuid']]) {
      expect(start2).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
      expect(start2).toContain(`REVOKE ALL ON FUNCTION public.${fn}(${args}) FROM PUBLIC, anon;`);
      expect(start2).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}(${args}) TO authenticated;`);
      expect(del).toContain(`DROP FUNCTION IF EXISTS public.${fn}(${args});`);
    }
    expect(del).toContain('DROP FUNCTION IF EXISTS public.vendor_task_line_snapshot(uuid);');
  });
  it('the move of a line is allowed only inside the RPC (a session flag the trigger reads), and it is reset', () => {
    expect(start2).toContain("current_setting('app.vendor_invoice_line_move', true)");
    expect(start2).toContain("set_config('app.vendor_invoice_line_move', 'on', true)");
    expect(start2).toContain("set_config('app.vendor_invoice_line_move', 'off', true)");
  });
  it('the setting is read by the project switch that is OFF by default; set_header refuses Multi when it is off', () => {
    expect(start2).toContain("multiProjectVendorInvoceNeeded");
    expect(start2).toMatch(/COALESCE\(\(SELECT p\."rowJSON"->>p_key FROM public\.project_table p WHERE p\."rowGUID" = p_project\), 'false'\) = 'true'/);
    expect(start2).toContain('multi project vendor invoices are switched off in the project settings (Vendor)');
  });
});
