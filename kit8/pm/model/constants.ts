// PM Gantt module constants. Table names are the single source of truth for every
// Supabase call in kit8/pm (never hard-code a table string anywhere else).

export const projectTable = 'project_table';
export const projectTaskTable = 'project_task_table';
export const projectTaskDependenciesTable = 'project_task_dependencies_table';
export const projectTaskDependencyClosureTable = 'project_task_dependency_closure_table';
/** Per user settings of a project (rowOwnerGUID = project, rowParentGUID = user, rowJSON.uxuiSettings). */
export const projectUserSettingsTable = 'project_user_settings_table';

// ---- Kanban (kit8/sql/init/create_pm_kanban_tables.sql, kit8/sql/defTable.md pattern) ----------------
/** Catalog of default Kanban stages (rowOwnerGUID = KANBAN_STAGE_CATALOG_OWNER). */
export const kanbanStageTable = 'kanban_stage_table';
/** Kanban stages (columns) of a project (rowOwnerGUID = project). */
export const projectKanbanStageTable = 'project_kanban_stage_table';
/** Kanban stage of a task (rowOwnerGUID = project, rowParentGUID = task, rowJSON.stageGUID). */
export const projectTaskKanbanStateTable = 'project_task_kanban_state_table';
/** rowOwnerGUID of the shared kanban_stage_table catalog rows. */
export const KANBAN_STAGE_CATALOG_OWNER = 'kanbanStageCatalog';
/** RPC: the project's stages; the first call copies the catalog into the project. */
export const pmRpcKanbanEnsureProjectStages = 'pm_kanban_ensure_project_stages';

// SQL functions (see kit8/sql/init/create_pm_tables.sql)
export const pmRpcApplySchedule = 'pm_apply_schedule';
export const pmRpcDependencyCreatesCycle = 'pm_dependency_creates_cycle';

export const PM_ROUTES = {
  dashboard: '/pm/project/dashboard',
  task: '/pm/project/task',
} as const;

// ---- layout (px) -----------------------------------------------------------------
export const PM_ROW_HEIGHT = 34;
export const PM_SCALE_HEIGHT = 48; // two-tier time scale; the tree header matches it
export const PM_TOOLBAR_HEIGHT = 40; // tree + chart toolbars share it so canvases align
export const PM_SPLITTER_WIDTH = 6;

export const PM_TREE_DEFAULT_WIDTH = 380;
export const PM_TREE_MIN_WIDTH = 200;
export const PM_TREE_MAX_WIDTH = 720;
export const PM_TREE_INDENT = 18;
/** Outline number column ("1.2.3"), right of the Task name. */
export const PM_TREE_COL_WBS = 52;
export const PM_TREE_COL_TASK_START_DATE = 78;
export const PM_TREE_COL_TASK_FINISH_DATE = 78;
export const PM_TREE_COL_START_HOUR_START = 54;
export const PM_TREE_COL_START_HOUR_FINISH = 54;
export const PM_TREE_COL_PLAN_MINUTE_START = 50;
export const PM_TREE_COL_PLAN_MINUTE_FINISH = 50;
export const PM_TREE_COL_PLAN_SECOND_START = 50;
export const PM_TREE_COL_PLAN_SECOND_FINISH = 50;
export const PM_TREE_COL_TASK_DURATION = 56;
/** @deprecated legacy alias for PM_TREE_COL_TASK_START_DATE */
export const PM_TREE_COL_START = PM_TREE_COL_TASK_START_DATE;
/** @deprecated legacy alias for PM_TREE_COL_TASK_DURATION */
export const PM_TREE_COL_DAYS = PM_TREE_COL_TASK_DURATION;
export const PM_TREE_COL_PROGRESS = 46;
export const PM_TREE_COL_KANBAN = 88;
export const PM_TREE_COL_KANBAN_PROGRESS = 58;

export const PM_DAY_WIDTH_DEFAULT = 30;
export const PM_DAY_WIDTH_MIN = 1; // Year zoom (quarter / year scale)
export const PM_DAY_WIDTH_MAX = 160;

export const PM_BAR_VPAD = 7; // bar top/bottom inset inside a row
export const PM_BAR_HANDLE_PX = 7; // resize grip hot-zone at each bar end
export const PM_LINK_HANDLE_R = 5; // link circle radius drawn outside the bar ends
export const PM_OVERSCAN_ROWS = 12; // rows rendered above/below the viewport
export const PM_ROW_BUCKET = 6; // window only re-renders when scroll crosses a bucket
export const PM_DAY_BUCKET = 14; // same idea for horizontal virtualization
export const PM_TIMELINE_PAD_DAYS = 21; // empty days before/after the project range

/** @deprecated the tree row panel is sized by tree/panels/treeRowPanelGeometry (kept for older imports). */
export const PM_HOVER_PANEL_WIDTH = 250;
export const PM_BAR_PANEL_WIDTH = 200; // chart hover CRUD panel (next to the bar)
/** "Critical path" (chart bar) and "+ Project" (project bar) share this width. */
export const PM_WIDE_ACTION_WIDTH = 132;
/** px around a dependency arrow that still counts as a hit (right-click / double-click / tap). */
export const PM_LINK_HIT_TOLERANCE = 6;

/** Progress line color / thickness: kit8/pm/view/task/progress/line (re-exported for older imports). */
export { progressLineColor, PM_PROGRESS_LINE_HEIGHT } from '../view/task/progress/line/progressLineConstants';

export const DAY_MS = 24 * 60 * 60 * 1000;

// Legacy names kept so older imports keep compiling.
export const PM_TREE_COLUMN_WIDTH = PM_TREE_DEFAULT_WIDTH;
export const PM_TIMELINE_HEADER_HEIGHT = PM_SCALE_HEIGHT;
