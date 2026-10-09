/** @jest-environment jsdom */
// useTaskPlaceActivation: the remembered place of a task is activated ONCE when the task is opened - the page scrolls to the section
// and keeps it in view while the content above it loads, until the user touches the page.
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, renderUI, seedStore } from './pmUiTestKit';
import { KEEP_IN_VIEW_MS, useTaskPlaceActivation } from '../../../kit8/pm/view/task/useTaskPlaceActivation';
import { makeLastEditPlace } from '../../../kit8/pm/model/lastEditPlace';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

let api: ReturnType<typeof useTaskPlaceActivation>;
const scrollTo = jest.fn();
function Probe({ guid, hasTask = true }: { guid: string; hasTask?: boolean }) {
  api = useTaskPlaceActivation(guid, hasTask);
  (api.scrollRef as any).current = { scrollTo };
  return null;
}
const layout = (section: 'progress' | 'kanbanProgress' | 'dependencies' | 'finances', y: number) => act(() => api.sectionLayout(section)({ nativeEvent: { layout: { y } } } as any));
const remember = (guid: string, input: Parameters<typeof makeLastEditPlace>[0]) =>
  act(() => usePMStore.setState((s: any) => ({ tasksById: { ...s.tasksById, [guid]: { ...s.tasksById[guid], rowJSON: { ...s.tasksById[guid].rowJSON, lastEditPlace: makeLastEditPlace(input, 'u1') } } } })));

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); cleanupUI(); });

describe('opening a task', () => {
  it('no remembered place: the page stays where it is', () => {
    const { byName } = seedStore();
    renderUI(<Probe guid={byName('Task 111').rowGUID} />);
    expect(api.ready).toBe(true);
    expect(api.financesPlace).toBeNull();
    layout('finances', 700);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('a remembered section: the page scrolls to it (a little above) as soon as its position is known', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'taskPage', section: 'dependencies' });
    renderUI(<Probe guid={guid} />);
    expect(scrollTo).not.toHaveBeenCalled(); // no layout yet
    layout('progress', 100);
    expect(scrollTo).not.toHaveBeenCalled(); // another section
    layout('dependencies', 900);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 892, animated: false });
  });

  it('the Finances place is given to the lines (tab + line) and also scrolls to the Finances section', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'financesView', section: 'finances', genus: 'expenseGenus', lineGUID: 'l1' });
    renderUI(<Probe guid={guid} />);
    expect(api.financesPlace).toMatchObject({ section: 'finances', genus: 'expenseGenus', lineGUID: 'l1' });
    layout('finances', 400);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 392, animated: false });
  });

  it('a place of the task WINDOW does not move the page', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'editModal', section: 'TabUXUI' });
    renderUI(<Probe guid={guid} />);
    layout('finances', 400);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('waits for the task: nothing is ready (and nothing is read) before the task is loaded', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'taskPage', section: 'progress' });
    const { rerender } = renderUI(<Probe guid={guid} hasTask={false} />);
    expect(api.ready).toBe(false);
    rerender(<Probe guid={guid} hasTask />);
    expect(api.ready).toBe(true);
    layout('progress', 50);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 42, animated: false });
  });
});

describe('content above the section is still loading', () => {
  it('the section is kept in view when it moves down, until the user touches the page', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'taskPage', section: 'dependencies' });
    renderUI(<Probe guid={guid} />);
    layout('dependencies', 500);
    layout('dependencies', 640); // the lines of Finances above it arrived
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 632, animated: false });
    const calls = scrollTo.mock.calls.length;
    act(() => api.disarm()); // the user scrolls / taps
    layout('dependencies', 900);
    expect(scrollTo).toHaveBeenCalledTimes(calls);
  });

  it('after ~1.5 s the page is left alone', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'taskPage', section: 'progress' });
    renderUI(<Probe guid={guid} />);
    layout('progress', 100);
    const calls = scrollTo.mock.calls.length;
    act(() => { jest.advanceTimersByTime(KEEP_IN_VIEW_MS + 50); });
    layout('progress', 300);
    expect(scrollTo).toHaveBeenCalledTimes(calls);
  });
});

describe('once per opening', () => {
  it('a place written while the page is open (the user\'s own edits) does not scroll the page again', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    remember(guid, { surface: 'taskPage', section: 'progress' });
    renderUI(<Probe guid={guid} />);
    layout('progress', 100);
    act(() => api.disarm());
    scrollTo.mockClear();
    remember(guid, { surface: 'taskPage', section: 'dependencies' });
    layout('dependencies', 800);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(api.financesPlace).toMatchObject({ section: 'progress' }); // the place of the opening
  });

  it('another task opened on the same page (a dependency link) gets its own place', () => {
    const { byName } = seedStore();
    const a = byName('Task 111').rowGUID;
    const b = byName('Task 112').rowGUID;
    remember(a, { surface: 'taskPage', section: 'progress' });
    remember(b, { surface: 'taskPage', section: 'finances', genus: 'timeGenus' });
    const { rerender } = renderUI(<Probe guid={a} />);
    expect(api.pageSection).toBe('progress');
    rerender(<Probe guid={b} />);
    expect(api.ready).toBe(true);
    expect(api.pageSection).toBe('finances');
    expect(api.financesPlace).toMatchObject({ genus: 'timeGenus' });
  });
});
