// The project-specific commands of a Projects list item (pure, no React): the three dots menu and the card FAB of ReusableList show the SAME list.
// The standard commands (Move, Archive / Restore, Delete, Copy GUID) come from the list itself; these are the ones only a project has.
import type { ReusableTableRow } from '../../ui/components/table/reusable/reusableTableTypes';
import { projectIsBimBased } from '../../pm/bim/model/bimModel';

export interface ProjectCommandHandlers {
  /** the project dashboard (Gantt) */
  onDashboard?: (projectGUID: string) => void;
  /** the Project settings window */
  onSettings?: (projectGUID: string) => void;
  /** a new project with the settings of this one, no tasks */
  onCopy?: (row: ReusableTableRow) => void;
  /** the same + tasks, links and task lines */
  onCopyWithTasks?: (row: ReusableTableRow) => void;
  /** the same + the BIM model (offered only for a BIM project) */
  onCopyWithBim?: (row: ReusableTableRow) => void;
}

export interface ProjectCommand {
  /** short id for test ids: dashboard | settings | copy | copy-tasks | copy-bim */
  key: string;
  label: string;
  /** icon name of the row menu (Material Symbols) */
  menuIcon: string;
  /** icon name of the card FAB (Material Community Icons) */
  fabIcon: string;
  run: () => void;
}

export function projectCommands(row: ReusableTableRow, h: ProjectCommandHandlers): ProjectCommand[] {
  const id = row.rowGUID;
  const out: ProjectCommand[] = [];
  if (h.onDashboard) out.push({ key: 'dashboard', label: 'Open dashboard', menuIcon: 'timeline', fabIcon: 'chart-timeline-variant', run: () => h.onDashboard!(id) });
  if (h.onSettings) out.push({ key: 'settings', label: 'Project settings', menuIcon: 'settings', fabIcon: 'cog-outline', run: () => h.onSettings!(id) });
  if (h.onCopy) out.push({ key: 'copy', label: 'Copy', menuIcon: 'content_copy', fabIcon: 'content-copy', run: () => h.onCopy!(row) });
  if (h.onCopyWithTasks) out.push({ key: 'copy-tasks', label: 'Copy with Tasks', menuIcon: 'control_point_duplicate', fabIcon: 'content-duplicate', run: () => h.onCopyWithTasks!(row) });
  if (h.onCopyWithBim && projectIsBimBased((row.rowJSON || {}) as any)) out.push({ key: 'copy-bim', label: 'Copy with BIM', menuIcon: 'view_in_ar', fabIcon: 'cube-outline', run: () => h.onCopyWithBim!(row) });
  return out;
}
