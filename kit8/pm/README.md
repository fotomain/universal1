# kit8/pm — Skia Gantt for Expo (iOS / Android / Web)

Routes: `/pm/project/dashboard` (view/project/PMProjectDashboard) · `/pm/project/task?taskGUID=…` (view/task/PMProjectTaskInfo).
Drawer item: **Projects** (kit8/components/CustomDrawerContent.tsx).

## Setup

1. Run `kit8/sql/init/create_pm_tables.sql` in the Supabase SQL editor (drops + recreates the PM tables).
   Existing database from the old `pm_gantt_tables.sql`? Run `update_pm_tables_rowJSON.sql` instead (non-destructive:
   adds `rowJSON` to the dependency + closure tables, moves `rowJSON.color` → `rowJSON.taskColor`).
   Existing PM tables (before per-user settings)? Run `update_pm_tables_userSettings.sql` (non-destructive: creates
   `project_user_settings_table` and copies every project's old `rowJSON.uxuiSettings` into its owner's row).
   Existing PM tables (before realtime)? Run `update_pm_tables_realtime.sql` (non-destructive: adds the PM tables to the
   `supabase_realtime` publication + `REPLICA IDENTITY FULL`; without it other browsers only see edits after a reload).
   Kanban: run `create_pm_kanban_tables.sql` after it (non-destructive, safe to re-run; also after every
   `create_pm_tables.sql`, which drops the project Kanban tables). Remove: `delete_pm_kanban_tables.sql`.
   Remove everything: `delete_pm_tables.sql`.
   Project versions (`kit8/pm/version`): the `version_*` tables + RPCs are section 5b of `kit8/sql/init/done/create_tables.sql`.
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

## Realtime auto refresh (`crud/realtime/`)

The same user editing in several browsers / devices sees every change without reloading:

```
browser B edits → Supabase → Realtime channel (postgres_changes) → useProjectRealtime (browser A)
  → invalidate React Query (debounced 350 ms, paused while A's own mutation is in flight) → refetch
  → hydrate() → usePMStore → Skia repaints
```

* `useProjectRealtime(ownerGUID, projectGUID)` - mounted on the dashboard AND the task page. One channel per
  (user, project): `project_table` (filter `rowOwnerGUID`), `project_task_table` + `project_task_dependencies_table`
  (filter `projectGUID`), `project_user_settings_table` (filter `rowParentGUID`) → projects / projectData / task /
  closure / userSettings queries.
* DELETE events cannot be filtered by Supabase and (RLS + `REPLICA IDENTITY FULL`) carry only the primary key: they
  are matched against the cached rows (`projectRealtime.ts` `isDeleteRelevant`, pure).
* After a reconnect (sleep / network drop) everything is refetched - events sent meanwhile are lost.
* SQL: the realtime block at the end of `create_pm_tables.sql` / `update_pm_tables_realtime.sql`. Check with
  `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
* Scope = one user's own rows (RLS `auth.uid()`); sharing a project with other users needs RLS changes first.
* Tests: `__tests__/pm/crud/realtime/`.

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
| user row `rowJSON.uxuiSettings.treeColumnsOrder` | custom keys take part in column drag & drop like the built-in ones |
| user row `rowJSON.uxuiSettings.treeColumnsWidths` | resized columns `{ name: 260, cc_xxxxxxxx: 140 }` |
| `project_task_table.rowJSON.customColumns` | values `{ [columnKey]: string \| number \| boolean \| null }`, dates as `YYYY-MM-DD` |

Cells: click = inline editor (`EditTaskCustomValue`; Enter saves, Esc cancels, empty = clear), Boolean = click toggles the
check box. Custom values are editable on stages too (no roll-up). Value edits are undoable (`crud.setCustomColumnValue`);
adding / deleting columns is not part of the Gantt undo. Pure logic + parsing: `view/tree/columns/customColumns.ts`;
commands: `crud/project/useProjectCustomColumns.ts`; UI: `view/tree/customColumns/`.

## Filter & sort of tree columns (`view/tree/filter`)

Every tree header has an icon at its right edge: a light **▾** (no filter; white-ish in dark mode, soft grey in light
mode = `palette.headerIcon`) or a **funnel** in `uxuiSettings.columnFilterIconColor` (filtered; default light vibrant
red `#FF4D6D`, ⚙ → Tree tab). A small **↑ / ↓** left of it = the sorted column. Click the icon, or right-click
(touch: long-press) the header → **Filter & sort** (first item of `PMTreeHeaderMenu`) → `PMTreeColumnFilterPopup`:

