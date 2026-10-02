// React Query hooks of the project versions -> Zustand (version/store/store_version.ts).
//
//   useReadProjectVersionsQuery(project)  version_project_table rows -> store.versions; the checked versions
//                                         (uxuiSettings.checkedProjectVersions) -> store.checkedGUIDs; their
//                                         tasks + dependencies -> store.dataByVersion -> store.overlays (Gantt)
//   useVersionDataQuery(version)          tasks + dependencies of one version (cards: differences)
//
// Versions never change after they were saved (only the title), so their data is cached for the session.

import { useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSupabase } from '../../../../providers/WithSupabase';
import { usePMStore } from '../../../store/store_pm';
import { createVersionApi, PMVersionApi } from '../api/versionApi';
import { normalizeChecked, usePMVersionStore } from '../../store/store_version';

export const pmVersionKeys = {
  /** version_project_table rows of one project */
  versions: (projectGUID: string | null | undefined) => ['pm', 'versions', projectGUID] as const,
  /** tasks + dependencies of one version */
  versionData: (versionGUID: string | null | undefined) => ['pm', 'versionData', versionGUID] as const,
};

export function usePMVersionApi(): PMVersionApi {
  const { supabase } = useSupabase();
  return useMemo(() => createVersionApi(supabase), [supabase]);
}

const NEVER_STALE = Infinity;

export function useVersionDataQuery(versionGUID: string | null | undefined, enabled = true) {
  const api = usePMVersionApi();
  return useQuery({
    queryKey: pmVersionKeys.versionData(versionGUID),
    queryFn: () => api.readVersionData(versionGUID as string),
    enabled: !!versionGUID && enabled,
    staleTime: NEVER_STALE,
  });
}

/** Mount once per screen (dashboard): keeps the version store of the selected project filled. */
export function useReadProjectVersionsQuery(projectGUID: string | null | undefined) {
  const api = usePMVersionApi();
  const hydrate = usePMVersionStore((s) => s.hydrateVersions);
  const query = useQuery({
    queryKey: pmVersionKeys.versions(projectGUID),
    queryFn: () => api.readProjectVersions(projectGUID as string),
    enabled: !!projectGUID,
  });

  useEffect(() => {
    usePMVersionStore.getState().resetProject(projectGUID ?? null);
  }, [projectGUID]);
  useEffect(() => {
    if (query.data && projectGUID) hydrate(projectGUID, query.data.rows, query.data.missing);
  }, [query.data, projectGUID, hydrate]);

  // checked versions = the user's saved setting (per project and user), limited to existing versions
  const savedChecked = usePMStore((s) => {
    if (!projectGUID) return '';
    const saved = s.userSettingsByProject[projectGUID]?.checkedProjectVersions ?? s.projectsById[projectGUID]?.rowJSON?.uxuiSettings?.checkedProjectVersions;
    return Array.isArray(saved) ? saved.join(',') : '';
  });
  const versions = usePMVersionStore((s) => s.versions);
  const loadedFor = usePMVersionStore((s) => s.projectGUID);
  useEffect(() => {
    if (!projectGUID || loadedFor !== projectGUID) return;
    usePMVersionStore.getState().setChecked(normalizeChecked(savedChecked ? savedChecked.split(',') : [], versions));
  }, [savedChecked, versions, projectGUID, loadedFor]);

  // tasks + dependencies of every checked version -> overlays of the Gantt
  const checked = usePMVersionStore((s) => s.checkedGUIDs);
  const dataQueries = useQueries({
    queries: checked.map((g) => ({
      queryKey: pmVersionKeys.versionData(g),
      queryFn: () => api.readVersionData(g),
      staleTime: NEVER_STALE,
    })),
  });
  const loadedKey = dataQueries.map((q) => (q.data ? q.data.versionGUID : '')).join(',');
  useEffect(() => {
    const st = usePMVersionStore.getState();
    for (const q of dataQueries) if (q.data) st.setVersionData(q.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  return query;
}
