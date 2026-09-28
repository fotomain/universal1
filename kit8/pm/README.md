# kit8/pm — Skia Gantt for Expo (iOS / Android / Web)

Routes: `/pm/project/dashboard` (PMProjectDashboard) · `/pm/project/task?taskGUID=…` (PMProjectTaskInfo).
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
Supabase ──► React Query (queries.ts)  server truth · optimistic updates + rollback · realtime · write-back
                 │ hydrate()
                 ▼
             Zustand (store.ts)        normalized tree · CPM schedule · visibleRows · UI state
                 │ selectors
                 ▼
   ┌─────────── PMGanttSurface ────────────┐   one viewport (useGanttViewport.ts):
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
* **Web loading** – `PMGanttSurfaceLoader.web.tsx` initialises CanvasKit, then code-splits the Skia surface
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

## Scheduling (scheduling.ts, pure + unit-tested)

Forward pass (dates) + backward pass (total float → **critical path**), FS/SS/FF/SF + lag/lead, links to
stages, "start no earlier than" constraints (bar drag), optional Mon–Fri calendar, stage roll-up
(start/finish/duration-weighted progress), cycle-safe. Dates are UTC midnights; `rowJSON.startAt` = start,
`rowDuration` (timestamptz) = exclusive finish.

## Interactions

Chart: drag bar = move · drag ends = resize · drag ▲ knob = progress · drag ○ = create link (end → end picks
FS/SS/FF/SF) · double-click = edit · hover panel = edit / add / link / details / delete · wheel = scroll ·
shift+wheel = horizontal · ctrl/⌘+wheel or pinch = zoom · Undo · Day / Week / Month / Year · Today · Fit to screen ·
arrow shape · task progress % · Critical path. Right-click / double-click an arrow = dependency menu / editor.
Touch: long-press a bar to drag it, pan to scroll, tap a row to show its panel.

Tree: click Start / Days / % = inline edit (Enter saves, Esc cancels) · drag rows by the Task name column ·
hover panel = add task above / below (+ inside for stages), edit, link, details, delete ·
toolbar = add stage / task / milestone, move up/down, indent/outdent, edit, delete, expand/collapse all
· drag a row (long-press on touch) to reorder / re-parent · chevron = expand/collapse.

Keyboard (web): ↑/↓ select · Alt+↑/↓ move · Tab / Shift+Tab indent/outdent · Enter/F2 edit · Del delete · Esc ·
Ctrl/⌘+Z undo.

Task page: any way back (in-page arrow, header arrow, Android back, browser back) returns to the dashboard and
activates the task in the tree (parents expanded, row selected + scrolled into view: `store.requestFocus`).

## Projects bar

`SelectProjectFromList` (search any project in the DB by substring, like the language picker) · ribbon of the
**last selected** projects only (sorted by name, chevron scrolling, hover → ✕ "Close" removes it from the ribbon),
stored per user in AsyncStorage (`pm.recentProjects.v1.<userGUID>`, see `recentProjects.ts`) · switching project
shows the loader until the project's data was re-read.

## Resize / rotation

`PMGanttSurface` follows onLayout live and, once the size settles (window resize, split view, landscape ↔
portrait via `useWindowDimensions`), re-creates the Skia canvases (`layoutEpoch`), re-clamps scroll, closes
floating menus/editors and keeps the selected row in view.

## Undo (undoGanttAction)

Every command in `usePMCrud` records the whole project (tasks + dependencies) **before** it mutates. Undo diffs
that snapshot against the current data (`undo/undoGanttPlan.ts`) and writes the difference back (re-insert
deleted rows/links, restore moved/stretched/reordered/recolored rows, delete rows the action created).
Storage: `undoGanttActionTable` (1 record = 1 action; `rowOwnerGUID` = project, `rowParentGUID` = user,
`orderInList` = timestamp, `rowJSON` = action) in **expo-sqlite** via `SQLiteProvider` (auto-created in `onInit`,
db `pm_gantt_undo.db`); on web the same layout lives in localStorage (expo-sqlite web needs COOP/COEP headers).
Key: `undoGanttAction-<userGUID>-<projectGUID>`, last 100 actions kept. Button: Gantt bar → Undo; web: Ctrl/⌘+Z.

## Approvals

`PMApproveYesNoCancelModalWindow` (Yes / No / Cancel; web: Enter = Yes, Esc = Cancel) asks before every delete
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

All of them are edited in `PMGanttUXUISettinsModalWindow` (⚙ on the Gantt bar, right after the % button).

Read with `uxuiSettingsOf()` (falls back to the old top-level keys), saved with `crud/project/useProjectViewSettings.ts`.
Default line color: `PM_DEFAULT_PROGRESS_LINE_COLOR` / `progressLineColor` = "yellow".

## Project progress (formula + stored procedure)

`progress = round1( Σ wᵢ·pᵢ / Σ wᵢ )` over the LEAF rows (tasks + milestones, not empty stages),
`wᵢ = max(durationDays, 1)`, `pᵢ` = task % — duration-weighted earned progress; stages use the same over their subtree.
SQL: `pm_recalc_project_progress(project uuid)` updates every stage's and the project's `rowProgress`; the trigger
`trg_project_task_zz_progress_*` calls it on any task insert / delete / % / duration / kind / move, and
`pm_apply_schedule` calls it too. Client mirror: `computeProjectProgress` (store.projectProgress), so the Gantt and
the project chip update instantly. Existing DB: run `update_pm_tables_projectProgress.sql`.

## Network view (`kit8/pm/network`)