* **Sort** A to Z / Z to A (dates: oldest ↔ newest, numbers: smallest ↔ largest) - applied at once; press the active
  one again = tree order. Siblings are sorted inside every parent; empty values are last; one sorted column at a time.
  Drag & drop of rows is blocked while sorted (message in the error bar).
* **filterVariantForColumn** (chosen with `kit8/components/common/SelectItemFromListApp`, link trigger "begins with ⌄"):
  Is exactly / Is equal to · Is not · Is one of (comma separated) · Contains · Does not contain · Begins with ·
  After / Greater than · Before / Less than · Less than or equal (dates: On or before) · Greater than or equal ·
  Between A and B (two inputs) · Matches (old AX / D365 syntax: `*` `?` `!` `a..b` `..b` `a..` `>` `<` `,` `""`, dates
  `t` / `(day(-1))`; `G*V, !Gustav` = starts with G, ends with V, not Gustav) · Is empty / Is not empty (custom columns).
  Text / date / number / boolean columns get the variants and labels of their type; Boolean = Yes / No chips.
  Inputs are `TextInputApp`; dates: YYYY-MM-DD, D.M.YYYY, M/D/YYYY, `t`. Live preview "N matching rows"; invalid
  input shows the error and saves nothing. Apply / Clear; web: Enter = Apply, Esc = close.
* Tree semantics: a row is shown when it matches every column filter (AND) or when a descendant does (those ancestors
  are **context rows**, drawn muted); applying a filter expands collapsed stages that hide a match. The Gantt follows
  (same `visibleRows`). Tree toolbar → **filter_alt_off** (badge = filtered columns) clears all filters + sort.

Saved per project AND user in `uxuiSettings`: `treeColumnsFilters` `{ [columnKey]: { filterVariantForColumn, value?, value2? } }`,
`treeColumnSort` `{ key, direction: 'asc' | 'desc' } | null`, `columnFilterIconColor`. Deleting a custom column
removes its filter / sort. Files: `treeColumnFilter.ts` (pure: variants, parsing, "matches", `filterAndSortTreeRows`),
`treeFilterIconGeometry.ts` (icon box / hit-test), `PMTreeColumnFilterPopup.tsx`; store: `storeDerive.treeRowsOf`
(used by derive / expand / collapse / reveal / settings); commands: `crud/project/useProjectTreeFilters.ts`
(`openTreeColumnFilter`, `setTreeColumnFilter`, `setTreeColumnSort`, `clearTreeColumnsFilters`).
Tests: `__tests__/pm/view/tree/filter/treeColumnFilter.test.ts`, `__tests__/pm/ui/treeColumnFilterUi.test.tsx`.

## Import / export a project (`crud/exchange/project`)

Gantt bar → **⇅** (right after the task progress % button) opens the **Project settings** window of the selected project
(also: projects bar → ⚙); its **Import / Export** section is `crud/exchange/project/ImportExportProject.tsx`,
with top tabs **Import** (TabImport, default: the drop zone) and **Export** (TabExport: the export button).

* **Export** → `project_data_<project.rowGUID>.json` = `{ format: "kit8.pm.project", version: 1, exportedAt, project,
  tasks, dependencies, uxuiSettings }` - the project with ALL its stages / tasks / milestones and dependencies, read fresh from
  the database, plus the exporting user's Gantt settings. Web: downloaded at once; iOS / Android: share sheet (Save to Files …).
* **Import** → drop the file on the drop zone (`ReceiveDraggableFilesComponent`, compact, with **Choose file…**) - into the
  project being edited. If it already has tasks / dependencies it asks first (**Delete and import**; No = nothing changes),
  then deletes them and inserts the file's rows with NEW ids and tree paths under this project (so a file can be imported next
  to its source project), applies start / calendar / custom columns (the project keeps its name) and the file's Gantt settings
  for this user. Not undoable.
