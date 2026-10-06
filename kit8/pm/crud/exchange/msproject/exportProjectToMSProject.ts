// "Export to MS Project": the project that is open on the dashboard -> <Project_name>_<time>.xml (MSPDI),
// downloaded at once (web) / share sheet (phones). MS Project: File > Open > the .xml file > "As a new project".
//
// Data = what the user sees: the store's tasks (tree order), dependencies and CPM schedule (start / finish /
// duration / critical / progress), plus - when asked - the Kanban stage and Kanban percent of every row
// (store_kanban) as the custom fields Text1 / Number1.

import { usePMStore } from '../../../store/store_pm';
import { usePMKanbanStore } from '../../../store/store_kanban';
import { flattenAll } from '../../../view/project/scheduling';
import { derivedKanbanProgress, isKanbanCardRow, kanbanStageForRow } from '../../../view/kanban/kanbanModel';
import { kanbanStageProgressOf } from '../../../model/kanbanTypes';
import { downloadTextFile, PMDownloadResult } from '../project/export/downloadTextFile';
import { pmT } from '../../../i18n/pmT';
import { buildMSProjectXml, MSProjectExportInput, MSProjectExportOptions, msProjectFileName } from './msProjectXml';

export interface PMMSProjectExportResult {
  fileName: string;
  xml: string;
  tasks: number;
  result: PMDownloadResult;
}

/** Builds the export input from the stores (throws when the project is not the one open on the dashboard). */
export function msProjectInputFromStore(projectGUID: string, options: MSProjectExportOptions = {}): MSProjectExportInput {
  const s = usePMStore.getState();
  const project = s.projectsById[projectGUID];
  if (!project) throw new Error(pmT('The project does not exist (any more).'));
  if (s.loadedProjectGUID !== projectGUID) throw new Error(pmT('Open the project on the dashboard first.'));
  const k = usePMKanbanStore.getState();
  const kanbanLoaded = k.loadedProjectGUID === projectGUID;
  const kanbanStageNameByTask: Record<string, string | null> = {};
  const kanbanPercentByTask: Record<string, number | null> = {};
  const guids = flattenAll(s.tree).filter((g) => !!s.tasksById[g]);
  if (kanbanLoaded && (options.exportKanbanStage || options.exportKanbanPercent)) {
    for (const g of guids) {
      kanbanStageNameByTask[g] = kanbanStageForRow(g, s.tasksById, s.tree, k.stages, k.statesByTask)?.rowJSON?.stageName ?? null;
      kanbanPercentByTask[g] = isKanbanCardRow(s.tasksById[g], s.tree)
        ? kanbanStageProgressOf(k.statesByTask[g], 0)
        : derivedKanbanProgress(g, s.tasksById, s.tree, k.statesByTask);
    }
  }
  return {
    projectName: project.rowJSON?.name || '',
    rows: guids.map((g) => ({ task: s.tasksById[g], outlineLevel: (s.tree.depthById[g] ?? 0) + 1, wbs: s.tree.wbsById[g] || '', schedule: s.schedule[g] })),
    dependencies: s.deps,
    projectStartMs: s.projectStartMs,
    projectFinishMs: s.projectFinishMs,
    skipWeekends: !!project.rowJSON?.skipWeekends,
    kanbanStageNameByTask,
    kanbanPercentByTask,
    options,
    kanbanStageAlias: 'Kanban Stage',
    kanbanPercentAlias: 'Kanban Percent',
  };
}

export async function exportProjectToMSProject(
  projectGUID: string,
  options: MSProjectExportOptions = {},
  download: typeof downloadTextFile = downloadTextFile
): Promise<PMMSProjectExportResult> {
  const input = msProjectInputFromStore(projectGUID, options);
  const xml = buildMSProjectXml(input);
  const fileName = msProjectFileName(input.projectName);
  const result = await download(fileName, xml, 'application/xml');
  return { fileName, xml, tasks: input.rows.length, result };
}
