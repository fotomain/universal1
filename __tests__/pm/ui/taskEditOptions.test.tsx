/** @jest-environment jsdom */
// PMTaskEditOptions: the window of the context menu item "Options" - title "Edit options", the UX/UI of the task only (the bar color).
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore } from './pmUiTestKit';

const PMTaskEditOptions = require('../../../kit8/pm/view/task/PMTaskEditOptions').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.getState().setEditingOptions(null)); });

function open(crud = fakeCrud()) {
  const { byName } = seedStore();
  const t = byName('Task 111');
  renderUI(<PMTaskEditOptions crud={crud} />);
  act(() => usePMStore.getState().setEditingOptions(t.rowGUID));
  return { t, crud };
}

describe('PMTaskEditOptions', () => {
  it('is closed until the store asks; the title is "Edit options"', () => {
    seedStore();
    renderUI(<PMTaskEditOptions crud={fakeCrud()} />);
    expect(q('pm-task-options')).toBeNull();
    cleanupUI();
    open();
    expect(q('pm-task-options-title')!.textContent).toBe('Edit options');
  });

  it('contains the UX/UI colors only: no name, days, dates, progress, kanban, notes, tabs', () => {
    open();
    expect(q('pm-task-colors-section')).not.toBeNull();
    expect(q('pm-task-color-picker')).not.toBeNull();
    for (const id of ['pm-edit-name', 'pm-edit-days', 'pm-edit-progress', 'pm-edit-notes', 'pm-task-edit-toptabs', 'pm-edit-delete', 'pm-edit-open']) expect(q(id)).toBeNull();
  });

  it('Save with a new color writes only taskColor (the rest of rowJSON is kept) and closes', () => {
    const { t, crud } = open();
    press('pm-edit-color-#ef4444');
    press('pm-task-options-save');
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
    const [guid, patch] = crud.updateTask.mock.calls[0];
    expect(guid).toBe(t.rowGUID);
    expect(patch.rowJSON).toEqual({ ...t.rowJSON, taskColor: '#EF4444' });
    expect(crud.recordEditPlace).toHaveBeenCalledWith(t.rowGUID, { surface: 'editModal', section: 'TabUXUI' });
    expect(usePMStore.getState().editingOptionsGUID).toBeNull();
  });

  it('Save without a change writes nothing; Cancel / X close without saving', () => {
    const { crud } = open();
    press('pm-task-options-save');
    expect(crud.updateTask).not.toHaveBeenCalled();
    expect(usePMStore.getState().editingOptionsGUID).toBeNull();
    cleanupUI();
    const second = open();
    press('pm-edit-color-#ef4444');
    press('pm-task-options-cancel');
    expect(second.crud.updateTask).not.toHaveBeenCalled();
    expect(usePMStore.getState().editingOptionsGUID).toBeNull();
    cleanupUI();
    open();
    press('pm-task-options-close');
    expect(usePMStore.getState().editingOptionsGUID).toBeNull();
  });

  it('the full task form (PMTaskEditModal) is not opened by it', () => {
    open();
    expect(usePMStore.getState().editingGUID).toBeNull();
  });
});
