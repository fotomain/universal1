/** @jest-environment jsdom */
// kit8/pm/view/kanban: PMKanbanDashboard (columns, cards, scope, ‹ › moves, read-only mode),
// the Gantt | Kanban | Network switch and PMKanbanStagesModalWindow (Kanban Stages).
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, mustGet, press, pressKey, q, qa, renderUI, seedStore, textOf, typeInto } from './pmUiTestKit';

import React from 'react';
import { View } from 'react-native';

// react-native-reanimated-dnd needs Reanimated's native side: pass-through components
jest.mock('react-native-reanimated-dnd', () => {
  const R = require('react');
  const Pass = ({ children, style }: any) => R.createElement(require('react-native').View, { style }, children);
  return {
    __esModule: true,
    Draggable: Object.assign(Pass, { Handle: Pass }),
    Droppable: Pass,
    DropProvider: R.forwardRef(({ children }: any, _ref: any) => children),
  };
});

const mockKanban = {
  moveTasksToStage: jest.fn(),
  moveTreeRowToStage: jest.fn(),
  createStage: jest.fn(),
  updateStage: jest.fn(),
  moveStage: jest.fn(),
  deleteStage: jest.fn(),
  setTaskKanbanProgress: jest.fn(),
  isSaving: false,
};
jest.mock('../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({ useKanbanCommands: () => mockKanban }));
let mockEditorData: any = null;
jest.mock('../../../kit8/pm/crud/kanban/kanbanQueries', () => ({
  useReadKanbanStageCatalogQuery: () => ({}),
  useProjectKanbanData: () => ({ data: mockEditorData, isLoading: false, isError: false }),
}));

import PMKanbanDashboard from '../../../kit8/pm/view/kanban/PMKanbanDashboard';
import PMKanbanStagesModalWindow from '../../../kit8/pm/view/kanban/PMKanbanStagesModalWindow';
import GanttToggleButtons from '../../../kit8/pm/view/gantt/toolbars/GanttToggleButtons';
import { usePMKanbanStore } from '../../../kit8/pm/store/store_kanban';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import type { PMProjectKanbanStageRow } from '../../../kit8/pm/model/kanbanTypes';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#fff', text: '#111', border: '#ccc', error: '#e00' }, false);
const stage = (id: string, order: number, name: string, stageProgressPercent = 0): PMProjectKanbanStageRow => ({ rowGUID: id, rowOwnerGUID: 'p', rowParentGUID: 'empty', orderInList: order, rowJSON: { stageName: name, stageColor: '#6366F1', stageProgressPercent } });
// Waiting = manual (0), Plan = fixed 10 %, Execute = fixed 90 %
const STAGES = [stage('s-wait', 1024, 'Waiting'), stage('s-plan', 2048, 'Plan', 10), stage('s-exec', 3072, 'Execute', 90)];

function setup(missing = false, states: any[] = []) {
  const seeded = seedStore();
  const projectGUID = seeded.demo.projects[0].rowGUID as string;
  act(() => {
    usePMKanbanStore.getState().resetProject(null);
    usePMKanbanStore.getState().hydrateProject(projectGUID, missing ? [] : STAGES, states, missing);
    usePMKanbanStore.getState().setScope(null);
  });
  const crud = fakeCrud();
  renderUI(<PMKanbanDashboard projectGUID={projectGUID} width={900} height={600} palette={palette} crud={crud} kanban={mockKanban as any} />);
  return { ...seeded, projectGUID, crud };
}
const cardsOf = (stageGUID: string) =>
  Array.from(mustGet(`pm-kanban-column-${stageGUID}`).querySelectorAll('[data-testid^="pm-kanban-card-"]')).map((e) => e.textContent || '');

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
  act(() => {
    usePMStore.getState().setSelected(null);
    usePMKanbanStore.getState().setScope(null);
  });
});

describe('Gantt | Kanban | Network switch', () => {
  it('Gantt | Kanban in this order (Network is a section of Reports, not a button of this switch) and reports the choice', () => {
    const onChange = jest.fn();
    renderUI(<GanttToggleButtons palette={palette} onChange={onChange} />);
    expectInOrder(['pm-gantt-vs-network-showGanttChart', 'pm-gantt-vs-network-showKanbanView']);
    expect(q('pm-gantt-vs-network-showNetworkView')).toBeNull();
    press('pm-gantt-vs-network-showKanbanView');
    expect(onChange).toHaveBeenCalledWith('showKanbanView');
  });
});

