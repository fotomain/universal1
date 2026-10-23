/** @jest-environment jsdom */
// The columns Paid / Open of the payment plan (documentation/PAYMENTS_FACT_WBS.html, Q8): what the POSTED payment facts have paid of each POSTED payment of the task. The hook reads task_payment_paid (a fake here),
// the columns are read only and appear only while there is a posted payment.
import '../../../ui/pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../../ui/pmUiTestKit';
import { buildPaymentColumns } from '../../../../../kit8/pm/view/task/payments/paymentPlanColumns';
import { DAYS, paymentData } from './paymentsTestKit';

const mockFetch = jest.fn();
jest.mock('../../../../../kit8/pm/view/task/payments/paymentPlanApi', () => ({
  ...jest.requireActual('../../../../../kit8/pm/view/task/payments/paymentPlanApi'),
  fetchPlanPaid: (...a: any[]) => mockFetch(...a),
}));
jest.mock('../../../../../kit8/catalog/select/with_folders/SelectCatalogItemWithFolders', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/catalog/select/from_tree/SelectCatalogItemFromTreeReusable', () => ({ __esModule: true, default: () => null }));
const { usePaymentPlanPaid } = require('../../../../../kit8/pm/view/task/payments/usePaymentPlan');

const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('usePaymentPlanPaid', () => {
  let latest: Map<string, any>;
  const Probe = ({ task, sig, enabled }: { task: string; sig: string; enabled?: boolean }) => { latest = usePaymentPlanPaid(task, sig, enabled); return null; };
  it('reads the paid / open of the task into a map by plan payment; reads again when the posting of the payments changes', async () => {
    mockFetch.mockResolvedValue([{ planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 }, { planLineGUID: 'pl2', planSum: 50, paid: 0, open: 50 }]);
    const view = renderUI(<Probe task="t1" sig="posted|1" />);
    await flush();
    expect(mockFetch).toHaveBeenCalledWith('t1');
    expect(latest.get('pl1')).toEqual({ planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 });
    expect(latest.size).toBe(2);
    view.rerender(<Probe task="t1" sig="posted|1" />);
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    view.rerender(<Probe task="t1" sig="draft|0" />);
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  it('a failure leaves the map empty (the columns then show nothing); no task or disabled = nothing is read', async () => {
    mockFetch.mockRejectedValue(new Error('permission denied'));
    renderUI(<Probe task="t1" sig="a" />);
    await flush();
    expect(latest.size).toBe(0);
    cleanupUI();
    mockFetch.mockClear();
    renderUI(<Probe task="" sig="a" />);
    renderUI(<Probe task="t1" sig="b" enabled={false} />);
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('the columns', () => {
  const ctx = (paid?: Map<string, any>) => ({ data: paymentData(), direction: 'outbound' as const, days: DAYS, afterFinishOn: true, fx: null, fxProject: null, projectCurrency: 'USD', textColor: '#000', errorColor: '#d00', showErrors: false, paid });
  const keys = (paid?: Map<string, any>) => buildPaymentColumns(ctx(paid)).map((c: any) => c.key);
  const paid = new Map([['pl1', { planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 }], ['pl2', { planLineGUID: 'pl2', planSum: 50, paid: 70, open: -20 }]]);
  it('Paid and Open come last and only while a payment is posted (the map has rows)', () => {
    expect(keys()).not.toContain('paid');
    expect(keys(new Map())).not.toContain('open');
    const k = keys(paid);
    expect(k.slice(-2)).toEqual(['paid', 'open']);
  });
  it('read only; the cell shows the money of ITS payment, empty for a payment that is not posted; an overpaid payment is shown in the error colour', () => {
    const cols = buildPaymentColumns(ctx(paid));
    const paidCol: any = cols.find((c: any) => c.key === 'paid');
    const openCol: any = cols.find((c: any) => c.key === 'open');
    expect(paidCol.editable).toBe(false);
    expect(openCol.editable).toBe(false);
    expect(paidCol.title).toBe('Paid (with VAT)');
    expect(paidCol.renderCell({ rowGUID: 'pl1' }).props.children).toMatch(/40[.,]00/);
    expect(openCol.renderCell({ rowGUID: 'pl1' }).props.style.color).toBe('#000');
    expect(openCol.renderCell({ rowGUID: 'pl2' }).props.style.color).toBe('#d00');
    expect(openCol.renderCell({ rowGUID: 'pl2' }).props.children).toMatch(/-20[.,]00/);
    expect(paidCol.renderCell({ rowGUID: 'other' }).props.children).toBe('');
    expect(paidCol.searchText({ rowGUID: 'pl1' })).toBe('40');
    expect(openCol.searchText({ rowGUID: 'other' })).toBe('');
  });
});
