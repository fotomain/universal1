# Kanban stage catalog (`kit8/catalog/kanbanstage`)

Hamburger menu → **Catalogs** → **Kanban Stages** → `/pm/kanbanstage/list` · add / edit → `/pm/kanbanstage/edit` (`?rowGUID=…`).

The **default** stages of the PM Kanban: the first time a project opens its Kanban, the ACTIVE stages are copied
into it in this order (`project_kanban_stage_table`, RPC `pm_kanban_ensure_project_stages`). After that each project
edits its own copy (Project settings → Kanban Stages); changing the catalog does not change existing projects.

## Data — `kanban_stage_table` (`kit8/sql/init/create_pm_kanban_tables.sql`, RN `kanbanStageTable`)

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `'kanbanStageCatalog'` (shared catalog, `KANBAN_STAGE_CATALOG_OWNER`) |
| `rowParentGUID` | `'empty'` |
| `orderInList` | column order (drag & drop on web; new stages go last) |
| `rowJSON` | `{ stageCode, stageName, stageColor, isActive, stageProgressPercent }` - name + code unique, color `#RRGGBB`, percent = whole number 0..100 (**obligatory**) |

### The percent of a stage (`stageProgressPercent`)

Every stage has a percent (whole number 0..100; the SQL trigger `pm_kanban_stage_percent_chk` refuses anything else and fills a missing one from the code):

| value | meaning |
|---|---|
| **1..100** | FIXED: every card of the stage shows this percent; it cannot be typed on the card. With Project settings → Kanban → `autoUpdateTaskProgressPercentFromKanban` a card moved into the stage also sets the task progress % to it |
| **0** | MANUAL: the percent of each card is typed on the Kanban dashboard (the bar or the badge ✎ of the card, the tree cell "Kanban %", the task window) |

Seed: Waiting 0 · Plan 10 · Analyse 30 · Construct 60 · Execute 90. A project copies the percent with the stage and then edits its own copy
(Project settings → Kanban Stages: the % field of each row). More: `kit8/pm/view/kanban/README.md`.

Redux entity `kanbanStageReusable` (`kit8/redux/SystemMetaData.ts` → `reusableCrudSlice` + `reusableRootSaga`), auto refresh
with `useRealtimeEntity` (same as the currency catalog, see `kit8/catalog/currency/README.md`).

## Files

`kanbanStageModel.ts` (entity, routes, validation, card mapping) · `KanbanStageList.tsx` (web: `ListWebCardsComponent`, phones:
FlatList) · `KanbanStageCard.tsx` · `KanbanEditCard.tsx` (edit screen) · routes `app/pm/kanbanstage/list`, `app/pm/kanbanstage/edit`.
Tests: `__tests__/catalog/kanbanstage/*`.
