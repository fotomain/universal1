// Kanban data model (kit8/sql/init/create_pm_kanban_tables.sql, kit8/sql/defTable.md pattern). Pure types + defaults.
//
//   kanban_stage_table               catalog  rowOwnerGUID = 'kanbanStageCatalog' · rowParentGUID = 'empty'
//   project_kanban_stage_table       columns  rowOwnerGUID = project · rowParentGUID = catalog stage | 'empty'
//   project_task_kanban_state_table  states   rowOwnerGUID = project · rowParentGUID = task · rowJSON.stageGUID
//
// Every task of a project uses the project's stage set. No state row (or an unknown stage) = the FIRST stage.
// kanbanNoState: a state row with rowJSON.stageGUID = 'kanbanNoState' = the task is in NO column (like empty):
// it is not shown on the board, the tree's Kanban cell says "No state" and the tree can be filtered by it.
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
  /**
   * Whole number 0..100 (SQL trigger pm_kanban_stage_percent_chk keeps it so).
   * 1..100 = FIXED: every card of the stage has this percent. 0 = MANUAL: the percent of a card is typed by hand on the Kanban dashboard.
   * Missing (an old row) = the standard percent of the stage code (waiting 0, plan 10, analyse 30, construct 60, execute 90), else 0.
   */
  stageProgressPercent?: number;
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
  /** independently editable progress % (0..100) of the task in its Kanban stage */
  kanbanStageProgressPercent?: number;
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
export const PM_KANBAN_DEFAULT_STAGES: Required<Pick<PMKanbanStageJSON, 'stageCode' | 'stageName' | 'stageColor' | 'stageProgressPercent'>>[] = [
  { stageCode: 'waiting', stageName: 'Waiting', stageColor: '#94A3B8', stageProgressPercent: 0 },
  { stageCode: 'plan', stageName: 'Plan', stageColor: '#6366F1', stageProgressPercent: 10 },
  { stageCode: 'analyse', stageName: 'Analyse', stageColor: '#0EA5E9', stageProgressPercent: 30 },
  { stageCode: 'construct', stageName: 'Construct', stageColor: '#F59E0B', stageProgressPercent: 60 },
  { stageCode: 'execute', stageName: 'Execute', stageColor: '#22C55E', stageProgressPercent: 90 },
];

/** Standard percent of the stages of the code (same as the SQL function pm_kanban_stage_default_percent). */
export const PM_KANBAN_STANDARD_PERCENT: Record<string, number> = Object.fromEntries(
  PM_KANBAN_DEFAULT_STAGES.map((s) => [s.stageCode, s.stageProgressPercent]),
);

/** Colors offered in the "Kanban Stages" window. */
export const PM_KANBAN_STAGE_COLORS = ['#94A3B8', '#6366F1', '#0EA5E9', '#14B8A6', '#22C55E', '#84CC16', '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#64748B'];

/** rowJSON.stageGUID of a task that is in no Kanban column ("kanbanNoState", like empty). */
export const PM_KANBAN_NO_STATE = 'kanbanNoState';
/** Text of the tree's Kanban cell / pickers for kanbanNoState. */
export const PM_KANBAN_NO_STATE_LABEL = 'No state';
export const PM_KANBAN_NO_STATE_COLOR = '#9CA3AF';

export const isKanbanNoState = (state: PMTaskKanbanStateRow | undefined | null): boolean => state?.rowJSON?.stageGUID === PM_KANBAN_NO_STATE;

/** Step between two orderInList values written by the Kanban (fractional inserts stay possible). */
export const PM_KANBAN_ORDER_STEP = 1024;

/** Stage name limit in the "Kanban Stages" window. */
export const PM_KANBAN_STAGE_NAME_MAX = 40;

export const kanbanStageColorOf = (json: PMKanbanStageJSON | undefined | null, fallback = '#94A3B8'): string =>
  json?.stageColor && /^#[0-9a-f]{6}$/i.test(json.stageColor) ? json.stageColor : fallback;

export const kanbanStageProgressOf = (state: PMTaskKanbanStateRow | undefined | null, fallback = 0): number => {
  const p = state?.rowJSON?.kanbanStageProgressPercent;
  return typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : fallback;
};

/** true when v is a whole number 0..100 (what the SQL trigger accepts). */
export const isKanbanStagePercent = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

/** Percent of a stage: stageProgressPercent, else the standard percent of its code, else 0 (manual). */
export const kanbanStagePercentOf = (json: PMKanbanStageJSON | undefined | null): number => {
  const p = json?.stageProgressPercent;
  if (typeof p === 'number' && Number.isFinite(p)) return Math.max(0, Math.min(100, Math.round(p)));
  const code = json?.stageCode;
  return code && Object.prototype.hasOwnProperty.call(PM_KANBAN_STANDARD_PERCENT, code) ? PM_KANBAN_STANDARD_PERCENT[code] : 0;
};

/** MANUAL stage (percent 0): the percent of each card is typed by hand on the Kanban dashboard. */
export const isKanbanStageManualPercent = (json: PMKanbanStageJSON | undefined | null): boolean => kanbanStagePercentOf(json) === 0;

/**
 * Text -> stage percent for an edit field: '' -> 0, '45' -> 45, '45.5' / '-1' / '101' / 'x' -> null (invalid).
 */
export const parseKanbanStagePercent = (text: string): number | null => {
  const t = String(text ?? '').trim();
  if (t === '') return 0;
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return isKanbanStagePercent(n) ? n : null;
};

/** Percent shown on a card: FIXED stage -> the stage percent (always in step with the stage); MANUAL stage -> the percent typed on the card. */
export const kanbanCardPercentOf = (
  stage: PMKanbanStageJSON | undefined | null,
  state: PMTaskKanbanStateRow | undefined | null,
): number => (isKanbanStageManualPercent(stage) ? kanbanStageProgressOf(state, 0) : kanbanStagePercentOf(stage));
