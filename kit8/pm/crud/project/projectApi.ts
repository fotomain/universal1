// Supabase CRUD for project_table (one row per project).

import type { SupabaseClient } from '@supabase/supabase-js';
import { projectTable } from '../../constants';
import { PMProjectRow, PMRowJSON } from '../../types';
import { fractionalOrderBetween, projectTreePath, todayUTC } from '../../scheduling';
import { check, newGUID, normalizeProject } from '../shared/apiUtils';

/** Escapes %, _ and \ so a user's text is matched literally by ILIKE. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function createProjectApi(sb: SupabaseClient) {
  /** All projects of one owner (the projects bar / drawer), ordered. */
  async function readProjects(ownerGUID: string): Promise<PMProjectRow[]> {
    const data = check(
      await sb.from(projectTable).select('*').eq('rowOwnerGUID', ownerGUID).order('orderInList', { ascending: true })
    );
    return (data || []).map(normalizeProject);
  }

  /** Substring search on the project name, straight from the database (case-insensitive). */
  async function searchProjects(ownerGUID: string, text: string, limit = 30): Promise<PMProjectRow[]> {
    let q = sb.from(projectTable).select('*').eq('rowOwnerGUID', ownerGUID);
    const t = text.trim();
    if (t) q = q.ilike('rowJSON->>name', likePattern(t));
    const data = check(await q.order('rowJSON->>name', { ascending: true }).limit(limit));
    return (data || []).map(normalizeProject);
  }

  function buildProjectRow(ownerGUID: string, name: string, afterOrder: number | null, startMs?: number): PMProjectRow {
    const rowGUID = newGUID();
    const rowJSON: PMRowJSON = {
      rowKind: 'project',
      name,
      durationDays: 0,
      projectStartAt: new Date(startMs ?? todayUTC()).toISOString(),
      skipWeekends: false,
    };
    return {
      rowGUID,
      treePath: projectTreePath(rowGUID),
      rowOwnerGUID: ownerGUID,
      rowDuration: null,
      rowProgress: 0,
      orderInList: fractionalOrderBetween(afterOrder, null),
      rowJSON,
    };
  }

  /** Batch insert (demo seed). */
  async function createProjects(rows: PMProjectRow[]): Promise<PMProjectRow[]> {
    if (!rows.length) return [];
    const data = check(await sb.from(projectTable).insert(rows).select());
    return (data || []).map(normalizeProject);
  }

  /** Inserts one project (build it first with buildProjectRow). */
  async function createProject(row: PMProjectRow): Promise<PMProjectRow> {
    const [created] = await createProjects([row]);
    return created;
  }

  /** One project by id, or null (not found / not yours - RLS). */
  async function readProject(rowGUID: string): Promise<PMProjectRow | null> {
    const data = check(await sb.from(projectTable).select('*').eq('rowGUID', rowGUID).maybeSingle());
    return data ? normalizeProject(data) : null;
  }

  async function updateProject(rowGUID: string, patch: Partial<PMProjectRow>): Promise<PMProjectRow> {
    const { rowGUID: _g, treePath: _p, created_at: _c, updated_at: _u, ...safe } = patch as any;
    const data = check(await sb.from(projectTable).update(safe).eq('rowGUID', rowGUID).select().single());
    return normalizeProject(data);
  }

  async function deleteProject(rowGUID: string): Promise<void> {
    check(await sb.from(projectTable).delete().eq('rowGUID', rowGUID));
  }

  return {
    // CRUD
    createProject,
    readProject,
    updateProject,
    deleteProject,
    // batch / list / helpers
    createProjects,
    readProjects,
    searchProjects,
    buildProjectRow,
  };
}

export type PMProjectApi = ReturnType<typeof createProjectApi>;
