/** @jest-environment jsdom */
// Tests for the TaskTree "Kanban" column and its inline stage editor (EditTaskKanbanStage).
import React, { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore } from './pmUiTestKit';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { usePMKanbanStore } from '../../../kit8/pm/store/store_kanban';
import EditTaskKanbanStage from '../../../kit8/pm/view/tree/inline/EditTaskKanbanStage';
import {
  PM_TREE_COLUMNS_DEFAULT_ORDER,
  PM_TREE_COLUMN_TITLES,
  PM_TREE_COLUMN_WIDTHS,
  layoutTreeColumns,
  normalizeTreeColumnsOrder,
} from '../../../kit8/pm/view/tree/columns/treeColumns';
import { PM_TREE_COL_KANBAN } from '../../../kit8/pm/model/constants';

const mockKanban = {
  moveTasksToStage: jest.fn(),
  moveTreeRowToStage: jest.fn(),
  createStage: jest.fn(),
  updateStage: jest.fn(),
  moveStage: jest.fn(),
  deleteStage: jest.fn(),
  isSaving: false,
};
jest.mock('../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({
  useKanbanCommands: () => mockKanban,
}));

const colors = { text: '#000', border: '#ccc', background: '#fff', primary: '#6366f1', error: '#f00' };

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
});

describe('TaskTree "Kanban" column definition', () => {
  it('is the last built-in column in default order', () => {
    expect(PM_TREE_COLUMNS_DEFAULT_ORDER[PM_TREE_COLUMNS_DEFAULT_ORDER.length - 1]).toBe('kanban');
    expect(PM_TREE_COLUMN_TITLES.kanban).toBe('Kanban');
    expect(PM_TREE_COLUMN_WIDTHS.kanban).toBe(PM_TREE_COL_KANBAN);
  });

  it('normalizeTreeColumnsOrder preserves "kanban" at the end', () => {
    const norm = normalizeTreeColumnsOrder(null);
    expect(norm[norm.length - 1]).toBe('kanban');
    expect(norm).toEqual(['wbs', 'name', 'start', 'days', 'progress', 'kanban']);
  });

  it('layoutTreeColumns lays out the Kanban column as last column', () => {
    const layout = layoutTreeColumns(600, PM_TREE_COLUMNS_DEFAULT_ORDER);
    expect(layout.byKey.kanban).toBeDefined();
    expect(layout.columns[layout.columns.length - 1].key).toBe('kanban');
    expect(layout.byKey.kanban!.title).toBe('Kanban');
    expect(layout.byKey.kanban!.w).toBe(PM_TREE_COL_KANBAN);
  });
});

describe('EditTaskKanbanStage inline editor', () => {
  const scrollY = { value: 0 } as any;

  const mockStages = [
    { rowGUID: 'stage-1', rowOwnerGUID: 'p1', rowParentGUID: 'empty', orderInList: 1024, rowJSON: { stageName: 'Waiting', stageColor: '#94A3B8' } },
    { rowGUID: 'stage-2', rowOwnerGUID: 'p1', rowParentGUID: 'empty', orderInList: 2048, rowJSON: { stageName: 'In Progress', stageColor: '#6366F1' } },
    { rowGUID: 'stage-3', rowOwnerGUID: 'p1', rowParentGUID: 'empty', orderInList: 3072, rowJSON: { stageName: 'Done', stageColor: '#22C55E' } },
  ];

  it('displays the list of Kanban stages and highlights the current stage', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    const crud = fakeCrud();

    act(() => {
      usePMStore.getState().selectProject('p1');
      usePMKanbanStore.getState().hydrateProject('p1', mockStages as any, [
        { rowGUID: 'st-1', rowOwnerGUID: 'p1', rowParentGUID: task.rowGUID, orderInList: 1024, rowJSON: { stageGUID: 'stage-2' } } as any,
      ], false);
      usePMStore.getState().setCellEdit({ guid: task.rowGUID, field: 'kanban' });
    });

    renderUI(
      <EditTaskKanbanStage
        guid={task.rowGUID}
        rowIndex={1}
        x={200}
        width={100}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    expect(q(`pm-tree-edit-kanban-popup-${task.rowGUID}`)).not.toBeNull();
    expect(q('pm-tree-edit-kanban-option-stage-1')).not.toBeNull();
    expect(q('pm-tree-edit-kanban-option-stage-2')).not.toBeNull();
    expect(q('pm-tree-edit-kanban-option-stage-3')).not.toBeNull();
    expect(document.body.textContent).toContain('Waiting');
    expect(document.body.textContent).toContain('In Progress');
    expect(document.body.textContent).toContain('Done');
  });

  it('clicking a stage calls moveTreeRowToStage and closes the editor', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    const crud = fakeCrud();

    act(() => {
      usePMStore.getState().selectProject('p1');
      usePMKanbanStore.getState().hydrateProject('p1', mockStages as any, [], false);
      usePMStore.getState().setCellEdit({ guid: task.rowGUID, field: 'kanban' });
    });

    renderUI(
      <EditTaskKanbanStage
        guid={task.rowGUID}
        rowIndex={1}
        x={200}
        width={100}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    press('pm-tree-edit-kanban-option-stage-3');

    expect(mockKanban.moveTreeRowToStage).toHaveBeenCalledWith(task.rowGUID, 'stage-3');
    expect(usePMStore.getState().cellEdit).toBeNull();
  });

  it('clicking close button or backdrop cancels without moving stage', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    const crud = fakeCrud();

    act(() => {
      usePMStore.getState().selectProject('p1');
      usePMKanbanStore.getState().hydrateProject('p1', mockStages as any, [], false);
      usePMStore.getState().setCellEdit({ guid: task.rowGUID, field: 'kanban' });
    });

    renderUI(
      <EditTaskKanbanStage
        guid={task.rowGUID}
        rowIndex={1}
        x={200}
        width={100}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    press('pm-tree-edit-kanban-close');
    expect(mockKanban.moveTreeRowToStage).not.toHaveBeenCalled();
    expect(usePMStore.getState().cellEdit).toBeNull();
  });
});
