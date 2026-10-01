/** @jest-environment jsdom */
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore, textOf, typeInto } from './pmUiTestKit';
import PMTaskEditModal from '../../../kit8/pm/view/task/PMTaskEditModal';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const mockKanban = {
  moveTasksToStage: jest.fn(),
  moveTreeRowToStage: jest.fn(),
  setTaskKanbanProgress: jest.fn(),
  setTasksKanbanProgress: jest.fn(),
  createStage: jest.fn(),
  updateStage: jest.fn(),
  moveStage: jest.fn(),
  deleteStage: jest.fn(),
  isSaving: false,
};
jest.mock('../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({
  useKanbanCommands: () => mockKanban,
}));

afterEach(() => {
  jest.clearAllMocks();
  act(() => {
    usePMStore.setState({
      editingGUID: null,
      planHour: false,
      planMinute: false,
      planSecond: false,
    });
  });
  cleanupUI();
});

describe('PMTaskEditModal TopTabs and Dates/Times Validation', () => {
  it('renders TopTabs (TabMain and TabUXUI) and switches between tabs', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskEditModal crud={fakeCrud()} />);

    act(() => usePMStore.getState().setEditing(task.rowGUID));

    // TopTabs bar present
    expect(q('pm-task-edit-toptabs')).not.toBeNull();
    expect(q('pm-task-tab-TabMain')).not.toBeNull();
    expect(q('pm-task-tab-TabUXUI')).not.toBeNull();

    // Default active tab is TabMain
    expect(q('pm-task-tab-main-content')).not.toBeNull();
    expect(q('pm-edit-start')).not.toBeNull();
    expect(q('pm-edit-finish')).not.toBeNull();

    // Switch to TabUXUI
    press('pm-task-tab-TabUXUI');
    expect(q('pm-task-tab-uxui-content')).not.toBeNull();
    expect(q('pm-edit-color-auto')).not.toBeNull();
  });

  it('validates start date greater than finish date (start > finish)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskEditModal crud={fakeCrud()} />);

    act(() => usePMStore.getState().setEditing(task.rowGUID));

    // Set finish date first, then set start date past finish
    typeInto('pm-edit-finish', '2026-10-05');
    typeInto('pm-edit-start', '2026-10-10');

    press('pm-edit-save');
    expect(q('pm-task-edit-error')).not.toBeNull();
    expect(textOf('pm-task-edit-error')).toContain('Start date cannot be after finish date.');
  });

  it('validates finish date less than start date (finish < start)', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskEditModal crud={fakeCrud()} />);

    act(() => usePMStore.getState().setEditing(task.rowGUID));

    typeInto('pm-edit-start', '2026-10-10');
    typeInto('pm-edit-finish', '2026-10-02');

    press('pm-edit-save');
    expect(q('pm-task-edit-error')).not.toBeNull();
    expect(textOf('pm-task-edit-error')).toContain('Finish date cannot be before start date.');
  });

  it('enables sub-unit inputs when planHour, planMinute, planSecond are true and validates ranges', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');

    act(() => {
      usePMStore.setState({
        planHour: true,
        planMinute: true,
        planSecond: true,
      });
      usePMStore.getState().setEditing(task.rowGUID);
    });

    renderUI(<PMTaskEditModal crud={fakeCrud()} />);

    // Sub-unit inputs for start
    expect(q('pm-edit-start-hour')).not.toBeNull();
    expect(q('pm-edit-start-minute')).not.toBeNull();
    expect(q('pm-edit-start-second')).not.toBeNull();

    // Sub-unit inputs for finish
    expect(q('pm-edit-finish-hour')).not.toBeNull();
    expect(q('pm-edit-finish-minute')).not.toBeNull();
    expect(q('pm-edit-finish-second')).not.toBeNull();

    // Test invalid hour > 23
    typeInto('pm-edit-start-hour', '25');
    press('pm-edit-save');
    expect(q('pm-task-edit-error')).not.toBeNull();
    expect(textOf('pm-task-edit-error')).toContain('Hours must be between 0 and 23.');

    // Test invalid minute > 59
    typeInto('pm-edit-start-hour', '10');
    typeInto('pm-edit-start-minute', '65');
    press('pm-edit-save');
    expect(q('pm-task-edit-error')).not.toBeNull();
    expect(textOf('pm-task-edit-error')).toContain('Minutes must be between 0 and 59.');

    // Test invalid second > 59
    typeInto('pm-edit-start-minute', '30');
    typeInto('pm-edit-start-second', '70');
    press('pm-edit-save');
    expect(q('pm-task-edit-error')).not.toBeNull();
    expect(textOf('pm-task-edit-error')).toContain('Seconds must be between 0 and 59.');
  });
});
