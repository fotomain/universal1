// React side of the project exchange: export (download) and import (replace the project's data).
//   exportProject(projectGUID)          -> project_data_<rowGUID>.json
//   importProject(projectGUID, files)   -> asks before deleting existing data, then refreshes the caches
//                                          (tree + Gantt repaint) and applies the file's Gantt settings
//                                          to THIS user (project_user_settings_table)

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../../store/store_pm';
import { effectiveUxuiSettings } from '../../../store/storeDerive';
import { approvePM } from '../../../inner/PMApproveYesNoCancelModalWindow';
import type { DroppedFileItem } from '../../../../components/common/ReceiveDraggableFilesComponent.types';
import { errorMessage } from '../../api/apiUtils';
import { pmKeys, usePMApi } from '../../shared/queryShared';
import { useSaveProjectUserSettings } from '../../project/projectUserSettingsQueries';
import { exportProjectToFile } from './export/exportProjectToFile';
import { importProjectFromFile, PMConfirmReplace } from './import/importProjectFromFile';
import type { PMProjectImportPlan } from './import/planProjectImport';

export type PMExchangeStatus = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const deps = (n: number) => plural(n, 'dependency', 'dependencies');

/** "Delete the current data?" - the PM Yes / No / Cancel window. */
export const confirmReplaceWithApprove: PMConfirmReplace = (i) =>
  approvePM({
    title: `Replace the data of "${i.projectName}"?`,
    message:
      `The project already has ${plural(i.tasks, 'task')} and ${deps(i.dependencies)}. ` +
      `They are DELETED and replaced by the file ("${i.sourceProjectName}": ${plural(i.fileTasks, 'task')}, ` +
      `${deps(i.fileDependencies)}). This cannot be undone.`,
    yesLabel: 'Delete and import',
    destructive: true,
  });

export function useProjectExchange(ownerGUID: string) {
  const api = usePMApi();
  const qc = useQueryClient();
  const { saveUxuiSettings } = useSaveProjectUserSettings(ownerGUID);
  const [status, setStatus] = useState<PMExchangeStatus>({ kind: 'idle' });

  const exportProject = useCallback(
    async (projectGUID: string) => {
      setStatus({ kind: 'busy', text: 'Exporting…' });
      try {
        const s = usePMStore.getState();
        const r = await exportProjectToFile(api, projectGUID, { project: s.projectsById[projectGUID], uxuiSettings: effectiveUxuiSettings(s, projectGUID) });
        setStatus({ kind: 'done', text: `${r.result === 'dismissed' ? 'Prepared' : 'Exported'} ${r.fileName} (${plural(r.file.tasks.length, 'task')}).` });
        return r;
      } catch (e) {
        setStatus({ kind: 'error', text: errorMessage(e) });
        return null;
      }
    },
    [api]
  );

  const importProject = useCallback(
    async (projectGUID: string, files: DroppedFileItem[], confirmReplace: PMConfirmReplace = confirmReplaceWithApprove): Promise<PMProjectImportPlan | null> => {
      const target = usePMStore.getState().projectsById[projectGUID];
      if (!target) return null;
      setStatus({ kind: 'busy', text: 'Importing…' });
      try {
        const out = await importProjectFromFile(api, target, ownerGUID, files, confirmReplace);
        if (out.status === 'cancelled') {
          setStatus({ kind: 'done', text: 'Import cancelled - nothing was changed.' });
          return null;
        }
        const { plan } = out;
        // the project row (start, calendar, custom columns) + its tasks: refetch -> store -> repaint
        await Promise.all([
          qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) }),
          qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'closure'] }),
        ]);
        if (plan.uxuiSettings) saveUxuiSettings(projectGUID, plan.uxuiSettings);
        setStatus({
          kind: 'done',
          text: `Imported ${plural(plan.tasks.length, 'task')} and ${deps(plan.dependencies.length)} from "${plan.sourceProjectName}".`,
        });
        return plan;
      } catch (e) {
        setStatus({ kind: 'error', text: errorMessage(e) });
        return null;
      }
    },
    [api, qc, ownerGUID, saveUxuiSettings]
  );

  return { exportProject, importProject, status, busy: status.kind === 'busy' };
}
