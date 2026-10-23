/** @jest-environment jsdom */
// PMPaymentFactGetFromPlan: the posted payments of the plan with something open; a check box each; the first one checked fixes the payee; "Only this task"; Add. The data hook is a fake.
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf } from '../../../pm/ui/pmUiTestKit';

const mockRows: { current: any[] } = { current: [] };
const mockFilters: any[] = [];
const mockState = { isLoading: false, error: null as string | null };
jest.mock('../../../../kit8/documents/payment/fact/usePaymentFact', () => ({
  usePlanCandidates: (header: string, filter: any) => { mockFilters.push({ header, filter }); return { rows: mockRows.current, isLoading: mockState.isLoading, error: mockState.error, refetch: jest.fn() }; },
}));
const PMPaymentFactGetFromPlan = require('../../../../kit8/documents/payment/fact/PMPaymentFactGetFromPlan').default;
import type { PaymentFactHeaderView, PlanCandidate } from '../../../../kit8/documents/payment/fact/paymentFactModel';

const T = 'payment-fact-plan';
const header: PaymentFactHeaderView = {
  guid: 'd1', number: 'PF-1', status: 'draft', paymentFactNumber: '', day: '', moneyAccountGUID: '', moneyAccountTitle: '', legalEntityTitle: '', currency: '', partnerGUID: '', personGUID: '', payeeTitle: '', direction: '', bankAmount: null,
  taskGUID: 't-1', projectGUID: 'p-1', projectCount: 0, authorName: 'Anna',
};
const cand = (guid: string, over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  planLineGUID: guid, taskGUID: 't-1', taskTitle: 'Task 1', projectGUID: 'p-1', projectName: 'Proj', direction: 'outbound', partnerGUID: 'pt-1', personGUID: null, payeeTitle: 'Supplier One', contractGUID: 'c1', contractInfo: 'C-1',
  budgetItem: 'bi', businessUnit: null, currency: 'EUR', plannedDay: '2030-01-05', planSum: 100, paid: 20, open: 80, ...over,
});
const row = (guid: string) => `${T}-row-${guid}`;
afterEach(() => { cleanupUI(); jest.clearAllMocks(); mockFilters.length = 0; mockState.isLoading = false; mockState.error = null; });

describe('the list', () => {
  it('one row per payment: the payee, the contract, the project and task, the day, the open sum with the plan and the paid', () => {
    mockRows.current = [cand('a'), cand('b', { payeeTitle: 'Other', partnerGUID: 'pt-2', open: 50, planSum: 50, paid: 0, contractInfo: '' })];
    renderUI(<PMPaymentFactGetFromPlan visible header={header} taskGUID="t-1" onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(textOf(row('a'))).toContain('Supplier One · C-1');
    expect(textOf(row('a'))).toContain('Proj › Task 1 · Outbound · 2030-01-05');
    expect(textOf(row('a'))).toContain('80.00 EUR');
    expect(textOf(row('a'))).toContain('plan 100.00 · paid 20.00');
    expect(textOf(row('b'))).toContain('no contract');
    expect(textOf(`${T}-total`)).toContain('0 payments');
  });
  it('nothing open: a message that says where payments are posted; loading and an error are shown', () => {
    mockRows.current = [];
    renderUI(<PMPaymentFactGetFromPlan visible header={header} onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(textOf(`${T}-empty`)).toContain('Post the payments of a task');
    cleanupUI();
    mockState.error = 'permission denied';
    renderUI(<PMPaymentFactGetFromPlan visible header={header} onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(textOf(`${T}-error`)).toBe('permission denied');
  });
});

describe('the choice', () => {
  it('the first one checked fixes the payee and the direction: the others of another payee are off', () => {
    mockRows.current = [cand('a'), cand('b', { contractGUID: 'c2', open: 40 }), cand('c', { partnerGUID: 'pt-2', payeeTitle: 'Other' }), cand('d', { direction: 'inbound' })];
    renderUI(<PMPaymentFactGetFromPlan visible header={header} onAdd={jest.fn()} onClose={jest.fn()} />);
    press(row('a'));
    press(row('c'));                                                     // another payee: refused
    press(row('d'));                                                     // the other direction: refused too
    expect(q(row('c'))!.getAttribute('aria-checked')).toBe('false');
    expect(q(row('d'))!.getAttribute('aria-checked')).toBe('false');
    press(row('b'));                                                     // the same payee, another contract: fine
    expect(textOf(`${T}-total`)).toContain('2 payments');
    expect(textOf(`${T}-total`)).toContain('120.00');
    press(row('a'));
    press(row('b'));                                                     // unchecked: the payee is free again
    press(row('c'));
    expect(q(row('c'))!.getAttribute('aria-checked')).toBe('true');
  });
  it('Add calls onAdd with the checked payments and closes; nothing checked: the button is off', async () => {
    mockRows.current = [cand('a'), cand('b')];
    const onAdd = jest.fn(async () => {});
    const onClose = jest.fn();
    renderUI(<PMPaymentFactGetFromPlan visible header={header} onAdd={onAdd} onClose={onClose} />);
    expect(qa(`${T}-add`)).toHaveLength(1);
    press(`${T}-add`);
    expect(onAdd).not.toHaveBeenCalled();
    press(row('a'));
    press(row('b'));
    await act(async () => { press(`${T}-add`); });
    expect(onAdd).toHaveBeenCalledWith(['a', 'b']);
    expect(onClose).toHaveBeenCalled();
  });
  it('Cancel and the x close without adding', () => {
    mockRows.current = [cand('a')];
    const onAdd = jest.fn();
    const onClose = jest.fn();
    renderUI(<PMPaymentFactGetFromPlan visible header={header} onAdd={onAdd} onClose={onClose} />);
    press(`${T}-cancel`);
    press(`${T}-close`);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('only this task', () => {
  it('starts ON for a document made for a task (the RPC gets taskGUID); the check box turns it off; no task = no check box', () => {
    mockRows.current = [cand('a')];
    renderUI(<PMPaymentFactGetFromPlan visible header={header} taskGUID="t-1" onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(mockFilters.at(-1)).toEqual({ header: 'd1', filter: { taskGUID: 't-1' } });
    press(`${T}-only-task`);
    expect(mockFilters.at(-1).filter).toEqual({});
    cleanupUI();
    renderUI(<PMPaymentFactGetFromPlan visible header={header} onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(q(`${T}-only-task`)).toBeNull();
    expect(mockFilters.at(-1).filter).toEqual({});
  });
  it('the title line names the payee and the direction of a document that has them', () => {
    mockRows.current = [];
    renderUI(<PMPaymentFactGetFromPlan visible header={{ ...header, payeeTitle: 'Supplier One', direction: 'outbound' }} onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(textOf(`${T}-title`)).toBe('Get from plan');
    expect(document.body.textContent).toContain('Supplier One · Outbound');
  });
});
