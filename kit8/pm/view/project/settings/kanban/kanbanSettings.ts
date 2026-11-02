// kanbanSettings - the key of Project settings -> Kanban (pure TypeScript, no React / Supabase: unit-testable). README: kit8/pm/view/kanban/README.md
//   project_table.rowJSON.autoUpdateTaskProgressPercentFromKanban
//     false / missing (default): the Kanban never touches the task progress % (project_task_table.rowProgress); the card percent lives only in the Kanban.
//     true: a card moved into a FIXED stage (stage percent 1..100) sets the task progress % to the stage percent; a percent typed on a card of a MANUAL stage (stage percent 0) sets it too.
// PROJECT level only: the Kanban is not part of the organization defaults of a new project (defaultProjectSettings.ts).

export const KANBAN_AUTO_PROGRESS_KEY = 'autoUpdateTaskProgressPercentFromKanban' as const;

export interface PMKanbanSettingsValues {
  autoUpdateTaskProgressPercentFromKanban: boolean;
}

/** The Kanban values of a project row (missing = off). */
export const kanbanValuesOf = (json: { autoUpdateTaskProgressPercentFromKanban?: unknown } | null | undefined): PMKanbanSettingsValues => ({
  autoUpdateTaskProgressPercentFromKanban: json?.autoUpdateTaskProgressPercentFromKanban === true,
});

/** true when the project row asks the Kanban to set the task progress %. */
export const autoUpdateTaskProgressFromKanbanOf = (json: { autoUpdateTaskProgressPercentFromKanban?: unknown } | null | undefined): boolean =>
  kanbanValuesOf(json).autoUpdateTaskProgressPercentFromKanban;
