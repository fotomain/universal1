// paymentFactApi - the RPC calls: the names, the parameters, the typed answers and the messages of a failure. The Supabase client is a fake.
import {
  addFromPlan, addPaymentFactLine, createPaymentFact, deletePaymentFact, fetchPaymentFactList, fetchPlanCandidates, fetchTaskPaymentPaid, postPaymentFact, refreshCashLedger, setPaymentFactHeader, setPaymentFactLineTask,
  unpostPaymentFact, createPaymentFactFromInvoice,
} from '../../../../kit8/documents/payment/fact/paymentFactApi';
import { EMPTY_PAYMENT_FACT_FILTER } from '../../../../kit8/documents/payment/fact/paymentFactModel';

function fake(answers: Record<string, any> = {}) {
  const calls: { name: string; args: any }[] = [];
  const client = { rpc: jest.fn(async (name: string, args: any) => { calls.push({ name, args }); return answers[name] ?? { data: null, error: null }; }) };
  return { client, calls };
}

it('createPaymentFact: the task, the direction and the plan payments go to payment_fact_create; empty values are null', async () => {
  const f = fake({ payment_fact_create: { data: 'new-guid', error: null } });
  expect(await createPaymentFact(f.client, { taskGUID: 't1', direction: 'outbound', planLineGUIDs: ['a', 'b'] })).toBe('new-guid');
  expect(f.calls[0]).toEqual({ name: 'payment_fact_create', args: { p_task: 't1', p_direction: 'outbound', p_plan_lines: ['a', 'b'] } });
  await createPaymentFact(f.client);
  expect(f.calls[1].args).toEqual({ p_task: null, p_direction: null, p_plan_lines: null });
  await createPaymentFact(f.client, { planLineGUIDs: [] });
  expect(f.calls[2].args.p_plan_lines).toBeNull();
});

it('fetchPaymentFactList: the filter and the extra keys are the p_filter; the answer is typed', async () => {
  const f = fake({ payment_fact_list: { data: { totalCount: 1, totalsByCurrency: [{ currency: 'EUR', count: 1, sumForMoneyAccount: 5 }], rows: [{ documentGUID: 'd1', documentStatus: 'posted', sumForMoneyAccount: 5 }] }, error: null } });
  const a = await fetchPaymentFactList(f.client, { ...EMPTY_PAYMENT_FACT_FILTER, number: 'B', fromDay: '20300105' }, { taskGUID: 't1' }, 50, 10);
  expect(f.calls[0]).toEqual({ name: 'payment_fact_list', args: { p_filter: { taskGUID: 't1', fromDay: '2030-01-05', number: 'B' }, p_limit: 50, p_offset: 10 } });
  expect(a.rows[0]).toMatchObject({ documentGUID: 'd1', documentStatus: 'posted', sumForMoneyAccount: 5 });
  await fetchPaymentFactList(f.client, null, { documentGUIDs: ['d1'] });
  expect(f.calls[1].args.p_filter).toEqual({ documentGUIDs: ['d1'] });
});

it('setPaymentFactHeader, addFromPlan, addPaymentFactLine, setPaymentFactLineTask', async () => {
  const f = fake({ payment_fact_add_from_plan: { data: { added: 1, skipped: [{ planLineGUID: 'x', reason: 'nothingOpen' }] }, error: null }, payment_fact_add_line: { data: 'line-1', error: null } });
  await setPaymentFactHeader(f.client, 'd1', { paymentFactNumber: 'B-1', paymentFactDate: '2030-01-05', moneyAccountFact: 'ma1', paymentFactPartner: 'pt1' });
  expect(f.calls[0]).toEqual({ name: 'payment_fact_set_header', args: { p_header: 'd1', p_patch: { paymentFactNumber: 'B-1', paymentFactDate: '2030-01-05', moneyAccountFact: 'ma1', paymentFactPartner: 'pt1' } } });
  expect(await addFromPlan(f.client, 'd1', ['pl1', 'pl2'])).toEqual({ added: 1, skipped: [{ planLineGUID: 'x', reason: 'nothingOpen' }] });
  expect(f.calls[1]).toEqual({ name: 'payment_fact_add_from_plan', args: { p_header: 'd1', p_plan_lines: ['pl1', 'pl2'] } });
  expect(await addPaymentFactLine(f.client, 'd1', 't9')).toBe('line-1');
  expect(f.calls[2].args).toEqual({ p_header: 'd1', p_task: 't9' });
  await addPaymentFactLine(f.client, 'd1');
  expect(f.calls[3].args).toEqual({ p_header: 'd1', p_task: null });
  await setPaymentFactLineTask(f.client, 'l1', 't2');
  expect(f.calls[4]).toEqual({ name: 'payment_fact_set_line_task', args: { p_line: 'l1', p_task: 't2' } });
});

it('fetchPlanCandidates: the header and the filter; the rows are typed', async () => {
  const f = fake({ payment_fact_plan_candidates: { data: { rows: [{ planLineGUID: 'pl1', open: '10' }] }, error: null } });
  const rows = await fetchPlanCandidates(f.client, 'd1', { taskGUID: 't1' });
  expect(f.calls[0]).toEqual({ name: 'payment_fact_plan_candidates', args: { p_header: 'd1', p_filter: { taskGUID: 't1' } } });
  expect(rows[0]).toMatchObject({ planLineGUID: 'pl1', open: 10 });
  await fetchPlanCandidates(f.client, null);
  expect(f.calls[1].args).toEqual({ p_header: null, p_filter: {} });
});

