// A project task of the calendar -> the project dashboard: the task is selected, the Finances ("Edit") view is open
// at its tab (the line is marked when known). Web: a browser tab of its own; iOS / Android: this app.

import { openDashboardLink } from '../../pm/view/project/dashboardDeepLink';
import type { UserCalendarEventJSON } from './data/userCalendarModel';

export function openProjectTaskInDashboard(j: Pick<UserCalendarEventJSON, 'projectGUID' | 'projectTaskGUID'>, router: { push: (to: any) => void }): boolean {
  if (!j.projectGUID || !j.projectTaskGUID) return false;
  openDashboardLink({ projectGUID: j.projectGUID, taskGUID: j.projectTaskGUID }, router);
  return true;
}