* Files: `projectExchangeFormat.ts` (format, file name, checks) · `export/exportProjectToFile.ts` + `downloadTextFile.ts` ·
  `import/importProjectFromFile.ts` + `planProjectImport.ts` (pure id / path remap) + `readDroppedFileText.ts` ·
  `useProjectExchange.ts` (React: confirm, cache refresh). Tests: `__tests__/pm/crud/exchange/projectExchange.test.ts`,
  `__tests__/pm/ui/importExportProject.test.tsx`.

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

## Gantt UX/UI settings — `project_user_settings_table` (per project AND user)

Each user has his own settings per project (`kit8/sql/defTable.md` pattern, RN `projectUserSettingsTable`):

| column | value |
|---|---|
| `rowGUID` | uuid of the row |
| `rowOwnerGUID` | `project_table.rowGUID` (the project; the row is deleted with it) |
| `rowParentGUID` | the user = Supabase auth uid (the PM owner id, `usePMOwnerGUID`) |
| `rowJSON` | `{ uxuiSettings: { …keys below… } }` - user specified data for visualisations |

One row per (project, user) - `UNIQUE (rowOwnerGUID, rowParentGUID)`, saved with an upsert; RLS: own rows only.
Read: `useReadProjectUserSettingsQuery(user)` (all rows of the user, dashboard + task page) → `store.userSettingsByProject`.
Effective value = the user's row over the project's old `project_table.rowJSON.uxuiSettings` (still read as a fallback,
e.g. after `update_pm_tables_userSettings.sql` for other users) over legacy top-level keys over defaults
(`uxuiSettingsOf(projectJSON, userSettings)` / `effectiveUxuiSettings(store, projectGUID)`).
Save: `useSaveProjectUserSettings(user).saveUxuiSettings(project, patch)` - store first (no flicker), then upsert;
if the table does not exist yet (SQL not run) it saves to `project_table.rowJSON.uxuiSettings` as before.
Custom column definitions + header colors stay project data (`project_table.rowJSON.customColumns`).

