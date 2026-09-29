# kit8/pm — Skia Gantt for Expo (iOS / Android / Web)

Routes: `/pm/project/dashboard` (view/project/PMProjectDashboard) · `/pm/project/task?taskGUID=…` (view/task/PMProjectTaskInfo).
Drawer item: **Projects** (kit8/components/CustomDrawerContent.tsx).

## Setup

1. Run `kit8/sql/init/create_pm_tables.sql` in the Supabase SQL editor (drops + recreates the PM tables).
   Existing database from the old `pm_gantt_tables.sql`? Run `update_pm_tables_rowJSON.sql` instead (non-destructive:
   adds `rowJSON` to the dependency + closure tables, moves `rowJSON.color` → `rowJSON.taskColor`).
   Remove everything: `delete_pm_tables.sql`.
2. Web only: `public/canvaskit.wasm` must exist (copied from `node_modules/canvaskit-wasm/bin/full/`,
   or run `npx setup-skia-web public`). If it is missing, the loader falls back to the jsDelivr CDN.
3. Sign in (RLS: every row belongs to `auth.uid()`), open **Projects**, press **Demo** to load the use case.

## Architecture

```
Supabase ──► React Query (crud/queries.ts)  server truth · optimistic updates + rollback · realtime · write-back
                 │ hydrate()
                 ▼
             Zustand (store/store_pm.ts) normalized tree · CPM schedule · visibleRows · UI state
                 │ selectors
                 ▼
   ┌─────────── PMGanttSurface ────────────┐   one viewport (view/gantt/useGanttViewport.ts):
   │ PMProjectTasksTree │ PMProjectGanttChart│   scrollY / scrollX / live zoom = Reanimated
   │   (Skia canvas)    │   (Skia canvas)    │   shared values → both canvases translate on the
   └────────────────────┴────────────────────┘   UI thread → rows are pixel-locked, no scroll sync
```

* **Rendering** – both panes are `@shopify/react-native-skia` canvases (CanvasKit on web). Rows/bars are
  virtualized: React re-renders only when scrolling crosses a bucket of rows/days (`PM_ROW_BUCKET`,
  `PM_DAY_BUCKET`), never per frame.
* **Zoom** – pinch / ctrl+wheel apply a live `scaleX` on the UI thread; on release the zoom is committed to
  React for a crisp re-layout (the DHTMLX "zoom levels" become automatic: day / week / month scales).
* **Interaction** – react-native-gesture-handler + Reanimated worklets: hit-testing, drag ghost, snapped
  date label, rubber-band link line all run on the UI thread; one JS call commits on release.
* **Web loading** – `view/gantt/PMGanttSurfaceLoader.web.tsx` initialises CanvasKit, then code-splits the Skia surface
  (Skia modules must not be evaluated before CanvasKit exists). Fonts are bundled `.ttf`
  (CanvasKit cannot use system fonts).

## Three structures (never mixed)

| Structure | Storage | Answers |
|---|---|---|
| Tree Project → Stage → Task | `treePath ltree` = `<project>.<stage>.<task>` (labels = GUID with `_`) | what contains what, display order (`orderInList`, fractional) |
| DAG of dependencies | `project_task_dependencies_table` (+ `linkType` FS/SS/FF/SF, `lagDays`) | what must happen first |
| Transitive closure | `project_task_dependency_closure_table` (trigger-maintained, per project) | all blockers / all dependents in O(1) |

Improvements over the textbook edge + closure pattern: FK-backed `projectGUID` on every child table, ltree
integrity checks, subtree move/delete triggers, tree-aware cycle detection (a link on a stage constrains
every task inside it), per-project advisory lock against concurrent cycles, per-project closure rebuild on
delete, SECURITY DEFINER trigger functions + owner-only RLS, and a scheduler write-back RPC so SQL always
has real dates (`project_task_schedule_view`).

## Scheduling (view/project/scheduling.ts, pure + unit-tested)

Forward pass (dates) + backward pass (total float → **critical path**), FS/SS/FF/SF + lag/lead, links to
stages, "start no earlier than" constraints (bar drag), optional Mon–Fri calendar, stage roll-up
(start/finish/duration-weighted progress), cycle-safe. Dates are UTC midnights; `rowJSON.startAt` = start,
`rowDuration` (timestamptz) = exclusive finish.

## Interactions

