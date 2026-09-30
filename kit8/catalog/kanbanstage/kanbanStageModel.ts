// Kanban stage catalog - table + row shape + validation (pure, unit-tested in __tests__/catalog/kanbanstage).
//   SQL: public.kanban_stage_table (kit8/sql/init/create_pm_kanban_tables.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = KANBAN_STAGE_CATALOG_OWNER (shared catalog) · rowParentGUID = 'empty' ·
//   orderInList (column order) · rowJSON = PMKanbanStageJSON { stageCode, stageName, stageColor, isActive }
// These are the DEFAULT stages: a project copies the active ones (in this order) the first time its Kanban
// opens; after that each project edits its own copy (Project settings -> Kanban Stages).

import { KANBAN_STAGE_CATALOG_OWNER, kanbanStageTable } from '../../pm/model/constants';
import { PMKanbanStageJSON, PMKanbanStageRow, PM_KANBAN_STAGE_COLORS, PM_KANBAN_STAGE_NAME_MAX } from '../../pm/model/kanbanTypes';

export { kanbanStageTable, KANBAN_STAGE_CATALOG_OWNER };
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const KANBAN_STAGE_ENTITY = 'kanbanStageReusable';
export const KANBAN_STAGE_ROUTES = { list: '/kanbanstage/list', edit: '/kanbanstage/edit' } as const;
/** readData payload of the catalog (all rows; also the catch-up read after a realtime reconnect). */
export const KANBAN_STAGE_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export type KanbanStageRowJSON = Required<Pick<PMKanbanStageJSON, 'stageCode' | 'stageName' | 'stageColor' | 'isActive'>>;
export type KanbanStageRow = PMKanbanStageRow;

export const kanbanStageExample: KanbanStageRowJSON = { stageCode: 'waiting', stageName: 'Waiting', stageColor: '#94A3B8', isActive: true };

export const emptyKanbanStage = (): KanbanStageRowJSON => ({ stageCode: '', stageName: '', stageColor: PM_KANBAN_STAGE_COLORS[1], isActive: true });

/** "Code Review!" -> "code_review" (the default code when the user leaves it empty). */
export const kanbanStageCodeOf = (name: string): string =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

/** Form values -> stored shape (trimmed, code lower-case, color upper-case). */
export function normalizeKanbanStage(v: Partial<KanbanStageRowJSON>): KanbanStageRowJSON {
  const stageName = String(v.stageName ?? '').trim();
  const code = String(v.stageCode ?? '').trim().toLowerCase();
  return {
    stageName,
    stageCode: code || kanbanStageCodeOf(stageName),
    stageColor: String(v.stageColor ?? '').trim().toUpperCase(),
    isActive: v.isActive !== false,
  };
}

export type KanbanStageErrors = Partial<Record<keyof KanbanStageRowJSON, string>>;

/** Field errors ({} = valid). Code and name are unique in the catalog (other rows than `rowGUID`). */
export function validateKanbanStage(v: KanbanStageRowJSON, rows: Pick<KanbanStageRow, 'rowGUID' | 'rowJSON'>[] = [], rowGUID?: string | null): KanbanStageErrors {
  const e: KanbanStageErrors = {};
  const others = rows.filter((r) => r.rowGUID !== rowGUID);
  if (!v.stageName) e.stageName = 'Name is required.';
  else if (v.stageName.length > PM_KANBAN_STAGE_NAME_MAX) e.stageName = `Name: at most ${PM_KANBAN_STAGE_NAME_MAX} characters.`;
  else if (others.some((r) => String(r.rowJSON?.stageName || '').trim().toLowerCase() === v.stageName.toLowerCase())) e.stageName = `"${v.stageName}" is already in the catalog.`;
  if (!/^[a-z0-9_]{1,30}$/.test(v.stageCode)) e.stageCode = 'Code: 1-30 characters a-z, 0-9, _ (e.g. construct).';
  else if (others.some((r) => String(r.rowJSON?.stageCode || '').toLowerCase() === v.stageCode)) e.stageCode = `${v.stageCode} is already in the catalog.`;
  if (!/^#[0-9A-F]{6}$/.test(v.stageColor)) e.stageColor = 'Color: #RRGGBB, e.g. #6366F1.';
  return e;
}

/** Row -> card of ListWebCardsComponent (title / description drive its search). */
export function kanbanStageToCard(row: any, idx = 0) {
  const j: Partial<KanbanStageRowJSON> = row?.rowJSON || {};
  return {
    id: row?.rowGUID || `kanban-stage-${idx + 1}`,
    title: j.stageName || '—',
    description: [j.stageCode, j.stageColor, j.isActive === false ? 'inactive' : ''].filter(Boolean).join(' · '),
    orderInList: row?.orderInList,
    /** 1-based place in the list = column order in new projects */
    position: idx + 1,
    rawItem: row,
  };
}
