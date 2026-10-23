/** @jest-environment jsdom */
// The data hooks of the payment fact: the list, the documents of the form with their commands, the plan payments of "Get from plan", the paid / open of the plan, the starter of the task menu, "open", "Refresh rests".
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../../pm/ui/pmUiTestKit';

const fake: any = { calls: [] as { name: string; args: any }[], rpc: {} as Record<string, any> };
fake.client = { rpc: jest.fn(async (name: string, args: any) => { fake.calls.push({ name, args }); const r = fake.rpc[name]; return typeof r === 'function' ? r(args) : r ?? { data: null, error: null }; }) };
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const { usePaymentFactList, usePaymentFactDocuments, usePlanCandidates, useTaskPaymentPaid, useStartPaymentFact, useOpenPaymentFact, useRefreshCashLedger } = require('../../../../kit8/documents/payment/fact/usePaymentFact');
import { EMPTY_PAYMENT_FACT_FILTER } from '../../../../kit8/documents/payment/fact/paymentFactModel';

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const callsOf = (name: string) => fake.calls.filter((c: any) => c.name === name);
const docRow = (guid: string, over: Record<string, any> = {}) => ({ documentGUID: guid, documentNumber: `PF-${guid}`, documentStatus: 'draft', paymentFactNumber: '', paymentFactDay: null, moneyAccountGUID: 'ma-1', moneyAccountTitle: 'Bank', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme', currency: 'EUR', partnerGUID: 'pt-1', personGUID: '', payeeTitle: 'Supplier', direction: 'outbound', folder: 'ma-1:pt-1', bankAmount: null, taskGUID: 't-1', projectGUID: 'p-1', projectCount: 1, authorGUID: 'u', authorName: 'Anna', lineCount: 1, sumForMoneyAccount: 10, ...over });
const listAnswer = (...rows: any[]) => ({ data: { totalCount: rows.length, totalsByCurrency: [], rows }, error: null });
let latest: any;
beforeEach(() => { fake.calls = []; fake.rpc = {}; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('usePaymentFactList: the filter and the extra keys are the p_filter; totals per currency', async () => {
  fake.rpc.payment_fact_list = { data: { totalCount: 1, totalsByCurrency: [{ currency: 'EUR', count: 1, sumForMoneyAccount: 10 }], rows: [docRow('d1')] }, error: null };
  function Probe() { latest = usePaymentFactList({ ...EMPTY_PAYMENT_FACT_FILTER, partnerGUID: 'pt-list-1', fromDay: '20300101' }, 50, { direction: 'inbound' }); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('payment_fact_list')[0].args).toEqual({ p_filter: { direction: 'inbound', partnerGUID: 'pt-list-1', fromDay: '2030-01-01' }, p_limit: 50, p_offset: 0 });
  expect(latest.answer.rows[0]).toMatchObject({ documentGUID: 'd1', sumForMoneyAccount: 10 });
  expect(latest.answer.totalsByCurrency[0]).toMatchObject({ currency: 'EUR', sumForMoneyAccount: 10 });
  expect(latest.error).toBeNull();
});

it('usePaymentFactList: an error of the database is a message', async () => {
  fake.rpc.payment_fact_list = { data: null, error: { message: 'permission denied' } };
  function Probe() { latest = usePaymentFactList({ ...EMPTY_PAYMENT_FACT_FILTER, author: 'err-case' }); return null; }
  renderUI(<Probe />);
  await flush();
  expect(latest.error).toBe('permission denied');
});

describe('usePaymentFactDocuments', () => {
  const mount = (guids: string[]) => { function Probe() { latest = usePaymentFactDocuments(guids); return null; } renderUI(<Probe />); };
  it('asks for the documents of the route (documentGUIDs) and keeps THEIR order; a missing one is left out', async () => {
    fake.rpc.payment_fact_list = listAnswer(docRow('dB'), docRow('dA'));
    mount(['dA', 'dB', 'dX']);
    await flush();
    expect(callsOf('payment_fact_list')[0].args.p_filter).toEqual({ documentGUIDs: ['dA', 'dB', 'dX'] });
    expect(latest.headers.map((h: any) => h.guid)).toEqual(['dA', 'dB']);
    expect(latest.headers[0]).toMatchObject({ number: 'PF-dA', status: 'draft', payeeTitle: 'Supplier', moneyAccountGUID: 'ma-1', direction: 'outbound' });
  });
  it('no documents: nothing is asked', async () => {
    mount([]);
    await flush();
    expect(callsOf('payment_fact_list')).toHaveLength(0);
    expect(latest.headers).toEqual([]);
  });
  it('setHeader: the RPC gets the patch, the documents are read again', async () => {
    fake.rpc.payment_fact_list = listAnswer(docRow('dS'));
    mount(['dS']);
    await flush();
    const before = callsOf('payment_fact_list').length;
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.setHeader('dS', { paymentFactNumber: 'B-5', paymentFactDate: '2030-01-05' }); });
    await flush();
    expect(ok).toBe(true);
    expect(callsOf('payment_fact_set_header')[0].args).toEqual({ p_header: 'dS', p_patch: { paymentFactNumber: 'B-5', paymentFactDate: '2030-01-05' } });
    expect(callsOf('payment_fact_list').length).toBeGreaterThan(before);
  });
  it('post: a typed answer; a refusal is an answer, a failure is a message and null', async () => {
    fake.rpc.payment_fact_list = listAnswer(docRow('dP'));
    fake.rpc.post_payment_fact = { data: { status: 'refused', lines: 1, problems: [{ lineGUID: null, problem: 'moneyAccountMissing' }] }, error: null };
    mount(['dP']);
    await flush();
    let answer: any;
    await act(async () => { answer = await latest.post('dP'); });
    expect(callsOf('post_payment_fact')[0].args).toEqual({ p_header: 'dP' });
    expect(answer).toEqual({ status: 'refused', lines: 1, problems: [{ lineGUID: null, problem: 'moneyAccountMissing' }] });
    expect(latest.error).toBeNull();
    fake.rpc.post_payment_fact = { data: null, error: { message: 'boom' } };
    await act(async () => { answer = await latest.post('dP'); });
    expect(answer).toBeNull();
    expect(latest.error).toBe('boom');
    expect(latest.busy).toBe(false);
  });
  it('unpost and remove call their RPCs; a refused delete is false + the message', async () => {
    fake.rpc.payment_fact_list = listAnswer(docRow('dU'));
    fake.rpc.unpost_payment_fact = { data: { status: 'draft', problems: [] }, error: null };
    mount(['dU']);
    await flush();
    await act(async () => { await latest.unpost('dU'); });
    expect(callsOf('unpost_payment_fact')[0].args).toEqual({ p_header: 'dU' });
    let ok: boolean | undefined;
    await act(async () => { ok = await latest.remove('dU'); });
    expect(ok).toBe(true);
    expect(callsOf('delete_payment_fact')[0].args).toEqual({ p_header: 'dU' });
    fake.rpc.delete_payment_fact = { data: null, error: { message: 'a posted payment fact cannot be deleted: unpost it first' } };
    await act(async () => { ok = await latest.remove('dU'); });
    expect(ok).toBe(false);
    expect(latest.error).toContain('unpost it first');
  });
  it('addFromPlan: the plan payments go to the RPC, the answer says what was left out; addLine and setLineTask', async () => {
    fake.rpc.payment_fact_list = listAnswer(docRow('dA'));
    fake.rpc.payment_fact_add_from_plan = { data: { added: 1, skipped: [{ planLineGUID: 'x', reason: 'wrongPayee' }] }, error: null };
    fake.rpc.payment_fact_add_line = { data: 'new-line', error: null };
    mount(['dA']);
    await flush();
    let answer: any;
    await act(async () => { answer = await latest.addFromPlan('dA', ['pl1', 'x']); });
    expect(callsOf('payment_fact_add_from_plan')[0].args).toEqual({ p_header: 'dA', p_plan_lines: ['pl1', 'x'] });
    expect(answer).toEqual({ added: 1, skipped: [{ planLineGUID: 'x', reason: 'wrongPayee' }] });
    let ok = false;
    await act(async () => { ok = await latest.addLine('dA', 't-2'); });
    expect(ok).toBe(true);
    expect(callsOf('payment_fact_add_line')[0].args).toEqual({ p_header: 'dA', p_task: 't-2' });
    await act(async () => { ok = await latest.setLineTask('l1', 't-3'); });
    expect(callsOf('payment_fact_set_line_task')[0].args).toEqual({ p_line: 'l1', p_task: 't-3' });
    fake.rpc.payment_fact_add_from_plan = { data: null, error: { message: 'payment fact: the payment of the plan is outbound, the document is inbound' } };
    await act(async () => { answer = await latest.addFromPlan('dA', ['pl2']); });
    expect(answer).toBeNull();
    expect(latest.error).toContain('is outbound');
  });
});

it('usePlanCandidates: the header and the filter go to the RPC; the rows are typed; disabled = nothing is asked', async () => {
  fake.rpc.payment_fact_plan_candidates = { data: { rows: [{ planLineGUID: 'pl1', open: 12.5, direction: 'outbound' }] }, error: null };
  function Probe() { latest = usePlanCandidates('d1', { taskGUID: 't-1' }); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('payment_fact_plan_candidates')[0].args).toEqual({ p_header: 'd1', p_filter: { taskGUID: 't-1' } });
  expect(latest.rows[0]).toMatchObject({ planLineGUID: 'pl1', open: 12.5 });
  cleanupUI();
  fake.calls = [];
  function Off() { latest = usePlanCandidates('d2', {}, false); return null; }
  renderUI(<Off />);
  await flush();
  expect(callsOf('payment_fact_plan_candidates')).toHaveLength(0);
  expect(latest.rows).toEqual([]);
});

it('useTaskPaymentPaid: a map plan payment -> paid / open (the columns of the plan); no task = nothing is asked', async () => {
  fake.rpc.task_payment_paid = { data: [{ planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 }], error: null };
  function Probe() { latest = useTaskPaymentPaid('t-paid-1'); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('task_payment_paid')[0].args).toEqual({ p_task: 't-paid-1' });
  expect(latest.byPlanLine.get('pl1')).toEqual({ planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 });
  cleanupUI();
  fake.calls = [];
  function None() { latest = useTaskPaymentPaid(null); return null; }
  renderUI(<None />);
  await flush();
  expect(callsOf('task_payment_paid')).toHaveLength(0);
  expect(latest.byPlanLine.size).toBe(0);
});

it('useOpenPaymentFact: opens a document (nothing without one)', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  function Probe() { latest = useOpenPaymentFact(); return null; }
  renderUI(<Probe />);
  latest({ taskGUID: 't1' });
  expect(open).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  latest({ documentGUID: 'd1', taskGUID: 't1' });
  // a browser tab is tried first on the web; blocked (null) = this window
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pm/project/task/payment-fact', params: { taskGUID: 't1', documentGUID: 'd1' } });
  open.mockRestore();
});

describe('useStartPaymentFact - the context menu "Payment fact" makes a draft for the task and opens it', () => {
  const mount = () => { function Probe() { latest = useStartPaymentFact(); return null; } renderUI(<Probe />); };
  it('the task goes to payment_fact_create, the form opens on the new document', async () => {
    fake.rpc.payment_fact_create = { data: 'new-1', error: null };
    mount();
    let guid: string | null = null;
    await act(async () => { guid = await latest.start({ taskGUID: 't1', projectGUID: 'p1' }); });
    expect(guid).toBe('new-1');
    expect(callsOf('payment_fact_create')[0].args).toEqual({ p_task: 't1', p_direction: null, p_plan_lines: null });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/payment-fact', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'new-1' } });
  });
  it('a direction and plan payments start the draft from them', async () => {
    fake.rpc.payment_fact_create = { data: 'new-2', error: null };
    mount();
    await act(async () => { await latest.start({ taskGUID: 't1', direction: 'inbound', planLineGUIDs: ['pl1'] }); });
    expect(callsOf('payment_fact_create')[0].args).toEqual({ p_task: 't1', p_direction: 'inbound', p_plan_lines: ['pl1'] });
  });
  it('no task: nothing is made; a failure is a message and null, nothing opens', async () => {
    mount();
    let guid: any = 'x';
    await act(async () => { guid = await latest.start({ taskGUID: '' }); });
    expect(guid).toBeNull();
    expect(callsOf('payment_fact_create')).toHaveLength(0);
    fake.rpc.payment_fact_create = { data: null, error: { message: 'not your project' } };
    await act(async () => { guid = await latest.start({ taskGUID: 't1' }); });
    expect(guid).toBeNull();
    expect(latest.error).toBe('not your project');
    expect(mockPush).not.toHaveBeenCalled();
    expect(latest.busy).toBe(false);
  });
});

it('useRefreshCashLedger: the RPC answers { changed, queue }', async () => {
  fake.rpc.cash_ledger_refresh_now = { data: { changed: 2, queue: 0 }, error: null };
  function Probe() { latest = useRefreshCashLedger(); return null; }
  renderUI(<Probe />);
  let r: any;
  await act(async () => { r = await latest.refresh(); });
  expect(r).toEqual({ changed: 2, queue: 0 });
  expect(latest.busy).toBe(false);
});