describe('PMKanbanDashboard', () => {
  it('columns in stage order; tasks without a state are in the first stage; saved states are used', () => {
    const { byName } = seedStore();
    const t112 = byName('Task 112').rowGUID;
    setup(false, [{ rowGUID: 'k1', rowOwnerGUID: 'p', rowParentGUID: t112, orderInList: 1024, rowJSON: { stageGUID: 's-plan' } }]);
    expectInOrder(['pm-kanban-column-s-wait', 'pm-kanban-column-s-plan', 'pm-kanban-column-s-exec']);
    expect(cardsOf('s-plan').join('|')).toContain('Task 112');
    const waiting = cardsOf('s-wait').join('|');
    expect(waiting).toContain('Task 111');
    expect(waiting).not.toContain('Task 112');
    expect(waiting).not.toContain('Stage 1'.concat('|')); // stages are not cards
    expect(textOf('pm-kanban-count')).toBe('6 tasks');
    expect(q('pm-kanban-scope-all')).toBeNull();
  });

  it('‹ › move a card to the previous / next stage, ✎ opens the task editor, tap selects the task', () => {
    const { byName, crud } = setup();
    const t = byName('Task 111').rowGUID;
    press(`pm-kanban-right-${t}`);
    expect(mockKanban.moveTasksToStage).toHaveBeenCalledWith([t], 's-plan');
    expect(mustGet(`pm-kanban-left-${t}`).getAttribute('aria-disabled')).toBe('true'); // first column
    press(`pm-kanban-edit-${t}`);
    expect(crud.edit).toHaveBeenCalledWith(t);
  });

  it('scope follows the tree: a selected stage shows only its tasks, "All" = whole project', () => {
    const { byName } = setup();
    act(() => usePMStore.getState().setSelected(byName('Stage 2').rowGUID));
    expect(textOf('pm-kanban-scope')).toBe('Stage 2');
    expect(textOf('pm-kanban-count')).toBe('3 tasks');
    expect(cardsOf('s-wait').join('|')).toContain('Task 121');
    expect(cardsOf('s-wait').join('|')).not.toContain('Task 111');
    // a task outside the scope -> whole project
    act(() => usePMStore.getState().setSelected(byName('Task 111').rowGUID));
    expect(textOf('pm-kanban-scope')).toBe('Whole project');
    act(() => usePMStore.getState().setSelected(byName('Stage 1').rowGUID));
    press('pm-kanban-scope-all');
    expect(textOf('pm-kanban-count')).toBe('6 tasks');
  });

  it('missing tables: read-only default stages, no move buttons', () => {
    const { byName } = setup(true);
    expect(qa('pm-kanban-column-').length).toBe(5);
    expect(q('pm-kanban-column-default-waiting')).not.toBeNull();
    expect(q(`pm-kanban-right-${byName('Task 111').rowGUID}`)).toBeNull();
  });

  it('stage progress can be edited on card badge and calls setTaskKanbanProgress', () => {
    const { byName } = seedStore();
    const t = byName('Task 111').rowGUID;
    setup(false, [
      { rowGUID: 'k1', rowOwnerGUID: 'p', rowParentGUID: t, orderInList: 1024, rowJSON: { stageGUID: 's-wait', kanbanStageProgressPercent: 25 } },
    ]);
    expect(textOf(`pm-kanban-progress-badge-${t}`)).toContain('25%');
    press(`pm-kanban-progress-badge-${t}`);
    const inputEl = mustGet(`pm-kanban-progress-input-${t}`);
    const htmlInput = (inputEl.tagName === 'INPUT' ? inputEl : inputEl.querySelector('input')) as HTMLInputElement;
    expect(htmlInput.selectionStart).toBe(0);
    expect(htmlInput.selectionEnd).toBe(2); // '25' length is 2
    typeInto(`pm-kanban-progress-input-${t}`, '75');
    pressKey(`pm-kanban-progress-input-${t}`, 'Enter');
    expect(mockKanban.setTaskKanbanProgress).toHaveBeenCalledWith(t, 75);
  });
});

