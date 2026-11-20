// Turns an exchange file into the rows to write into a TARGET project (any project, also the source one):
//   * every task gets a NEW rowGUID (the file may be imported next to its source project -> no key clashes)
//   * treePath is rebuilt from the target project + the new ids (parents before children)
//   * dependencies follow the new ids; links to rows missing in the file are dropped
//   * project settings from the file (start, calendar, custom columns, notes) are applied, the target keeps its NAME;
//     budget settings that point into catalogs (scenarios, business units) are checked first (budgetSettingsOfImport.ts)
// Pure - unit-tested in __tests__/pm/crud/exchange/projectExchange.test.ts.

import { PMProjectRow, PMRowJSON, PMTaskDependencyRow, PMTaskRow, PMUxUiSettings } from '../../../../model/types';
import { buildTreePath, projectTreePath, toLtreeLabel } from '../../../../view/project/scheduling';
import { PMExchangeTaskLine, PMProjectExchangeError, PMProjectExchangeFile, taskJSONOfFile } from '../projectExchangeFormat';
import { applyBudgetSettingsOfImport, BudgetCatalogsForImport } from './budgetSettingsOfImport';

export interface PMProjectImportPlan {
  /** parents before children (the DB checks that the parent exists) */
  tasks: PMTaskRow[];
  dependencies: PMTaskDependencyRow[];
  /** the task lines of the file, on the NEW task ids with new line ids (a line whose task is not in the file is dropped) */
  taskLines: PMExchangeTaskLine[];
  skippedLines: number;
  /** new project_table.rowJSON of the target */
  projectRowJSON: PMRowJSON;
  uxuiSettings?: PMUxUiSettings;
  /** old task id -> new task id */
  idMap: Record<string, string>;
  skippedDependencies: number;
  /** budget settings of the file that were NOT taken (the scenario / unit does not exist in this database), for the user */
  budgetNotTaken: string[];
  sourceProjectName: string;
}

export function planProjectImport(
  file: PMProjectExchangeFile,
  target: PMProjectRow,
  ownerGUID: string,
  newGUID: () => string,
  budgetCatalogs: BudgetCatalogsForImport = {}
): PMProjectImportPlan {
  const byLabel = new Map(file.tasks.map((t) => [toLtreeLabel(t.rowGUID), t]));
  const idMap: Record<string, string> = {};
  for (const t of file.tasks) idMap[t.rowGUID] = newGUID();

  const depth = (t: PMTaskRow) => t.treePath.split('.').length;
  const ordered = [...file.tasks].sort((a, b) => depth(a) - depth(b) || (a.orderInList ?? 0) - (b.orderInList ?? 0));
  const newPath: Record<string, string> = {};
  const tasks: PMTaskRow[] = [];
  for (const t of ordered) {
    const labels = t.treePath.split('.');
    if (labels[labels.length - 1] !== toLtreeLabel(t.rowGUID)) throw new PMProjectExchangeError(`Task "${taskJSONOfFile(t.rowJSON).taskDescription || t.rowGUID}" has a wrong tree path.`);
    const parentLabel = labels.length > 2 ? labels[labels.length - 2] : null;
    let parentPath = projectTreePath(target.rowGUID);
    if (parentLabel) {
      const parent = byLabel.get(parentLabel);
      if (!parent || !newPath[parent.rowGUID]) throw new PMProjectExchangeError(`Task "${taskJSONOfFile(t.rowJSON).taskDescription || t.rowGUID}" has no parent in the file.`);
      parentPath = newPath[parent.rowGUID];
    }
    const rowGUID = idMap[t.rowGUID];
    newPath[t.rowGUID] = buildTreePath(parentPath, rowGUID);
    const { created_at: _c, updated_at: _u, ...rest } = t;
    tasks.push({
      ...rest,
      rowGUID,
      treePath: newPath[t.rowGUID],
      projectGUID: target.rowGUID,
      rowOwnerGUID: ownerGUID,
      rowProgress: Number(t.rowProgress) || 0,
      orderInList: Number(t.orderInList) || 0,
      rowJSON: taskJSONOfFile(t.rowJSON),
    });
  }

  let skippedDependencies = 0;
  const seen = new Set<string>();
  const dependencies: PMTaskDependencyRow[] = [];
  for (const d of file.dependencies) {
    const succ = idMap[d.rowGUID];
    const pred = idMap[d.rowDependsOnGUID];
    const key = `${pred}>${succ}`;
    if (!succ || !pred || succ === pred || seen.has(key)) {
      skippedDependencies++;
      continue;
    }
    seen.add(key);
    const { created_at: _c, ...rest } = d as any;
    dependencies.push({ ...rest, rowGUID: succ, rowDependsOnGUID: pred, projectGUID: target.rowGUID, rowOwnerGUID: ownerGUID, rowJSON: d.rowJSON || {} });
  }

  // task lines: new ids, on the new task ids; a line is the line of a task / milestone, never of a stage (the database refuses nothing, the app shows none)
  let skippedLines = 0;
  const taskLines: PMExchangeTaskLine[] = [];
  for (const l of file.taskLines ?? []) {
    const task = idMap[l.rowOwnerGUID];
    if (!task) {
      skippedLines++;
      continue;
    }
    taskLines.push({ rowGUID: newGUID(), rowOwnerGUID: task, rowParentGUID: l.rowParentGUID, orderInList: Number(l.orderInList) || 0, rowJSON: { ...l.rowJSON, taskIsPosted: false, baseOfDistribution: null } });
  }

  // project settings from the file, identity of the target (name, kind); per-user settings travel separately
  const { name: _n, rowKind: _k, uxuiSettings: _u, ...fileJSON } = file.project.rowJSON || ({} as PMRowJSON);
  // projectIsBIMBased is the target's own: only a restored BIM model sets it (bim_import_commit); a file of a BIM project without its model must not switch a BIM button on
  const { projectIsBIMBased: _bim, ...fileJSONWithoutBim } = fileJSON as Record<string, any>;
  const { rowJSON: projectRowJSON, notTaken: budgetNotTaken } = applyBudgetSettingsOfImport(
    { ...target.rowJSON, ...fileJSONWithoutBim, name: target.rowJSON.name, rowKind: 'project' },
    target.rowJSON,
    budgetCatalogs
  );

  return {
    tasks,
    dependencies,
    taskLines,
    skippedLines,
    projectRowJSON,
    uxuiSettings: file.uxuiSettings,
    idMap,
    skippedDependencies,
    budgetNotTaken,
    sourceProjectName: file.project.rowJSON?.name || file.project.rowGUID,
  };
}
