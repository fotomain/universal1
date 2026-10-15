/** @jest-environment jsdom */
// The Actions menu of the project bar: "Update project cost" is offered only while a cost budget is on, sits right before "Refresh the project", calls update_project_cost_total,
// tells the open tree to read the totals again, and reports the answer (a snackbar) or the error (the error window).
import React, { act } from 'react';
import { cleanupUI, press, q, qa, renderUI } from '../ui/pmUiTestKit';

// the kit mocks react-redux and WithSupabase: a test that needs its own version overrides them with doMock + require AFTER the kit is imported
const mockDispatch = jest.fn();
const mockRpc = jest.fn();
const mockShowError = jest.fn();
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch, useSelector: () => [] }));
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: { rpc: (...a: any[]) => mockRpc(...a) } }) }));
jest.doMock('../../../kit8/pm/view/task/plan/useProjectPostActions', () => ({ useProjectPostActions: () => ({ postUnposted: jest.fn(), repostAll: jest.fn(), busy: false }) }));
jest.doMock('../../../kit8/ui/components/common/ErrorModalWindow', () => ({ showErrorModal: (...a: any[]) => mockShowError(...a) }));
const PMProjectActionsButton = require('../../../kit8/pm/view/project/buttons/PMProjectActionsButton').default;
const { onCostTotalsStale } = require('../../../kit8/pm/cost/costTotalModel');
const { COST_REFRESH_DEBOUNCE_MS, pendingProjectCostRefreshes, resetCostRefreshScheduler, scheduleProjectCostRefresh } = require('../../../kit8/pm/cost/costRefreshScheduler');

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
// the menu opens when measureInWindow answers (react-native-web: a timer)
const open = async () => { press('pm-project-actions'); await wait(80); };
const ITEMS = ['pm-project-actions-post-unposted', 'pm-project-actions-repost-all', 'pm-project-actions-update-cost', 'pm-project-actions-refresh'];
const itemIds = () => qa('pm-project-actions-').filter((id) => ITEMS.includes(id));
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanupUI(); resetCostRefreshScheduler(); jest.clearAllMocks(); });

it('is not offered while no cost budget is on', async () => {
  renderUI(<PMProjectActionsButton projectGUID="p1" color="#000" costBudgetOn={false} />);
  await open();
  expect(q('pm-project-actions-update-cost')).toBeNull();
  expect(q('pm-project-actions-refresh')).not.toBeNull();
});

it('is offered while a cost budget is on, directly before "Refresh the project"', async () => {
  renderUI(<PMProjectActionsButton projectGUID="p1" color="#000" costBudgetOn />);
  await open();
  const ids = itemIds();
  expect(ids.indexOf('pm-project-actions-update-cost')).toBeGreaterThan(-1);
  expect(ids.indexOf('pm-project-actions-update-cost')).toBe(ids.indexOf('pm-project-actions-refresh') - 1);
});

it('calls update_project_cost_total, tells the tree to read again and reports the answer', async () => {
  mockRpc.mockResolvedValue({ data: { tasks: 11, rows: 4, projectTotal: 1234.5, changedRows: 2, ms: 9, flushed: 1 }, error: null });
  const stale = jest.fn();
  const off = onCostTotalsStale(stale);
  renderUI(<PMProjectActionsButton projectGUID="p1" color="#000" costBudgetOn />);
  await open();
  press('pm-project-actions-update-cost');
  await flush();
  expect(mockRpc).toHaveBeenCalledWith('update_project_cost_total', { p_project: 'p1' });
  expect(stale).toHaveBeenCalledWith('p1');
  const snack = mockDispatch.mock.calls.map((c) => c[0]).find((a) => a?.payload?.message);
  expect(snack.payload.isError).toBe(false);
  expect(snack.payload.message).toContain('1234.50');
  expect(snack.payload.message).toContain('11');
  expect(snack.payload.message).toContain('2 total(s) updated');         // changedRows > 0: a drift was healed
  off();
});

it('an up-to-date project says no more than the total', async () => {
  mockRpc.mockResolvedValue({ data: { tasks: 3, rows: 1, projectTotal: 10, changedRows: 0, ms: 2, flushed: 0 }, error: null });
  renderUI(<PMProjectActionsButton projectGUID="p1" color="#000" costBudgetOn />);
  await open();
  press('pm-project-actions-update-cost');
  await flush();
  const snack = mockDispatch.mock.calls.map((c) => c[0]).find((a) => a?.payload?.message);
  expect(snack.payload.message).not.toContain('updated');
});

it('an error of the database opens the error window (not a snackbar) and the tree is not told', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'update_project_cost_total: project x is not yours' } });
  const stale = jest.fn();
  const off = onCostTotalsStale(stale);
  renderUI(<PMProjectActionsButton projectGUID="p1" color="#000" costBudgetOn />);
  await open();
  press('pm-project-actions-update-cost');
  await flush();
  expect(mockShowError).toHaveBeenCalledWith('update_project_cost_total: project x is not yours', 'Update project cost');
  expect(stale).not.toHaveBeenCalled();
  off();
});

it('does nothing without a project', async () => {
  renderUI(<PMProjectActionsButton projectGUID={null} color="#000" costBudgetOn />);
  await open();
  press('pm-project-actions-update-cost');
  await flush();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('the command cancels the call that a Post had scheduled: ONE call in all, not two', async () => {
  mockRpc.mockResolvedValue({ data: { tasks: 1, rows: 1, projectTotal: 5, changedRows: 0, ms: 1, flushed: 0 }, error: null });
  scheduleProjectCostRefresh({ rpc: mockRpc }, 'p1', { projectExpenseBudgetNeeded: true });       // a Post a moment ago
  expect(pendingProjectCostRefreshes()).toBe(1);
  renderUI(<PMProjectActionsButton projectGUID="p1" color="#000" costBudgetOn />);
  await open();
  press('pm-project-actions-update-cost');
  await flush();
  expect(pendingProjectCostRefreshes()).toBe(0);
  await wait(COST_REFRESH_DEBOUNCE_MS + 100);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
