// fillProjectFromEstimation - copies the estimation project (project2) into the project that names it (project1): stages / tasks / milestones, the links between them and the task lines.
//   documentation/ESTIMATION/PROJECT_ESTIMATION.html section 4. Plain async function (no React); the hook is useFillProjectFromEstimation.ts.
//
// ORDER (nothing of project1 is lost when something fails):
//   1 read project2 (tasks, links, lines) and plan with NEW ids (planEstimationFill) - nothing is written yet
//   2 write the new rows: tasks (project_import_tasks, 500 a chunk) -> links (250) -> lines (250); the new TOP-LEVEL rows go behind the ones project1 has
//     a failure / a cancel here: the new top-level rows are deleted again (project_delete_task_roots), project1 is as before
//   3 Replace only: the OLD top-level rows of project1 are deleted (they are known from the summary the user saw). A failure here leaves old + new rows: nothing is lost, the error says so
//   4 the note projectEstimationLastFill is written on project1 (information only; the fresh row is read first: updateProject REPLACES rowJSON)
// The project settings of project2 are never copied; the lines come out UNPOSTED (planProjectImport), without the sums in the currencies of project2 when the currencies differ.
import type { PMApi } from '../../../crud/api/api_pm';
import { newGUID } from '../../../crud/api/apiUtils';
import type { PMProjectRow } from '../../../model/types';
import { CHUNK, DEP_CHUNK, LINE_CHUNK } from '../../../crud/exchange/project/import/importProjectFromFile';
import { ESTIMATION_LAST_FILL_KEY, planEstimationFill, type EstimationRoot, type FillMode } from './estimationModel';

export type EstimationFillApi = Pick<PMApi, 'readProjectData' | 'readProjectTaskLines' | 'importTasks' | 'createDependencies' | 'createTaskLines' | 'readProject' | 'updateProject'> & {
  deleteTaskRoots: (projectGUID: string, roots: readonly string[]) => Promise<number>;
};

export class EstimationFillCancelledError extends Error {
  constructor() { super('The fill was cancelled; nothing was changed.'); this.name = 'EstimationFillCancelledError'; }
}
/** the copy is complete but the old rows of a Replace could not be deleted (both exist now) */
export class EstimationFillPartialError extends Error {
  constructor(cause: string) { super(`The estimation was copied, but the old rows of the project could not be deleted: ${cause}`); this.name = 'EstimationFillPartialError'; }
}

export interface EstimationFillResult {
  mode: FillMode;
  tasks: number;
  links: number;
  lines: number;
  /** old top-level rows that were deleted (Replace) */
  removedRoots: number;
}

export interface EstimationFillArgs {
  source: PMProjectRow;
  target: PMProjectRow;
  ownerGUID: string;
  /** null = the project has no rows: the rows are simply written */
  mode: Exclude<FillMode, 'empty'> | null;
  /** the top-level rows of the project now (from the summary the user saw) */
  existingRoots: readonly EstimationRoot[];
  /** the budget / accounting currency of the two projects differ: the lines come without the sums of project2's currencies */
  dropCurrencySums: boolean;
  /** the English text of the step ({{n}} placeholder), how far it is (0..1), the values of the placeholder */
  onStep?: (text: string, fraction: number, values?: { n: number }) => void;
  isCancelled?: () => boolean;
  makeGUID?: () => string;
  now?: () => string;
}

export async function fillProjectFromEstimation(api: EstimationFillApi, args: EstimationFillArgs): Promise<EstimationFillResult> {
  const { source, target } = args;
  const step = (text: string, fraction: number, n?: number) => args.onStep?.(text, fraction, n === undefined ? undefined : { n });
  const stopIfCancelled = () => { if (args.isCancelled?.()) throw new EstimationFillCancelledError(); };
  const mode: FillMode = args.mode ?? 'empty';
  if (source.rowGUID === target.rowGUID) throw new Error('A project cannot be filled from itself.');

  step('Reading the estimation', 0.02);
  const [data, taskLines] = await Promise.all([api.readProjectData(source.rowGUID), api.readProjectTaskLines(source.rowGUID)]);
  stopIfCancelled();
  if (!data.tasks.length) throw new Error('The estimation has no tasks.');
  const plan = planEstimationFill({
    source, tasks: data.tasks, dependencies: data.deps, taskLines, target, ownerGUID: args.ownerGUID,
    existingRoots: args.existingRoots, dropCurrencySums: args.dropCurrencySums, newGUID: args.makeGUID ?? newGUID,
  });
  const total = plan.tasks.length + plan.dependencies.length + plan.taskLines.length || 1;
  let done = 0;
  const progress = () => 0.05 + 0.85 * (done / total);

  try {
    step('Writing {{n}} tasks', progress(), plan.tasks.length);
    for (let i = 0; i < plan.tasks.length; i += CHUNK) {
      stopIfCancelled();
      const chunk = plan.tasks.slice(i, i + CHUNK);
      await api.importTasks(target.rowGUID, chunk);
      done += chunk.length;
      step('Writing {{n}} tasks', progress(), plan.tasks.length);
    }
    if (plan.dependencies.length) step('Writing {{n}} links', progress(), plan.dependencies.length);
    for (let i = 0; i < plan.dependencies.length; i += DEP_CHUNK) {
      stopIfCancelled();
      const chunk = plan.dependencies.slice(i, i + DEP_CHUNK);
      await api.createDependencies(chunk);
      done += chunk.length;
      step('Writing {{n}} links', progress(), plan.dependencies.length);
    }
    if (plan.taskLines.length) step('Writing {{n}} task lines', progress(), plan.taskLines.length);
    for (let i = 0; i < plan.taskLines.length; i += LINE_CHUNK) {
      stopIfCancelled();
      const chunk = plan.taskLines.slice(i, i + LINE_CHUNK);
      await api.createTaskLines(chunk);
      done += chunk.length;
      step('Writing {{n}} task lines', progress(), plan.taskLines.length);
    }
    stopIfCancelled();
  } catch (e) {
    // take the new rows back: project1 is as it was (a failing rollback must not hide the first error)
    try { await api.deleteTaskRoots(target.rowGUID, plan.newRoots); } catch { /* the original error is the one to show */ }
    throw e;
  }

  let removedRoots = 0;
  if (mode === 'replace' && args.existingRoots.length) {
    step('Removing the old rows', 0.93);
    try {
      removedRoots = await api.deleteTaskRoots(target.rowGUID, args.existingRoots.map((r) => r.rowGUID)) > 0 ? args.existingRoots.length : 0;
    } catch (e: any) {
      throw new EstimationFillPartialError(String(e?.message || e));
    }
  }

  step('Saving the note of the fill', 0.97);
  const fresh = (await api.readProject(target.rowGUID)) ?? target;
  await api.updateProject(target.rowGUID, {
    rowJSON: { ...fresh.rowJSON, [ESTIMATION_LAST_FILL_KEY]: { at: (args.now ?? (() => new Date().toISOString()))(), sourceGUID: source.rowGUID, mode, tasks: plan.tasks.length, lines: plan.taskLines.length } },
  });
  step('Done', 1);
  return { mode, tasks: plan.tasks.length, links: plan.dependencies.length, lines: plan.taskLines.length, removedRoots };
}
