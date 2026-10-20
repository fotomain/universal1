/** @jest-environment jsdom */
// The strip above the table of Monitor01 (documentation/ROI_DOC.html section 7.1): the money of the month totals on the VAT basis of the screen; absent when there is nothing or the read fails.
import { act } from 'react';
import { cleanupUI, q, renderUI, textOf } from '../../ui/pmUiTestKit';
import { zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';

const mockFetch = jest.fn();
jest.mock('../../../../kit8/pm/reports/roi/roiApi', () => ({ ...jest.requireActual('../../../../kit8/pm/reports/roi/roiApi'), fetchRoiMonthTotals: (...a: any[]) => mockFetch(...a) }));
const mockClient = { from: () => ({}) };
// pmUiTestKit mocks WithSupabase itself (a new client object per render): override it with doMock + require AFTER the kit is imported
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));

const Monitor01ProjectStrip = require('../../../../kit8/pm/reports/monitor01/Monitor01ProjectStrip').default;
const rows = [{ projectGUID: 'p1', month: '2026-10-01', money: { ...zeroMoney(), costPlanNet: 1000, costPlanVat: 200, costPlanVatInCost: 50, costInvoicedNet: 900, costInvoicedVat: 180, revenueInvoicedNet: 1200, revenueInvoicedVat: 240 } }];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('Monitor01ProjectStrip', () => {
  it('shows Budget, Vendor Invoice Amount and Customer Invoice Amount on the Cost basis', async () => {
    mockFetch.mockResolvedValue(rows);
    renderUI(<Monitor01ProjectStrip projectGUID="p1" startDate="" finishDate="" vatBasis="cost" />);
    await flush();
    expect(textOf('monitor01-strip-costPlan')).toBe('1 050.00');
    expect(textOf('monitor01-strip-vendorInvoiced')).toBe('900.00');
    expect(textOf('monitor01-strip-customerInvoiced')).toBe('1 200.00');
  });
  it('follows the VAT basis of the screen', async () => {
    mockFetch.mockResolvedValue(rows);
    renderUI(<Monitor01ProjectStrip projectGUID="p1" startDate="" finishDate="" vatBasis="gross" />);
    await flush();
    expect(textOf('monitor01-strip-costPlan')).toBe('1 200.00');
    expect(textOf('monitor01-strip-customerInvoiced')).toBe('1 440.00');
  });
  it('reads the project of the bar and the period of the dates; no project = all of mine', async () => {
    mockFetch.mockResolvedValue(rows);
    renderUI(<Monitor01ProjectStrip projectGUID="p1" startDate="2026-10-05" finishDate="" vatBasis="net" />);
    await flush();
    expect(mockFetch.mock.calls[0].slice(1)).toEqual([['p1'], '2026-10-05', null]);
    cleanupUI();
    renderUI(<Monitor01ProjectStrip projectGUID={null} startDate="" finishDate="" vatBasis="net" />);
    await flush();
    expect(mockFetch.mock.calls[1].slice(1)).toEqual([null, null, null]);
  });
  it('nothing in the month totals, or a failing read (an old database): no strip, the report works without it', async () => {
    mockFetch.mockResolvedValue([]);
    renderUI(<Monitor01ProjectStrip projectGUID="p1" startDate="" finishDate="" vatBasis="cost" />);
    await flush();
    expect(q('monitor01-strip')).toBeNull();
    cleanupUI();
    mockFetch.mockRejectedValue(new Error('relation does not exist'));
    renderUI(<Monitor01ProjectStrip projectGUID="p1" startDate="" finishDate="" vatBasis="cost" />);
    await flush();
    expect(q('monitor01-strip')).toBeNull();
  });
  it('reads again when the report\'s rows change (refreshKey)', async () => {
    mockFetch.mockResolvedValue(rows);
    const view = renderUI(<Monitor01ProjectStrip projectGUID="p1" startDate="" finishDate="" vatBasis="cost" refreshKey={1} />);
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    view.rerender(<Monitor01ProjectStrip projectGUID="p1" startDate="" finishDate="" vatBasis="cost" refreshKey={2} />);
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
