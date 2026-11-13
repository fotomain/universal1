// project GUID -> { name, readonly } for the media posts a list shows. One read of project_table for the GUIDs the posts name; what the user may not read stays unnamed.
import { useEffect, useMemo, useState } from 'react';
import { mediaPostProjectGUID, PostProjectInfo } from './mediaPostProject';

// require, not import: a screen or a test that never shows a project post does not create the client
const client = () => require('../../../supabase/supabase').supabase;

export async function fetchPostProjects(guids: string[]): Promise<Record<string, PostProjectInfo>> {
  if (!guids.length) return {};
  try {
    const { data } = await client().from('project_table').select('rowGUID,rowJSON').in('rowGUID', guids);
    const out: Record<string, PostProjectInfo> = {};
    for (const p of (data as any[]) || []) out[String(p.rowGUID)] = { name: String(p.rowJSON?.name || ''), readonly: p.rowJSON?.projectIsReadonly === true };
    return out;
  } catch {
    return {};
  }
}

export function useMediaPostProjects(rows: unknown): Record<string, PostProjectInfo> {
  const key = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(rows)) for (const r of rows) { const g = mediaPostProjectGUID(r); if (g) set.add(g); }
    return [...set].sort().join(',');
  }, [rows]);
  const [info, setInfo] = useState<Record<string, PostProjectInfo>>({});
  useEffect(() => {
    let live = true;
    if (!key) { setInfo({}); return; }
    fetchPostProjects(key.split(',')).then((r) => { if (live) setInfo(r); });
    return () => { live = false; };
  }, [key]);
  return info;
}
