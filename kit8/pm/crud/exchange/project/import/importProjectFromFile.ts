// importProjectFromFile: project_data_….json -> the TARGET project (the one open in "Project settings").
//   1. read + check the file            2. plan (new ids, rebuilt tree paths, project settings)
//   3. target already has tasks? -> ask "sql_for_delete the current data?" (no = nothing changes)
//   4. sql_for_delete the target's tasks (dependencies go with them), insert tasks (parents first, importTasks = the RPC project_import_tasks, 500 a chunk) + dependencies + task lines,
//      update the project's rowJSON; the caller refreshes the caches and applies plan.uxuiSettings.
// Not undoable (the undo history of the project is about single edits).

import type { PMApi } from '../../../api/api_pm';
import { newGUID } from '../../../api/apiUtils';
import { PMProjectRow } from '../../../../model/types';
import type { DroppedFileItem } from '../../../../../ui/components/common/ReceiveDraggableFilesComponent.types';
import { parseProjectExchangeFile, PMProjectExchangeError } from '../projectExchangeFormat';
import { planProjectImport, PMProjectImportPlan } from './planProjectImport';
import type { BudgetCatalogsForImport } from './budgetSettingsOfImport';
import { readDroppedFileText } from './readDroppedFileText';

export type PMImportOutcome =
  | { status: 'imported'; plan: PMProjectImportPlan }
  | { status: 'cancelled' };

/** Question shown before existing data is replaced; resolve true = go on. */
export type PMConfirmReplace = (info: { projectName: string; tasks: number; dependencies: number; fileTasks: number; fileDependencies: number; sourceProjectName: string }) => Promise<boolean>;

export const CHUNK = 500;
/** task lines: 500 took 2.4-2.9 s on the local Postgres (the line triggers) - smaller chunks keep a margin under the 8 s limit of Supabase */
export const LINE_CHUNK = 250;
/** links: 500 took 5-7 s on the hosted Supabase (cycle check + closure per link) - 250 keeps a safe margin under the 8 s limit */
export const DEP_CHUNK = 250;

/** The .json the user meant: project_data_*.json first, else the first .json, else the first file. */
export function pickProjectDataFile(files: DroppedFileItem[]): DroppedFileItem | null {
  return (
    files.find((f) => /^project_data_.+\.json$/i.test(f.name)) ??
    files.find((f) => /\.json$/i.test(f.name) || /json/i.test(f.mimeType || '')) ??
    files[0] ??
    null
  );
}

export async function importProjectFromFile(
  api: Pick<PMApi, 'readProjectData' | 'deleteProjectTasks' | 'createDependencies' | 'updateProject'> & { importTasks: PMApi['importTasks']; createTaskLines: PMApi['createTaskLines'] },
  target: PMProjectRow,
  ownerGUID: string,
  files: DroppedFileItem[],
  confirmReplace: PMConfirmReplace,
  budgetCatalogs: BudgetCatalogsForImport = {}
): Promise<PMImportOutcome> {
  const picked = pickProjectDataFile(files);
  if (!picked) throw new PMProjectExchangeError('No file.');
  const file = parseProjectExchangeFile(await readDroppedFileText(picked));
  const plan = planProjectImport(file, target, ownerGUID, newGUID, budgetCatalogs);

  const current = await api.readProjectData(target.rowGUID);
  if (current.tasks.length > 0 || current.deps.length > 0) {
    const ok = await confirmReplace({
      projectName: target.rowJSON.name,
      tasks: current.tasks.length,
      dependencies: current.deps.length,
      fileTasks: plan.tasks.length,
      fileDependencies: plan.dependencies.length,
      sourceProjectName: plan.sourceProjectName,
    });
    if (!ok) return { status: 'cancelled' };
    await api.deleteProjectTasks(target.rowGUID);
  }
  for (let i = 0; i < plan.tasks.length; i += CHUNK) await api.importTasks(target.rowGUID, plan.tasks.slice(i, i + CHUNK));
  for (let i = 0; i < plan.dependencies.length; i += DEP_CHUNK) await api.createDependencies(plan.dependencies.slice(i, i + DEP_CHUNK));
  for (let i = 0; i < plan.taskLines.length; i += LINE_CHUNK) await api.createTaskLines(plan.taskLines.slice(i, i + LINE_CHUNK));
  await api.updateProject(target.rowGUID, { rowJSON: plan.projectRowJSON });
  return { status: 'imported', plan };
}
