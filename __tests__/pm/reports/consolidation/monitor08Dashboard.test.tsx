/** @jest-environment jsdom */
// Monitor08 Consolidation (the screen): the golden example of the document through the screen - A (EUR) 5 000 + B (USD) 10 000 at 1.25 = 8 000 EUR.
import React from 'react';
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../ui/pmUiTestKit';

const rpcRows = [
  { o_project: 'pa', o_project_name: 'Project A', o_month: null, o_kind: 'used', o_side: 'purchase', o_qty: 1, o_amount: 5050, o_net: 5000, o_vat: 1050, o_vat_in_cost: 50, o_budget_currency: 'EUR', o_budget_net: 5000, o_budget_vat: 1050, o_budget_vat_in_cost: 50, o_currency: 'EUR' },
  { o_project: 'pb', o_project_name: 'Project B', o_month: null, o_kind: 'used', o_side: 'purchase', o_qty: 1, o_amount: 8080, o_net: 8000, o_vat: 1680, o_vat_in_cost: 80, o_budget_currency: 'USD', o_budget_net: 10000, o_budget_vat: 2100, o_budget_vat_in_cost: 100, o_currency: 'EUR' },
];
const mockRpc = jest.fn((_name: string, _args?: any) => Promise.resolve({ data: rpcRows, error: null }));
const mockClient = { rpc: (n: string, a?: any) => mockRpc(n, a) };
jest.mock('../../../../kit8/catalog/organization/consolidation/useConsolidationStatus', () => ({
  useConsolidationStatus: () => ({ status: { currency: 'EUR', rateType: 'Default', includePurchaseVAT: false, includeSaleVAT: false, state: 'ready', gaps: 0, queued: 0 }, error: null, busy: false, reload: jest.fn(), refreshNow: jest.fn() }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }), { virtual: true });

// pmUiTestKit mocks WithSupabase itself: override with doMock + require AFTER the kit (KNOW_HOW section 7). ONE client object for every render (a new one per render would loop the effect that reads)
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));
const Monitor08Dashboard = require('../../../../kit8/pm/reports/consolidation/Monitor08Dashboard').default;
const { resetCurrencyBasisForTest } = require('../../../../kit8/pm/reports/common/useCurrencyBasis');

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('Monitor08 Consolidation', () => {
  beforeEach(() => { resetCurrencyBasisForTest(); mockRpc.mockClear(); });
  afterEach(() => cleanupUI());

  it('reads the report from the database and adds the projects in the consolidation currency', async () => {
    renderUI(<Monitor08Dashboard />);
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('consolidation_report', { p_projects: null, p_from: null, p_to: null, p_by_month: false });
    expect(textOf('monitor08-table-row-pa')).toContain('Project A');
    expect(textOf('monitor08-table-row-pb')).toContain('8 080.00');
    expect(textOf('monitor08-table-footer')).toContain('13 130.00');
    expect(textOf('monitor08-basis-text')).toContain('Amounts in EUR (consolidation)');
    expect(textOf('monitor08-basis-text')).toContain('VAT: purchase without, sale without (set by the organization)');
    expect(textOf('monitor08-state')).toContain('Ready');
    expect(q('monitor08-vat-basis')).toBeNull(); // the VAT basis is the organization's in this basis
  });

  it('the project currency basis shows each project in its own currency and does NOT add them', async () => {
    renderUI(<Monitor08Dashboard />);
    await flush();
    press('monitor08-currency-basis-radio-project');
    expect(textOf('monitor08-table-row-pb')).toContain('USD');
    expect(textOf('monitor08-table-row-pb')).toContain('10 100.00');
    expect(q('monitor08-table-mixed')).not.toBeNull();
    expect(textOf('monitor08-table-mixed')).toContain('EUR, USD');
    expect(q('monitor08-vat-basis')).not.toBeNull(); // the VAT basis of the report is back
  });
});
