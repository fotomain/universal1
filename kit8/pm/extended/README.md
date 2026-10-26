# Gantt Extended functions (`kit8/pm/extended`)

MS Project functions that the Gantt chart did not have, each behind its own switch. **Without the master switch the Gantt chart works exactly as before.**
Why and which row of which table: `documentation/MORE_GANTT_INPUT.html` (every row has its `xxxxEnabled` key and "how it works in the app"); the four big ones also have a WBS
(`MORE_GANTT_ManuallyScheduledTasks_WBS.html`, `…ProjectCalculationAutomaticOrManual.html`, `…The8ConstraintTypes.html`, `…ScheduleFromProjectFinishDate_WBS.html`).

## The switches
- Master: Project settings → **Gantt** → `ganttExtendedFunctionalityEnabled` (`project_table.rowJSON`, off by default). With it on the Gantt bar has the **Extended** button (`PMExtendedWindow`).
- One `gantt…Enabled` key per function (registry `extendedModel.ts` = id, key, group, title, short text, full text, `requires`). `extendedOf(json)` gives the effective state (master AND own key AND required functions); `isExtended`, `extendedPatch`, `extendedMasterOf` are the helpers.
- Options that are not an on/off: one object `ganttExtendedOptions` (`extendedOptions.ts`, `extendedOptionsOf` normalizes it, a missing value = its default).
- The store mirrors them (`extFlags`, `extOptions`); `derive()` in `store/storeDerive.ts` hands them to the scheduler and the columns.

## Where the work is done
| Area | Pure module (tested) | UI / command |
|---|---|---|
| Scheduler A1-A5, A8-A12, A14, B4, B5 | `view/project/scheduling.ts` (`scheduleProject`), `model/taskConstraint.ts`, `taskScheduleMode.ts`, `scheduleFrom.ts`, `scheduleOptions.ts`, `view/project/ganttCalendar.ts` | `PMTaskAdvancedTab`, Task menu, `crud/task/useTaskCommands.ts`, `crud/task/barEditPatch.ts` |
| Calculation Manual A2 | `model/calcSignature.ts`, frozen plan in `store/storeDerive.ts` | `PMGanttCalculateButton` (F9), `crud/project/ensureCalculated.ts`, `crud/queries.ts` (write-back gating) |
| Task fields A6, A9, A13, A15, G2 | `taskTypes.ts`, `durationText.ts`, `recurrence.ts` | `PMTaskAdvancedTab`, `PMExtendedDialogs` (recurring) |
| Links B1-B3, B6, B7 | `predecessorsText.ts`, `taskPath.ts` | `PMTreeExtendedMenu` (Link / Unlink), `PMEditDependencyScreen` (lag in %), `crud/extended/useExtendedCommands.ts`, `crud/extended/useExternalDates.ts` (B5) |
| Tracking C1-C8 | `tracking.ts`, `evm.ts` | `useExtendedActions.ts` (Project actions: Set baseline, Update project), `PMGanttExtendedLayers`, `reports/monitor01/Monitor01EvmStrip.tsx` |
| Chart E1-E6, E12, E13 | options in `extendedOptions.ts` | `view/gantt/PMProjectGanttChart.tsx`, `PMGanttExtendedLayers.tsx`, `PMGanttExtendedButtons.tsx` |
| E7, E9, E10, E11 | `projectSummary.ts`, `view/project/scheduleMarks.ts` | `PMProjectSummaryRow`, `PMTimelineStrip`, `PMDetailsPane`, `view/tree/columns/PMTreeScheduleIcon.tsx` |
| Table F1-F11 | `extendedColumns.ts` (virtual columns `cc_ext_<field>` + formula columns), `formula.ts` (no eval), `rowRules.ts`, `wbsMask.ts`, `rangeSelect.ts` | `PMTreeExtendedMenu`, `useExtendedKeys.ts` (web keys), `PMExtendedDialogs` |
| G1, G4, H1 | `PMRichNotes.richLinesOf` | `PMTaskAdvancedTab`, `PMRichNotes`, print options → `crud/exchange/pdf` |

## Rules worth knowing
- A new task key must be in `model/types.ts` and, when it is a date, in `crud/api/templateApi.ts` (shift) and `task_template_clean_task` (start2_sql_code.sql, the only SQL touched).
- The extended tree columns are *virtual custom columns* (`cc_ext_…`): the existing custom column machinery draws, sorts and filters them; `customCellValue` is the one reader.
- MS Project export (`crud/exchange/msproject`) writes the 8 constraint types, manual start, priority and `ScheduleFromStart` only while the functions are on.
- The formula parser never uses `eval`; an error gives an empty cell.

## Tests
`__tests__/pm/extended/*` (registry, pure modules, rich notes), `__tests__/pm/view/project/schedulingExtended.test.ts` (scheduler), `__tests__/pm/store/calculationMode.test.ts`,
`__tests__/pm/ui/extendedWindow.test.tsx`, `__tests__/pm/crud/exchange/msProjectXml.test.ts` (Extended part), Docker `kit8/docker/tests/98_task_template.sql`.
