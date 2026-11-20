// exportProjectToFile: the project + ALL its tasks and dependencies (fresh from the database) + the
// user's Gantt settings -> project_data_<rowGUID>.json, downloaded at once (web) / share sheet (phones).

import type { PMApi } from '../../../api/api_pm';
import { PMProjectRow, PMUxUiSettings } from '../../../../model/types';
import { buildProjectExchangeFile, PMProjectExchangeFile, projectDataFileName } from '../projectExchangeFormat';
import { downloadTextFile, PMDownloadResult } from './downloadTextFile';
import { downloadBinaryFile } from '../package/binaryFiles';
import { ExportCancelledError, readBimForExport, type BimExportCloud } from '../package/bimExportRead';
import { buildPackageEntries, packZip, projectPackageFileName, type PMExportOptions } from '../package/packageModel';
import { usePMStore } from '../../../../store/store_pm';
import { effectiveUxuiSettings } from '../../../../store/storeDerive';
import { pmT } from '../../../../i18n/pmT';

export interface PMExportResult {
  fileName: string;
  file: PMProjectExchangeFile;
  result: PMDownloadResult;
  /** 'json' = project_data_<guid>.json (as always), 'package' = project_package_<guid>.zip (the JSON + the BIM model) */
  kind?: 'json' | 'package';
  /** the BIM part of a package */
  bim?: { storeys: number; chunks: number; elements: number; properties: number; bytes: number };
  /** the BIM model was asked for but the project has none: the file is the plain JSON */
  noBimModel?: boolean;
}

export async function exportProjectToFile(
  api: Pick<PMApi, 'readProjectData' | 'readProject'> & Partial<Pick<PMApi, 'readProjectTaskLines'>>,
  projectGUID: string,
  opts: {
    project?: PMProjectRow;
    uxuiSettings?: PMUxUiSettings;
    download?: typeof downloadTextFile;
    /** the Export tab: task lines / BIM model / BIM properties. Missing = as before (tasks + links only) */
    options?: Partial<PMExportOptions>;
    /** reads the BIM model (needed for options.bim) */
    cloud?: BimExportCloud;
    downloadBinary?: typeof downloadBinaryFile;
    /** a step of the export; `fraction` (0..1) = how far it is (for a progress bar) */
    onStep?: (text: string, fraction?: number) => void;
    /** true = the user pressed Cancel export: the export stops at the next step / page / file (ExportCancelledError) */
    isCancelled?: () => boolean;
  } = {}
): Promise<PMExportResult> {
  const checkCancel = () => { if (opts.isCancelled?.()) throw new ExportCancelledError(); };
  const step = (text: string, fraction?: number) => { checkCancel(); opts.onStep?.(text, fraction); };
  const want = opts.options ?? {};
  const project = opts.project ?? (await api.readProject(projectGUID));
  if (!project) throw new Error('The project does not exist (any more).');
  step('Reading the project', 0.05);
  const data = await api.readProjectData(projectGUID);
  if (want.taskLines && api.readProjectTaskLines) step('Reading the task lines', 0.35);
  const lines = want.taskLines && api.readProjectTaskLines ? await api.readProjectTaskLines(projectGUID) : undefined;
  const file = buildProjectExchangeFile(project, data.tasks, data.deps, opts.uxuiSettings, new Date(), lines);

  // the BIM model: only for a project that has one (a project without a ready model gives the plain JSON, `noBimModel` tells the caller)
  const bim = want.bim && opts.cloud ? await readBimForExport(opts.cloud, projectGUID, { properties: want.bimProperties === true, onStep: (t) => step(t, 0.55), isCancelled: opts.isCancelled }) : null;
  if (bim) {
    step('Packing the files into a zip', 0.85);
    const bytes = packZip(buildPackageEntries(file, bim));
    const fileName = projectPackageFileName(project.rowGUID);
    step('Saving the file', 0.95);
    const result = await (opts.downloadBinary ?? downloadBinaryFile)(fileName, bytes);
    return { fileName, file, result, kind: 'package', bim: { storeys: bim.storeys.length, chunks: bim.chunks.length, elements: bim.elements.length, properties: bim.properties.length, bytes: bim.chunks.reduce((n, c) => n + c.byteSize, 0) } };
  }
  const fileName = projectDataFileName(project.rowGUID);
  step('Saving the file', 0.95);
  const result = await (opts.download ?? downloadTextFile)(fileName, JSON.stringify(file, null, 2));
  return { fileName, file, result, kind: 'json', ...(want.bim && opts.cloud ? { noBimModel: true } : {}) };
}

/**
 * The same file from what the dashboard shows now (the store: realtime-synced tasks + dependencies of the OPEN
 * project) - no database round trip. Used by the Gantt bar: Export > Export to JSON.
 */
export async function exportOpenProjectToFile(projectGUID: string, download: typeof downloadTextFile = downloadTextFile): Promise<PMExportResult> {
  const s = usePMStore.getState();
  const project = s.projectsById[projectGUID];
  if (!project) throw new Error(pmT('The project does not exist (any more).'));
  if (s.loadedProjectGUID !== projectGUID) throw new Error(pmT('Open the project on the dashboard first.'));
  const file = buildProjectExchangeFile(project, s.tasks, s.deps, effectiveUxuiSettings(s, projectGUID));
  const fileName = projectDataFileName(project.rowGUID);
  const result = await download(fileName, JSON.stringify(file, null, 2));
  return { fileName, file, result };
}
