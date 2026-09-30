// Kanban data model (kit8/sql/init/create_pm_kanban_tables.sql, kit8/sql/defTable.md pattern). Pure types + defaults.
//
//   kanban_stage_table               catalog  rowOwnerGUID = 'kanbanStageCatalog' · rowParentGUID = 'empty'
//   project_kanban_stage_table       columns  rowOwnerGUID = project · rowParentGUID = catalog stage | 'empty'
//   project_task_kanban_state_table  states   rowOwnerGUID = project · rowParentGUID = task · rowJSON.stageGUID
//
// Every task of a project uses the project's stage set. No state row (or an unknown stage) = the FIRST stage.
// The Kanban stage is independent of the task progress % (project_task_table.rowProgress).

export {
  kanbanStageTable,
  projectKanbanStageTable,
  projectTaskKanbanStateTable,
  KANBAN_STAGE_CATALOG_OWNER,
} from './constants';

/** rowJSON of a catalog / project stage. */
export interface PMKanbanStageJSON {
  /** stable code, e.g. 'waiting' (catalog: unique) */
  stageCode?: string;
  stageName: string;
  /** '#RRGGBB' - column accent */
  stageColor?: string;
  /** catalog only: copied into new projects (default true) */
  isActive?: boolean;
  /** project only: optional work-in-progress limit (0 / undefined = none) */
  wipLimit?: number;
}

/** Row of kanban_stage_table (catalog). */
export interface PMKanbanStageRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: PMKanbanStageJSON;
  created_at?: string;
  updated_at?: string;
}

/** Row of project_kanban_stage_table (a column of one project). */
export interface PMProjectKanbanStageRow {
  rowGUID: string;
  /** the project */
  rowOwnerGUID: string;
  /** catalog stage it was copied from, or 'empty' */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: PMKanbanStageJSON;
  created_at?: string;
  updated_at?: string;
}

/** rowJSON of project_task_kanban_state_table. */
export interface PMTaskKanbanStateJSON {
  /** project_kanban_stage_table.rowGUID */
  stageGUID: string;
}

/** Row of project_task_kanban_state_table (the stage of one task). */
export interface PMTaskKanbanStateRow {
  rowGUID: string;
  /** the project */
  rowOwnerGUID: string;
  /** the task (project_task_table.rowGUID) */
  rowParentGUID: string;
  /** card order inside its column */
  orderInList: number;
  rowJSON: PMTaskKanbanStateJSON;
  created_at?: string;
  updated_at?: string;
}

/** Kanban data of one project (React Query cache of useReadProjectKanbanQuery). */
export interface PMProjectKanbanData {
  stages: PMProjectKanbanStageRow[];
  states: PMTaskKanbanStateRow[];
  /** create_pm_kanban_tables.sql not run yet: the board shows the default stages read-only */
  missing: boolean;
}

/** projectTaskKanbanStages - defaults when the catalog is empty / missing (same as the SQL seed). */
export const PM_KANBAN_DEFAULT_STAGES: Required<Pick<PMKanbanStageJSON, 'stageCode' | 'stageName' | 'stageColor'>>[] = [
  { stageCode: 'waiting', stageName: 'Waiting', stageColor: '#94A3B8' },
  { stageCode: 'plan', stageName: 'Plan', stageColor: '#6366F1' },
  { stageCode: 'analyse', stageName: 'Analyse', stageColor: '#0EA5E9' },
  { stageCode: 'construct', stageName: 'Construct', stageColor: '#F59E0B' },
  { stageCode: 'execute', stageName: 'Execute', stageColor: '#22C55E' },
];

/** Colors offered in the "Kanban Stages" window. */
export const PM_KANBAN_STAGE_COLORS = ['#94A3B8', '#6366F1', '#0EA5E9', '#14B8A6', '#22C55E', '#84CC16', '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#64748B'];

/** Step between two orderInList values written by the Kanban (fractional inserts stay possible). */
export const PM_KANBAN_ORDER_STEP = 1024;

/** Stage name limit in the "Kanban Stages" window. */
export const PM_KANBAN_STAGE_NAME_MAX = 40;

export const kanbanStageColorOf = (json: PMKanbanStageJSON | undefined | null, fallback = '#94A3B8'): string =>
  json?.stageColor && /^#[0-9a-f]{6}$/i.test(json.stageColor) ? json.stageColor : fallback;