Gantt bar → **Gantt | Network** (`toolbars/gantt/GanttToNetworkViewToggleButtons.tsx`, same look as the arrow-shape
selector) sets `uxuiSettings.ganttVsNetworkView` = `'showGanttChart'` | `'showNetworkView'`; the dashboard then renders
the Gantt surface or `PMNetworkView`. The same buttons sit on the network bar, so you can always switch back.

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

| entity | api (`crud/*/…Api.ts`) | React Query (`crud/*/…Queries.ts`) | commands (`usePMCrud`) |
|---|---|---|---|
| project | `createProject` · `readProject` · `updateProject` · `deleteProject` (+ `createProjects`, `readProjects`, `searchProjects`) | `useCreateProjectMutation` · `useReadProjectQuery` / `useReadProjectsQuery` · `useUpdateProjectMutation` · `useDeleteProjectMutation` | view settings: `setGanttViewSettings`, toggles |
| task | `createTask` · `readTask` · `updateTask` · `deleteTask` (+ `createTasks`, `readProjectData`) | `useCreateTaskMutation` · `useReadTaskQuery` / `useReadProjectDataQuery` · `useUpdateTaskMutation` · `useDeleteTaskMutation` · `useMoveTaskMutation` | `createStage` · `createTask(at, kind)` · `createTaskAbove` · `createTaskBelow` · `updateTask` · `deleteTask` (asks first) · move / indent / outdent / drop |
| dependency | `createDependency` · `updateDependency` · `deleteDependency` (+ `createDependencies`, `readUpstream`, `readDownstream`) | `useCreateDependencyMutation` · `useReadTaskClosureQuery` · `useUpdateDependencyMutation` · `useDeleteDependencyMutation` | `link` / `unlink` · `updateDependency` · `updateDependencyColor` · `deleteDependency` (asks first) |

## Files

`constants.ts` table names & layout · `types.ts` · `scheduling.ts` CPM/tree/calendar ·
`crud/{project,task,dependency}/` Supabase API + React Query hooks + commands per entity (`crud/shared/` helpers) ·
`api.ts` / `queries.ts` / `usePMCrud.ts` compose them · `undo/` undoGanttAction · `inline/` tree cell editors ·
`buttons/` every button, built on `kit8/components/common/ButtonApp` (improved: `variant="toolbar"`, `active`,
`badge`, `compact`, `width`, `danger`, `textColor`, `iconSize`, `testID`, hover / long-press handlers, forwarded
ref): `PMIconButton` (toolbar / panel icon + tip), `PMDialogButton` (primary / secondary / text / danger…),
`PMAddProjectButton`, `PMGanttUndoButton`, `PMGanttZoomButtons`, `PMGanttScaleButtons`, `PMGanttViewToggles`,
`PMRowActionButtons`, `PMTipIcon` / `PMTipPressable` ·
`toolbars/` `PMRecentProjectsToolbar` (project bar: search + recent ribbon + project CRUD), `PMToolbarPrimitives`
(bar / divider / spacer), `toolbars/gantt/` `PMGanttToolbar` + `PMGanttLinkModeHint` + `DependencyArrowLineFormSelector`,
`toolbars/tree/` `PMTreeToolbar` ·
`menu/` `PMContextMenu` (generic popup menu) + `PMMenuItem` + `PMDependencyMenu` (arrow right-click / tap menu) · `progress/line/` everything about the progress lines: constants (`PMProgressLinePosition`, default color,
thickness, swatches), placement math (`progressLineGeometry.ts`), Skia `PMTaskProgressLine` / `PMProjectProgressLine`
/ `PMProjectProgressLabel`, and the settings UI (`PMProgressLineSettings`, `PMProgressLinePositionSelector`,
`PMColorSwatchPicker`, `PMProgressLinePreview`) · `panels/gantt/` `PMGanttBarHoverPanel`, `panels/tree/` `PMTreeRowHoverPanel`, `panels/` shared `PMFloatingRowPanel` · `store.ts` Zustand · `useGanttViewport.ts` shared scroll ·
`PMGanttSurface*.tsx` layout + web loader · `PMProjectTasksTree.tsx` · `PMProjectGanttChart.tsx` ·
`ganttGeometry.ts` time scale · `theme.ts` palette · `PMTaskEditModal.tsx` ·
`PMProjectTaskInfo.tsx` · `PMEditDependencyScreen.tsx` · `SelectProjectFromList.tsx` ·
`recentProjects.ts` · `seedDemo.ts` · tests: see below.

## Tests (`npx jest __tests__/pm`)

* Pure logic: `scheduling.test.ts`, `undoGanttPlan.test.ts`, `progress.test.ts`, `viewSettings.test.ts`.
* **UI** (`__tests__/pm/ui`, jsdom + react-native-web): every button, toolbar, hover panel, context
  menu, dialog, progress-line picker and inline cell editor is rendered, found by `testID`, pressed /
  typed into, and checked for the right `crud` call or store change (`pmUiTestKit.tsx` = mocks + helpers).
  The Skia canvases themselves are covered by the pure geometry / scheduling tests.
* **CRUD** (`__tests__/pm/crud`): the real `usePMCrud` → React Query → Supabase stack on an in-memory
  Supabase (`fakeSupabaseTestKit.ts`: PostgREST subset + the subtree / cascade / re-path triggers):
  `pmApi.test.ts` (API layer, old-schema fallback, RPC), `pmCrud.test.tsx` (create / update / reorder /
  indent / drag-drop / delete with approval / dependencies / view settings / optimistic rollback / undo of
  every action type), `pmProjectCrud.test.tsx` (projects, search, demo seed, schedule write-back, undo storage).
* Files ending in `TestKit.ts(x)` are helpers, excluded from the run in `jest.config.js`.
