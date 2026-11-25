// React side of the project exchange: export (download) and import (replace the project's data).
//   exportProject(projectGUID, options?) -> project_data_<rowGUID>.json (tasks, links, task lines) or, with the BIM model, project_package_<rowGUID>.zip (package/)
//   importProject(projectGUID, files)   -> asks before deleting existing data, then refreshes the caches
//                                          (tree + Gantt repaint) and applies the file's Gantt settings
//                                          to THIS user (project_dashboard_user_settings_table)

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../../store/store_pm';
import { effectiveUxuiSettings } from '../../../store/storeDerive';
import { approvePM } from '../../../inner/PMApproveYesNoCancelModalWindow';
import type { DroppedFileItem } from '../../../../ui/components/common/ReceiveDraggableFilesComponent.types';
import { errorMessage } from '../../api/apiUtils';
import { pmKeys, usePMApi } from '../../shared/queryShared';
import { useSaveProjectUserSettings } from '../../project/projectUserSettingsQueries';
import { useBudgetScenarioData } from '../../../../catalog/budget/scenario/useBudgetScenarioData';
import { useBusinessUnitData } from '../../../../catalog/business_unit/useBusinessUnitData';
import { useSupabase } from '../../../../providers/WithSupabase';
import { createBimCloud } from '../../../bim/cloud/bimCloud';
import { exportProjectToFile } from './export/exportProjectToFile';
import { ExportCancelledError } from './package/bimExportRead';
import type { PMExportOptions } from './package/packageModel';
import { importProjectFromFile, PMConfirmReplace } from './import/importProjectFromFile';
import type { PMProjectImportPlan } from './import/planProjectImport';
import type { BudgetCatalogsForImport } from './import/budgetSettingsOfImport';

export type PMExchangeStatus = { kind: 'idle' } | { kind: 'busy'; text: string; fraction?: number } | { kind: 'done'; text: string } | { kind: 'error'; text: string } | { kind: 'cancelled'; text: string };

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
  const { supabase } = useSupabase();
  const cloud = useMemo(() => createBimCloud(supabase), [supabase]);
  const qc = useQueryClient();
  const { saveUxuiSettings } = useSaveProjectUserSettings(ownerGUID);
  const [status, setStatus] = useState<PMExchangeStatus>({ kind: 'idle' });
  // the catalogs the budget settings of a file point into (scenarios, business units): checked on import
  const scenarios = useBudgetScenarioData(true);
  const units = useBusinessUnitData(true);
  const catalogs = useRef<BudgetCatalogsForImport>({});
  catalogs.current = { scenarios: scenarios.loaded ? scenarios.rows : null, units: units.loaded ? units.rows : null, cfrRows: units.loaded ? units.cfrRows : null };

  // "Cancel export": the running export stops at its next step / page / file
  const exportCancelled = useRef(false);
  const cancelExport = useCallback(() => { exportCancelled.current = true; }, []);

  const exportProject = useCallback(
    async (projectGUID: string, options?: Partial<PMExportOptions>) => {
      exportCancelled.current = false;
      setStatus({ kind: 'busy', text: 'Exporting…', fraction: 0 });
      try {
        const s = usePMStore.getState();
        const r = await exportProjectToFile(api, projectGUID, {
          project: s.projectsById[projectGUID],
          uxuiSettings: effectiveUxuiSettings(s, projectGUID),
          options,
          cloud,
          isCancelled: () => exportCancelled.current,
          onStep: (text, fraction) => setStatus((prev) => ({ kind: 'busy', text: `${text}…`, fraction: fraction ?? (prev.kind === 'busy' ? prev.fraction : undefined) })),
        });
        const extra =
          (r.file.taskLines?.length ? `, ${plural(r.file.taskLines.length, 'task line')}` : '') +
          (r.bim ? `, BIM: ${plural(r.bim.elements, 'element')}, ${plural(r.bim.chunks, 'chunk')}${r.bim.properties ? `, ${plural(r.bim.properties, 'property set')}` : ''}` : '') +
          (r.noBimModel ? ' (the project has no BIM model: plain JSON)' : '');
        setStatus({ kind: 'done', text: `${r.result === 'dismissed' ? 'Prepared' : 'Exported'} ${r.fileName} (${plural(r.file.tasks.length, 'task')}${extra}).` });
        return r;
      } catch (e) {
        setStatus(e instanceof ExportCancelledError ? { kind: 'cancelled', text: 'Export cancelled - no file was made.' } : { kind: 'error', text: errorMessage(e) });
        return null;
      }
    },
    [api, cloud]
  );

  const importProject = useCallback(
    async (projectGUID: string, files: DroppedFileItem[], confirmReplace: PMConfirmReplace = confirmReplaceWithApprove): Promise<PMProjectImportPlan | null> => {
      const target = usePMStore.getState().projectsById[projectGUID];
      if (!target) return null;
      setStatus({ kind: 'busy', text: 'Importing…' });
      try {
        const out = await importProjectFromFile(api, target, ownerGUID, files, confirmReplace, catalogs.current, {
          cloud,
          onStep: (text) => setStatus({ kind: 'busy', text: `${text}…` }),
        });
        if (out.status === 'cancelled') {
          setStatus({ kind: 'done', text: 'Import cancelled - nothing was changed.' });
          return null;
        }
        const { plan, bim } = out;
        // the project row (start, calendar, custom columns) + its tasks: refetch -> store -> repaint
        await Promise.all([
          qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) }),
          qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'closure'] }),
        ]);
        if (plan.uxuiSettings) saveUxuiSettings(projectGUID, plan.uxuiSettings);
        setStatus({
          kind: 'done',
          text:
            `Imported ${plural(plan.tasks.length, 'task')}, ${deps(plan.dependencies.length)}${plan.taskLines.length > 0 ? ` and ${plural(plan.taskLines.length, 'task line')}` : ''} from "${plan.sourceProjectName}".` +
            (bim ? ` BIM model: ${plural(bim.elements, 'element')}, ${plural(bim.chunks, 'chunk')}${bim.properties ? `, ${plural(bim.properties, 'property set')}` : ''}.` : '') +
            (plan.budgetNotTaken.length > 0 ? ` Budget settings not taken: ${plan.budgetNotTaken.join('; ')}.` : ''),
        });
        return plan;
      } catch (e) {
        setStatus({ kind: 'error', text: errorMessage(e) });
        return null;
      }
    },
    [api, cloud, qc, ownerGUID, saveUxuiSettings]
  );

  return { exportProject, cancelExport, importProject, status, busy: status.kind === 'busy' };
}