Chart: drag bar = move · drag ends = resize · drag ▲ knob = progress · drag ○ = create link (end → end picks
FS/SS/FF/SF) · double-click = edit · hover panel = edit / add / duplicate / link / details / delete · wheel = scroll ·
shift+wheel = horizontal · ctrl/⌘+wheel or pinch = zoom · Undo · Day / Week / Month / Year · Today · Fit to screen ·
arrow shape · task progress % · Critical path. Right-click / double-click an arrow = dependency menu / editor.
Touch: long-press a bar to drag it, pan to scroll, tap a row to show its panel.

Tree: # = hierarchy / outline number (1, 1.1, 1.1.1 from treePath + sibling order, read-only), **first column by default**,
on/off with `uxuiSettings.showTreeHierarchyNumbers` (toolbar # button or ⚙) · **drag a column header to move the column**
(`view/tree/columns`, saved as `uxuiSettings.treeColumnsOrder`) · **drag a header separator to resize the column on its left**
(columnResizeWidth - Task name included, saved as `uxuiSettings.treeColumnsWidths`; double-click the separator = default width;
without a saved width the Task name column fills the pane) · click Start / Days / % = inline edit (Enter saves, Esc cancels) ·
drag rows by the Task name / # columns ·
**right-click a header (touch: long-press)** = `PMTreeHeaderMenu`: Add custom column ▸ Text / Date / Boolean / Integer / Float,
Rename / Delete custom column, Header color ▸, Default width (see *Custom tree columns* below) ·
**horizontal scroll** when the columns are wider than the pane (shift+wheel / trackpad on web, pan on touch, scroll bar at the bottom) ·
hover panel = add task above / below (+ inside for stages), edit, duplicate, copy info, share, link, details, delete,
**drag handle ⠿ (last button: press + drag = move the row)** - it takes the
width its icons need (`view/tree/panels/treeRowPanelGeometry.ts`): ends at the Task name column's right edge and grows over the
neighbouring columns when the name column is narrower; once shown, the pointer can move onto it over Start / Days / % ·
toolbar = add stage / task / milestone, move up/down, indent/outdent, edit, duplicate, delete, # on/off, expand/collapse all
· drag a row (long-press on touch) to reorder / re-parent · chevron = expand/collapse.

**Context commands mode** (per project, ⚙ → *Task tree: row commands* / *Gantt chart: bar commands*):
`onHoverPanelMode` (default) = the floating panel above; `onRightClickMenuMode` = no panel, the same commands
(add below / above / inside, edit, duplicate, copy info, share, link, details, delete) in `view/task/PMTaskRowMenu`
opened by right-click on a row / bar (web) or long-press and release (touch; long-press and drag still reorders rows /
moves bars). Right-click on a dependency arrow keeps opening the arrow menu.

Hover panels also have **Copy task info** (plain-text summary + deep link to the clipboard) and **Share task**
(native share sheet; web: Web Share API, otherwise the link is copied) - `view/task/taskShare.ts`.

Duplicate = copy right below the original (a stage with its whole subtree; name + " (copy)"; dependencies are not copied; one Undo step).

Keyboard (web): ↑/↓ select · Alt+↑/↓ move · Tab / Shift+Tab indent/outdent · Enter/F2 edit · Del delete · Esc ·
Ctrl/⌘+Z undo.

Task page: any way back (in-page arrow, header arrow, Android back, browser back) returns to the dashboard and
activates the task in the tree (parents expanded, row selected + scrolled into view: `store.requestFocus`).

## Custom tree columns (AddCustomProjectTaskColumn)

Right-click (touch: long-press) the Task name header or any other tree header → **Add custom column** ▸ Text · Date ·
Boolean · Integer · Float → `PMCustomColumnNameModalWindow` asks for the name (unique, not a built-in title, ≤ 40 chars) →
the column is appended as the **last** column and the tree scrolls horizontally to it. **Delete custom column** (custom
headers only) asks first and removes the definition, its order / width / header color and its values in every task.

| where | what |
|---|---|
| `project_table.rowJSON.customColumns.columns` | `[{ key: 'cc_xxxxxxxx', name, type: 'text' \| 'date' \| 'boolean' \| 'integer' \| 'float', createdAt }]` |
| `project_table.rowJSON.customColumns.headersBackgroundColors` | `{ [columnKey]: color }` - header background of any column (custom or built-in); the misspelled `headersBacgroundColors` is read too |
| `project_table.rowJSON.uxuiSettings.treeColumnsOrder` | custom keys take part in column drag & drop like the built-in ones |
| `project_table.rowJSON.uxuiSettings.treeColumnsWidths` | resized columns `{ name: 260, cc_xxxxxxxx: 140 }` |
| `project_task_table.rowJSON.customColumns` | values `{ [columnKey]: string \| number \| boolean \| null }`, dates as `YYYY-MM-DD` |

Cells: click = inline editor (`EditTaskCustomValue`; Enter saves, Esc cancels, empty = clear), Boolean = click toggles the
check box. Custom values are editable on stages too (no roll-up). Value edits are undoable (`crud.setCustomColumnValue`);
adding / deleting columns is not part of the Gantt undo. Pure logic + parsing: `view/tree/columns/customColumns.ts`;
commands: `crud/project/useProjectCustomColumns.ts`; UI: `view/tree/customColumns/`.

## Projects bar

`SelectProjectFromList` (search any project in the DB by substring, like the language picker) · ribbon of the
**last selected** projects only (sorted by name, chevron scrolling, hover → ✕ "Close" removes it from the ribbon),
stored per user in AsyncStorage (`pm.recentProjects.v1.<userGUID>`, see `view/project/recent/recentProjects.ts`) · switching project
shows the loader until the project's data was re-read.

## Resize / rotation

`PMGanttSurface` follows onLayout live and, once the size settles (window resize, split view, landscape ↔
portrait via `useWindowDimensions`), re-creates the Skia canvases (`layoutEpoch`), re-clamps scroll, closes
floating menus/editors and keeps the selected row in view.

## Undo (undoGanttAction)

Every command in `usePMCrud` records the whole project (tasks + dependencies) **before** it mutates. Undo diffs
that snapshot against the current data (`view/undo/undoGanttPlan.ts`) and writes the difference back (re-insert
deleted rows/links, restore moved/stretched/reordered/recolored rows, delete rows the action created).
Storage: `undoGanttActionTable` (1 record = 1 action; `rowOwnerGUID` = project, `rowParentGUID` = user,
`orderInList` = timestamp, `rowJSON` = action) in **expo-sqlite** via `SQLiteProvider` (auto-created in `onInit`,
db `pm_gantt_undo.db`); on web the same layout lives in localStorage (expo-sqlite web needs COOP/COEP headers).
Key: `undoGanttAction-<userGUID>-<projectGUID>`, last 100 actions kept. Button: Gantt bar → Undo; web: Ctrl/⌘+Z.

## Approvals

`inner/PMApproveYesNoCancelModalWindow` (Yes / No / Cancel; web: Enter = Yes, Esc = Cancel) asks before every delete
(task / stage / milestone, dependency, project) and before Undo: `await approvePM({ title, message, yesLabel,
destructive })`. One window is mounted per screen (dashboard, task page).

## Gantt UX/UI settings — `project_table.rowJSON.uxuiSettings` (per project)

| key | values (default) | UI |
|---|---|---|
| `showCriticalPath` | bool (true) | Critical path button |
| `ganttArrowsForm` | 'smoothForm' \| 'squareForm' ('smoothForm') | arrow shape selector |
| `showTaskProgressOnGantt` | bool (false) | % button: progress lines + "XX%" |
| `taskProgressLinePosition` | 'onTop' \| 'onBottom' \| 'atTheMiddle' ('onTop') | atTheMiddle = through the bar, under the task text |
| `projectProgressLinePosition` | 'onTop' \| 'onBottom' \| 'atTheMiddle' ('onBottom') | line in the time-scale header (middle = under the labels) + "Project XX%" |
| `taskProgressLineColor` | any color ('yellow') | task bar progress lines |
| `projectProgressLineColor` | any color ('yellow') | project progress line |
| `showTreeHierarchyNumbers` | bool (true) | "#" column of the task tree (tree toolbar # button) |
| `treeColumnsOrder` | array of 'wbs' \| 'name' \| 'start' \| 'days' \| 'progress' \| custom keys 'cc_…' (['wbs','name','start','days','progress', …custom]) | drag the tree column headers; ⚙ = default order |
| `treeColumnsWidths` | { [columnKey]: px } ({} = Task name fills the pane, others default) | drag the header separators; double-click / header menu / ⚙ = default width |
| `projectTreeContextCommandsMode` | 'onHoverPanelMode' \| 'onRightClickMenuMode' ('onHoverPanelMode') | tree row commands: hover panel, or `PMTaskRowMenu` on right-click (web) / long-press and release (touch) |
| `projectGanttChartContextCommandsMode` | 'onHoverPanelMode' \| 'onRightClickMenuMode' ('onHoverPanelMode') | Gantt bar commands: same choice for the chart |

All of them are edited in `PMGanttUXUISettinsModalWindow` (⚙ on the Gantt bar, right after the % button), split into
top tabs **Task** (task progress on/off, task progress line) · **Tree** (row commands, "#" column, column order / widths) ·
**Gantt** (critical path, arrow shape, bar commands) · **Project** (project progress line). The search field above the tabs
finds a setting by any substring of its name (or key, e.g. `showCriticalPath`): the matches are listed in a table
(Setting | Tab); pressing a line opens that tab, scrolls to the option and flashes it. Which option lives where:
`view/gantt/settings/uxuiSettingsIndex.ts`.

Read with `uxuiSettingsOf()` (falls back to the old top-level keys), saved with `crud/project/useProjectViewSettings.ts`.
Default line color: `PM_DEFAULT_PROGRESS_LINE_COLOR` / `progressLineColor` = "yellow".

## Project progress (formula + stored procedure)

`progress = round1( Σ wᵢ·pᵢ / Σ wᵢ )` over the LEAF rows (tasks + milestones, not empty stages),
`wᵢ = max(durationDays, 1)`, `pᵢ` = task % — duration-weighted earned progress; stages use the same over their subtree.
SQL: `pm_recalc_project_progress(project uuid)` updates every stage's and the project's `rowProgress`; the trigger
`trg_project_task_zz_progress_*` calls it on any task insert / delete / % / duration / kind / move, and
`pm_apply_schedule` calls it too. Client mirror: `computeProjectProgress` (store.projectProgress), so the Gantt and
the project chip update instantly. Existing DB: run `update_pm_tables_projectProgress.sql`.

## Network view (`kit8/pm/view/network`)

Gantt bar → **Gantt | Network** (`view/gantt/toolbars/GanttToNetworkViewToggleButtons.tsx`, same look as the arrow-shape
selector) sets `uxuiSettings.ganttVsNetworkView` = `'showGanttChart'` | `'showNetworkView'`; the dashboard then renders
the Gantt surface or `PMNetworkView`. The same buttons sit on the network bar, so you can always switch back; on both bars
they are right before the **Critical path** button.

`PMNetworkView` — radio **Network diagram / Network schedule** (`networkViewMode`) + Critical path:

| component | notation | variants (toggle in its own bar) |
|---|---|---|
| `PMNetworkDiagram` | activity-on-node (PDM) | `cpmNodes` (ES·D·EF / name / LS·TF·LF box) · `compactNodes` (name, duration, dates) |
| `PMNetworkSchedule` | activity-on-arrow, events = circles | `eventCircles` (4 sectors: № / early · late / predecessor №) · `timeScaled` (x = working day, dotted = free float, dates + today on the axis) |

All four settings are saved per project in `uxuiSettings` (`networkViewMode`, `networkDiagramVariant`,
`networkScheduleVariant`, `ganttVsNetworkView`). Numbers are working-day offsets from the project start, 0-based,
EF = ES + D, taken from the same CPM schedule as the Gantt (`store.schedule`). Stage links are expanded to leaves and
transitively reduced (dashed). The AOA network: one event per distinct predecessor set, then exact dummy contraction
(critical branches first), non-FS / lag links stay as labelled dummies, Fulkerson numbering (`networkModel.ts`,
unit-tested in `__tests__/pm/networkModel.test.ts`). Layout: longest-path layers + barycenter crossing reduction +
isotonic vertical placement. Rendering: React Native views + react-native-svg (no Skia). Zoom: buttons, Fit,
ctrl/⌘+wheel on web.

Interactions (editable): tap = select (shared with the Gantt) + CRUD panel (add below · edit · link · details · delete),
double tap / long press = edit, tap-to-link, tap a link / labelled dummy = dependency menu, hover = highlight the
upstream + downstream chain, info card (dates, ES/EF/LS/LF, float, progress).
**Read-only**: `<PMNetworkView readOnly />` (or no `crud`) — no CRUD panel, no linking / editing / dependency menu,
only selection + the info card; view switches are local (nothing saved).

## Dependencies

`rowJSON` on `project_task_dependencies_table` (e.g. `dependencyColor`) and on the closure table. Arrow shape:
`DependencyArrowLineFormSelector` (smoothForm / squareForm). Right-click an arrow (tap on touch) → menu Edit /
Delete; double-click → `PMEditDependencyScreen` (from/to GUIDs with copy, link type, lag, color, delete).

## CRUD names (same at every layer)

| entity | api (`crud/api/…Api.ts`) | React Query (`crud/*/…Queries.ts`) | commands (`usePMCrud`) |
|---|---|---|---|
| project | `createProject` · `readProject` · `updateProject` · `deleteProject` (+ `createProjects`, `readProjects`, `searchProjects`) | `useCreateProjectMutation` · `useReadProjectQuery` / `useReadProjectsQuery` · `useUpdateProjectMutation` · `useDeleteProjectMutation` | view settings: `setGanttViewSettings`, toggles |
| task | `createTask` · `readTask` · `updateTask` · `deleteTask` (+ `createTasks`, `readProjectData`) | `useCreateTaskMutation` · `useReadTaskQuery` / `useReadProjectDataQuery` · `useUpdateTaskMutation` · `useDeleteTaskMutation` · `useMoveTaskMutation` | `createStage` · `createTask(at, kind)` · `createTaskAbove` · `createTaskBelow` · `updateTask` · `deleteTask` (asks first) · move / indent / outdent / drop |
| dependency | `createDependency` · `updateDependency` · `deleteDependency` (+ `createDependencies`, `readUpstream`, `readDownstream`) | `useCreateDependencyMutation` · `useReadTaskClosureQuery` · `useUpdateDependencyMutation` · `useDeleteDependencyMutation` | `link` / `unlink` · `updateDependency` · `updateDependencyColor` · `deleteDependency` (asks first) |

## Files

`skia/` fonts ·
**`model/`** data model (pure, no React / Supabase / Skia): `constants.ts` table names & layout · `types.ts` · `seedDemo.ts` demo data ·
**`store/`** Zustand: `store_pm.ts` (`usePMStore`) · `storeTypes.ts` state shape · `storeDerive.ts` pure derive / view settings ·
**`crud/`** data layer: `crud/api/` Supabase API (`api_pm.ts` = `createPMApi` + `projectApi.ts` / `taskApi.ts` / `dependencyApi.ts` + `apiUtils.ts`) ·
`crud/{project,task,dependency}/` React Query hooks + commands per entity (`crud/shared/queryShared.ts`) ·
`crud/queries.ts` (owner, realtime, write-back; re-exports the hooks) · `crud/usePMCrud.ts` all commands in one object
(`crud/project/useProjectCustomColumns.ts` = custom tree columns) ·
**`inner/`** shared building blocks: `inner/buttons/` every button, built on `kit8/components/common/ButtonApp` (improved: `variant="toolbar"`, `active`,
`badge`, `compact`, `width`, `danger`, `textColor`, `iconSize`, `testID`, hover / long-press handlers, forwarded
ref): `PMIconButton` (toolbar / panel icon + tip), `PMDialogButton` (primary / secondary / text / danger…),
`PMRowActionButtons`, `PMDragHandleButton` (row drag handle), `PMTipIcon` / `PMTipPressable` ·
`inner/toolbars/` `PMToolbarPrimitives` (bar / divider / spacer) · `inner/tooltip/` `PMTooltip` (`usePMTip`, `showPMTip` /
`hidePMTip`, `PMTooltipLayer`) · `inner/menu/` `PMContextMenu` (generic popup menu) + `PMMenuItem`; items can open a submenu ▸ ·
`inner/panels/` shared `PMFloatingRowPanel` · `inner/PMApproveYesNoCancelModalWindow.tsx` Yes / No / Cancel dialog ·
**`view/`** screens and panes: `view/theme.ts` palette ·
**`view/gantt/`** Gantt pane: `PMGanttSurface*.tsx` layout (Tree | Gantt) + web loader · `PMProjectGanttChart.tsx` ·
`ganttGeometry.ts` time scale · `useGanttViewport.ts` shared scroll · `PMGanttUXUISettinsModalWindow.tsx` (+ `settings/uxuiSettingsIndex.ts` tabs / search index) ·
`buttons/` `PMGanttUndoButton`, `PMGanttZoomButtons`, `PMGanttScaleButtons`, `PMGanttViewToggles` · `panels/` `PMGanttBarHoverPanel` ·
`toolbars/` `PMGanttToolbar` + `PMGanttLinkModeHint` + `GanttToNetworkViewToggleButtons` (+ the arrow shape selector from `view/task/dependency/`) ·
**`view/network/`** network diagram / schedule (see *Network view*) ·
**`view/project/`** project level: `scheduling.ts` CPM / tree / calendar (pure) · `PMProjectDashboard.tsx` (route `/pm/project/dashboard`) · `SelectProjectFromList.tsx` ·
`buttons/` `PMAddProjectButton` · `recent/` recently selected projects: `recentProjects.ts` (per-user ribbon
store) + `PMRecentProjectsToolbar` (project bar: search + recent ribbon + project CRUD) ·
**`view/task/`** task level: `PMTaskEditModal.tsx` · `PMProjectTaskInfo.tsx` · `taskShare.ts` (copy / share) ·
`dependency/` everything about dependencies (links): `PMDependencyMenu` (arrow right-click / tap menu), `PMEditDependencyScreen` (editor),
`DependencyArrowLineFormSelector` (arrow shape) · `progress/line/` everything about the progress lines: constants (`PMProgressLinePosition`, default color,
thickness, swatches), placement math (`progressLineGeometry.ts`), Skia `PMTaskProgressLine` / `PMProjectProgressLine`
/ `PMProjectProgressLabel`, and the settings UI (`PMProgressLineSettings`, `PMProgressLinePositionSelector`,
`PMColorSwatchPicker`, `PMProgressLinePreview`) ·
**`view/tree/`** Tree pane: `PMProjectTasksTree.tsx` · `columns/` column order / widths / layout / drag & drop / resize
(`treeColumns.ts` + `customColumns.ts` pure, `useTreeColumnsLayout`, `useTreeColumnDragGesture`, `useTreeColumnResizeGesture`,
Skia `PMTreeColumnsHeader` - import it by path) · `customColumns/` `PMTreeHeaderMenu` + `PMCustomColumnNameModalWindow` ·
`panels/` `PMTreeRowHoverPanel` + `treeRowPanelGeometry.ts` · `toolbars/` `PMTreeToolbar` ·
`inline/` cell editors (`PMInlineCellEditor`, `EditTaskStart` / `EditTaskDays` / `EditTaskProgress` / `EditTaskCustomValue`) ·
**`view/undo/`** undoGanttAction (provider, plan, SQLite / web storage) · tests: see below.

## Tests (`npx jest __tests__/pm`)

* `__tests__/pm` mirrors `kit8/pm`. Pure logic: `view/project/scheduling.test.ts`, `store/viewSettings.test.ts`,
  `view/undo/undoGanttPlan.test.ts`, `view/task/progress/progress.test.ts`, `view/task/taskShare.test.ts`,
  `view/network/networkModel.test.ts`, `view/tree/columns/treeColumns.test.ts` (column order / layout / drag & drop + row panel placement),
  `view/tree/columns/customColumns.test.ts` (custom column values / definitions, widths, resize handles, horizontal scroll).
* **UI** (`__tests__/pm/ui`, jsdom + react-native-web): every button, toolbar, hover panel, context
  menu (incl. the tree header menu + submenus), dialog (incl. the custom column name window), progress-line picker and inline cell editor is rendered, found by `testID`, pressed /
  typed into, and checked for the right `crud` call or store change (`pmUiTestKit.tsx` = mocks + helpers).
  The Skia canvases themselves are covered by the pure geometry / scheduling tests.
* **CRUD** (`__tests__/pm/crud`): the real `usePMCrud` → React Query → Supabase stack on an in-memory
  Supabase (`fakeSupabaseTestKit.ts`: PostgREST subset + the subtree / cascade / re-path triggers):
  `crud/api/pmApi.test.ts` (API layer, old-schema fallback, RPC), `pmCrud.test.tsx` (create / update / reorder /
  indent / drag-drop / delete with approval / dependencies / view settings / optimistic rollback / undo of
  every action type), `pmProjectCrud.test.tsx` (projects, search, demo seed, schedule write-back, undo storage), `pmCustomColumnsCrud.test.tsx` (add / rename / delete custom columns, values, header colors, column widths).
* Files ending in `TestKit.ts(x)` are helpers, excluded from the run in `jest.config.js`.
