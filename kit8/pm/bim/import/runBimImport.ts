// The BIM import, step by step (documentation/BIM_WBS.html sections 3 + 9). The pieces are INJECTED (cloud, converter, api) so the order and the failure handling are tested without a network.
//   1. the target project: made when it does not exist; a project that has tasks and is NOT a BIM project is refused (owner rule Q10); a BIM project asks "replace"
//   2. bim_import_begin       the right + the read-only guard + a model in state importing + the storage folder
//   3. the converter          converts the IFC and uploads the chunks (with the user's token); returns the bundle
//   4. the tasks              the project file of the bundle through the ordinary importer path (planProjectImport + project_import_tasks, 500 a chunk)
//   5. the rows               storeys, chunks, elements, properties (bim_import_add_rows, in batches)
//   6. bim_import_commit      all or nothing: the model becomes ready, projectIsBIMBased is set
// A failure after step 2: bim_import_fail (the model row, the partial rows and the uploaded files are cleaned) and the tasks of THIS import are deleted again.
import type { PMApi } from '../../crud/api/api_pm';
import { newGUID } from '../../crud/api/apiUtils';
import type { PMProjectRow, PMProjectData } from '../../model/types';
import { projectTreePath } from '../../view/project/scheduling';
import { planProjectImport, type PMProjectImportPlan } from '../../crud/exchange/project/import/planProjectImport';
import { CHUNK } from '../../crud/exchange/project/import/importProjectFromFile';
import type { BimCloud } from '../cloud/bimCloud';
import { projectIsBimBased } from '../model/bimModel';
import { BimImportError, buildBimRows, checkBundle, modelInfoOfBundle, uploadedPathsOf, type BimBundle, type BimImportOptions } from './bimImportModel';
import type { BimConvertParams, BimConvertSource } from './bimServerClient';

export type BimImportApi = Pick<PMApi, 'readProjectData' | 'deleteProjectTasks' | 'importTasks' | 'updateProject' | 'createProject'>;

export interface BimImportDeps {
  cloud: BimCloud;
  convert: (params: BimConvertParams, source: BimConvertSource, onProgress: (percent: number, text: string) => void) => Promise<BimBundle>;
  api: BimImportApi;
  ownerGUID: string;
  /** the project row as the store knows it (undefined = not there) */
  getProject: (projectGUID: string) => PMProjectRow | undefined;
  /** "the tasks of this BIM project will be replaced": resolve true = go on */
  confirmReplace: (info: { projectName: string; tasks: number }) => Promise<boolean>;
}

export interface BimImportInput {
  projectGUID: string;
  /** the name of a project that has to be made */
  projectName: string;
  source: BimConvertSource;
  options: BimImportOptions;
  /** shown while it runs: 0..100 + a text */
  onStep?: (percent: number, text: string) => void;
}

export type BimImportOutcome =
  | { status: 'imported'; modelGUID: string; revision: number; counts: Record<string, number>; plan: PMProjectImportPlan; projectGUID: string }
  | { status: 'cancelled' };

const sourceNameOf = (s: BimConvertSource) => (s.kind === 'url' ? decodeURIComponent((s.url.split('?')[0].split('/').pop() || 'model.ifc').trim()) : s.name);

export async function runBimImport(deps: BimImportDeps, input: BimImportInput): Promise<BimImportOutcome> {
  const { cloud, api } = deps;
  const step = input.onStep ?? (() => {});
  const startMs = input.options.startDate ? Date.parse(`${input.options.startDate}T00:00:00.000Z`) : Date.now();

  step(1, 'Checking the project');
  let target = deps.getProject(input.projectGUID);
  let existing: PMProjectData | null = null;
  if (target) {
    existing = await api.readProjectData(input.projectGUID);
    if (existing.tasks.length > 0) {
      if (!projectIsBimBased(target.rowJSON)) throw new BimImportError('The project already has tasks and is not a BIM project. Import into an empty project, or into a BIM project (its tasks are replaced).');
      const ok = await deps.confirmReplace({ projectName: target.rowJSON.name, tasks: existing.tasks.length });
      if (!ok) return { status: 'cancelled' };
    }
  }

  step(3, 'Starting the import');
  if (!target) {
    target = await api.createProject({
      rowGUID: input.projectGUID,
      treePath: projectTreePath(input.projectGUID),
      rowOwnerGUID: deps.ownerGUID,
      rowDuration: null,
      rowProgress: 0,
      orderInList: 1024,
      rowJSON: { rowKind: 'project', name: input.projectName, durationDays: 0, projectStartAt: new Date(startMs).toISOString(), skipWeekends: true },
    } as PMProjectRow);
  }
  const begin = await cloud.begin(input.projectGUID, sourceNameOf(input.source), null, input.options as any);
  let bundle: BimBundle | null = null;
  let tasksWritten = false;
  try {
    bundle = await deps.convert(
      { projectGUID: input.projectGUID, modelGUID: begin.modelGUID, name: input.projectName, granularity: input.options.granularity, skipEmpty: input.options.skipEmptyStoreys, startDate: input.options.startDate, openings: input.options.includeOpenings === true },
      input.source,
      (p, t) => step(5 + Math.round(p * 0.55), t)
    );
    checkBundle(bundle);

    step(62, 'Making the stages and tasks');
    const plan = planProjectImport(bundle.project, target, deps.ownerGUID, newGUID);
    if (existing && existing.tasks.length > 0) await api.deleteProjectTasks(input.projectGUID);
    tasksWritten = true;
    for (let i = 0; i < plan.tasks.length; i += CHUNK) await api.importTasks(input.projectGUID, plan.tasks.slice(i, i + CHUNK));
    await api.updateProject(input.projectGUID, { rowJSON: plan.projectRowJSON });

    step(72, 'Writing the model');
    const rows = buildBimRows(bundle, plan.idMap, begin.storagePrefix);
    for (const kind of ['storeys', 'chunks', 'elements', 'properties'] as const) {
      for (const batch of rows[kind]) await cloud.addRows(begin.modelGUID, kind, batch);
    }
    step(94, 'Finishing');
    const done = await cloud.commit(begin.modelGUID, rows.counts, modelInfoOfBundle(bundle));
    step(100, 'Done');
    return { status: 'imported', modelGUID: begin.modelGUID, revision: done.revision, counts: done.counts, plan, projectGUID: input.projectGUID };
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    try {
      await cloud.fail(begin.modelGUID, text, bundle ? uploadedPathsOf(bundle, begin.storagePrefix) : []);
    } catch {
      /* the original error is the one to show */
    }
    if (tasksWritten) {
      try {
        await api.deleteProjectTasks(input.projectGUID);
      } catch {
        /* best effort: the tasks of the half import stay; a re-import into this project asks again */
      }
    }
    throw e;
  }
}
