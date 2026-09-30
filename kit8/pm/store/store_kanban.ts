// Zustand store of the Kanban view (kit8/pm/view/kanban). Filled from React Query
// (crud/kanban/kanbanQueries.ts) exactly like store_pm.ts is: server truth -> hydrate -> selectors.
//
//   catalog            kanban_stage_table rows (shared default stages)
//   stages / states    project_kanban_stage_table + project_task_kanban_state_table of the selected project
//   scopeGUID          board shows the subtree of this tree row (null = the whole project)
//   treeDrag           a tree row is being dragged over the board (view/kanban/kanbanTreeBridge.ts)
//   stagesEditor       "Kanban Stages" window (Project settings) is open for this project

import { create } from 'zustand';
import type { PMKanbanStageRow, PMProjectKanbanStageRow, PMTaskKanbanStateRow } from '../model/kanbanTypes';

export interface PMKanbanTreeDrag {
  /** dragged tree row (a stage drags all its tasks) */
  guid: string;
  name: string;
  /** stage (column) under the pointer, null = not over a column */
  overStageGUID: string | null;
}

export interface PMKanbanStoreState {
  catalog: PMKanbanStageRow[];
  catalogMissing: boolean;
  /** project whose stages / states are loaded (null = none yet) */
  loadedProjectGUID: string | null;
  stages: PMProjectKanbanStageRow[];
  statesByTask: Record<string, PMTaskKanbanStateRow>;
  /** create_pm_kanban_tables.sql not run: default stages, read-only */
  tablesMissing: boolean;
  scopeGUID: string | null;
  treeDrag: PMKanbanTreeDrag | null;
  stagesEditorProjectGUID: string | null;

  hydrateCatalog: (rows: PMKanbanStageRow[], missing: boolean) => void;
  hydrateProject: (projectGUID: string, stages: PMProjectKanbanStageRow[], states: PMTaskKanbanStateRow[], missing: boolean) => void;
  resetProject: (projectGUID: string | null) => void;
  setScope: (guid: string | null) => void;
  setTreeDrag: (drag: PMKanbanTreeDrag | null) => void;
  setTreeDragOver: (stageGUID: string | null) => void;
  openStagesEditor: (projectGUID: string | null) => void;
}

export const usePMKanbanStore = create<PMKanbanStoreState>((set, get) => ({
  catalog: [],
  catalogMissing: false,
  loadedProjectGUID: null,
  stages: [],
  statesByTask: {},
  tablesMissing: false,
  scopeGUID: null,
  treeDrag: null,
  stagesEditorProjectGUID: null,

  hydrateCatalog: (rows, missing) => set({ catalog: rows, catalogMissing: missing }),
  hydrateProject: (projectGUID, stages, states, missing) => {
    const statesByTask: Record<string, PMTaskKanbanStateRow> = {};
    for (const s of states) statesByTask[s.rowParentGUID] = s;
    set((st) => ({
      loadedProjectGUID: projectGUID,
      stages: [...stages].sort((a, b) => a.orderInList - b.orderInList),
      statesByTask,
      tablesMissing: missing,
      // another project: the scope row does not exist there
      scopeGUID: st.loadedProjectGUID === projectGUID ? st.scopeGUID : null,
    }));
  },
  resetProject: (projectGUID) =>
    set((st) => (st.loadedProjectGUID === projectGUID ? {} : { loadedProjectGUID: null, stages: [], statesByTask: {}, scopeGUID: null, treeDrag: null })),
  setScope: (guid) => {
    if (get().scopeGUID !== guid) set({ scopeGUID: guid });
  },
  setTreeDrag: (drag) => set({ treeDrag: drag }),
  setTreeDragOver: (stageGUID) => {
    const d = get().treeDrag;
    if (d && d.overStageGUID !== stageGUID) set({ treeDrag: { ...d, overStageGUID: stageGUID } });
  },
  openStagesEditor: (projectGUID) => set({ stagesEditorProjectGUID: projectGUID }),
}));

/** Non-hook access for gesture callbacks. */
export const pmKanbanStore = usePMKanbanStore;
