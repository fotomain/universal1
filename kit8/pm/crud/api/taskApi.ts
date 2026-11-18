// Supabase CRUD for project_task_table (stages, tasks, milestones) + the scheduler
// write-back RPC. readProjectData also returns the project's dependencies because the
// Gantt always needs both at once (one round-trip, one cache entry).

import type { SupabaseClient } from '@supabase/supabase-js';
import { pmRpcApplySchedule, pmRpcImportTasks, pmRpcSetTaskLastEditPlace, pmTaskLineTable, projectTaskDependenciesTable, projectTaskTable } from '../../model/constants';
import { PMLastEditPlace, PMProjectData, PMTaskRow } from '../../model/types';
import { buildTreePath, projectTreePath } from '../../view/project/scheduling';
import { check, newGUID, normalizeDep, normalizeTask, readAllPages } from './apiUtils';

export interface PMScheduleWrite {
  rowGUID: string;
  startAt: string;
  finishAt: string;
  rowProgress?: number;
}

export function createTaskApi(sb: SupabaseClient) {
  /** Everything the Gantt of one project needs: its tasks (ordered) + dependencies. */
  async function readProjectData(projectGUID: string): Promise<PMProjectData> {
    // ALL pages: one request returns at most 1000 rows, a bigger project lost its tail (and the parents of the rows that were left)
    const [tasks, deps] = await Promise.all([
      readAllPages((from, to) =>
        sb.from(projectTaskTable).select('*').eq('projectGUID', projectGUID).order('orderInList', { ascending: true }).order('rowGUID', { ascending: true }).range(from, to)
      ),
      readAllPages((from, to) =>
        sb.from(projectTaskDependenciesTable).select('*').eq('projectGUID', projectGUID).order('rowGUID', { ascending: true }).order('rowDependsOnGUID', { ascending: true }).range(from, to)
      ),
    ]);
    return { tasks: tasks.map(normalizeTask), deps: deps.map(normalizeDep) };
  }

  /** One task by id, or null. */
  async function readTask(rowGUID: string): Promise<PMTaskRow | null> {
    const data = check(await sb.from(projectTaskTable).select('*').eq('rowGUID', rowGUID).maybeSingle());
    return data ? normalizeTask(data) : null;
  }

  function buildTaskRow(params: {
    ownerGUID: string;
    projectGUID: string;
    parentTreePath: string | null; // null -> directly under the project
    rowKind: 'stage' | 'task' | 'milestone';
    name: string;
    durationDays: number;
    orderInList: number;
    rowGUID?: string;
  }): PMTaskRow {
    const rowGUID = params.rowGUID || newGUID();
    return {
      rowGUID,
      treePath: buildTreePath(params.parentTreePath || projectTreePath(params.projectGUID), rowGUID),
      projectGUID: params.projectGUID,
      rowOwnerGUID: params.ownerGUID,
      rowDuration: null,
      rowProgress: 0,
      orderInList: params.orderInList,
      rowJSON: { rowKind: params.rowKind, taskDescription: params.name, durationDays: params.durationDays },
    };
  }

  /** Parents must come before children in `rows` (the DB checks the parent exists). */
  async function createTasks(rows: PMTaskRow[]): Promise<PMTaskRow[]> {
    if (!rows.length) return [];
    const clean = rows.map(({ created_at: _c, updated_at: _u, ...r }) => r);
    const data = check(await sb.from(projectTaskTable).insert(clean).select());
    return (data || []).map(normalizeTask);
  }

  /**
   * The tasks of ONE chunk of an imported project file (parents before children). Through the RPC project_import_tasks: ONE progress calculation per chunk instead of one per row -
   * a project of 2 000 tasks does not fit the 8 s statement limit of Supabase any other way. A database without the function (start2_sql_code.sql not run yet) gets the old plain insert.
   */
  async function importTasks(projectGUID: string, rows: PMTaskRow[]): Promise<void> {
    if (!rows.length) return;
    const clean = rows.map(({ created_at: _c, updated_at: _u, ...r }) => r);
    const res = await sb.rpc(pmRpcImportTasks, { p_project: projectGUID, p_rows: clean });
    if (!res.error) return;
    const e: any = res.error;
    const missing = e.code === 'PGRST202' || e.code === '42883' || (/project_import_tasks/.test(`${e.message} ${e.details}`) && /(schema cache|does not exist|Could not find)/i.test(`${e.message} ${e.details}`));
    if (!missing) check(res as any);
    await createTasks(rows);
  }

  /**
   * The task lines of ONE chunk of an imported project file (the tasks exist already). rowProjectGUID is set by the database from the task, the line is NOT posted
   * (taskIsPosted false: "Post unposted tasks" posts it). The rows are plain data of the file: the app writes nothing it computed.
   */
  async function createTaskLines(rows: { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; orderInList: number; rowJSON: Record<string, any> }[]): Promise<void> {
    if (!rows.length) return;
    check(await sb.from(pmTaskLineTable).insert(rows));
  }

  /**
   * ALL finance lines of ONE project (Time / Material / Expense / Revenue), the columns an exchange file carries (project copy, export). Paged: a request answers at most 1000 rows.
   */
  async function readProjectTaskLines(projectGUID: string): Promise<{ rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; orderInList: number; rowJSON: Record<string, any> }[]> {
    const rows = await readAllPages<any>((from, to) =>
      sb.from(pmTaskLineTable).select('rowGUID,rowOwnerGUID,rowParentGUID,orderInList,rowJSON').eq('rowProjectGUID', projectGUID).order('rowGUID', { ascending: true }).range(from, to)
    );
    return rows.map((r) => ({ ...r, orderInList: Number(r.orderInList) || 0, rowJSON: r.rowJSON || {} }));
  }

  /** Inserts one stage / task / milestone (its parent must exist). */
  async function createTask(row: PMTaskRow): Promise<PMTaskRow> {
    const [created] = await createTasks([row]);
    return created;
  }

  async function updateTask(rowGUID: string, patch: Partial<PMTaskRow>): Promise<PMTaskRow> {
    const { rowGUID: _g, projectGUID: _p, created_at: _c, updated_at: _u, ...safe } = patch as any;
    const data = check(await sb.from(projectTaskTable).update(safe).eq('rowGUID', rowGUID).select().single());
    return normalizeTask(data);
  }

  /** Deleting a stage deletes its subtree in the DB (trigger) and all touching edges (FK). */
  async function deleteTask(rowGUID: string): Promise<void> {
    check(await sb.from(projectTaskTable).delete().eq('rowGUID', rowGUID));
  }

  /** Deletes EVERY stage / task of a project (their dependencies go with them: FK cascade). Import uses it. */
  async function deleteProjectTasks(projectGUID: string): Promise<void> {
    check(await sb.from(projectTaskTable).delete().eq('projectGUID', projectGUID));
  }

  /** rowJSON.lastEditPlace of one task (null removes it) - the rest of rowJSON is not sent, so nothing else can be overwritten */
  async function setTaskLastEditPlace(rowGUID: string, place: PMLastEditPlace | null): Promise<void> {
    check(await sb.rpc(pmRpcSetTaskLastEditPlace, { p_task_guid: rowGUID, p_place: place }));
  }

  async function applySchedule(
    projectGUID: string,
    rows: PMScheduleWrite[],
    projectFinish: string | null,
    projectProgress: number | null
  ): Promise<number> {
    const data = check(
      await sb.rpc(pmRpcApplySchedule, {
        p_project_guid: projectGUID,
        p_rows: rows,
        p_project_finish: projectFinish,
        p_project_progress: projectProgress,
      })
    );
    return Number(data) || 0;
  }

  return {
    // CRUD
    createTask,
    readTask,
    updateTask,
    deleteTask,
    setTaskLastEditPlace,
    deleteProjectTasks,
    // batch / per project / helpers
    createTasks,
    importTasks,
    createTaskLines,
    readProjectTaskLines,
    readProjectData,
    buildTaskRow,
    applySchedule,
  };
}

export type PMTaskApi = ReturnType<typeof createTaskApi>;