it('post / unpost answer with the typed result, delete returns nothing', async () => {
  const f = fake({ post_payment_fact: { data: { status: 'refused', lines: 1, problems: [{ lineGUID: null, problem: 'moneyAccountMissing' }] }, error: null }, unpost_payment_fact: { data: { status: 'draft', problems: [] }, error: null } });
  expect(await postPaymentFact(f.client, 'd1')).toEqual({ status: 'refused', lines: 1, problems: [{ lineGUID: null, problem: 'moneyAccountMissing' }] });
  expect((await unpostPaymentFact(f.client, 'd1')).status).toBe('draft');
  await deletePaymentFact(f.client, 'd1');
  expect(f.calls.map((c) => c.name)).toEqual(['post_payment_fact', 'unpost_payment_fact', 'delete_payment_fact']);
  expect(f.calls.every((c) => c.args.p_header === 'd1')).toBe(true);
});

it('fetchTaskPaymentPaid and refreshCashLedger', async () => {
  const f = fake({ task_payment_paid: { data: [{ planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 }], error: null }, cash_ledger_refresh_now: { data: { changed: 3, queue: 1 }, error: null } });
  expect(await fetchTaskPaymentPaid(f.client, 't1')).toEqual([{ planLineGUID: 'pl1', planSum: 100, paid: 40, open: 60 }]);
  expect(f.calls[0]).toEqual({ name: 'task_payment_paid', args: { p_task: 't1' } });
  expect(await refreshCashLedger(f.client)).toEqual({ changed: 3, queue: 1 });
});

it('a failure of the database is an Error with its message - every call', async () => {
  const f = fake(Object.fromEntries(['payment_fact_create', 'payment_fact_list', 'payment_fact_set_header', 'payment_fact_plan_candidates', 'payment_fact_add_from_plan', 'payment_fact_add_line', 'payment_fact_set_line_task', 'post_payment_fact',
    'unpost_payment_fact', 'delete_payment_fact', 'task_payment_paid', 'cash_ledger_refresh_now'].map((n) => [n, { data: null, error: { message: `boom ${n}` } }])));
  await expect(createPaymentFact(f.client)).rejects.toThrow('boom payment_fact_create');
  await expect(fetchPaymentFactList(f.client, null)).rejects.toThrow('boom payment_fact_list');
  await expect(setPaymentFactHeader(f.client, 'd', {})).rejects.toThrow('boom payment_fact_set_header');
  await expect(fetchPlanCandidates(f.client, null)).rejects.toThrow('boom payment_fact_plan_candidates');
  await expect(addFromPlan(f.client, 'd', [])).rejects.toThrow('boom payment_fact_add_from_plan');
  await expect(addPaymentFactLine(f.client, 'd')).rejects.toThrow('boom payment_fact_add_line');
  await expect(setPaymentFactLineTask(f.client, 'l', 't')).rejects.toThrow('boom payment_fact_set_line_task');
  await expect(postPaymentFact(f.client, 'd')).rejects.toThrow('boom post_payment_fact');
  await expect(unpostPaymentFact(f.client, 'd')).rejects.toThrow('boom unpost_payment_fact');
  await expect(deletePaymentFact(f.client, 'd')).rejects.toThrow('boom delete_payment_fact');
  await expect(fetchTaskPaymentPaid(f.client, 't')).rejects.toThrow('boom task_payment_paid');
  await expect(refreshCashLedger(f.client)).rejects.toThrow('boom cash_ledger_refresh_now');
});

it('createPaymentFactFromInvoice: the vendor / customer RPC with the invoice; the answer is typed; a failure is an Error', async () => {
  const f = fake({
    create_payment_fact_from_vendor_invoice: { data: { documents: [{ documentGUID: 'n1', lineCount: 2, taskGUID: 't1' }], skipped: [] }, error: null },
    create_payment_fact_from_customer_invoice: { data: { documents: [], skipped: [{ reason: 'nothingToPay' }] }, error: null },
  });
  expect(await createPaymentFactFromInvoice(f.client, 'vendor', 'vi1')).toEqual({ documents: [{ documentGUID: 'n1', lineCount: 2, taskGUID: 't1' }], skipped: [] });
  expect(f.calls[0]).toEqual({ name: 'create_payment_fact_from_vendor_invoice', args: { p_invoice: 'vi1' } });
  expect((await createPaymentFactFromInvoice(f.client, 'customer', 'ci1')).skipped).toEqual([{ reason: 'nothingToPay' }]);
  expect(f.calls[1]).toEqual({ name: 'create_payment_fact_from_customer_invoice', args: { p_invoice: 'ci1' } });
  const bad = fake({ create_payment_fact_from_vendor_invoice: { data: null, error: { message: 'post the vendor invoice first: a payment fact pays a posted invoice' } } });
  await expect(createPaymentFactFromInvoice(bad.client, 'vendor', 'vi1')).rejects.toThrow('post the vendor invoice first');
});
