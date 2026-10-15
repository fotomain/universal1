// The debounced cost refresh: many signals -> ONE call after the last one; a signal during a running call -> exactly one more after it; per project; gated; cancel; errors do not break it.
import { COST_REFRESH_DEBOUNCE_MS, cancelProjectCostRefresh, pendingProjectCostRefreshes, resetCostRefreshScheduler, scheduleProjectCostRefresh } from '../../../kit8/pm/cost/costRefreshScheduler';

const ON = { projectExpenseBudgetNeeded: true };
const answer = { data: { tasks: 1, rows: 1, projectTotal: 1, changedRows: 0, ms: 1, flushed: 0 }, error: null };
const quick = () => { const c: any = { rpc: jest.fn(() => Promise.resolve(answer)) }; return c; };
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
const tick = async (ms: number) => { jest.advanceTimersByTime(ms); await flush(); };

beforeEach(() => jest.useFakeTimers());
afterEach(() => { resetCostRefreshScheduler(); jest.useRealTimers(); jest.clearAllMocks(); });

it('five Posts within the quiet time make ONE call, after the last one', async () => {
  const c = quick();
  for (let i = 0; i < 5; i += 1) { scheduleProjectCostRefresh(c, 'p1', ON); await tick(COST_REFRESH_DEBOUNCE_MS - 100); }
  expect(c.rpc).not.toHaveBeenCalled();                                 // each signal restarted the quiet time (4 x 400 ms have passed)
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(c.rpc).toHaveBeenCalledTimes(1);
  expect(c.rpc).toHaveBeenCalledWith('update_project_cost_total', { p_project: 'p1' });
  await tick(5000);
  expect(c.rpc).toHaveBeenCalledTimes(1);
  expect(pendingProjectCostRefreshes()).toBe(0);                        // nothing is kept
});

it('the call is made exactly COST_REFRESH_DEBOUNCE_MS after the last signal, not before', async () => {
  const c = quick();
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS - 1);
  expect(c.rpc).not.toHaveBeenCalled();
  await tick(1);
  expect(c.rpc).toHaveBeenCalledTimes(1);
});

it('two signals far apart make two calls', async () => {
  const c = quick();
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS + 10);
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS + 10);
  expect(c.rpc).toHaveBeenCalledTimes(2);
});

it('a signal while the call is still running does not start a second call in parallel: ONE more follows the first', async () => {
  let release: (v: any) => void = () => {};
  const c: any = { rpc: jest.fn(() => new Promise((r) => { release = r; })) };
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(c.rpc).toHaveBeenCalledTimes(1);                               // running, not answered
  scheduleProjectCostRefresh(c, 'p1', ON);                              // two more Posts while it runs
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS + 10);
  expect(c.rpc).toHaveBeenCalledTimes(1);                               // still only the first (no parallel call)
  release(answer);
  await flush();
  expect(c.rpc).toHaveBeenCalledTimes(2);                               // exactly one more, not two
  release(answer);
  await tick(5000);
  expect(c.rpc).toHaveBeenCalledTimes(2);
  expect(pendingProjectCostRefreshes()).toBe(0);
});

it('a signal that comes after the running call has finished is an ordinary new call', async () => {
  let release: (v: any) => void = () => {};
  const c: any = { rpc: jest.fn(() => new Promise((r) => { release = r; })) };
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  release(answer);
  await flush();
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(c.rpc).toHaveBeenCalledTimes(2);
});

it('projects are independent', async () => {
  const c = quick();
  scheduleProjectCostRefresh(c, 'p1', ON);
  scheduleProjectCostRefresh(c, 'p2', ON);
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(c.rpc.mock.calls.map((a: any[]) => a[1].p_project).sort()).toEqual(['p1', 'p2']);
});

it('the gate: no call without a cost budget, a project or a client; nothing is kept for them', async () => {
  const c = quick();
  scheduleProjectCostRefresh(c, 'p1', {});
  scheduleProjectCostRefresh(c, 'p1', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false });
  scheduleProjectCostRefresh(c, null, ON);
  scheduleProjectCostRefresh(null, 'p1', ON);
  expect(pendingProjectCostRefreshes()).toBe(0);
  await tick(COST_REFRESH_DEBOUNCE_MS * 2);
  expect(c.rpc).not.toHaveBeenCalled();
});

it('the settings of the LAST signal win (the budget turned off in between = the pending call is dropped)', async () => {
  const c = quick();
  scheduleProjectCostRefresh(c, 'p1', ON);
  scheduleProjectCostRefresh(c, 'p1', {});                              // the master was turned off
  expect(pendingProjectCostRefreshes()).toBe(0);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(c.rpc).not.toHaveBeenCalled();
});

it('cancel drops the pending call (the explicit command did the work)', async () => {
  const c = quick();
  scheduleProjectCostRefresh(c, 'p1', ON);
  cancelProjectCostRefresh('p1');
  expect(pendingProjectCostRefreshes()).toBe(0);
  await tick(COST_REFRESH_DEBOUNCE_MS * 2);
  expect(c.rpc).not.toHaveBeenCalled();
  cancelProjectCostRefresh('unknown');                                  // harmless
  cancelProjectCostRefresh(null);
});

it('cancel while a call runs lets it finish and drops the extra call that was waiting', async () => {
  let release: (v: any) => void = () => {};
  const c: any = { rpc: jest.fn(() => new Promise((r) => { release = r; })) };
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);                                 // marked "again"
  cancelProjectCostRefresh('p1');
  release(answer);
  await tick(COST_REFRESH_DEBOUNCE_MS * 3);
  expect(c.rpc).toHaveBeenCalledTimes(1);
});

it('a failing call is only logged and the next signal works', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const c: any = { rpc: jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'boom' } }).mockResolvedValue(answer) };
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
  scheduleProjectCostRefresh(c, 'p1', ON);
  await tick(COST_REFRESH_DEBOUNCE_MS);
  expect(c.rpc).toHaveBeenCalledTimes(2);
  warn.mockRestore();
});
