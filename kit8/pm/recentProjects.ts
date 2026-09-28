// The project ribbon shows only the LAST SELECTED projects (not every project in the
// database). The set + the last selected project are stored in AsyncStorage separately
// for each user:  key = "pm.recentProjects.v1.<userGUID>"  value = { recent, selected }.

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePMStore } from './store';

interface Saved {
  recent: string[];
  selected: string | null;
}

export const recentProjectsKey = (userGUID: string) => `pm.recentProjects.v1.${userGUID}`;

async function load(userGUID: string): Promise<Saved | null> {
  try {
    const raw = await AsyncStorage.getItem(recentProjectsKey(userGUID));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return { recent: Array.isArray(v?.recent) ? v.recent.filter((g: unknown) => typeof g === 'string') : [], selected: typeof v?.selected === 'string' ? v.selected : null };
  } catch {
    return null;
  }
}

async function save(userGUID: string, value: Saved) {
  try {
    await AsyncStorage.setItem(recentProjectsKey(userGUID), JSON.stringify(value));
  } catch {
    // best effort: the ribbon still works for this session
  }
}

/**
 * Restores (once per user, after the projects list arrived) the ribbon + the last selected
 * project, then persists every change. Falls back to the first project when nothing
 * was saved yet, so a first visit still opens a project.
 */
export function useRecentProjects(userGUID: string, projectsLoaded: boolean) {
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userGUID || !projectsLoaded || restoredFor.current === userGUID) return;
    let alive = true;
    load(userGUID).then((saved) => {
      if (!alive) return;
      restoredFor.current = userGUID;
      const s = usePMStore.getState();
      const exists = (g: string | null | undefined): g is string => !!g && !!s.projectsById[g];
      const recent = (saved?.recent || []).filter(exists);
      // keep whatever got selected meanwhile (deep link / demo), otherwise restore
      let selected = exists(s.selectedProjectGUID) ? s.selectedProjectGUID : null;
      if (!selected) selected = exists(saved?.selected) ? saved!.selected : recent[0] ?? (saved ? null : s.projectOrder[0] ?? null);
      s.setRecentProjects(selected && !recent.includes(selected) ? [...recent, selected] : recent);
      if (selected && selected !== s.selectedProjectGUID) s.selectProject(selected);
    });
    return () => {
      alive = false;
    };
  }, [userGUID, projectsLoaded]);

  useEffect(() => {
    if (!userGUID) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = usePMStore.subscribe((state, prev) => {
      if (restoredFor.current !== userGUID) return; // never overwrite before restoring
      if (state.recentProjectGUIDs === prev.recentProjectGUIDs && state.selectedProjectGUID === prev.selectedProjectGUID) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const s = usePMStore.getState();
        save(userGUID, { recent: s.recentProjectGUIDs, selected: s.selectedProjectGUID });
      }, 200);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [userGUID]);
}
