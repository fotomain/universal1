/** @jest-environment jsdom */
// TaskDatesBar: Start date – Finish date as TEXT + Select period in the toolbar of the task window (kit8/pm/view/task/TaskDatesBar.tsx).
// A press on a date or on the icon opens Select period; the dates of a posted task are replanned (Post of that task) once the schedule shows the new days.
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, inputValue, press, q, renderUI, seedStore, textOf, typeInto } from './pmUiTestKit';
import TaskDatesBar, { REPLAN_DELAY_MS } from '../../../kit8/pm/view/task/TaskDatesBar';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const mockPostTask = jest.fn();
let mockByTask: Record<string, any[]> = {};
jest.mock('../../../kit8/pm/view/task/plan/useProjectPostActions', () => ({ useProjectPostActions: () => ({ postTask: mockPostTask, postUnposted: jest.fn(), repostAll: jest.fn(), busy: false }) }));
jest.mock('../../../kit8/pm/view/task/plan/useProjectTaskLines', () => ({ useProjectTaskLines: () => ({ byTask: mockByTask, lines: [], indicators: {}, isLoading: false, refetch: jest.fn() }) }));

const T = 'pm-task-dates';
const line = (posted: boolean) => ({ rowGUID: 'l1', rowJSON: { budgetItemTaskLine: 'b1', taskIsPosted: posted, baseOfDistribution: posted ? 'x' : null } });
beforeEach(() => { jest.useFakeTimers(); mockPostTask.mockClear(); mockByTask = {}; });
afterEach(() => { cleanupUI(); jest.useRealTimers(); act(() => { usePMStore.setState({ planHour: false, planMinute: false, planSecond: false }); }); });

describe('a leaf task', () => {
  it('shows its start and finish from the schedule as TEXT (no input boxes), and the Select period button', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    const sched = usePMStore.getState().schedule[task.rowGUID];
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={fakeCrud()} />);
    expect(textOf(`${T}-start`)).toBe(new Date(sched.startMs).toISOString().slice(0, 10));
    expect(textOf(`${T}-finish`)).not.toBe('');
    expect(q(`${T}-start`)!.querySelector('input')).toBeNull();
    expect(q(`${T}-finish`)!.querySelector('input')).toBeNull();
    expect(q(`${T}-period-button`)).not.toBeNull();
  });
  it('a press on the start, on the finish or on the icon opens Select period (closed at the start)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={fakeCrud()} />);
    expect(q(`${T}-period-modal`)).toBeNull();
    for (const id of [`${T}-start`, `${T}-finish`, `${T}-period-button`]) {
      press(id);
      expect(q(`${T}-period-modal`)).not.toBeNull();
      press(`${T}-period-modal-cancel`);
      expect(q(`${T}-period-modal`)).toBeNull();
    }
  });
  it('the input of the pressed date is active in the window (the icon activates none)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={fakeCrud()} />);
    const active = () => document.activeElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? '';
    press(`${T}-finish`);
    act(() => { jest.advanceTimersByTime(100); });
    expect(document.activeElement).toBe(q(`${T}-period-modal-to`));
    press(`${T}-period-modal-cancel`);
    press(`${T}-start`);
    act(() => { jest.advanceTimersByTime(100); });
    expect(document.activeElement).toBe(q(`${T}-period-modal-from`));
    press(`${T}-period-modal-cancel`);
    press(`${T}-period-button`);
    expect(document.activeElement).not.toBe(q(`${T}-period-modal-from`));
    expect(active()).not.toBe(`${T}-period-modal-to`);
  });
  it('the window shows the dates of the task; Select writes manualStartAt + the duration, the rest of the rowJSON kept', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    const crud = fakeCrud();
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={crud} />);
    press(`${T}-start`);
    expect(inputValue(`${T}-period-modal-from`)).toBe(textOf(`${T}-start`));
    typeInto(`${T}-period-modal-from`, '2027-03-01');
    typeInto(`${T}-period-modal-to`, '2027-03-31');
    press(`${T}-period-modal-select`);
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
    const [guid, patch] = crud.updateTask.mock.calls[0];
    expect(guid).toBe(task.rowGUID);
    expect(patch.rowJSON).toEqual(expect.objectContaining({ manualStartAt: '2027-03-01T00:00:00.000Z', taskDescription: task.rowJSON.taskDescription }));
    expect(patch.rowJSON.durationDays).toBeGreaterThan(1);
  });
});

