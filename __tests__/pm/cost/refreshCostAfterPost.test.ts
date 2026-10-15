// refreshProjectCostAfterPost: the safety net after a Post - only while a cost budget is on, one RPC, tells the tree, never throws.
import { refreshProjectCostAfterPost } from '../../../kit8/pm/cost/refreshCostAfterPost';
import { onCostTotalsStale } from '../../../kit8/pm/cost/costTotalModel';

const ON = { projectExpenseBudgetNeeded: true };
const client = (impl: () => Promise<any>) => ({ rpc: jest.fn(impl) });
const ok = () => Promise.resolve({ data: { tasks: 3, rows: 1, projectTotal: 10, changedRows: 0, ms: 2, flushed: 1 }, error: null });

it('calls update_project_cost_total once and tells the open tree', async () => {
  const c = client(ok);
  const stale = jest.fn();
  const off = onCostTotalsStale(stale);
  await expect(refreshProjectCostAfterPost(c, 'p1', ON)).resolves.toBe(true);
  expect(c.rpc).toHaveBeenCalledTimes(1);
  expect(c.rpc).toHaveBeenCalledWith('update_project_cost_total', { p_project: 'p1' });
  expect(stale).toHaveBeenCalledWith('p1');
  off();
});

it.each([
  ['the master is off', {}],
  ['all of Time / Material / Expense are off', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }],
  ['the project is unknown', undefined],
])('does nothing when %s', async (_n, json) => {
  const c = client(ok);
  await expect(refreshProjectCostAfterPost(c, 'p1', json as any)).resolves.toBe(false);
  expect(c.rpc).not.toHaveBeenCalled();
});

it('does nothing without a project or a client', async () => {
  const c = client(ok);
  await expect(refreshProjectCostAfterPost(c, null, ON)).resolves.toBe(false);
  await expect(refreshProjectCostAfterPost(undefined, 'p1', ON)).resolves.toBe(false);
  expect(c.rpc).not.toHaveBeenCalled();
});

it('a failure is only logged: it does not throw and the tree is not told', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const c = client(() => Promise.resolve({ data: null, error: { message: 'boom' } }));
  const stale = jest.fn();
  const off = onCostTotalsStale(stale);
  await expect(refreshProjectCostAfterPost(c, 'p1', ON)).resolves.toBe(false);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
  expect(stale).not.toHaveBeenCalled();
  off();
  warn.mockRestore();
});

it('a network exception is also only logged', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const c = client(() => Promise.reject(new Error('offline')));
  await expect(refreshProjectCostAfterPost(c, 'p1', ON)).resolves.toBe(false);
  warn.mockRestore();
});
