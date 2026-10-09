/** @jest-environment jsdom */
// PMTaskEditModal and rowJSON.lastEditPlace: the window opens on the tab the task was edited on last; Save remembers the tab that
// holds what changed (and leaves the place alone when nothing changed).
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore, typeInto } from './pmUiTestKit';
import PMTaskEditModal from '../../../kit8/pm/view/task/PMTaskEditModal';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { makeLastEditPlace } from '../../../kit8/pm/model/lastEditPlace';

jest.mock('../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({
  useKanbanCommands: () => ({ setTaskKanbanProgress: jest.fn(), setTasksKanbanProgress: jest.fn() }),
}));

afterEach(() => {
  jest.clearAllMocks();
  act(() => usePMStore.setState({ editingGUID: null }));
  cleanupUI();
});

const selected = (id: string) => q(id)?.getAttribute('aria-selected') === 'true';

/** the task with a remembered place, opened in the window */
function open(placeInput?: Parameters<typeof makeLastEditPlace>[0]) {
  const { byName, store } = seedStore();
  const task = byName('Task 111');
  if (placeInput) {
    const place = makeLastEditPlace(placeInput, 'u1');
    act(() => store.setState((s: any) => ({ tasksById: { ...s.tasksById, [task.rowGUID]: { ...s.tasksById[task.rowGUID], rowJSON: { ...s.tasksById[task.rowGUID].rowJSON, lastEditPlace: place } } } })));
  }
  const crud = fakeCrud();
  renderUI(<PMTaskEditModal crud={crud} />);
  act(() => store.getState().setEditing(task.rowGUID));
  return { crud, task };
}

describe('opening the task window', () => {
  it('without a place it opens on Main', () => {
    open();
    expect(selected('pm-task-tab-TabMain')).toBe(true);
    expect(selected('pm-task-tab-TabUXUI')).toBe(false);
  });

  it('it opens on the tab of the last edit', () => {
    open({ surface: 'editModal', section: 'TabUXUI' });
    expect(selected('pm-task-tab-TabUXUI')).toBe(true);
    expect(selected('pm-task-tab-TabMain')).toBe(false);
  });

  it('a place of another screen (the Finances lines, the task page) does not move the window', () => {
    open({ surface: 'taskPage', section: 'finances', genus: 'timeGenus' });
    expect(selected('pm-task-tab-TabMain')).toBe(true);
  });
});

describe('saving the task window', () => {
  it('a changed field on Main remembers Main', () => {
    const { crud, task } = open({ surface: 'editModal', section: 'TabUXUI' });
    press('pm-task-tab-TabMain');
    typeInto('pm-edit-name', 'Renamed task');
    press('pm-edit-save');
    expect(crud.recordEditPlace).toHaveBeenCalledWith(task.rowGUID, { surface: 'editModal', section: 'TabMain' });
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
  });

  it('a changed color on UX/UI remembers UX/UI', () => {
    const { crud, task } = open();
    press('pm-task-tab-TabUXUI');
    press('pm-edit-color-#ef4444');
    press('pm-edit-save');
    expect(crud.recordEditPlace).toHaveBeenCalledWith(task.rowGUID, { surface: 'editModal', section: 'TabUXUI' });
  });

  it('nothing changed: Save leaves the remembered place alone', () => {
    const { crud } = open({ surface: 'editModal', section: 'TabUXUI' });
    press('pm-edit-save');
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
    expect(crud.recordEditPlace).not.toHaveBeenCalled();
  });

  it('Cancel never remembers a place', () => {
    const { crud } = open();
    typeInto('pm-edit-name', 'Not saved');
    press('pm-edit-cancel');
    expect(crud.recordEditPlace).not.toHaveBeenCalled();
    expect(crud.updateTask).not.toHaveBeenCalled();
  });
});