describe('replan', () => {
  const change = (task: any, crud: any) => {
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={crud} />);
    press(`${T}-period-button`);
    typeInto(`${T}-period-modal-from`, '2027-03-01');
    typeInto(`${T}-period-modal-to`, '2027-03-31');
    press(`${T}-period-modal-select`);
  };
  const scheduleMoves = (guid: string) => act(() => { usePMStore.setState((s: any) => ({ schedule: { ...s.schedule, [guid]: { ...s.schedule[guid], startMs: Date.UTC(2027, 2, 1), finishMs: Date.UTC(2027, 3, 1) } } })); });

  it('a POSTED task is posted again once the schedule shows the new days (after the scheduler delay)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    mockByTask = { [task.rowGUID]: [line(true)] };
    change(task, fakeCrud());
    expect(mockPostTask).not.toHaveBeenCalled();                     // the days have not moved yet
    scheduleMoves(task.rowGUID);
    expect(mockPostTask).not.toHaveBeenCalled();                     // the scheduler of the server needs a moment
    act(() => { jest.advanceTimersByTime(REPLAN_DELAY_MS + 50); });
    expect(mockPostTask).toHaveBeenCalledWith(task.rowGUID);
  });
  it('a task that was posted and changed since is posted again too', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    mockByTask = { [task.rowGUID]: [{ ...line(false), rowJSON: { budgetItemTaskLine: 'b1', taskIsPosted: false, baseOfDistribution: 'x' } }] };
    change(task, fakeCrud());
    scheduleMoves(task.rowGUID);
    act(() => { jest.advanceTimersByTime(REPLAN_DELAY_MS + 50); });
    expect(mockPostTask).toHaveBeenCalledWith(task.rowGUID);
  });
  it('a task that was never posted is NOT posted by a change of its dates', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    mockByTask = { [task.rowGUID]: [line(false)] };
    change(task, fakeCrud());
    scheduleMoves(task.rowGUID);
    act(() => { jest.advanceTimersByTime(REPLAN_DELAY_MS + 50); });
    expect(mockPostTask).not.toHaveBeenCalled();
  });
  it('the same dates again: nothing written, nothing replanned', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    mockByTask = { [task.rowGUID]: [line(true)] };
    const crud = fakeCrud();
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={crud} />);
    press(`${T}-period-button`);
    press(`${T}-period-modal-select`);                               // the window opens at the task's own dates
    expect(crud.updateTask).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(REPLAN_DELAY_MS + 50); });
    expect(mockPostTask).not.toHaveBeenCalled();
  });
});

describe('who cannot edit', () => {
  it('a stage: the dates are shown (they come from its tasks) but a press does not open the window', () => {
    const { byName } = seedStore();
    const stage = byName('Stage 1');
    renderUI(<TaskDatesBar guid={stage.rowGUID} crud={fakeCrud()} />);
    expect(textOf(`${T}-start`)).not.toBe('');
    press(`${T}-start`);
    press(`${T}-period-button`);
    expect(q(`${T}-period-modal`)).toBeNull();
  });
  it('with hours on the dates are edited in the task form: a press does not open the window', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    act(() => { usePMStore.setState({ planHour: true }); });
    renderUI(<TaskDatesBar guid={task.rowGUID} crud={fakeCrud()} />);
    press(`${T}-finish`);
    expect(q(`${T}-period-modal`)).toBeNull();
  });
});
