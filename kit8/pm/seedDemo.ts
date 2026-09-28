// Demo data = the use case from the TRD (Project 1 / Project 2, two stages each,
// the 3rd task of every stage finishes-to-start after the two previous ones).
// Pure builder so it is shared by the "Demo data" button and the unit tests.

import { buildTreePath, fractionalOrderBetween, projectTreePath } from './scheduling';
import { PMProjectRow, PMTaskDependencyRow, PMTaskRow } from './types';

interface DemoStage {
  name: string;
  tasks: { name: string; days: number; after?: number[] }[]; // after = indices within the stage
}

const DEMO: { name: string; stages: DemoStage[] }[] = [
  {
    name: 'Project 1',
    stages: [
      { name: 'Stage 1', tasks: [{ name: 'Task 111', days: 3 }, { name: 'Task 112', days: 5 }, { name: 'Task 113', days: 2, after: [0, 1] }] },
      { name: 'Stage 2', tasks: [{ name: 'Task 121', days: 3 }, { name: 'Task 122', days: 5 }, { name: 'Task 123', days: 2, after: [0, 1] }] },
    ],
  },
  {
    name: 'Project 2',
    stages: [
      { name: 'Stage 21', tasks: [{ name: 'Task 211', days: 6 }, { name: 'Task 212', days: 7 }, { name: 'Task 213', days: 3, after: [0, 1] }] },
      { name: 'Stage 22', tasks: [{ name: 'Task 221', days: 6 }, { name: 'Task 222', days: 7 }, { name: 'Task 223', days: 3, after: [0, 1] }] },
    ],
  },
];

export interface PMDemoData {
  projects: PMProjectRow[];
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
}

export function buildDemoData(
  ownerGUID: string,
  projectStartMs: number,
  newGUID: () => string,
  lastProjectOrder: number | null = null
): PMDemoData {
  const projects: PMProjectRow[] = [];
  const tasks: PMTaskRow[] = [];
  const deps: PMTaskDependencyRow[] = [];
  let projectOrder = lastProjectOrder;

  for (const p of DEMO) {
    const projectGUID = newGUID();
    projectOrder = fractionalOrderBetween(projectOrder, null);
    const startAt = new Date(projectStartMs).toISOString();
    projects.push({
      rowGUID: projectGUID,
      treePath: projectTreePath(projectGUID),
      rowOwnerGUID: ownerGUID,
      rowDuration: null,
      rowProgress: 0,
      orderInList: projectOrder,
      rowJSON: { rowKind: 'project', name: p.name, durationDays: 0, projectStartAt: startAt, skipWeekends: false },
    });

    let stageOrder: number | null = null;
    for (const s of p.stages) {
      const stageGUID = newGUID();
      stageOrder = fractionalOrderBetween(stageOrder, null);
      const stagePath = buildTreePath(projectTreePath(projectGUID), stageGUID);
      tasks.push({
        rowGUID: stageGUID,
        treePath: stagePath,
        projectGUID,
        rowOwnerGUID: ownerGUID,
        rowDuration: null,
        rowProgress: 0,
        orderInList: stageOrder,
        rowJSON: { rowKind: 'stage', name: s.name, durationDays: 0 },
      });

      const stageTaskGUIDs: string[] = [];
      let taskOrder: number | null = null;
      for (const t of s.tasks) {
        const taskGUID = newGUID();
        stageTaskGUIDs.push(taskGUID);
        taskOrder = fractionalOrderBetween(taskOrder, null);
        tasks.push({
          rowGUID: taskGUID,
          treePath: buildTreePath(stagePath, taskGUID),
          projectGUID,
          rowOwnerGUID: ownerGUID,
          rowDuration: null,
          rowProgress: 0,
          orderInList: taskOrder,
          rowJSON: { rowKind: 'task', name: t.name, durationDays: t.days },
        });
        for (const idx of t.after || []) {
          deps.push({
            rowGUID: taskGUID,
            rowDependsOnGUID: stageTaskGUIDs[idx],
            projectGUID,
            rowOwnerGUID: ownerGUID,
            linkType: 'FS',
            lagDays: 0,
          });
        }
      }
    }
  }
  return { projects, tasks, deps };
}
