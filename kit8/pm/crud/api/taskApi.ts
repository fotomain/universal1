// Supabase CRUD for project_task_table (stages, tasks, milestones) + the scheduler
// write-back RPC. readProjectData also returns the project's dependencies because the
// Gantt always needs both at once (one round-trip, one cache entry).

import type { SupabaseClient } from '@supabase/supabase-js';
import { pmRpcApplySchedule, projectTaskDependenciesTable, projectTaskTable } from '../../model/constants';
import { PMProjectData, PMTaskRow } from '../../model/types';
import { buildTreePath, projectTreePath } from '../../view/project/scheduling';
import { check, newGUID, normalizeDep, normalizeTask } from './apiUtils';

export interface PMScheduleWrite {
  rowGUID: string;
  startAt: string;
  finishAt: string;
  rowProgress?: number;
}

export function createTaskApi(sb: SupabaseClient) {
  /** Everything the Gantt of one project needs: its tasks (ordered) + dependencies. */
  async function readProjectData(projectGUID: string): Promise<PMProjectData> {
    const [tasksRes, depsRes] = await Promise.all([
      sb.from(projectTaskTable).select('*').eq('projectGUID', projectGUID).order('orderInList', { ascending: true }),
      sb.from(projectTaskDependenciesTable).select('*').eq('projectGUID', projectGUID),
    ]);
    return {
      tasks: (check(tasksRes) || []).map(normalizeTask),
      deps: (check(depsRes) || []).map(normalizeDep),
    };
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
      rowJSON: { rowKind: params.rowKind, name: params.name, durationDays: params.durationDays },
    };
  }

  /** Parents must come before children in `rows` (the DB checks the parent exists). */
  async function createTasks(rows: PMTaskRow[]): Promise<PMTaskRow[]> {
    if (!rows.length) return [];
    const clean = rows.map(({ created_at: _c, updated_at: _u, ...r }) => r);
    const data = check(await sb.from(projectTaskTable).insert(clean).select());
    return (data || []).map(normalizeTask);
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
    deleteProjectTasks,
    // batch / per project / helpers
    createTasks,
    readProjectData,
    buildTaskRow,
    applySchedule,
  };
}

export type PMTaskApi = ReturnType<typeof createTaskApi>;