describe('Kanban stage percent on the dashboard', () => {
  it('the column header says "manual" or the percent of the stage', () => {
    setup();
    expect(textOf('pm-kanban-colpercent-s-wait')).toBe('manual');
    expect(textOf('pm-kanban-colpercent-s-plan')).toBe('10%');
    expect(textOf('pm-kanban-colpercent-s-exec')).toBe('90%');
  });

  it('a card of a FIXED stage shows the percent of the stage and cannot be typed; a card of a manual stage can', () => {
    const { byName } = seedStore();
    const t112 = byName('Task 112').rowGUID;
    const t111 = byName('Task 111').rowGUID;
    setup(false, [
      { rowGUID: 'k1', rowOwnerGUID: 'p', rowParentGUID: t112, orderInList: 1024, rowJSON: { stageGUID: 's-plan', kanbanStageProgressPercent: 77 } }, // a stored percent is ignored in a fixed stage
    ]);
    expect(textOf(`pm-kanban-progress-badge-${t112}`)).toContain('10%');
    expect(q(`pm-kanban-progress-fixed-${t112}`)).not.toBeNull();
    press(`pm-kanban-progress-badge-${t112}`);
    expect(q(`pm-kanban-progress-input-${t112}`)).toBeNull(); // no editor
    expect(mustGet(`pm-kanban-progress-track-${t112}`).getAttribute('aria-disabled')).toBe('true');
    expect(mockKanban.setTaskKanbanProgress).not.toHaveBeenCalled();
    // Task 111 is in Waiting (manual): editable, no "stage" mark
    expect(q(`pm-kanban-progress-fixed-${t111}`)).toBeNull();
    press(`pm-kanban-progress-badge-${t111}`);
    expect(q(`pm-kanban-progress-input-${t111}`)).not.toBeNull();
  });
});

describe('PMKanbanStagesModalWindow (Kanban Stages)', () => {
  const open = () => {
    mockEditorData = { stages: STAGES, states: [], missing: false };
    renderUI(<View><PMKanbanStagesModalWindow projectGUID="p" projectName="Project 1" visible onClose={jest.fn()} /></View>);
  };
  it('renders nothing when closed', () => {
    renderUI(<PMKanbanStagesModalWindow projectGUID="p" visible={false} onClose={jest.fn()} />);
    expect(q('pm-kanban-stages-window')).toBeNull();
  });
  it('add / rename / reorder / sql_for_delete (confirmed inline)', () => {
    open();
    expect(q('pm-kanban-stages-window')).not.toBeNull();
    typeInto('pm-kanban-stage-new-name', 'Review');
    press('pm-kanban-stage-add');
    expect(mockKanban.createStage).toHaveBeenCalledWith('Review', expect.any(String), 0);
    typeInto('pm-kanban-stage-new-name', 'plan'); // duplicate (case-insensitive)
    press('pm-kanban-stage-add');
    expect(mockKanban.createStage).toHaveBeenCalledTimes(1);
    press('pm-kanban-stage-right-s-wait');
    expect(mockKanban.moveStage).toHaveBeenCalledWith('s-wait', 1);
    press('pm-kanban-stage-delete-s-plan');
    expect(mockKanban.deleteStage).not.toHaveBeenCalled();
    press('pm-kanban-stage-delete-yes-s-plan');
    expect(mockKanban.deleteStage).toHaveBeenCalledWith('s-plan');
    press('pm-kanban-stage-color-s-exec');
    press('pm-kanban-stage-colors-s-exec-#EF4444');
    expect(mockKanban.updateStage).toHaveBeenCalledWith('s-exec', { stageColor: '#EF4444' });
  });
  it('the percent of a stage: shown, edited (whole number 0..100), refused otherwise; a new stage can have one', () => {
    open();
    expect((mustGet('pm-kanban-stage-percent-s-plan') as HTMLInputElement).value).toBe('10');
    expect((mustGet('pm-kanban-stage-percent-s-wait') as HTMLInputElement).value).toBe('0');
    typeInto('pm-kanban-stage-percent-s-plan', '45');
    pressKey('pm-kanban-stage-percent-s-plan', 'Enter');
    expect(mockKanban.updateStage).toHaveBeenCalledWith('s-plan', { stageProgressPercent: 45 });
    mockKanban.updateStage.mockClear();
    typeInto('pm-kanban-stage-percent-s-exec', '90'); // unchanged
    pressKey('pm-kanban-stage-percent-s-exec', 'Enter');
    expect(mockKanban.updateStage).not.toHaveBeenCalled();
    typeInto('pm-kanban-stage-new-name', 'Review');
    typeInto('pm-kanban-stage-new-percent', '70');
    pressKey('pm-kanban-stage-new-percent', 'Enter');
    press('pm-kanban-stage-add');
    expect(mockKanban.createStage).toHaveBeenCalledWith('Review', expect.any(String), 70);
  });
  it('missing tables: explains which SQL to run', () => {
    mockEditorData = { stages: [], states: [], missing: true };
    renderUI(<PMKanbanStagesModalWindow projectGUID="p" visible onClose={jest.fn()} />);
    expect(mustGet('pm-kanban-stages-window').textContent).toContain('create_tables.sql');
  });
});
