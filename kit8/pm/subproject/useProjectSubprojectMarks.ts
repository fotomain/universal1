// useProjectSubprojectMarks - the subproject marks of the open project (called ONCE, in PMProjectDashboard; the tree and the Gantt read store_subproject).
//   * nothing is read while no task of the project is a subproject (the functionality off = no query, no channel, an empty map)
//   * the link rows (RPC-free: the table project_subproject_link, RLS) + the names of the subprojects (project_table) are read again when the set of the origin tasks changes
//     (a task flagged / unflagged / another subproject / its dates) and when Realtime says the link table changed
//   * the warning is computed from the CLIENT schedule (store.schedule) every time it changes
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabase } from '../../providers/WithSupabase';
import { usePMStore } from '../store/store_pm';
import { pmT } from '../i18n/pmT';
import { SUBPROJECT_LINK_TABLE } from './subprojectApi';
import { subprojectEffectiveOf } from './subprojectModel';
import { PMSubprojectLinkInfo, buildSubprojectMarks } from './subprojectMarks';
import { NO_SUBPROJECT_MARKS, usePMSubprojectStore } from './store_subproject';

export async function readSubprojectLinks(client: any, projectGUID: string): Promise<PMSubprojectLinkInfo[]> {
  const { data, error } = await client.from(SUBPROJECT_LINK_TABLE).select('rowOwnerGUID,rowSubprojectGUID,linkStartAt,linkFinishAt').eq('rowProjectGUID', projectGUID);
  if (error) throw new Error(error.message || String(error));
  const rows = (data || []) as any[];
  if (!rows.length) return [];
  const ids = Array.from(new Set(rows.map((r) => String(r.rowSubprojectGUID))));
  const names = new Map<string, string>();
  const { data: projects } = await client.from('project_table').select('rowGUID,rowJSON').in('rowGUID', ids);
  for (const p of (projects || []) as any[]) names.set(String(p.rowGUID), String(p?.rowJSON?.name ?? p?.rowJSON?.title ?? ''));
  return rows.map((r) => ({
    taskGUID: String(r.rowOwnerGUID),
    subprojectGUID: String(r.rowSubprojectGUID),
    subprojectName: names.get(String(r.rowSubprojectGUID)) ?? '',
    linkStartAt: r.linkStartAt ?? null,
    linkFinishAt: r.linkFinishAt ?? null,
  }));
}

export function useProjectSubprojectMarks(projectGUID: string | null | undefined) {
  const { supabase: typedClient } = useSupabase();
  const supabase: any = typedClient;
  const tasks = usePMStore((s) => s.tasks);
  const schedule = usePMStore((s) => s.schedule);
  const project = usePMStore((s) => (projectGUID ? s.projectsById[projectGUID] : undefined));
  const effective = subprojectEffectiveOf(project?.rowJSON);
  // the origin tasks and what they point at (+ their finish: a copy of the dates changes it)
  const signature = useMemo(
    () => tasks.filter((t) => t.rowJSON?.taskIsSubproject === true && t.rowJSON?.taskSubprojectGUID).map((t) => `${t.rowGUID}:${t.rowJSON.taskSubprojectGUID}:${t.rowDuration ?? ''}`).sort().join('|'),
    [tasks],
  );
  const active = !!projectGUID && effective.enabled && signature !== '';
  const [links, setLinks] = useState<PMSubprojectLinkInfo[]>([]);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!active || !projectGUID) { setLinks((l) => (l.length ? [] : l)); return undefined; }
    let alive = true;
    readSubprojectLinks(supabase, projectGUID).then((l) => { if (alive) setLinks(l); }).catch(() => { if (alive) setLinks((cur) => (cur.length ? [] : cur)); });
    return () => { alive = false; };
  }, [supabase, projectGUID, active, signature, nonce]);

  // Realtime of the link table (the subproject was scheduled: its dates in the link changed)
  useEffect(() => {
    if (!active || !projectGUID || typeof supabase?.channel !== 'function') return undefined;
    const ch = supabase.channel(`subproject-links-${projectGUID}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: SUBPROJECT_LINK_TABLE, filter: `rowProjectGUID=eq.${projectGUID}` }, () => reload())
      .subscribe();
    return () => { try { supabase.removeChannel?.(ch); } catch { /* the channel is gone with the page */ } };
  }, [supabase, projectGUID, active, reload]);

  const marks = useMemo(() => (active && links.length ? buildSubprojectMarks(links, schedule, effective.dates, pmT) : NO_SUBPROJECT_MARKS), [active, links, schedule, effective.dates]);
  useEffect(() => { usePMSubprojectStore.getState().set(projectGUID ?? null, marks); }, [projectGUID, marks]);
  return marks;
}
