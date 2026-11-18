// recalculateOrganizationProjects - "recalculate ALL projects of the organization with its new currencies" as a plain async function (no React; the screen is
// OrganizationEdit, the hook that gathers its inputs is useOrganizationCurrencyRecalc). Called AFTER the administrator answered Yes to the approval window.
//
// For each project of the organization (project_table.rowParentGUID = the organization), one after the other:
//   1. a READ ONLY project is skipped (the database refuses every change of it); the others get the three currencies in their rowJSON (an empty one never wipes);
//   2. every task line is converted again, the SAME algorithm as the Recalculate command of the Finances tab (recalculateLineFx: the saved rate snapshot is ignored,
//      the rates of the day are taken again, kit8/pm/view/task/finances/taskLineFx.ts); a line that changed is saved with taskIsPosted = false;
//   3. a task that was POSTED before and has a changed line is posted again (runTaskPost, one transaction per task, like Repost all); a task that was "posted and
//      changed" is left for the user (counted: tasksNeedPost); a task that was never posted stays so;
//   4. the cost totals are refreshed when a cost budget is on.
// One project that fails never stops the others: its result says why. The result list is what the screen reports.
import { createProjectApi } from '../../../pm/crud/api/projectApi';
import { projectTable, projectTaskTable } from '../../../pm/model/constants';
import { projectIsReadonly } from '../../../pm/model/projectReadonly';
import { formatDateISO } from '../../../pm/view/project/scheduling';
import { fxEnabled, fxProblem, fxProjectOf, recalculateLineFx, type LineFxContext } from '../../../pm/view/task/finances/taskLineFx';
import { lineContractCurrency, type TaskLineCatalogData } from '../../../pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef, taskLineTable, type TaskLineRow } from '../../../pm/view/task/finances/taskLineModel';
import { fetchRateRows, rateCurrencyGuids } from '../../../pm/view/task/finances/useLineRateBook';
import { runTaskPost } from '../../../pm/view/task/plan/runTaskPost';
import { taskPostState } from '../../../pm/view/task/plan/taskLinePlanModel';
import { linesByTask } from '../../../pm/view/task/plan/useProjectTaskLines';
import { refreshProjectCostAfterPost } from '../../../pm/cost/refreshCostAfterPost';
import { buildRateBook } from '../../currency/exchange/currencyConvert';
import { todayISO } from '../../currency/exchange/currencyExchangeModel';
import { currencyRefreshConfig } from '../../currency/refresh/currencyRefreshConfig';
import type { DefRow } from '../../product/productModel';
import { projectCurrencyPatch, type OrganizationCurrencies, type ProjectRecalcResult } from './organizationCurrenciesModel';

const PAGE = 1000;
/** how many line updates go to the database at once */
const WRITE_BATCH = 10;

export interface RecalcProgress {
  /** 1-based */
  index: number;
  total: number;
  name: string;
  step: 'project' | 'lines' | 'post' | 'done';
}

export interface RecalcEnv {
  /** the Supabase client */
  supabase: any;
  organizationGUID: string;
  /** the new currencies of the organization */
  currencies: OrganizationCurrencies;
  /** the catalogs of the task lines (contracts, templates ...: the currency of a line) */
  catalogs: TaskLineCatalogData;
  /** currencyTable rows (redux) */
  currencyRows: any[];
  /** distributionGenericTable / managementCalendarTable rows (Post needs them) */
  distributions: DefRow<any>[];
  calendars: DefRow<any>[];
  /** the business unit check of Post (useBusinessUnitPostCheck) */
  lineCheck?: (line: TaskLineRow) => string | null;
  onProgress?: (p: RecalcProgress) => void;
  today?: string;
}

const failure = (e: any): string => String(e?.message || e);

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(failure(error));
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const msOf = (v: unknown): number | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : undefined;
};

