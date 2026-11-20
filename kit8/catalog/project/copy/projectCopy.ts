// Copy of a project (the menu of a card of /catalog/project: Copy, Copy with Tasks).
//
//   Copy             -> a NEW project (new rowGUID + treePath) with the settings of the source, no tasks
//   Copy with BIM    -> the same as Copy with Tasks + the BIM model of the source (storeys, chunks, elements, properties; the chunk files are copied in Storage);
//                       the tasks come first (their new ids tie the elements and the stages), the model after them (kit8/pm/bim/copy)
//   Copy with Tasks  -> the same + every task / stage / milestone (new ids), the links between them and the task lines
//                       (Time / Material / Expense / Revenue). It reuses the planner of the file import (planProjectImport:
//                       new ids, rebuilt tree paths, links on the new ids), so a copy and an import of the exported file agree.
//
// What a copy does NOT take: the read-only switch (a new project is never read-only), the posting (the task lines are UNPOSTED:
// "Post unposted tasks" posts them, the plan / fact registers of the source are not copied), documents (fact input, invoices,
// orders, payments, time sheets), the per-user Gantt settings, the subproject marks of the tasks (the link rows belong to the source).
// If anything fails after the project row exists, the half-made copy is deleted again.
// Pure parts (copyProjectName, planProjectCopy, copyOrderAfter) have no React / Supabase: __tests__/catalog/project/projectCopy.test.ts

import type { PMApi } from '../../../pm/crud/api/api_pm';
import { newGUID } from '../../../pm/crud/api/apiUtils';
import { PMProjectRow, PMTaskRow } from '../../../pm/model/types';
import { buildProjectExchangeFile } from '../../../pm/crud/exchange/project/projectExchangeFormat';
import { planProjectImport } from '../../../pm/crud/exchange/project/import/planProjectImport';
import { CHUNK, DEP_CHUNK, LINE_CHUNK } from '../../../pm/crud/exchange/project/import/importProjectFromFile';
import { fractionalOrderBetween, projectTreePath } from '../../../pm/view/project/scheduling';

export type ProjectCopyApi = Pick<
  PMApi,
  'readProjectData' | 'readProjectTaskLines' | 'createProject' | 'deleteProject' | 'importTasks' | 'createDependencies' | 'createTaskLines'
>;

export interface ProjectCopyResult {
  project: PMProjectRow;
  tasks: number;
  dependencies: number;
  taskLines: number;
  /** elements of the copied BIM model (0 = no BIM copy, or the source has none) */
  bimElements: number;
}

/** copies the BIM model of the source into the target; idMap = old task guid -> new task guid (kit8/pm/bim/copy/copyBimModel.ts) */
export type CopyBimFn = (sourceGUID: string, targetGUID: string, idMap: Record<string, string>) => Promise<{ copied: boolean; elements: number }>;

/** "X (copy)", then "X (copy 2)", "X (copy 3)" ... - the first one no other project has. */
export function copyProjectName(name: string, existingNames: string[]): string {
  const base = (name || 'Project').replace(/\s*\(copy(?: \d+)?\)$/i, '');
  const taken = new Set(existingNames.map((n) => (n || '').trim().toLowerCase()));
  let candidate = `${base} (copy)`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${base} (copy ${i})`;
  return candidate;
}

/** orderInList that puts the copy right behind the source (between it and the next project; the end of the list when it is the last). */
export function copyOrderAfter(sourceOrder: number, allOrders: number[]): number {
  const next = allOrders.filter((o) => o > sourceOrder).sort((a, b) => a - b)[0];
  return fractionalOrderBetween(sourceOrder, next ?? null);
}

/** The project row of the copy: the settings of the source, a new identity. rowParentGUID (the organization) is set by the database. */
export function planProjectCopy(source: PMProjectRow, ownerGUID: string, name: string, orderInList: number, makeGUID: () => string = newGUID): PMProjectRow {
  const rowGUID = makeGUID();
  const { projectIsReadonly: _ro, ...settings } = (source.rowJSON || {}) as any;
  return {
    rowGUID,
    treePath: projectTreePath(rowGUID),
    rowOwnerGUID: ownerGUID,
    rowDuration: null,
    rowProgress: 0,
    orderInList,
    rowJSON: { ...settings, name, rowKind: 'project' },
  };
}

/** the task of the copy is no subproject origin: the link rows (project_subproject_link) stay with the source */
const withoutSubprojectMark = (t: PMTaskRow): PMTaskRow => {
  const { taskIsSubproject: _a, taskSubprojectGUID: _b, ...rest } = (t.rowJSON || {}) as any;
  return { ...t, rowJSON: rest };
};

export async function copyProject(
  api: ProjectCopyApi,
  source: PMProjectRow,
  ownerGUID: string,
  opts: { withTasks: boolean; name: string; orderInList: number; makeGUID?: () => string; withBim?: boolean; copyBim?: CopyBimFn }
): Promise<ProjectCopyResult> {
  const makeGUID = opts.makeGUID ?? newGUID;
  const row = planProjectCopy(source, ownerGUID, opts.name, opts.orderInList, makeGUID);

  // read + plan BEFORE anything is written: a broken source stops with nothing created
  if (opts.withBim && !opts.copyBim) throw new Error('Copy with BIM needs the BIM copy function.');
  let plan: ReturnType<typeof planProjectImport> | null = null;
  if (opts.withTasks || opts.withBim) {
    const [data, taskLines] = await Promise.all([api.readProjectData(source.rowGUID), api.readProjectTaskLines(source.rowGUID)]);
    const file = { ...buildProjectExchangeFile(source, data.tasks, data.deps), taskLines };
    plan = planProjectImport(file, row, ownerGUID, makeGUID);
  }

  let bimElements = 0;
  const created = await api.createProject(row);
  if (!plan) return { project: created, tasks: 0, dependencies: 0, taskLines: 0, bimElements: 0 };
  try {
    const tasks = plan.tasks.map(withoutSubprojectMark);
    for (let i = 0; i < tasks.length; i += CHUNK) await api.importTasks(row.rowGUID, tasks.slice(i, i + CHUNK));
    for (let i = 0; i < plan.dependencies.length; i += DEP_CHUNK) await api.createDependencies(plan.dependencies.slice(i, i + DEP_CHUNK));
    for (let i = 0; i < plan.taskLines.length; i += LINE_CHUNK) await api.createTaskLines(plan.taskLines.slice(i, i + LINE_CHUNK));
    if (opts.withBim) bimElements = (await opts.copyBim!(source.rowGUID, row.rowGUID, plan.idMap)).elements;
  } catch (e) {
    // no half-made project is left behind (its tasks, links and lines go with the row)
    try {
      await api.deleteProject(row.rowGUID);
    } catch {
      /* the original error is the one to show */
    }
    throw e;
  }
  return { project: created, tasks: plan.tasks.length, dependencies: plan.dependencies.length, taskLines: plan.taskLines.length, bimElements };
}
