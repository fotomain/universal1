// Supabase CRUD for project_task_dependencies_table (the DAG edges) and read access to
// project_task_dependency_closure_table (maintained by DB triggers, read-only here).

import type { SupabaseClient } from '@supabase/supabase-js';
import { projectTaskDependenciesTable, projectTaskDependencyClosureTable } from '../../model/constants';
import { PMDependencyJSON, PMLinkType, PMTaskDependencyClosureRow, PMTaskDependencyRow } from '../../model/types';
import { check, normalizeDep } from './apiUtils';

export interface PMDependencyPatch {
  linkType?: PMLinkType;
  lagDays?: number;
  rowJSON?: PMDependencyJSON;
}

/** The DB was created by the old script (no "rowJSON" column on the dependency table yet). */
function isMissingRowJSONColumn(err: any): boolean {
  const msg = `${err?.message || ''} ${err?.details || ''}`;
  return /rowJSON/.test(msg) && /(column|schema cache)/i.test(msg);
}

export const PM_MISSING_DEP_ROWJSON_HINT =
  'The dependency table has no "rowJSON" column yet - run kit8/sql/init/update_pm_tables_rowJSON.sql in Supabase (dependency colors need it).';

export function createDependencyApi(sb: SupabaseClient) {
  async function createDependencies(rows: PMTaskDependencyRow[]): Promise<PMTaskDependencyRow[]> {
    if (!rows.length) return [];
    // an empty rowJSON is the DB default: do not send it (also works on a DB without the column)
    const clean = rows.map(({ created_at: _c, rowJSON, ...r }) =>
      rowJSON && Object.keys(rowJSON).length ? { ...r, rowJSON } : r
    );
    let res = await sb.from(projectTaskDependenciesTable).insert(clean).select();
    if (res.error && isMissingRowJSONColumn(res.error)) {
      // old schema: keep the links, drop their rowJSON (colors) instead of losing the arrow
      console.warn(`[pm] ${PM_MISSING_DEP_ROWJSON_HINT}`);
      const withoutJSON = clean.map(({ rowJSON: _j, ...r }: any) => r);
      res = await sb.from(projectTaskDependenciesTable).insert(withoutJSON).select();
    }
    return (check(res) || []).map(normalizeDep);
  }

  /** Inserts one dependency pred -> succ. */
  async function createDependency(row: PMTaskDependencyRow): Promise<PMTaskDependencyRow> {
    const [created] = await createDependencies([row]);
    return created;
  }

  /** Only linkType / lagDays / rowJSON are updatable (endpoints are immutable in SQL). */
  async function updateDependency(rowGUID: string, dependsOnGUID: string, patch: PMDependencyPatch): Promise<void> {
    const safe: PMDependencyPatch = {};
    if (patch.linkType !== undefined) safe.linkType = patch.linkType;
    if (patch.lagDays !== undefined) safe.lagDays = patch.lagDays;
    if (patch.rowJSON !== undefined) safe.rowJSON = patch.rowJSON;
    const res = await sb
      .from(projectTaskDependenciesTable)
      .update(safe)
      .eq('rowGUID', rowGUID)
      .eq('rowDependsOnGUID', dependsOnGUID);
    if (res.error && isMissingRowJSONColumn(res.error)) throw new Error(PM_MISSING_DEP_ROWJSON_HINT);
    check(res);
  }

  /** Deletes ONE dependency (edge) - never a task. */
  async function deleteDependency(rowGUID: string, dependsOnGUID: string): Promise<void> {
    check(
      await sb.from(projectTaskDependenciesTable).delete().eq('rowGUID', rowGUID).eq('rowDependsOnGUID', dependsOnGUID)
    );
  }

  /** All transitive blockers (upstream) of a task, straight from the closure table. */
  async function readUpstream(rowGUID: string): Promise<PMTaskDependencyClosureRow[]> {
    const data = check(
      await sb
        .from(projectTaskDependencyClosureTable)
        .select('*')
        .eq('descendantGUID', rowGUID)
        .order('depthLevel', { ascending: true })
    );
    return (data || []) as PMTaskDependencyClosureRow[];
  }

  /** Everything a task transitively blocks (downstream). */
  async function readDownstream(rowGUID: string): Promise<PMTaskDependencyClosureRow[]> {
    const data = check(
      await sb
        .from(projectTaskDependencyClosureTable)
        .select('*')
        .eq('ancestorGUID', rowGUID)
        .order('depthLevel', { ascending: true })
    );
    return (data || []) as PMTaskDependencyClosureRow[];
  }

  return {
    // CRUD (a dependency is read with its project: readProjectData)
    createDependency,
    updateDependency,
    deleteDependency,
    // batch / closure
    createDependencies,
    readUpstream,
    readDownstream,
  };
}

export type PMDependencyApi = ReturnType<typeof createDependencyApi>;
