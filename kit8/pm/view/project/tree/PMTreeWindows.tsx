// The windows the task tree opens (edit task, edit options, edit dependency, dependency menu, row menu, column menus, task templates, yes / no / cancel, tips).
// Mounted ONCE by the screen that hosts the tree: the Project dashboard (+ its own extra windows) and view/project/tree/PMProjectTreeHost.
import React from 'react';
import type { useKanbanCommands } from '../../../crud/kanban/useKanbanCommands';
import type { usePMCrud } from '../../../crud/usePMCrud';
import PMApproveYesNoCancelModalWindow from '../../../inner/PMApproveYesNoCancelModalWindow';
import { PMTooltipLayer } from '../../../inner/tooltip/PMTooltip';
import { PMTaskTemplateWindows } from '../../../tasktemplate';
import PMTaskEditModal from '../../task/PMTaskEditModal';
import PMTaskEditOptions from '../../task/PMTaskEditOptions';
import PMTaskRowMenu from '../../task/PMTaskRowMenu';
import PMDependencyMenu from '../../task/dependency/PMDependencyMenu';
import PMEditDependencyScreen from '../../task/dependency/PMEditDependencyScreen';
import PMCustomColumnNameModalWindow from '../../tree/customColumns/PMCustomColumnNameModalWindow';
import PMTreeHeaderMenu from '../../tree/customColumns/PMTreeHeaderMenu';
import PMTreeColumnFilterPopup from '../../tree/filter/PMTreeColumnFilterPopup';

export interface PMTreeWindowsProps {
  ownerGUID: string;
  projectGUID: string | null;
  crud: ReturnType<typeof usePMCrud>;
  kanban: ReturnType<typeof useKanbanCommands>;
  /** windows of the screen that must stand between the tree windows and the approve window (project versions, Gantt settings ...) */
  children?: React.ReactNode;
}

export default function PMTreeWindows({ ownerGUID, projectGUID, crud, kanban, children }: PMTreeWindowsProps) {
  return (
    <>
      <PMTaskEditModal crud={crud} kanban={kanban} />
      <PMTaskEditOptions crud={crud} />
      <PMEditDependencyScreen crud={crud} />
      <PMDependencyMenu crud={crud} />
      <PMTaskRowMenu crud={crud} />
      <PMTreeHeaderMenu crud={crud} />
      <PMCustomColumnNameModalWindow crud={crud} />
      <PMTreeColumnFilterPopup crud={crud} />
      {children}
      {/* task templates: "Save to template" / "Fill from template" windows */}
      <PMTaskTemplateWindows ownerGUID={ownerGUID} projectGUID={projectGUID} />
      <PMApproveYesNoCancelModalWindow />
      <PMTooltipLayer />
    </>
  );
}
