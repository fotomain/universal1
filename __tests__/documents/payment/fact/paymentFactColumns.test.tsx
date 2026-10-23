/** @jest-environment jsdom */
// paymentFactColumns - the columns of the lines of a payment fact: which are editable, which catalogs they offer, the Errors column, the amount of the money account (typed / converted).
import '../../../pm/ui/pmUiTestKit';
import React from 'react';
import { buildPaymentFactColumns, paymentFactErrors } from '../../../../kit8/documents/payment/fact/paymentFactColumns';
import { emptyTaskLineCatalogs } from '../../../../kit8/pm/view/task/finances/taskLineCatalogs';

jest.mock('../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: (p: any) => require('react').createElement('i', { 'data-testid': p.testID }) }));
jest.mock('../../../../kit8/catalog/select/with_folders/SelectCatalogItemWithFolders', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../kit8/catalog/select/from_tree/SelectCatalogItemFromTreeReusable', () => ({ __esModule: true, default: () => null }));

const row = (rowGUID: string, over: Record<string, any> = {}, json: Record<string, any> = {}) => ({ rowGUID, rowHeaderGUID: 'd1', rowProjectGUID: 'p1', rowOwnerGUID: 't1', paymentPlanLineGUID: null, rowJSON: json, ...over });
const data = () => {
  const d = emptyTaskLineCatalogs();
  d.budgetItem = [
    { rowGUID: 'bi_out', rowParentGUID: 'f1', rowJSON: { title: 'Vendor payments', managementGenusItem: 'outboundPaymentGenus' } },
    { rowGUID: 'bi_in', rowParentGUID: 'f1', rowJSON: { title: 'Customer receipts', managementGenusItem: 'inboundPaymentGenus' } },
    { rowGUID: 'bi_time', rowParentGUID: 'f2', rowJSON: { title: 'Time', managementGenusItem: 'timeGenus' } },
  ] as any;
  return d;
};
const ctx = (over: Record<string, any> = {}) => ({
  data: data(), direction: 'outbound' as const, payee: { kind: 'partner' as const, guid: 'pt1' }, accountCurrency: 'EUR', editable: true, places: { l1: { projectGUID: 'p1', projectName: 'Proj', taskGUID: 't1', taskName: 'Task One', taskLineGUID: null } },
  textColor: '#000', errorColor: '#d00', ...over,
});
const col = (cols: any[], key: string) => cols.find((c) => c.key === key);

describe('the column list', () => {
  it('Errors (pinned first) · # · Project · Task · Contract · Budget item · Currency · Plan · Sum · Accounting · Budget · Amount of the money account · Amount is', () => {
    const keys = buildPaymentFactColumns(ctx()).map((c: any) => c.key);
    expect(keys).toEqual(['errors', 'n', 'project', 'task', 'contract', 'budgetItem', 'currency', 'planSum', 'sum', 'sumAcc', 'sumBud', 'sumAccount', 'accountSource']);
    expect(col(buildPaymentFactColumns(ctx()), 'errors').pinFirst).toBe(true);
  });
  it('the Errors column is left out when no line has a problem; the business unit column is there only when the catalog has units', () => {
    expect(buildPaymentFactColumns(ctx({ showErrors: false })).some((c: any) => c.key === 'errors')).toBe(false);
    const d = data();
    d.businessUnit = [{ rowGUID: 'bu1', rowParentGUID: 'empty', rowJSON: { title: 'Unit' } }] as any;
    expect(buildPaymentFactColumns(ctx({ data: d })).map((c: any) => c.key)).toContain('businessUnit');
    expect(buildPaymentFactColumns(ctx()).map((c: any) => c.key)).not.toContain('businessUnit');
  });
});

describe('editable or read only', () => {
  it('a draft: contract, budget item, the sum and the amount of the money account; the converted sums, the project, the task and the source are read only', () => {
    const cols = buildPaymentFactColumns(ctx());
    expect(cols.filter((c: any) => c.editable === true).map((c: any) => c.key)).toEqual(['contract', 'budgetItem', 'sum', 'sumAccount']);
    for (const k of ['sumAcc', 'sumBud', 'currency', 'planSum', 'project', 'task', 'accountSource']) expect(col(cols, k).editable).toBe(false);
  });
  it('a posted document: nothing is editable', () => {
    const cols = buildPaymentFactColumns(ctx({ editable: false }));
    expect(cols.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('the money columns store in rowJSON through the fields sumForContract / sumForMoneyAccount; the title of the amount names the currency of the account', () => {
    const cols = buildPaymentFactColumns(ctx());
    expect(col(cols, 'sum')).toMatchObject({ field: 'sumForContract', type: 'number', total: false });
    expect(col(cols, 'sumAccount')).toMatchObject({ field: 'sumForMoneyAccount', type: 'number' });
    expect(col(cols, 'sumAccount').title).toBe('Amount of the money account (EUR)');
    expect(col(buildPaymentFactColumns(ctx({ accountCurrency: '' })), 'sumAccount').title).toBe('Amount of the money account');
    expect(col(cols, 'sumAcc').field).toBe('sumForAccounting');
    expect(col(cols, 'sumBud').field).toBe('sumForBudget');
  });
});

describe('the catalogs', () => {
  it('the contracts offered are the contracts of the payee (a partner / a person); the one already chosen stays', () => {
    const f = col(buildPaymentFactColumns(ctx()), 'contract').filterItem;
    const r = row('l1', {}, { paymentFactContract: 'c9' });
    expect(f({ rowGUID: 'c1', rowOwnerGUID: 'pt1', rowParentGUID: 'partner' }, r)).toBe(true);
    expect(f({ rowGUID: 'c2', rowOwnerGUID: 'pt2', rowParentGUID: 'partner' }, r)).toBe(false);
    expect(f({ rowGUID: 'c3', rowOwnerGUID: 'pt1', rowParentGUID: 'person' }, r)).toBe(false);
    expect(f({ rowGUID: 'c9', rowOwnerGUID: 'other', rowParentGUID: 'partner' }, r)).toBe(true);
    const fp = col(buildPaymentFactColumns(ctx({ payee: { kind: 'person', guid: 'pe1' } })), 'contract').filterItem;
    expect(fp({ rowGUID: 'c4', rowOwnerGUID: 'pe1', rowParentGUID: 'person' }, r)).toBe(true);
    expect(col(buildPaymentFactColumns(ctx({ payee: null })), 'contract').filterItem({ rowGUID: 'c1', rowOwnerGUID: 'pt1', rowParentGUID: 'partner' }, r)).toBe(false);
  });
  it('the budget items offered are the items of the payments genus of the direction (not a folder, not a cost item)', () => {
    const out = col(buildPaymentFactColumns(ctx()), 'budgetItem').filterItem;
    const rows = data().budgetItem as any[];
    expect(rows.filter(out).map((r) => r.rowGUID)).toEqual(['bi_out']);
    const inb = col(buildPaymentFactColumns(ctx({ direction: 'inbound' })), 'budgetItem').filterItem;
    expect(rows.filter(inb).map((r) => r.rowGUID)).toEqual(['bi_in']);
    expect(rows.filter(col(buildPaymentFactColumns(ctx({ direction: '' })), 'budgetItem').filterItem)).toEqual([]);
  });
});

describe('the cells', () => {
  const cell = (key: string, r: any, over: Record<string, any> = {}) => col(buildPaymentFactColumns(ctx(over)), key).renderCell(r);
  it('project and task: the names of the lines; the task cell is editable only on a line without a plan payment, in a draft, with the actions', () => {
    expect(cell('project', row('l1')).props.children).toBe('Proj');
    expect(cell('project', row('zz')).props.children).toBe('');
    const actions = { paste: jest.fn(), pick: jest.fn(), clear: jest.fn() };
    expect(cell('task', row('l1'), { placeActions: actions }).props).toMatchObject({ field: 'task', editable: true, testID: 'payment-fact-place-task-l1' });
    expect(cell('task', row('l1', { paymentPlanLineGUID: 'pl' }), { placeActions: actions }).props.editable).toBe(false);
    expect(cell('task', row('l1'), { placeActions: actions, editable: false }).props.editable).toBe(false);
    expect(cell('task', row('l1')).props.editable).toBe(false);
    cell('task', row('l1'), { placeActions: actions }).props.onPick();
    expect(actions.pick).toHaveBeenCalledWith('task', expect.objectContaining({ rowGUID: 'l1' }));
  });
  it('plan: shown in the error colour when the line pays another sum than the plan; the amount source says typed / converted', () => {
    const differs = row('l1', { paymentPlanLineGUID: 'pl' }, { paymentFactPlanSum: 100, sumForContract: 150 });
    const same = row('l2', { paymentPlanLineGUID: 'pl' }, { paymentFactPlanSum: 100, sumForContract: 100 });
    expect(cell('planSum', differs).props.style.color).toBe('#d00');
    expect(cell('planSum', same).props.style.color).toBe('#000');
    expect(cell('planSum', row('l3')).props.children).toBe('');
    expect(cell('accountSource', row('l1', {}, { moneyAccountSumSource: 'typed' })).props.children).toBe('typed');
    expect(cell('accountSource', row('l1', {}, { moneyAccountSumSource: 'auto' })).props.children).toBe('converted');
  });
  it('the Errors cell lists what is wrong with a line and is empty for a good one', () => {
    const bad = row('l1', {}, { paymentFactFxProblem: 'No Budget exchange rate of USD on or before 2030-01-05' });
    const html = cell('errors', bad);
    expect(html).not.toBeNull();
    expect(paymentFactErrors(bad)).toEqual(['A line needs a contract.', 'A line needs a budget item.', 'A line needs a currency (it comes from the contract).', 'A line needs a sum greater than 0.', 'No Budget exchange rate of USD on or before 2030-01-05']);
    expect(cell('errors', row('l2', {}, { paymentFactContract: 'c', paymentFactBudgetItem: 'b', paymentFactCurrency: 'EUR', sumForContract: 5 }))).toBeNull();
    expect(col(buildPaymentFactColumns(ctx()), 'errors').searchText(bad)).toContain('needs a contract');
  });
});