export async function recalculateOrganizationProjects(env: RecalcEnv): Promise<ProjectRecalcResult[]> {
  const sb = env.supabase;
  const projects: any[] = await readAll((from, to) => sb.from(projectTable).select('*').eq('rowParentGUID', env.organizationGUID).order('orderInList', { ascending: true }).range(from, to));
  const rateRowsCache = new Map<string, any[]>();
  const results: ProjectRecalcResult[] = [];
  for (let i = 0; i < projects.length; i++) {
    const row = projects[i];
    const name = String(row?.rowJSON?.name || row?.rowGUID);
    const result: ProjectRecalcResult = { projectGUID: row.rowGUID, name, status: 'done', linesChanged: 0, tasksPosted: 0, tasksNeedPost: 0, linesWithoutRate: 0, postProblems: [] };
    const say = (step: RecalcProgress['step']) => env.onProgress?.({ index: i + 1, total: projects.length, name, step });
    try {
      say('project');
      if (projectIsReadonly(row.rowJSON)) {
        results.push({ ...result, status: 'skipped', reason: 'the project is read only' });
        continue;
      }
      await recalculateProject(env, row, result, rateRowsCache, say);
    } catch (e: any) {
      result.status = 'failed';
      result.reason = failure(e);
    }
    say('done');
    results.push(result);
  }
  return results;
}

/** ONE project (the Project settings window after the user approved a change of ITS currencies): the same steps as the organization loop. env.currencies = the currencies the project has now */
export async function recalculateSingleProject(env: Omit<RecalcEnv, 'organizationGUID'> & { organizationGUID?: string }, projectGUID: string): Promise<ProjectRecalcResult> {
  const sb = env.supabase;
  const { data, error } = await sb.from(projectTable).select('*').eq('rowGUID', projectGUID).limit(1);
  if (error) throw new Error(failure(error));
  const row = (data || [])[0];
  if (!row) throw new Error('the project does not exist');
  const name = String(row?.rowJSON?.name || row?.rowGUID);
  const result: ProjectRecalcResult = { projectGUID, name, status: 'done', linesChanged: 0, tasksPosted: 0, tasksNeedPost: 0, linesWithoutRate: 0, postProblems: [] };
  const say = (step: RecalcProgress['step']) => env.onProgress?.({ index: 1, total: 1, name, step });
  try {
    say('project');
    if (projectIsReadonly(row.rowJSON)) return { ...result, status: 'skipped', reason: 'the project is read only' };
    await recalculateProject({ ...env, organizationGUID: env.organizationGUID || '' } as RecalcEnv, row, result, new Map(), say);
  } catch (e: any) {
    result.status = 'failed';
    result.reason = failure(e);
  }
  say('done');
  return result;
}