| key | values (default) | UI |
|---|---|---|
| `showCriticalPath` | bool (true) | Critical path button |
| `criticalPathTaskColor` | #FCFF00 · #FFAA00 · #FF5500 · #00FF66 · #00F0FF · #4455FF · #9D00FF · #FF007F · #FF0033 · #000000 ('#FF0033') | ⚙ → Task tab: color of the critical path bars, arrows and network nodes (`model/criticalPathColors.ts`, other values → default) |
| `ganttArrowsForm` | 'smoothForm' \| 'squareForm' ('smoothForm') | arrow shape selector |
| `showTaskProgressOnGantt` | bool (false) | % button: progress lines + "XX%" |
| `taskProgressLinePosition` | 'onTop' \| 'onBottom' \| 'atTheMiddle' ('onTop') | atTheMiddle = through the bar, under the task text |
| `projectProgressLinePosition` | 'onTop' \| 'onBottom' \| 'atTheMiddle' ('onBottom') | line in the time-scale header (middle = under the labels) + "Project XX%" |
| `taskProgressLineColor` | one of the set ('#FCFF00') | task bar progress lines |
| `projectProgressLineColor` | one of the set ('#FCFF00') | project progress line |
| `showTreeHierarchyNumbers` | bool (true) | "#" column of the task tree (tree toolbar # button) |
| `treeColumnsOrder` | array of 'wbs' \| 'name' \| 'start' \| 'days' \| 'progress' \| custom keys 'cc_…' (['wbs','name','start','days','progress', …custom]) | drag the tree column headers; ⚙ = default order |
| `treeColumnsWidths` | { [columnKey]: px } ({} = Task name fills the pane, others default) | drag the header separators; double-click / header menu / ⚙ = default width |
| `projectTreeContextCommandsMode` | 'onHoverPanelMode' \| 'onRightClickMenuMode' ('onHoverPanelMode') | tree row commands: hover panel, or `PMTaskRowMenu` on right-click (web) / long-press and release (touch) |
| `projectGanttChartContextCommandsMode` | 'onHoverPanelMode' \| 'onRightClickMenuMode' ('onHoverPanelMode') | Gantt bar commands: same choice for the chart |
| `treeColumnsFilters` | { [columnKey]: { filterVariantForColumn, value?, value2? } } ({}) | tree header ▾ → Filter & sort (see *Filter & sort of tree columns*) |
| `treeColumnSort` | { key, direction: 'asc' \| 'desc' } \| null (null) | Filter & sort → Sort A to Z / Z to A |
| `columnFilterIconColor` | '#RRGGBB' ('#FF4D6D') | ⚙ → Tree tab: funnel of a filtered header |

All of them are edited in `PMGanttUXUISettinsModalWindow` (⚙ on the Gantt bar, right after the % button), split into
top tabs **Task** (task progress on/off, task progress line, critical path task color) · **Tree** (row commands, "#" column, column order / widths) ·
**Gantt** (critical path, arrow shape, bar commands) · **Project** (project progress line). The search field above the tabs
finds a setting by any substring of its name (or key, e.g. `showCriticalPath`): the matches are listed in a table
(Setting | Tab); pressing a line opens that tab, scrolls to the option and flashes it. Which option lives where:
`view/gantt/settings/uxuiSettingsIndex.ts`.

Read with `uxuiSettingsOf()` (user row → project `uxuiSettings` → old top-level keys), saved with `crud/project/useProjectViewSettings.ts`
→ `crud/project/projectUserSettingsQueries.ts` → `crud/api/projectUserSettingsApi.ts`. Switches in the window are `SwitchApp`.
Progress line colors: ONLY `PM_PROGRESS_LINE_SWATCHES` = #FCFF00, #FFAA00, #FF5500, #00FF66, #00F0FF, #4455FF, #9D00FF,
#FF007F, #FF0033 + white #FFFFFF + black #000000; default `PM_DEFAULT_PROGRESS_LINE_COLOR` = #FCFF00. A saved color outside
the set (e.g. the old "yellow") is read as the default (`progressLineColorOf`). The Gantt settings window has a fixed height
(`PM_UXUI_WINDOW_HEIGHT`, max 92 % of the screen): switching tabs never resizes it, the tab panel scrolls.

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

All four settings are saved per project and user in `uxuiSettings` (`networkViewMode`, `networkDiagramVariant`,
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

## Kanban view (`kit8/pm/view/kanban`)

Main view switch **Gantt | Kanban | Network** (`GanttToNetworkViewToggleButtons`, on the Gantt, Kanban and network bars) =
`uxuiSettings.ganttVsNetworkView` `'showGanttChart'` | `'showKanbanView'` | `'showNetworkView'`. Kanban =
`PMGanttSurface rightPane="kanban"`: the Skia task tree stays on the left, `PMKanbanDashboard` replaces the chart.

* **Stages (columns)** - `project_kanban_stage_table`, the same set for every task of the project. The first open of a
  project copies the catalog `kanban_stage_table` (projectTaskKanbanStages: Waiting, Plan, Analyse, Construct, Execute)
  into it (RPC `pm_kanban_ensure_project_stages`, advisory lock = never twice). The catalog itself: hamburger menu →
  Catalogs → **Kanban Stages** (`kit8/catalog/kanbanstage`, `ListWebCardsComponent` + `KanbanEditCard`). Edit them in **Project settings →
  Kanban Stages** (or the Kanban bar button): rename, color, WIP limit, move, add, delete (its tasks go back to the first
  stage - SQL trigger). `PMKanbanStagesModalWindow` is rendered inside its host Modal (iOS) and confirms deletes inline.
* **Task stage** - `project_task_kanban_state_table` (rowOwnerGUID = project, rowParentGUID = task, rowJSON.stageGUID,
  orderInList = card order). No row / deleted stage = the first stage. **Independent of the progress %**: cards only
  show it (edit it with ✎ = `PMTaskEditModal`).
* **Cards** = tasks + milestones (leaf rows) of the **scope**: select a stage in the tree → the board shows only its
  subtree (toolbar: name + "earliest" stage of its tasks, **All** = whole project); selecting a task outside the scope
  resets it. Tap a card = select it in the tree, double tap / ✎ = edit, ‹ › = previous / next stage.
* **Drag & drop** - inside the board `react-native-reanimated-dnd` (card = `Draggable`, column = `Droppable`; the place
  inside the column comes from the drop position; touch: long-press first). **Tree → board**: the tree's own row drag
  (name / # columns, or the panel's ⠿ handle) continues onto the board through `kanbanTreeBridge.ts` (UI-thread shared
  values: pointer, column under it; floating `PMKanbanTreeDragGhost`); dropping a stage row moves all its tasks.
* **Data** - `crud/api/kanbanApi.ts` → `crud/kanban/kanbanQueries.ts` (React Query, optimistic + rollback) →
  `store/store_kanban.ts` (Zustand `usePMKanbanStore`); commands `crud/kanban/useKanbanCommands.ts`
  (`moveTasksToStage`, `moveTreeRowToStage`, `createStage`, `updateStage`, `moveStage`, `deleteStage`). Pure logic:
  `view/kanban/kanbanModel.ts` (`buildKanbanBoard`, `planKanbanMove`, `derivedKanbanStage`).
* **Auto refresh** - `crud/kanban/useKanbanRealtime.ts` (own channel, same rules as `crud/realtime`): the three tables
  are in the `supabase_realtime` publication (`create_pm_kanban_tables.sql`).
* Tables missing (SQL not run): the board shows the default stages read-only with a hint.
* Not in the Gantt undo; not part of the project export file.
* Tests: `__tests__/pm/view/kanban/kanbanModel.test.ts`, `__tests__/pm/crud/kanban/kanbanRealtime.test.ts`,
  `__tests__/pm/crud/pmKanbanCrud.test.tsx`, `__tests__/pm/ui/kanbanUi.test.tsx`.

## Project versions (`kit8/pm/version`)

Full description: `documentation/PM_VERSION_STRUCTURE.html`. SQL: `create_tables.sql` section 5b (run it once; idempotent).

* **Tables** - `version_` + original name, every one with `rowVersionGUID`; rows keep their original `rowGUID`:
  `version_project_table` (1 row per version; `rowJSON.versionTitle`, `versionCreatedAt`, `versionNumber`, `versionTaskCount`;
  `orderInList` = version number), `version_project_task_table`, `version_project_task_dependencies_table`,
  `version_project_kanban_stage_table`, `version_project_task_kanban_state_table`. Not stored: closure, schedule view,
  user settings, Kanban catalog, undo. Clients: SELECT + DELETE of a version; writes only through the RPCs.
* **RPCs** - `pm_version_save(project, title)` · `pm_version_restore(version, backupTitle)` (saves the current plan as
  "Before restore …" first, then replaces tasks / dependencies / Kanban with the version's rows, same `rowGUID`s; closure +
  progress rebuilt) · `pm_version_set_title(version, title)`.
* **Project bar** (after the template buttons, before the project settings button) - **Save project version** (`PMVersionTitleModalWindow`, default title = project name + date time)
  and **Restore project from version** (pick it in the reusable `kit8/components/common/ModalWindowListToSelect`; asks first;
  the Gantt undo history of the project is cleared).
* **Versions view** - view switch **Gantt | Kanban | Network | Versions** (`ganttVsNetworkView = 'showVersionsView'`,
  `PMGanttSurface rightPane="versions"`): `PMProjectVersionsList` replaces the chart, the tree stays. `ProjectVersionCard`:
  round check box (same look as the CRUD list cards), title, version number / date / rows, differences to the project now
  (added / removed / moved / changed, finish shift), **Restore from version**, rename, delete.
* **Visual comparison** - checked versions (at most `PM_VERSION_MAX_CHECKED` = 4, saved per project and user in
  `uxuiSettings.checkedProjectVersions`) are drawn on the Gantt together with the live project: one thin read-only bar per
  (version, row) under the task bar, matched by `rowGUID`, one color per version (`assignVersionColors`: different from each
  other and from the project's bar / critical / milestone / stage / custom task colors), legend bottom right
  (`PMGanttVersionsLegend`). Versions are scheduled client-side with the project's scheduler and the version's own start
  date + calendar (`scheduleVersion`). The time line is widened to the versions' range.
* **Limits** - fixed row height (2-4 versions: thinner bars, the upper ones overlap the task bar's lower edge); a task that
  exists only in a version has no Gantt row (counted as "removed" on the card); no hover details on version bars.
* **Data** - `crud/api/versionApi.ts` -> `crud/version/versionQueries.ts` (React Query) -> `store/store_version.ts`
  (Zustand `usePMVersionStore`: versions, checkedGUIDs, overlays); commands `crud/version/useVersionCommands.ts`;
  pure logic `model/versionCompare.ts`. `PMVersionWindows` is mounted once in `PMProjectDashboard`.
* Tables missing (SQL not run): the Versions view shows a hint, Save is disabled.
* Tests: `__tests__/pm/version/` (model, crud API, commands on the in-memory Supabase, UI).

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
`crud/queries.ts` (owner, write-back; re-exports the hooks) · `crud/realtime/` realtime auto refresh (`useProjectRealtime` + pure `projectRealtime.ts`) · `crud/usePMCrud.ts` all commands in one object
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

## 2026-10-05: selection, kanbanNoState, app bar / FAB, sharing

* **Multi selection** - round check box = FIRST tree column (`PM_TREE_SELECT_WIDTH`, outside the Skia grid; header box = all visible
  rows) and on every Kanban card. `store.checkedGUIDs` (`toggleChecked` / `setChecked` / `clearChecked`), stages and tasks.
  A checked row / card moves every checked one with it: tree -> Kanban column, card -> column, ‹ ›. Tree toolbar: selected count
  (clear) + delete selected (`crud.deleteTasks`, one question, one Undo step).
* **kanbanNoState** - `rowJSON.stageGUID = 'kanbanNoState'` (`PM_KANBAN_NO_STATE`, no SQL change): the task is in NO column; the
  tree's Kanban cell says "No state" (also the first option of its picker). Tree filter: Kanban -> **Is empty**, or the Kanban
  bar button **No state (N)**. Board -> tree: drop a card on the tree = No state. A task WITHOUT a state row is still in the first stage.
  Commands: `kanban.clearTasksKanbanState(guids)`, `kanban.clearTreeRowKanbanState(guid)`; pure: `planKanbanClear`, `kanbanStageForRow`.
* **Kanban column header** - ⋮ / right-click / long-press = menu: Select all tasks · Move all tasks to ▸ · Clear: all tasks to
  "No state" · Sort by ▸. **Sort button**: by any tree column (name, #, start, finish, duration, %, Kanban %, custom columns),
  press the field again = other direction; the field name + ↑ / ↓ is shown under the column title (`store_kanban.columnSort`, session only).
* **Row menu** (`PMTaskRowMenu`) - now opens in BOTH command modes (web: right-click, touch: long-press and release). New items:
  Add stage below / Add stage above (before Edit), Copy GUID, Add to Google Calendar. Hover panels: add stage below / above (before
  Edit) + Google Calendar. `crud.createStageBelow` / `createStageAbove` / `createSubStage` / `copyTaskGUID` / `addToGoogleCalendar`.
* **"+ Stage"** with a stage selected -> menu Stage / Substage (a stage inside the stage).
* **Add to Google Calendar** (`view/task/taskGoogleCalendar.ts`) - opens Google Calendar's pre-filled "new event" page (no OAuth):
  row menu, hover panels, Edit task window, task page, main FAB.
* **Chart period** - Gantt bar button before Today -> `PMGanttPeriodModalWindow` (From / To or a preset): zooms + scrolls to the
  period, the time line is widened to it (`store.ganttPeriod`, session only); "Whole project" = fit.
* **App bar buttons on the dashboard** (`kit8/ui/AppBar.tsx`, Redux `uxuiState`): `hideProjectToolBar`, `hideGanttToolBar` (tree +
  Gantt / Kanban bars together - the rows stay aligned), `hideTreeNode`, `hideGanttChartNode`, `refreshProjectData` (counter).
* **Main FAB** - `FABProvider.useFABContextActions(id, actions)`: the dashboard and the task page publish their CRUD commands.
* **Share screenshot / Share screenshot + JSON** (app ⋮ menu, and a button in Project settings / Edit task / Edit dependency):
  `kit8/lib/shareScreenshot.ts` - base64 only, nothing is written to a public folder. `uxuiState.currentJSON` is published with
  `useUxuiCurrentJSON` (dashboard, Project settings, Edit task, task page, dependency). The Skia canvases register a snapshot.
* **Touch** - dependency drawing starts at once from the (bigger) link circles of the SELECTED bar; the bar panel sits one row
  below the bar; the Tree | Gantt divider moves after a long touch (wide grab zone); the project bar scrolls horizontally.
