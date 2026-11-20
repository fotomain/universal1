// The BIM half of a package import (documentation: README.md of this folder). The ordinary half (tasks, links, task lines, project settings) is importProjectFromFile.ts; this adds the 3D model
// in the order the BIM importer uses (kit8/pm/bim/import/runBimImport.ts), so the rules are the same ones:
//   0. the checks      every element points to a chunk and to a task of the file, every chunk is in the zip with the size the model says - BEFORE anything is changed
//   1. a plain project that has tasks: its tasks go first (bim_import_begin refuses a project with tasks that is not BIM based); a BIM project keeps them until the import has begun
//   2. bim_import_begin       the right, the read-only guard, a model in state importing, the storage folder
//   3. the ordinary rows      tasks (new ids), links, task lines, project settings - `writePlan`
//   4. the chunk files        uploaded with the user's token into the folder of the model (4 at a time)
//   5. the rows               storeys, chunks, elements, properties (bim_import_add_rows) with the task ids of the file mapped to the new ones (plan.idMap)
//   6. bim_import_commit      all or nothing: the model becomes ready, projectIsBIMBased is set
// A failure after step 2: bim_import_fail (rows + uploaded files are cleaned) and the tasks of THIS import are deleted again.
import type { BimCloud } from '../../../../bim/cloud/bimCloud';
import { buildBimRows, modelInfoOfBundle, uploadedPathsOf, type BimBundle } from '../../../../bim/import/bimImportModel';
import { projectIsBimBased } from '../../../../bim/model/bimModel';
import { PMProjectExchangeError } from '../projectExchangeFormat';
import type { PMProjectImportPlan } from '../import/planProjectImport';
import { checkPackageBim } from './packageModel';

export type BimRestoreCloud = Pick<BimCloud, 'begin' | 'addRows' | 'commit' | 'fail' | 'uploadChunk'>;
export const BIM_RESTORE_PARALLEL = 4;

export interface BimRestoreInput {
  cloud: BimRestoreCloud;
  projectGUID: string;
  projectRowJSON: Record<string, any>;
  plan: PMProjectImportPlan;
  bim: { bundle: BimBundle; chunkBytes: (hash: string) => Uint8Array };
  /** the target has tasks now (they are replaced) */
  hasTasks: boolean;
  deleteTasks: () => Promise<void>;
  /** the ordinary rows: tasks, links, task lines, project settings */
  writePlan: () => Promise<void>;
  onStep?: (text: string) => void;
}

export interface BimRestoreResult {
  modelGUID: string;
  revision: number;
  counts: Record<string, number>;
}

export async function restoreBimModel(input: BimRestoreInput): Promise<BimRestoreResult> {
  const { cloud, projectGUID, plan, bim } = input;
  const bundle = bim.bundle;
  const step = input.onStep ?? (() => {});

  step('Checking the BIM model');
  const problem = checkPackageBim(bundle, (hash) => {
    try {
      return bim.chunkBytes(hash).byteLength;
    } catch {
      return null;
    }
  });
  if (problem) throw new PMProjectExchangeError(problem);

  const bimBased = projectIsBimBased(input.projectRowJSON);
  if (input.hasTasks && !bimBased) await input.deleteTasks();
  step('Starting the BIM import');
  const begin = await cloud.begin(projectGUID, String((bundle.model as any).sourceName || 'package'), (bundle.model as any).sourceSha256 ?? null, { source: 'project package' });
  let tasksWritten = false;
  try {
    if (input.hasTasks && bimBased) await input.deleteTasks();
    tasksWritten = true;
    step('Writing the tasks');
    await input.writePlan();

    step('Uploading the BIM geometry');
    const queue = bundle.chunks.map((c) => c.hash);
    const worker = async () => {
      for (let h = queue.shift(); h; h = queue.shift()) await cloud.uploadChunk(`${begin.storagePrefix}/${h}.bimc`, bim.chunkBytes(h));
    };
    await Promise.all(Array.from({ length: Math.min(BIM_RESTORE_PARALLEL, queue.length) }, worker));

    step('Writing the BIM model');
    const rows = buildBimRows(bundle, plan.idMap, begin.storagePrefix);
    for (const kind of ['storeys', 'chunks', 'elements', 'properties'] as const) {
      for (const batch of rows[kind]) await cloud.addRows(begin.modelGUID, kind, batch);
    }
    step('Finishing');
    const done = await cloud.commit(begin.modelGUID, rows.counts, modelInfoOfBundle(bundle));
    return { modelGUID: begin.modelGUID, revision: done.revision, counts: done.counts };
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    try {
      await cloud.fail(begin.modelGUID, text, uploadedPathsOf(bundle, begin.storagePrefix));
    } catch {
      /* the original error is the one to show */
    }
    if (tasksWritten) {
      try {
        await input.deleteTasks();
      } catch {
        /* best effort: the tasks of the half import stay; a new import into this project asks again */
      }
    }
    throw e;
  }
}