async function recalculateProject(env: RecalcEnv, row: any, result: ProjectRecalcResult, rateRowsCache: Map<string, any[]>, say: (s: RecalcProgress['step']) => void): Promise<void> {
  const sb = env.supabase;
  const projectGUID: string = row.rowGUID;

  // 1. the currencies of the project
  const patch = projectCurrencyPatch(env.currencies);
  const rowJSON = { ...(row.rowJSON || {}), ...patch };
  if (JSON.stringify(rowJSON) !== JSON.stringify(row.rowJSON || {})) await createProjectApi(sb).updateProject(projectGUID, { rowJSON } as any);

  // 2. the lines of the project, the dates of its tasks
  say('lines');
  const lines = await readAll<TaskLineRow>((from, to) => sb.from(taskLineTable).select('rowGUID,rowProjectGUID,rowOwnerGUID,rowParentGUID,orderInList,rowJSON').eq('rowProjectGUID', projectGUID).order('rowGUID', { ascending: true }).range(from, to));
  if (lines.length === 0) return;
  const tasks = await readAll<any>((from, to) => sb.from(projectTaskTable).select('rowGUID,rowDuration,rowJSON').eq('projectGUID', projectGUID).order('rowGUID', { ascending: true }).range(from, to));
  const taskById = new Map(tasks.map((t) => [t.rowGUID as string, t]));
  const stateBefore: Record<string, ReturnType<typeof taskPostState>> = {};
  for (const [task, own] of Object.entries(linesByTask(lines))) stateBefore[task] = taskPostState(own);

  const fxProject = fxProjectOf(rowJSON);
  if (!fxEnabled(fxProject)) return;
  const base = currencyRefreshConfig().base;
  const codes = [fxProject.accountingCurrency, fxProject.budgetCurrency, fxProject.contractCurrency, ...lines.map((l) => lineContractCurrency(env.catalogs, l.rowJSON || {}, fxProject.contractCurrency))].filter(Boolean) as string[];
  const guids = rateCurrencyGuids(env.currencyRows, codes, base);
  const cacheKey = guids.join(',');
  if (!rateRowsCache.has(cacheKey)) rateRowsCache.set(cacheKey, guids.length ? await fetchRateRows(sb, guids) : []);
  const book = buildRateBook(env.currencyRows, rateRowsCache.get(cacheKey) || [], base);
  const today = env.today || todayISO();

  const changed: { line: TaskLineRow; next: Record<string, any> }[] = [];
  for (const line of lines) {
    const def = taskLineGenusDef(line.rowParentGUID);
    if (!def) continue;
    const startAt = msOf(taskById.get(line.rowOwnerGUID)?.rowJSON?.startAt);
    const ctx: LineFxContext = { book, project: fxProject, taskStartDay: startAt === undefined ? null : formatDateISO(startAt), today };
    const fxPatch = recalculateLineFx(ctx, env.catalogs, def, line.rowJSON || {});
    const next = { ...(line.rowJSON || {}), ...fxPatch };
    if (fxProblem(ctx, env.catalogs, def, next)) result.linesWithoutRate += 1;
    if (Object.keys(fxPatch).length) changed.push({ line, next: { ...next, taskIsPosted: false } });
  }
  for (let i = 0; i < changed.length; i += WRITE_BATCH) {
    const results = await Promise.all(changed.slice(i, i + WRITE_BATCH).map(({ line, next }) => sb.from(taskLineTable).update({ rowJSON: next }).eq('rowGUID', line.rowGUID)));
    const bad = results.find((r: any) => r?.error);
    if (bad) throw new Error(failure((bad as any).error));
  }
  for (const { line, next } of changed) line.rowJSON = next;
  result.linesChanged = changed.length;

  // 3. the tasks that were posted are posted again
  const touched = [...new Set(changed.map((c) => c.line.rowOwnerGUID))];
  result.tasksNeedPost = touched.filter((t) => stateBefore[t] === 'postNeeded').length;
  const toPost = touched.filter((t) => stateBefore[t] === 'posted');
  if (toPost.length) say('post');
  const byTask = linesByTask(lines);
  for (const taskGUID of toPost) {
    const task = taskById.get(taskGUID);
    const taskName = String(task?.rowJSON?.taskDescription || taskGUID);
    const r = await runTaskPost({
      taskGUID, lines: byTask[taskGUID] || [], distributions: env.distributions, calendars: env.calendars, calendarForTaskPlan: rowJSON.calendarForTaskPlan,
      startMs: msOf(task?.rowJSON?.startAt), finishMs: msOf(task?.rowDuration), lineCheck: env.lineCheck,
    });
    if (r.status === 'posted') {
      result.tasksPosted += 1;
      if (r.problems.length) result.postProblems.push(`${taskName}: ${r.problems[0]}`);
    } else {
      result.tasksNeedPost += 1;
      result.postProblems.push(`${taskName}: ${r.status === 'error' ? r.message : r.problems[0] || 'nothing to post'}`);
    }
  }

  // 4. the cost totals (only while a cost budget is on)
  if (result.tasksPosted > 0) await refreshProjectCostAfterPost(sb, projectGUID, rowJSON);
}
