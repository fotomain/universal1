// importProjectFromFile: project_data_….json -> the TARGET project (the one open in "Project settings").
//   1. read + check the file            2. plan (new ids, rebuilt tree paths, project settings)
//   3. target already has tasks? -> ask "sql_for_delete the current data?" (no = nothing changes)
//   4. sql_for_delete the target's tasks (dependencies go with them), insert tasks (parents first, importTasks = the RPC project_import_tasks, 500 a chunk) + dependencies + task lines,
//      update the project's rowJSON; the caller refreshes the caches and applies plan.uxuiSettings.
// A project PACKAGE (project_package_<guid>.zip, package/) is the same file plus the BIM model: after the checks the BIM importer's own order is used (package/importProjectPackage.ts).
// Not undoable (the undo history of the project is about single edits).

import type { PMApi } from '../../../api/api_pm';
import { newGUID } from '../../../api/apiUtils';
import { PMProjectRow } from '../../../../model/types';
import type { DroppedFileItem } from '../../../../../ui/components/common/ReceiveDraggableFilesComponent.types';
import { parseProjectExchangeFile, PMProjectExchangeError, type PMProjectExchangeFile } from '../projectExchangeFormat';
import { isProjectPackageFileName, isZipBytes, readPackage, type PMPackage } from '../package/packageModel';
import { readDroppedFileBytes } from '../package/binaryFiles';
import { restoreBimModel, type BimRestoreCloud } from '../package/importProjectPackage';
import { planProjectImport, PMProjectImportPlan } from './planProjectImport';
import type { BudgetCatalogsForImport } from './budgetSettingsOfImport';
import { readDroppedFileText } from './readDroppedFileText';

export type PMImportOutcome =
  | { status: 'imported'; plan: PMProjectImportPlan; bim?: { elements: number; chunks: number; properties: number } }
  | { status: 'cancelled' };

/** Question shown before existing data is replaced; resolve true = go on. */
export type PMConfirmReplace = (info: { projectName: string; tasks: number; dependencies: number; fileTasks: number; fileDependencies: number; sourceProjectName: string }) => Promise<boolean>;

export const CHUNK = 500;
/** task lines: 500 took 2.4-2.9 s on the local Postgres (the line triggers) - smaller chunks keep a margin under the 8 s limit of Supabase */
export const LINE_CHUNK = 250;
/** links: 500 took 5-7 s on the hosted Supabase (cycle check + closure per link) - 250 keeps a safe margin under the 8 s limit */
export const DEP_CHUNK = 250;

/** The file the user meant: a project package (.zip) first, then project_data_*.json, else the first .json, else the first file. */
export function pickProjectDataFile(files: DroppedFileItem[]): DroppedFileItem | null {
  return (
    files.find((f) => isProjectPackageFileName(f.name) || /zip/i.test(f.mimeType || '')) ??
    files.find((f) => /^project_data_.+\.json$/i.test(f.name)) ??
    files.find((f) => /\.json$/i.test(f.name) || /json/i.test(f.mimeType || '')) ??
    files[0] ??
    null
  );
}

const isZipFile = (f: DroppedFileItem) => isProjectPackageFileName(f.name) || /zip/i.test(f.mimeType || '');

export async function importProjectFromFile(
  api: Pick<PMApi, 'readProjectData' | 'deleteProjectTasks' | 'createDependencies' | 'updateProject'> & { importTasks: PMApi['importTasks']; createTaskLines: PMApi['createTaskLines'] },
  target: PMProjectRow,
  ownerGUID: string,
  files: DroppedFileItem[],
  confirmReplace: PMConfirmReplace,
  budgetCatalogs: BudgetCatalogsForImport = {},
  /** the BIM model of a package: the cloud that writes it (without it a package with a model is refused) */
  bim: { cloud?: BimRestoreCloud; onStep?: (text: string) => void } = {}
): Promise<PMImportOutcome> {
  const picked = pickProjectDataFile(files);
  if (!picked) throw new PMProjectExchangeError('No file.');
  let pkg: PMPackage | null = null;
  let file: PMProjectExchangeFile;
  if (isZipFile(picked)) {
    const bytes = await readDroppedFileBytes(picked);
    if (!isZipBytes(bytes)) throw new PMProjectExchangeError('The file is not a zip package.');
    pkg = readPackage(bytes);
    file = pkg.file;
  } else {
    file = parseProjectExchangeFile(await readDroppedFileText(picked));
  }
  if (pkg?.bim && !bim.cloud) throw new PMProjectExchangeError('This package has a BIM model: sign in to import it.');
  const plan = planProjectImport(file, target, ownerGUID, newGUID, budgetCatalogs);

  const current = await api.readProjectData(target.rowGUID);
  const hasTasks = current.tasks.length > 0 || current.deps.length > 0;
  if (hasTasks) {
    const ok = await confirmReplace({
      projectName: target.rowJSON.name,
      tasks: current.tasks.length,
      dependencies: current.deps.length,
      fileTasks: plan.tasks.length,
      fileDependencies: plan.dependencies.length,
      sourceProjectName: plan.sourceProjectName,
    });
    if (!ok) return { status: 'cancelled' };
  }
  const deleteTasks = () => api.deleteProjectTasks(target.rowGUID);
  const writePlan = async () => {
    for (let i = 0; i < plan.tasks.length; i += CHUNK) await api.importTasks(target.rowGUID, plan.tasks.slice(i, i + CHUNK));
    for (let i = 0; i < plan.dependencies.length; i += DEP_CHUNK) await api.createDependencies(plan.dependencies.slice(i, i + DEP_CHUNK));
    for (let i = 0; i < plan.taskLines.length; i += LINE_CHUNK) await api.createTaskLines(plan.taskLines.slice(i, i + LINE_CHUNK));
    await api.updateProject(target.rowGUID, { rowJSON: plan.projectRowJSON });
  };

  if (pkg?.bim && bim.cloud) {
    const done = await restoreBimModel({
      cloud: bim.cloud, projectGUID: target.rowGUID, projectRowJSON: target.rowJSON, plan, bim: pkg.bim, hasTasks, deleteTasks, writePlan, onStep: bim.onStep,
    });
    return { status: 'imported', plan, bim: { elements: done.counts.elements ?? 0, chunks: done.counts.chunks ?? 0, properties: done.counts.properties ?? 0 } };
  }
  if (hasTasks) await deleteTasks();
  await writePlan();
  return { status: 'imported', plan };
}
