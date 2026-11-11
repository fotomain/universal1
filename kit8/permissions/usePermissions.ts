// usePermissions(projectGUID?, taskGUID?) - what the signed-in user may do (kit8/permissions/README.md). One call of perm_my_matrix per project / task, cached in a small zustand store
// and shared by every component; the cache is cleared on a sign in / out and refreshed when an assignment changes (realtime, when the provider has it) and every 60 s.
// UNTIL THE ANSWER IS THERE (or without Supabase: tests, the first second) everything is allowed - the database refuses what is not allowed; the interface only hides or disables.
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { canObject, canTable, EMPTY_MATRIX, matrixOf, type MyMatrix, type PermLetter } from './permissionModel';

interface Entry {
  matrix: MyMatrix;
  at: number;
  loading: boolean;
}

interface PermStore {
  entries: Record<string, Entry>;
  put: (key: string, matrix: MyMatrix) => void;
  mark: (key: string) => void;
  clear: () => void;
}

export const usePermissionStore = create<PermStore>((set) => ({
  entries: {},
  put: (key, matrix) => set((s) => ({ entries: { ...s.entries, [key]: { matrix, at: Date.now(), loading: false } } })),
  mark: (key) => set((s) => ({ entries: { ...s.entries, [key]: { ...(s.entries[key] ?? { matrix: EMPTY_MATRIX, at: 0 }), loading: true } } })),
  clear: () => set({ entries: {} }),
}));

const STALE_MS = 60_000;
const keyOf = (project?: string | null, task?: string | null) => `${project || '-'}|${task || '-'}`;

// The provider module is loaded on first use, not at import: the screens that only list the drawer (and their tests) do not pull the whole data layer in just to ask for permissions.
let useSupabaseHook: (() => { supabase: any }) | null | undefined;
function useClient(): any {
  if (useSupabaseHook === undefined) {
    try {
      useSupabaseHook = require('../providers/WithSupabase').useSupabase;
    } catch {
      useSupabaseHook = null;
    }
  }
  if (!useSupabaseHook) return null;
  try {
    return useSupabaseHook().supabase;
  } catch {
    return null;
  }
}

export interface Permissions {
  /** the answer of the database is there (false = everything is allowed in the interface) */
  ready: boolean;
  profiles: string[];
  isAdmin: boolean;
  canCreateProject: boolean;
  /** table letter (C R U D) for the project / task of the hook */
  can: (table: string, letter: PermLetter) => boolean;
  /** letters of an interface object (permissionVendorInvoice ...) */
  canUi: (object: string, letter: PermLetter) => boolean;
  matrix: MyMatrix;
  refresh: () => void;
}

export function usePermissions(projectGUID?: string | null, taskGUID?: string | null): Permissions {
  const client = useClient();
  const key = keyOf(projectGUID, taskGUID);
  const entry = usePermissionStore((s) => s.entries[key]);

  const load = useCallback(async () => {
    if (!client || typeof client.rpc !== 'function') return;
    const store = usePermissionStore.getState();
    if (store.entries[key]?.loading) return;
    store.mark(key);
    try {
      const { data, error } = await client.rpc('perm_my_matrix', { p_project: projectGUID || null, p_task: taskGUID || null });
      if (error) throw error;
      usePermissionStore.getState().put(key, matrixOf(data));
    } catch {
      // no answer: the entry stays "not ready" and the interface stays open (the database decides)
      usePermissionStore.setState((s) => {
        const e = s.entries[key];
        if (!e) return s;
        return { entries: { ...s.entries, [key]: { ...e, loading: false } } };
      });
    }
  }, [client, key, projectGUID, taskGUID]);

  useEffect(() => {
    if (!client) return;
    const e = usePermissionStore.getState().entries[key];
    if (!e || (!e.loading && Date.now() - e.at > STALE_MS)) void load();
  }, [client, key, load]);

  useEffect(() => {
    if (!client) return undefined;
    let channel: any = null;
    let unsubscribe: any = null;
    try {
      const sub = client.auth?.onAuthStateChange?.(() => {
        usePermissionStore.getState().clear();
        void load();
      });
      unsubscribe = sub?.data?.subscription;
      if (typeof client.channel === 'function') {
        channel = client.channel(`perm-${key}`);
        const refetch = () => { void load(); };
        for (const table of ['project_permission_profile_user_table', 'task_user_permission_table']) {
          channel.on('postgres_changes', { event: '*', schema: 'public', table }, refetch);
        }
        channel.subscribe?.();
      }
    } catch {
      // realtime is optional
    }
    return () => {
      try { unsubscribe?.unsubscribe?.(); } catch { /* ignore */ }
      try { if (channel) client.removeChannel?.(channel); } catch { /* ignore */ }
    };
  }, [client, key, load]);

  const ready = !!entry && entry.at > 0;
  const matrix = entry?.matrix ?? EMPTY_MATRIX;
  const can = useCallback((table: string, letter: PermLetter) => !ready || canTable(matrix, table, letter), [ready, matrix]);
  const canUi = useCallback((object: string, letter: PermLetter) => !ready || canObject(matrix, object, letter), [ready, matrix]);

  return useMemo(
    () => ({ ready, profiles: matrix.profiles, isAdmin: ready ? matrix.isAdmin : true, canCreateProject: ready ? matrix.canCreateProject : true, can, canUi, matrix, refresh: () => { void load(); } }),
    [ready, matrix, can, canUi, load],
  );
}

/** the two letters every document form needs: Post / Unpost / change = U, Delete = D of the header table (global answer: the database checks the project of each line) */
export function useDocumentRights(headerTable: string, projectGUID?: string | null) {
  const p = usePermissions(projectGUID);
  return { canChange: p.can(headerTable, 'U'), canDelete: p.can(headerTable, 'D'), canCreate: p.can(headerTable, 'C'), ready: p.ready };
}
