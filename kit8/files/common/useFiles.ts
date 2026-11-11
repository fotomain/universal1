// File attachments - the hooks of the Files tab: the list of a scope, the Drive state, may the user add, and the actions (they refresh every list). Plain React state with a small
// change counter - no React Query provider is needed, so the hooks work in every screen and every test that renders the Finances view.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authorizeFiles, fetchAllDriveStatus, fetchStorageUsed, listDocumentTypes, listVersions, moveFile, replacePickedFile, repairHealth, runHealthCheck, type DocumentType, type FileVersion, type StorageUsed, addLink, deleteFileRow, fetchDriveStatus, fetchDownloadUrl, listFiles, reorderFiles, startDriveConnect, updateFile, uploadPickedFile, disconnectDrive, runDriveCleanup, type DriveStatus, type FileTarget, type PickedFile } from './filesDriveApi';
import type { FileRow, FileStorageProvider } from './fileModel';


const NO_FILES: FileRow[] = [];

// every list and the Drive state read again after an action (upload, delete, edit ...) of any panel
let version = 0;
const listeners = new Set<() => void>();
export const bumpFiles = (): void => {
  version++;
  listeners.forEach((l) => l());
};
function useFilesVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}

const targetKey = (t: FileTarget) => `${t.scope}|${t.guid ?? ''}|${t.projectGUID ?? ''}`;

export function useFilesList(target: FileTarget, enabled = true) {
  const v = useFilesVersion();
  const key = targetKey(target);
  const [state, setState] = useState<{ rows: FileRow[]; loading: boolean; error: string | null }>({ rows: NO_FILES, loading: false, error: null });
  const on = enabled && (target.scope === 'organization' || !!target.guid);
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!on) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    listFiles(targetRef.current).then((r) => {
      if (!alive) return;
      setState(r.ok ? { rows: (r.data || NO_FILES) as FileRow[], loading: false, error: null } : { rows: NO_FILES, loading: false, error: r.error });
    });
    return () => { alive = false; };
  }, [on, key, v]);
  return { rows: state.rows, loading: state.loading, error: state.error };
}

/** may the signed-in user add / change files here (files_authorize, the same rule as every action) */
export function useCanChangeFiles(target: FileTarget, enabled = true) {
  const key = targetKey(target);
  const [state, setState] = useState<{ allowed: boolean; reason: string | null; loading: boolean }>({ allowed: false, reason: null, loading: false });
  const on = enabled && (target.scope === 'organization' || !!target.guid);
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!on) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    authorizeFiles('add', targetRef.current).then((r) => {
      if (alive) setState(r.ok ? { allowed: r.data?.allowed === true, reason: r.data?.reason || null, loading: false } : { allowed: false, reason: 'error', loading: false });
    });
    return () => { alive = false; };
  }, [on, key]);
  return { canChange: state.allowed, reason: state.reason, loading: state.loading };
}

/** the connection of ONE storage (default Google Drive); a change of the storage re-reads it */
export function useDriveStatus(enabled = true, provider: FileStorageProvider = 'googleDrive') {
  const v = useFilesVersion();
  const [state, setState] = useState<{ status: DriveStatus | null; loading: boolean; error: string | null }>({ status: null, loading: false, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetchDriveStatus(provider === 'googleDrive' ? undefined : provider).then((r) => {
      if (alive) setState(r.ok ? { status: r.data as DriveStatus, loading: false, error: null } : { status: null, loading: false, error: r.error });
    });
    return () => { alive = false; };
  }, [enabled, v, tick, provider]);
  return { status: state.status, loading: state.loading, error: state.error };
}

/** both storages at once (the connection blocks of Project settings -> Files) */
export function useAllDriveStatus(enabled = true) {
  const v = useFilesVersion();
  const [state, setState] = useState<{ all: { googleDrive: DriveStatus; oneDrive: DriveStatus } | null; error: string | null }>({ all: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchAllDriveStatus().then((r) => { if (alive) setState(r.ok ? { all: r.data, error: null } : { all: null, error: r.error }); });
    return () => { alive = false; };
  }, [enabled, v]);
  return state;
}

export function useFilesActions(target: FileTarget) {
  const targetRef = useRef(target);
  targetRef.current = target;
  return useMemo(
    () => ({
      uploadFile: async (file: PickedFile, onProgress?: (f: number) => void, signal?: { aborted: boolean }) => { const r = await uploadPickedFile(targetRef.current, file, { onProgress, signal }); bumpFiles(); return r; },
      addLink: async (url: string, title?: string) => { const r = await addLink(targetRef.current, url, title); bumpFiles(); return r; },
      updateFile: async (postGUID: string, patch: Record<string, any>) => { const r = await updateFile(postGUID, patch); bumpFiles(); return r; },
      deleteFile: async (postGUID: string) => { const r = await deleteFileRow(postGUID); bumpFiles(); return r; },
      reorder: async (ids: string[]) => { const r = await reorderFiles(ids); bumpFiles(); return r; },
      openUrl: (postGUID: string) => fetchDownloadUrl(postGUID),
      replaceFile: async (row: FileRow, file: PickedFile, onProgress?: (f: number) => void) => { const r = await replacePickedFile(row, file, { onProgress }); bumpFiles(); return r; },
      moveFile: async (postGUID: string, to: FileTarget) => { const r = await moveFile(postGUID, to); bumpFiles(); return r; },
      healthCheck: (provider?: FileStorageProvider) => runHealthCheck(provider),
      healthRepair: async (missing: string[], orphans: string[], provider?: FileStorageProvider) => { const r = await repairHealth(missing, orphans, provider); bumpFiles(); return r; },
      connect: (provider?: FileStorageProvider) => startDriveConnect(provider),
      disconnect: async (provider?: FileStorageProvider) => { const r = await disconnectDrive(provider); bumpFiles(); return r; },
      cleanup: async () => { const r = await runDriveCleanup(); bumpFiles(); return r; },
      refresh: bumpFiles,
    }),
    [],
  );
}

/** the document types (the seeded ones + the organization's own) */
export function useDocumentTypes(enabled = true) {
  const [types, setTypes] = useState<DocumentType[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listDocumentTypes().then((r) => { if (alive && r.ok) setTypes(r.data); });
    return () => { alive = false; };
  }, [enabled]);
  return types;
}

/** storage used by the files of the organization (S8), read again after every action */
export function useStorageUsed(enabled = true): StorageUsed | null {
  const v = useFilesVersion();
  const [used, setUsed] = useState<StorageUsed | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchStorageUsed('organization').then((r) => { if (alive && r.ok) setUsed(r.data); });
    return () => { alive = false; };
  }, [enabled, v]);
  return used;
}

/** the old versions of a replaced file (S4); read when `postGUID` is set */
export function useFileVersions(postGUID: string | null): FileVersion[] {
  const [rows, setRows] = useState<FileVersion[]>([]);
  useEffect(() => {
    if (!postGUID) { setRows([]); return; }
    let alive = true;
    listVersions(postGUID).then((r) => { if (alive) setRows(r.ok ? (r.data || []) : []); });
    return () => { alive = false; };
  }, [postGUID]);
  return rows;
}
