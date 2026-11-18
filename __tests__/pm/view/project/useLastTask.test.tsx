/** @jest-environment jsdom */
// useLastTask: the dashboard remembers the task the user clicked last (per user AND project) and scrolls to it when the project opens again.
import { act } from 'react';
import { cleanupUI, renderUI, seedStore } from '../../ui/pmUiTestKit';

const mockParams: Record<string, any> = {};
// pmUiTestKit mocks expo-router itself: override with doMock + require AFTER the kit
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useGlobalSearchParams: () => mockParams }));

import React from 'react';
import { usePMStore } from '../../../../kit8/pm/store/store_pm';
import { uxuiSettingsOf } from '../../../../kit8/pm/model/types';

const { useLastTask, LAST_TASK_SAVE_DELAY_MS, lastTaskToRestore } = require('../../../../kit8/pm/view/project/useLastTask');

const save = jest.fn();
function Probe({ enabled = true }: { enabled?: boolean }) { useLastTask(enabled, save); return null; }

function setup(opts: { saved?: string | null; link?: boolean } = {}) {
  const { byName, demo } = seedStore();
  const projectGUID: string = demo.projects[0].rowGUID;
  const task = byName('Task 111');
  const other = byName('Task 112');
  act(() => usePMStore.setState({
    selectedProjectGUID: projectGUID, loadedProjectGUID: projectGUID, keepWorkspaceMode: true, userSettingsTableMissing: false,
    selectedGUID: null, focusRequest: null,
    userSettingsByProject: opts.saved ? { [projectGUID]: { lastTaskGUID: opts.saved } } : {},
  } as any));
  if (opts.link) mockParams.taskGUID = task.rowGUID;
  return { projectGUID, task, other };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); cleanupUI(); for (const k of Object.keys(mockParams)) delete mockParams[k]; act(() => usePMStore.setState({ selectedGUID: null, focusRequest: null, userSettingsByProject: {} } as any)); });

describe('the setting', () => {
  it('lastTaskGUID: a GUID is kept, anything else = null', () => {
    expect(uxuiSettingsOf({}, { lastTaskGUID: 'abc' }).lastTaskGUID).toBe('abc');
    expect(uxuiSettingsOf({}, { lastTaskGUID: '' }).lastTaskGUID).toBeNull();
    expect(uxuiSettingsOf({}, {}).lastTaskGUID).toBeNull();
  });
});

describe('useLastTask: restore', () => {
  it('the saved task of the project is focused (revealed + scrolled into view) once the rows and the saved settings are in', () => {
    const { task } = setup({ saved: undefined });
    act(() => usePMStore.setState({ userSettingsByProject: { [usePMStore.getState().selectedProjectGUID!]: { lastTaskGUID: task.rowGUID } } } as any));
    renderUI(<Probe />);
    expect(usePMStore.getState().focusRequest?.guid).toBe(task.rowGUID);
  });
  it('waits while the saved settings are not applied yet', () => {
    const { task, projectGUID } = setup({ saved: undefined });
    act(() => usePMStore.setState({ keepWorkspaceMode: false, userSettingsByProject: { [projectGUID]: { lastTaskGUID: task.rowGUID } } } as any));
    renderUI(<Probe />);
    expect(usePMStore.getState().focusRequest).toBeNull();
    act(() => usePMStore.setState({ keepWorkspaceMode: true } as any));
    expect(usePMStore.getState().focusRequest?.guid).toBe(task.rowGUID);
  });
  it('a task that no longer exists, a project with nothing saved, a picker (enabled = false) and a deep link restore nothing', () => {
    setup({ saved: '99999999-9999-4999-8999-999999999999' });
    renderUI(<Probe />);
    expect(usePMStore.getState().focusRequest).toBeNull();
    cleanupUI();
    setup({ saved: null });
    renderUI(<Probe />);
    expect(usePMStore.getState().focusRequest).toBeNull();
    cleanupUI();
    const a = setup({ saved: undefined });
    act(() => usePMStore.setState({ userSettingsByProject: { [a.projectGUID]: { lastTaskGUID: a.task.rowGUID } } } as any));
    renderUI(<Probe enabled={false} />);
    expect(usePMStore.getState().focusRequest).toBeNull();
    cleanupUI();
    const b = setup({ saved: undefined, link: true });
    act(() => usePMStore.setState({ userSettingsByProject: { [b.projectGUID]: { lastTaskGUID: b.other.rowGUID } } } as any));
    renderUI(<Probe />);
    expect(usePMStore.getState().focusRequest).toBeNull();
  });
  it('a task the user has already selected is not replaced by the saved one', () => {
    const { task, other, projectGUID } = setup({ saved: undefined });
    act(() => usePMStore.setState({ selectedGUID: other.rowGUID, userSettingsByProject: { [projectGUID]: { lastTaskGUID: task.rowGUID } } } as any));
    renderUI(<Probe />);
    expect(usePMStore.getState().focusRequest).toBeNull();
    expect(lastTaskToRestore()).toBe(task.rowGUID);
  });
});

describe('useLastTask: save', () => {
  it('a click on a task is saved for the project after a short delay (once, the last one)', () => {
    const { task, other, projectGUID } = setup();
    renderUI(<Probe />);
    act(() => usePMStore.setState({ selectedGUID: task.rowGUID } as any));
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS / 2); });
    act(() => usePMStore.setState({ selectedGUID: other.rowGUID } as any));
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS + 50); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(projectGUID, { lastTaskGUID: other.rowGUID });
  });
  it('the task that is saved already, an empty selection and a picker save nothing', () => {
    const { task, projectGUID } = setup({ saved: undefined });
    act(() => usePMStore.setState({ userSettingsByProject: { [projectGUID]: { lastTaskGUID: task.rowGUID } } } as any));
    renderUI(<Probe />);
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS + 50); }); // the restore selects the saved task: nothing to save
    act(() => usePMStore.setState({ selectedGUID: task.rowGUID } as any));
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS + 50); });
    act(() => usePMStore.setState({ selectedGUID: null } as any));
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS + 50); });
    expect(save).not.toHaveBeenCalled();
    cleanupUI();
    renderUI(<Probe enabled={false} />);
    act(() => usePMStore.setState({ selectedGUID: task.rowGUID } as any));
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS + 50); });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('useLastTask: the whole round trip (click -> saved -> leave the dashboard -> open it again -> scrolled)', () => {
  it('the task clicked last is the one that is focused after a reload, per project', () => {
    const { task, other, projectGUID } = setup();
    // the save of the real app: merged into the user settings of the store (store.setProjectUserSettings), as saveUxuiSettings does
    const realSave = (g: string, patch: any) => usePMStore.getState().setProjectUserSettings(g, { ...(usePMStore.getState().userSettingsByProject[g] || {}), ...patch });
    function RealProbe() { useLastTask(true, realSave); return null; }
    renderUI(<RealProbe />);
    act(() => usePMStore.setState({ selectedGUID: task.rowGUID } as any));
    act(() => usePMStore.setState({ selectedGUID: other.rowGUID } as any));
    act(() => { jest.advanceTimersByTime(LAST_TASK_SAVE_DELAY_MS + 50); });
    expect(usePMStore.getState().userSettingsByProject[projectGUID]).toMatchObject({ lastTaskGUID: other.rowGUID });
    cleanupUI();
    // a page reload: the rows come again, nothing is selected, the saved settings are in
    act(() => usePMStore.setState({ selectedGUID: null, focusRequest: null } as any));
    renderUI(<RealProbe />);
    expect(usePMStore.getState().focusRequest?.guid).toBe(other.rowGUID);
  });
});
