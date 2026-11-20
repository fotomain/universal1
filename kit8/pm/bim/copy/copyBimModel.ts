// Copy of the BIM model of a project into another project that already holds the COPIED tasks (project copy "Copy with BIM", kit8/catalog/project/copy).
//   1. bim_copy_begin   the database copies the rows (storeys, chunks, elements, properties) inside itself, the task ids through idMap (old task -> new task);
//                       the new model stays "importing" and the answer lists the files to copy (source path -> path in the folder of the copy)
//   2. the files        Storage copy of every chunk file (the same upload policy as an import: the caller started this model)
//   3. bim_import_commit  all or nothing: the model becomes ready, projectIsBIMBased is set
// A failure after step 1: bim_import_fail (the rows go, the files already copied are queued for removal) and the error goes on to the caller (project copy deletes the half-made project).
// A source without a BIM model is not an error: nothing is copied (copied = false).
import type { BimCloud } from '../cloud/bimCloud';

export interface BimCopyResult {
  copied: boolean;
  elements: number;
  chunks: number;
  modelGUID?: string;
}

export type BimCopyCloud = Pick<BimCloud, 'copyBegin' | 'copyFile' | 'commit' | 'fail'>;

/** files copied at the same time (a model has one chunk per storey: a handful) */
export const BIM_COPY_PARALLEL = 4;

export async function copyBimModel(cloud: BimCopyCloud, sourceProjectGUID: string, targetProjectGUID: string, idMap: Record<string, string>): Promise<BimCopyResult> {
  const begun = await cloud.copyBegin(sourceProjectGUID, targetProjectGUID, idMap);
  if (!begun) return { copied: false, elements: 0, chunks: 0 };
  const done: string[] = [];
  try {
    const queue = [...begun.files];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        await cloud.copyFile(f.from, f.to);
        done.push(f.to);
      }
    };
    await Promise.all(Array.from({ length: Math.min(BIM_COPY_PARALLEL, queue.length) }, worker));
    const out = await cloud.commit(begun.modelGUID, begun.counts, {});
    return { copied: true, elements: Number(out.counts?.elements ?? begun.counts.elements ?? 0), chunks: Number(out.counts?.chunks ?? begun.counts.chunks ?? 0), modelGUID: begun.modelGUID };
  } catch (e) {
    try {
      // every destination is listed (also a file whose copy was running when another failed): the queue removes what exists
      await cloud.fail(begun.modelGUID, (e as Error)?.message || 'The BIM copy failed.', begun.files.map((f) => f.to));
    } catch {
      /* the original error is the one to show */
    }
    throw e;
  }
}
