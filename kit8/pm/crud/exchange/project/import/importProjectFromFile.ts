// importProjectFromFile: project_data_….json -> the TARGET project (the one open in "Project settings").
//   1. read + check the file            2. plan (new ids, rebuilt tree paths, project settings)
//   3. target already has tasks? -> ask "delete the current data?" (no = nothing changes)
//   4. delete the target's tasks (dependencies go with them), insert tasks (parents first) + dependencies,
//      update the project's rowJSON; the caller refreshes the caches and applies plan.uxuiSettings.
// Not undoable (the undo history of the project is about single edits).

import type { PMApi } from '../../../api/api_pm';
import { newGUID } from '../../../api/apiUtils';
import { PMProjectRow } from '../../../../model/types';
import type { DroppedFileItem } from '../../../../../components/common/ReceiveDraggableFilesComponent.types';
import { parseProjectExchangeFile, PMProjectExchangeError } from '../projectExchangeFormat';
import { planProjectImport, PMProjectImportPlan } from './planProjectImport';
import { readDroppedFileText } from './readDroppedFileText';

export type PMImportOutcome =
  | { status: 'imported'; plan: PMProjectImportPlan }
  | { status: 'cancelled' };

/** Question shown before existing data is replaced; resolve true = go on. */
export type PMConfirmReplace = (info: { projectName: string; tasks: number; dependencies: number; fileTasks: number; fileDependencies: number; sourceProjectName: string }) => Promise<boolean>;

const CHUNK = 500;

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
  api: Pick<PMApi, 'readProjectData' | 'deleteProjectTasks' | 'createTasks' | 'createDependencies' | 'updateProject'>,
  target: PMProjectRow,
  ownerGUID: string,
  files: DroppedFileItem[],
  confirmReplace: PMConfirmReplace
): Promise<PMImportOutcome> {
  const picked = pickProjectDataFile(files);
  if (!picked) throw new PMProjectExchangeError('No file.');
  const file = parseProjectExchangeFile(await readDroppedFileText(picked));
  const plan = planProjectImport(file, target, ownerGUID, newGUID);

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
  for (let i = 0; i < plan.tasks.length; i += CHUNK) await api.createTasks(plan.tasks.slice(i, i + CHUNK));
  for (let i = 0; i < plan.dependencies.length; i += CHUNK) await api.createDependencies(plan.dependencies.slice(i, i + CHUNK));
  await api.updateProject(target.rowGUID, { rowJSON: plan.projectRowJSON });
  return { status: 'imported', plan };
}
