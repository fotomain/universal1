// Project exchange file (export / import of ONE project with ALL its tasks and dependencies).
//
//   file name:  project_data_<project.rowGUID>.json          (projectDataFileName)
//   content:    { format: "kit8.pm.project", version: 1, exportedAt,
//                 project:      project_table row (rowGUID, rowJSON: name, projectStartAt, skipWeekends, customColumns, ...)
//                 tasks:        project_task_table rows (stages / tasks / milestones, ltree treePath)
//                 dependencies: project_task_dependencies_table rows
//                 uxuiSettings: the exporting user's Gantt settings of the project (project_user_settings_table) }
// Pure (no React / Supabase) - unit-tested in __tests__/pm/crud/exchange/projectExchange.test.ts.

import { PMProjectRow, PMTaskDependencyRow, PMTaskRow, PMUxUiSettings } from '../../../model/types';

export const PM_PROJECT_EXCHANGE_FORMAT = 'kit8.pm.project';
export const PM_PROJECT_EXCHANGE_VERSION = 1;

export interface PMProjectExchangeFile {
  format: typeof PM_PROJECT_EXCHANGE_FORMAT;
  version: number;
  exportedAt: string;
  project: PMProjectRow;
  tasks: PMTaskRow[];
  dependencies: PMTaskDependencyRow[];
  uxuiSettings?: PMUxUiSettings;
}

/** project_data_<rowGUID>.json */
export const projectDataFileName = (projectGUID: string): string => `project_data_${projectGUID}.json`;

/** true for names like project_data_<anything>.json (the import accepts other .json names too). */
export const isProjectDataFileName = (name: string | undefined | null): boolean => /^project_data_.+\.json$/i.test(name || '');

const strip = <T extends Record<string, any>>(row: T): T => {
  const { created_at: _c, updated_at: _u, ...rest } = row;
  return rest as T;
};

export function buildProjectExchangeFile(
  project: PMProjectRow,
  tasks: PMTaskRow[],
  dependencies: PMTaskDependencyRow[],
  uxuiSettings?: PMUxUiSettings,
  now: Date = new Date()
): PMProjectExchangeFile {
  return {
    format: PM_PROJECT_EXCHANGE_FORMAT,
    version: PM_PROJECT_EXCHANGE_VERSION,
    exportedAt: now.toISOString(),
    project: strip(project),
    tasks: tasks.filter((t) => t.projectGUID === project.rowGUID).map(strip),
    dependencies: dependencies.filter((d) => d.projectGUID === project.rowGUID).map(strip),
    ...(uxuiSettings ? { uxuiSettings } : {}),
  };
}

export class PMProjectExchangeError extends Error {}

/** Parses + checks a file's text; throws PMProjectExchangeError with a user-readable message. */
export function parseProjectExchangeFile(text: string): PMProjectExchangeFile {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PMProjectExchangeError('The file is not valid JSON.');
  }
  if (!data || data.format !== PM_PROJECT_EXCHANGE_FORMAT) throw new PMProjectExchangeError('This is not a project data file (project_data_….json).');
  if (typeof data.version !== 'number' || data.version > PM_PROJECT_EXCHANGE_VERSION)
    throw new PMProjectExchangeError(`Unsupported file version ${data.version} - update the app.`);
  if (!data.project?.rowGUID || !data.project?.rowJSON) throw new PMProjectExchangeError('The file has no project.');
  if (!Array.isArray(data.tasks) || !Array.isArray(data.dependencies)) throw new PMProjectExchangeError('The file has no task list.');
  for (const t of data.tasks) {
    if (!t?.rowGUID || typeof t.treePath !== 'string' || !t.rowJSON) throw new PMProjectExchangeError('The file has a broken task row.');
  }
  return data as PMProjectExchangeFile;
}
