# Kanban stage catalog (`kit8/catalog/kanbanstage`)

Hamburger menu → **Catalogs** → **Kanban Stages** → `/kanbanstage/list` · add / edit → `/kanbanstage/edit` (`?rowGUID=…`).

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
| `rowJSON` | `{ stageCode, stageName, stageColor, isActive }` - name + code unique, color `#RRGGBB` |

Redux entity `kanbanStageReusable` (`kit8/redux/SystemMetaData.ts` → `reusableCrudSlice` + `reusableRootSaga`), auto refresh
with `useRealtimeEntity` (same as the currency catalog, see `kit8/catalog/currency/README.md`).

## Files

`kanbanStageModel.ts` (entity, routes, validation, card mapping) · `KanbanStageList.tsx` (web: `ListWebCardsComponent`, phones:
FlatList) · `KanbanStageCard.tsx` · `KanbanEditCard.tsx` (edit screen) · routes `app/kanbanstage/list`, `app/kanbanstage/edit`.
Tests: `__tests__/catalog/kanbanstage/*`.
