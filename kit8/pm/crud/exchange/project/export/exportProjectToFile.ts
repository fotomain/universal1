// exportProjectToFile: the project + ALL its tasks and dependencies (fresh from the database) + the
// user's Gantt settings -> project_data_<rowGUID>.json, downloaded at once (web) / share sheet (phones).

import type { PMApi } from '../../../api/api_pm';
import { PMProjectRow, PMUxUiSettings } from '../../../../model/types';
import { buildProjectExchangeFile, PMProjectExchangeFile, projectDataFileName } from '../projectExchangeFormat';
import { downloadTextFile, PMDownloadResult } from './downloadTextFile';

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
