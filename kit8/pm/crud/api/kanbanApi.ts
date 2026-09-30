// Supabase CRUD for the Kanban tables (kit8/sql/init/create_pm_kanban_tables.sql):
//   kanban_stage_table               readKanbanStageCatalog
//   project_kanban_stage_table       ensureProjectKanbanStages · createProjectKanbanStage · updateProjectKanbanStage ·
//                                    saveProjectKanbanStagesOrder · deleteProjectKanbanStage
//   project_task_kanban_state_table  readProjectKanban (stages + states) · saveTaskKanbanStates (upsert on (project, task))
// Until create_pm_kanban_tables.sql has run the tables are missing: reads answer { missing: true },
// writes throw PMMissingTableError.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  KANBAN_STAGE_CATALOG_OWNER,
  kanbanStageTable,
  pmRpcKanbanEnsureProjectStages,
  projectKanbanStageTable,
  projectTaskKanbanStateTable,
} from '../../model/constants';
import {
  PMKanbanStageJSON,
  PMKanbanStageRow,
  PMProjectKanbanData,
  PMProjectKanbanStageRow,
  PMTaskKanbanStateRow,
  PM_KANBAN_DEFAULT_STAGES,
} from '../../model/kanbanTypes';
import { check } from './apiUtils';
import { isMissingTableError, PMMissingTableError } from './projectUserSettingsApi';

const KANBAN_SQL = 'kit8/sql/init/create_pm_kanban_tables.sql';

export class PMKanbanMissingError extends PMMissingTableError {
  constructor(table: string) {
    super(table);
    this.message = `${table} is missing - run ${KANBAN_SQL} in Supabase`;
  }
}

const missing = (err: any, table: string) => isMissingTableError(err, table) || String(err?.code || '') === 'PGRST202';

export function normalizeKanbanStage<T extends PMKanbanStageRow | PMProjectKanbanStageRow>(row: any): T {
  return { ...row, orderInList: Number(row.orderInList) || 0, rowJSON: { stageName: '', ...(row.rowJSON || {}) } } as T;
}

export function normalizeKanbanState(row: any): PMTaskKanbanStateRow {
  const percent = row?.rowJSON?.kanbanStageProgressPercent;
  return {
    ...row,
    orderInList: Number(row.orderInList) || 0,
    rowJSON: {
      stageGUID: '',
      ...(row.rowJSON || {}),
      ...(percent !== undefined ? { kanbanStageProgressPercent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))) } : {}),
    },
  };
}

const byOrder = <T extends { orderInList: number }>(a: T, b: T) => a.orderInList - b.orderInList;

/** A task state to write: the task's stage + its place in the column. */
export interface PMKanbanStateWrite {
  taskGUID: string;
  stageGUID: string;
  orderInList: number;
  kanbanStageProgressPercent?: number;
}

