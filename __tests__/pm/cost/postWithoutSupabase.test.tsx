/** @jest-environment jsdom */
// A screen without a SupabaseProvider (useSupabase throws): the Post hooks still render and Post works, the cost update is simply skipped.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../ui/pmUiTestKit';

const mockDispatch = jest.fn();
const mockRunTaskPost = jest.fn();
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch, useSelector: () => [] }));
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => { throw new Error('useSupabase must be used within SupabaseProvider'); } }));
jest.doMock('../../../kit8/pm/view/task/plan/runTaskPost', () => ({ runTaskPost: (...a: any[]) => mockRunTaskPost(...a), taskDaysOf: () => [] }));
jest.doMock('../../../kit8/pm/view/task/plan/useBusinessUnitPostCheck', () => ({ useBusinessUnitPostCheck: () => ({}) }));
jest.doMock('../../../kit8/pm/view/task/plan/BusyConflictsWindow', () => ({ showBusyConflicts: jest.fn() }));
const { usePMStore } = require('../../../kit8/pm/store/store_pm');
const { useTaskPost } = require('../../../kit8/pm/view/task/plan/useTaskPost');

let task: any;
function Probe() { task = useTaskPost({ projectGUID: 'p1', taskGUID: 't1', lines: [], distributions: [] }); return null; }
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('renders and posts without a SupabaseProvider; the user gets the message', async () => {
  usePMStore.setState({ projectsById: { p1: { rowGUID: 'p1', rowJSON: { projectExpenseBudgetNeeded: true } } } as any });
  mockRunTaskPost.mockResolvedValue({ status: 'posted', lines: 1, rows: 2, problems: [], busy: [], mode: 'capacityModeWarn' });
  renderUI(<Probe />);
  await act(async () => { await task.post(); });
  const snack = mockDispatch.mock.calls.map((c) => c[0]).find((a) => a?.payload?.message);
  expect(snack.payload.message).toContain('Posted 1 line(s)');
});
