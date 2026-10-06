// exportProjectToFile: the project + ALL its tasks and dependencies (fresh from the database) + the
// user's Gantt settings -> project_data_<rowGUID>.json, downloaded at once (web) / share sheet (phones).

import type { PMApi } from '../../../api/api_pm';
import { PMProjectRow, PMUxUiSettings } from '../../../../model/types';
import { buildProjectExchangeFile, PMProjectExchangeFile, projectDataFileName } from '../projectExchangeFormat';
import { downloadTextFile, PMDownloadResult } from './downloadTextFile';
import { usePMStore } from '../../../../store/store_pm';
import { effectiveUxuiSettings } from '../../../../store/storeDerive';
import { pmT } from '../../../../i18n/pmT';

export interface PMExportResult {
  fileName: string;
  file: PMProjectExchangeFile;
  result: PMDownloadResult;
}

export async function exportProjectToFile(
  api: Pick<PMApi, 'readProjectData' | 'readProject'>,
  projectGUID: string,
  opts: { project?: PMProjectRow; uxuiSettings?: PMUxUiSettings; download?: typeof downloadTextFile } = {}
): Promise<PMExportResult> {
  const project = opts.project ?? (await api.readProject(projectGUID));
  if (!project) throw new Error('The project does not exist (any more).');
  const data = await api.readProjectData(projectGUID);
  const file = buildProjectExchangeFile(project, data.tasks, data.deps, opts.uxuiSettings);
  const fileName = projectDataFileName(project.rowGUID);
  const result = await (opts.download ?? downloadTextFile)(fileName, JSON.stringify(file, null, 2));
  return { fileName, file, result };
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
