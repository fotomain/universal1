// useCreateSubproject - "Create based on this → Subproject" (Task menu and task line menu): creates the project "Subproject of <task>", links it to the task (rowJSON.taskIsSubproject +
// taskSubprojectGUID: the database trigger of project_task_table keeps project_subproject_link and the dates, SQL PART 29) and opens its board in a NEW browser window (web) / this app (iOS, Android).
// The new window is opened inside the click (a pop-up blocker allows it) and pointed at the board when the project exists. A failure closes it, deletes the new project and shows the error.
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../store/store_pm';
import { usePMApi } from '../crud/shared/queryShared';
import { errorMessage } from '../crud/api/apiUtils';
import { todayUTC } from '../view/project/scheduling';
import { openProjectBoard } from '../view/project/dashboardDeepLink';
import { openBlankWindow } from '../../documents/vendor/invoice/vendorInvoiceNavigation';
import { pmT } from '../i18n/pmT';
import { createSubprojectBlock, subprojectNameOf, subprojectStartMs, subprojectStartSettings } from './createSubprojectModel';
import { subprojectErrorText } from './subprojectModel';

/** the providers are missing in a screen without them (tests): the hook then only fails when the command is used */
function useOrNull<T>(use: () => T): T | null {
  try { return use(); } catch { return null; }
}

export function useCreateSubproject() {
  const api = useOrNull(usePMApi);
  const qc = useOrNull(useQueryClient);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = useCallback(async (taskGUID: string, projectGUID: string): Promise<string | null> => {
    const s = usePMStore.getState();
    const project = s.projectsById[projectGUID];
    const task = s.tasksById[taskGUID];
    if (!project || !task) return null;
    const block = createSubprojectBlock(project.rowJSON, task.rowJSON);
    if (block) {
      s.setError(block === 'disabled' ? pmT('Switch on "Subprojects" in the settings of the project first.')
        : block === 'notTask' ? pmT('Only a task (not a stage or a milestone) can stand for a subproject.')
        : pmT('This task already stands for a subproject.'));
      return null;
    }
    if (!api || !qc) { s.setError(pmT('The database is not available.')); return null; }
    const target = openBlankWindow();
    setBusy(true);
    let created: string | null = null;
    try {
      const last = s.projectOrder[s.projectOrder.length - 1];
      const row = api.buildProjectRow(project.rowOwnerGUID, subprojectNameOf(task.rowJSON.taskDescription), last ? s.projectsById[last]?.orderInList ?? null : null, subprojectStartMs(task.rowJSON, todayUTC()));
      Object.assign(row.rowJSON, subprojectStartSettings(project.rowJSON));
      await api.createProject(row);
      created = row.rowGUID;
      await api.updateTask(taskGUID, { rowJSON: { ...task.rowJSON, taskIsSubproject: true, taskSubprojectGUID: row.rowGUID } });
      void qc.invalidateQueries({ queryKey: ['pm', 'projects'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'projectSearch'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'project'] });
      void qc.invalidateQueries({ queryKey: ['pm', 'projectData', projectGUID] });
      void qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
      openProjectBoard(row.rowGUID, router, target);
      return row.rowGUID;
    } catch (e) {
      try { target?.close(); } catch { /* nothing to close */ }
      if (created) { try { await api.deleteProject(created); } catch { /* the user sees the first error; the empty project can be deleted by hand */ } }
      s.setError(subprojectErrorText(e, pmT) ?? errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [api, qc, router]);

  return { create, busy };
}
