// createSubprojectModel - "Create based on this → Subproject" of the Task context menu (useCreateSubproject.ts): a NEW project named "Subproject of <task name>" is made, linked as the
// subproject of the task, and its board is opened in a new browser window. No React state / Supabase calls (it imports the settings helpers of the organization defaults, which import the settings tab modules: a Jest test imports the PM UI kit first).
import { defaultProjectSettingsOf } from '../../catalog/organization/defaultProjectSettings';
import { subprojectsEnabledOf } from './subprojectModel';

export const SUBPROJECT_NAME_PREFIX = 'Subproject of ';
/** the name of the new project (the task name is not translated: it is the user's text) */
export const subprojectNameOf = (taskName: string | null | undefined): string => `${SUBPROJECT_NAME_PREFIX}${(taskName ?? '').trim() || '…'}`;

/** why the menu item "Create based on this → Subproject" is not offered / not enabled ('' = it works) */
export type CreateSubprojectBlock = '' | 'disabled' | 'notTask' | 'alreadySubproject';
export function createSubprojectBlock(projectJSON: any, taskJSON: any): CreateSubprojectBlock {
  if (!subprojectsEnabledOf(projectJSON)) return 'disabled';
  if (!taskJSON || (taskJSON.rowKind ?? 'task') !== 'task') return 'notTask';
  if (taskJSON.taskIsSubproject === true) return 'alreadySubproject';
  return '';
}
/** the menu "Go to → Subproject" needs a task that stands for a project */
export const subprojectGUIDOfTask = (taskJSON: any): string => (taskJSON?.taskIsSubproject === true && typeof taskJSON?.taskSubprojectGUID === 'string' ? taskJSON.taskSubprojectGUID : '');

/** the keys of the origin project's rowJSON the subproject starts with: the Project settings (units, budgets, vendor, subprojects) + partners, manager, command modes. NOT: name, dates, kanban, custom columns */
export function subprojectStartSettings(originJSON: any): Record<string, any> {
  const j = originJSON || {};
  return {
    ...defaultProjectSettingsOf(j),
    mainSupplierGUID: j.mainSupplierGUID ?? null,
    mainSupplierContractGUID: j.mainSupplierContractGUID ?? null,
    mainCustomerGUID: j.mainCustomerGUID ?? null,
    mainCustomerContractGUID: j.mainCustomerContractGUID ?? null,
    projectManagerPerson: j.projectManagerPerson ?? null,
    ...(j.projectTreeContextCommandsMode ? { projectTreeContextCommandsMode: j.projectTreeContextCommandsMode } : {}),
    ...(j.projectGanttChartContextCommandsMode ? { projectGanttChartContextCommandsMode: j.projectGanttChartContextCommandsMode } : {}),
  };
}

/** the start of the new project: the start of the origin task when it has one, else today */
export function subprojectStartMs(taskJSON: any, fallbackMs: number): number {
  for (const v of [taskJSON?.manualStartAt, taskJSON?.startAt]) {
    const ms = typeof v === 'string' ? Date.parse(v) : NaN;
    if (Number.isFinite(ms)) return ms;
  }
  return fallbackMs;
}
