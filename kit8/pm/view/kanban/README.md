# Kanban (`kit8/pm/view/kanban`)

Gantt | Kanban switch of the project screen. Columns = the stages of the project (`project_kanban_stage_table`), cards = tasks and milestones (not stage rows).
Data model, drag and drop and the tree bridge are described in the header comments of `kanbanModel.ts`, `kanbanTreeBridge.ts` and `kit8/pm/model/kanbanTypes.ts`.

## The percent of a card

Every stage has `rowJSON.stageProgressPercent` (whole number 0..100, **obligatory**; catalog: `kit8/catalog/kanbanstage`):

| stage percent | cards | where the card percent is edited |
|---|---|---|
| **1..100** (FIXED) | show the percent of the stage at once, also after the percent of the stage is changed (read side: `kanbanCardPercentOf`) | nowhere: the bar / badge show "stage", the tree cell, task window and edit window are locked; typing is refused with *The percent of this card is the percent of its stage* |
| **0** (MANUAL) | show the percent stored on the card (`project_task_kanban_state_table.rowJSON.kanbanStageProgressPercent`) | the bar (tap) or the badge ✎ of the card, the tree cell **Kanban %**, the task window (0 / 25 / 50 / 75 / 100), the edit window |

The column header shows the percent of the stage (`pm-kanban-colpercent-<stage>`: "N%" or "manual"). A missing percent (a row of an older database) reads as the standard percent of its code (waiting 0, plan 10, analyse 30, construct 60, execute 90), else 0.

## The task progress % (Project settings → Kanban → `autoUpdateTaskProgressPercentFromKanban`)

Default **off**: the Kanban never changes `project_task_table.rowProgress`. Project level only (the Kanban is not part of the organization defaults of a new project).

On:
* a card moved into a FIXED stage sets the task progress % to the percent of the stage (only tasks that CHANGE column; a reorder inside the column writes nothing);
* a percent typed on a card of a MANUAL stage sets the task progress % too;
* a card moved into a MANUAL stage changes nothing (the percent is typed afterwards);
* a stage row (tree) stands for its tasks; with Extended "Actual start and finish" the actual dates follow, like in the tree's % cell;
* changing the percent of a stage does NOT rewrite the progress of the tasks already in it: they get the new percent when they are moved.

Code: pure rules `kanbanModel.ts` (`planKanbanTaskProgress`, `kanbanTaskPercentOf`, `kanbanPercentForRow`), writes `kit8/pm/crud/kanban/useKanbanCommands.ts` (`applyTaskProgress`), switch `kit8/pm/view/project/settings/kanban/kanbanSettings.ts`.

## Tests

`__tests__/pm/view/kanban/kanbanModel.test.ts`, `kanbanPercent.test.ts` (pure), `__tests__/pm/crud/pmKanbanCrud.test.tsx`, `pmKanbanStagePercent.test.tsx` (React Query + in-memory Supabase), `__tests__/pm/ui/kanbanUi.test.tsx`, `__tests__/catalog/kanbanstage/*`; SQL: `kit8/docker/tests/45_kanban_stage_percent.sql`.
