# view/project/tree - the task tree of the Project dashboard as a reusable block

The Project dashboard (`../PMProjectDashboard.tsx`) and every screen that wants "a project's task tree with something next to it" use the same pieces:

| File | What |
|---|---|
| `PMProjectTreeHost.tsx` | the block: selects the project in the PM store, reads tasks + Realtime (tasks, task lines, Kanban), schedule write-back, subproject marks, the Skia tree (`PMGanttSurface`) with YOUR pane on the right (`renderRight`, or any `rightPane` of PMGanttSurface), keyboard, main FAB, windows. `renderRight({ width, height, palette, viewport, toolbarHeight })` also gets the SHARED `viewport` (`viewport.scrollY` = the vertical scroll of the tree) and the height of the tree toolbar: a pane that draws one row per tree row on that value (and a header `PM_SCALE_HEIGHT` high below a bar `toolbarHeight` high) stays pixel-locked to the tree like the Gantt chart (see `kit8/pm/estimation/grid/EstimateGridPane`); its own wheel / drag handlers must write `viewport.scrollY`, the surface leaves the wheel over a custom pane alone. Props: `projectGUID`, `readOnly`, `renderRight`, `rightPane`, `fabId`, `emptyText`, `hideRight`, `hideToolbars` |
| `PMTreeWindows.tsx` | the windows the tree opens (edit task / options / dependency, row menu, column menus, filter, templates, approve, tips); `children` = extra windows of the screen (the dashboard adds Gantt settings, Extended, Versions) |
| `useTreeKeyboardShortcuts.ts` | web keys: Ctrl+Z / Y, Del, Enter / F2, Esc, Alt+arrows, Tab |
| `useTreeScopeSelection.ts` | each screen remembers its OWN last project + task (the PM store holds one selection and Drawer screens stay mounted): the focused screen applies its memory on focus and records the store while it has the focus; a screen with a fixed project (`forcedProjectGUID`) re-selects it only while focused. Project dashboard = scope `project-dashboard` |
| `useTreeFabActions.ts` | the commands of the selected task (all its context menu items) in the main FAB |

Used by: Project dashboard (`PMProjectDashboard`), Estimation dashboard Estimate tab (`kit8/pm/estimation/EstimationDashboard.tsx`).

Rules: the PM store holds ONE selected project - mount only one host (or dashboard) at a time. A new screen with a tree uses the host and does NOT copy the loading hooks. The `fabId` of a screen must be its own.
Test: `__tests__/pm/view/project/tree/projectTreeHost.test.tsx`.