export function createKanbanApi(sb: SupabaseClient) {
  async function readKanbanStageCatalog(): Promise<{ rows: PMKanbanStageRow[]; missing: boolean }> {
    const res = await sb.from(kanbanStageTable).select('*').eq('rowOwnerGUID', KANBAN_STAGE_CATALOG_OWNER).order('orderInList');
    if (res.error && missing(res.error, kanbanStageTable)) return { rows: [], missing: true };
    return { rows: (check(res) || []).map((r: any) => normalizeKanbanStage<PMKanbanStageRow>(r)).sort(byOrder), missing: false };
  }

  /** Stages + task states of one project (two requests in parallel). */
  async function readProjectKanban(projectGUID: string): Promise<PMProjectKanbanData> {
    const [st, ts] = await Promise.all([
      sb.from(projectKanbanStageTable).select('*').eq('rowOwnerGUID', projectGUID).order('orderInList'),
      sb.from(projectTaskKanbanStateTable).select('*').eq('rowOwnerGUID', projectGUID).order('orderInList'),
    ]);
    if ((st.error && missing(st.error, projectKanbanStageTable)) || (ts.error && missing(ts.error, projectTaskKanbanStateTable))) {
      return { stages: [], states: [], missing: true };
    }
    return {
      stages: (check(st) || []).map((r: any) => normalizeKanbanStage<PMProjectKanbanStageRow>(r)).sort(byOrder),
      states: (check(ts) || []).map(normalizeKanbanState),
      missing: false,
    };
  }

  /**
   * The project's stages; when it has none yet the catalog is copied into it (RPC, one advisory lock
   * per project, so two browsers never create the stages twice). Old database without the RPC:
   * the client copies the catalog (or PM_KANBAN_DEFAULT_STAGES) itself.
   */
  async function ensureProjectKanbanStages(projectGUID: string): Promise<PMProjectKanbanStageRow[]> {
    const rpc = await sb.rpc(pmRpcKanbanEnsureProjectStages, { p_project: projectGUID });
    if (!rpc.error) return ((rpc.data as any[]) || []).map((r) => normalizeKanbanStage<PMProjectKanbanStageRow>(r)).sort(byOrder);
    if (!missing(rpc.error, pmRpcKanbanEnsureProjectStages)) throw new Error(rpc.error.message || String(rpc.error));
    const current = await sb.from(projectKanbanStageTable).select('*').eq('rowOwnerGUID', projectGUID);
    if (current.error && missing(current.error, projectKanbanStageTable)) throw new PMKanbanMissingError(projectKanbanStageTable);
    const existing = (check(current) || []) as any[];
    if (existing.length) return existing.map((r) => normalizeKanbanStage<PMProjectKanbanStageRow>(r)).sort(byOrder);
    const catalog = await readKanbanStageCatalog();
    const source: { rowGUID: string; json: PMKanbanStageJSON }[] = catalog.rows.length
      ? catalog.rows.filter((r) => r.rowJSON.isActive !== false).map((r) => ({ rowGUID: r.rowGUID, json: r.rowJSON }))
      : PM_KANBAN_DEFAULT_STAGES.map((d) => ({ rowGUID: 'empty', json: d }));
    const rows = source.map((c, i) => ({
      rowOwnerGUID: projectGUID,
      rowParentGUID: c.rowGUID,
      orderInList: (i + 1) * 1024,
      rowJSON: { stageCode: c.json.stageCode, stageName: c.json.stageName, stageColor: c.json.stageColor },
    }));
    const ins = await sb.from(projectKanbanStageTable).insert(rows).select();
    return (check(ins) || []).map((r: any) => normalizeKanbanStage<PMProjectKanbanStageRow>(r)).sort(byOrder);
  }

  async function createProjectKanbanStage(row: {
    rowGUID: string;
    projectGUID: string;
    orderInList: number;
    rowJSON: PMKanbanStageJSON;
  }): Promise<PMProjectKanbanStageRow> {
    const res = await sb
      .from(projectKanbanStageTable)
      .insert({ rowGUID: row.rowGUID, rowOwnerGUID: row.projectGUID, rowParentGUID: 'empty', orderInList: row.orderInList, rowJSON: row.rowJSON })
      .select()
      .single();
    if (res.error && missing(res.error, projectKanbanStageTable)) throw new PMKanbanMissingError(projectKanbanStageTable);
    return normalizeKanbanStage<PMProjectKanbanStageRow>(check(res));
  }

  async function updateProjectKanbanStage(rowGUID: string, patch: { orderInList?: number; rowJSON?: PMKanbanStageJSON }): Promise<void> {
    const res = await sb.from(projectKanbanStageTable).update(patch).eq('rowGUID', rowGUID);
    if (res.error && missing(res.error, projectKanbanStageTable)) throw new PMKanbanMissingError(projectKanbanStageTable);
    check(res);
  }

  /** New column order: one update per moved stage. */
  async function saveProjectKanbanStagesOrder(order: { rowGUID: string; orderInList: number }[]): Promise<void> {
    for (const o of order) await updateProjectKanbanStage(o.rowGUID, { orderInList: o.orderInList });
  }

  /** Deletes a column; the SQL trigger removes its task states (those tasks go back to the first stage). */
  async function deleteProjectKanbanStage(rowGUID: string): Promise<void> {
    const res = await sb.from(projectKanbanStageTable).delete().eq('rowGUID', rowGUID);
    if (res.error && missing(res.error, projectKanbanStageTable)) throw new PMKanbanMissingError(projectKanbanStageTable);
    check(res);
  }

  /** Upserts the stage + card order of several tasks (one row per (project, task)). */
  async function saveTaskKanbanStates(projectGUID: string, writes: PMKanbanStateWrite[]): Promise<PMTaskKanbanStateRow[]> {
    if (!writes.length) return [];
    const res = await sb
      .from(projectTaskKanbanStateTable)
      .upsert(
        writes.map((w) => ({
          rowOwnerGUID: projectGUID,
          rowParentGUID: w.taskGUID,
          orderInList: w.orderInList,
          rowJSON: {
            stageGUID: w.stageGUID,
            ...(w.kanbanStageProgressPercent !== undefined ? { kanbanStageProgressPercent: Math.max(0, Math.min(100, Math.round(w.kanbanStageProgressPercent))) } : {}),
          },
        })),
        { onConflict: 'rowOwnerGUID,rowParentGUID' }
      )
      .select();
    if (res.error && missing(res.error, projectTaskKanbanStateTable)) throw new PMKanbanMissingError(projectTaskKanbanStateTable);
    return (check(res) || []).map(normalizeKanbanState);
  }

  return {
    readKanbanStageCatalog,
    readProjectKanban,
    ensureProjectKanbanStages,
    createProjectKanbanStage,
    updateProjectKanbanStage,
    saveProjectKanbanStagesOrder,
    deleteProjectKanbanStage,
    saveTaskKanbanStates,
  };
}

export type PMKanbanApi = ReturnType<typeof createKanbanApi>;
