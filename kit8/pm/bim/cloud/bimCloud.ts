// The cloud side of BIM = Supabase (owner decision Q6 / Q7, 2026-11-20): the bim_ RPCs of SQL PART 55 and the private Storage bucket "bim". Qdrant is not used.
// One small interface (BimCloud) so a screen or a test never touches the client; createBimCloud(sb) is the Supabase adapter.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BIM_BUCKET, type BimElementRow, type BimManifest } from '../model/bimModel';

export interface BimBegin {
  modelGUID: string;
  revision: number;
  storagePrefix: string;
  organizationGUID?: string;
}

export interface BimCopyBegin {
  modelGUID: string;
  revision: number;
  storagePrefix: string;
  /** the chunk files to copy: the path in the source folder -> the path in the folder of the copy */
  files: { from: string; to: string }[];
  counts: Record<string, number>;
}

export interface BimElementsPage {
  rows: BimElementRow[];
  next: string | null;
}

export interface BimCloud {
  begin(projectGUID: string, sourceName: string, sha256?: string | null, options?: Record<string, any>): Promise<BimBegin>;
  addRows(modelGUID: string, kind: 'storeys' | 'chunks' | 'elements' | 'properties', rows: Record<string, any>[]): Promise<number>;
  commit(modelGUID: string, counts: Record<string, number>, info: Record<string, any>): Promise<{ modelGUID: string; revision: number; counts: Record<string, number> }>;
  fail(modelGUID: string, text: string, paths: string[]): Promise<void>;
  /** bim_copy_begin: copies the rows of the ready model of `source` into a new importing model of `target` (idMap: old task guid -> new task guid); null = the source has no model */
  copyBegin(sourceProjectGUID: string, targetProjectGUID: string, idMap: Record<string, string>): Promise<BimCopyBegin | null>;
  /** Storage copy of one chunk file inside the bucket (the folder of the copy is open for the caller until the commit) */
  copyFile(from: string, to: string): Promise<void>;
  /** removes ALL BIM data of the project; answers the file paths (removeFiles removes them) */
  deleteModel(projectGUID: string): Promise<string[]>;
  manifest(projectGUID: string): Promise<BimManifest | null>;
  elementsPage(modelGUID: string, after: string | null, limit?: number): Promise<BimElementsPage>;
  property(modelGUID: string, ifcGuid: string): Promise<Record<string, any> | null>;
  /** the bytes of one chunk file */
  downloadChunk(storagePath: string): Promise<ArrayBuffer>;
  /** Storage API remove + the confirmation of the queue */
  removeFiles(paths: string[]): Promise<void>;
  /** the files that wait for removal and that this user may remove (a deleted project's files stay with the service script) */
  pendingFiles(): Promise<string[]>;
}

const raise = (e: { message?: string } | null | undefined) => {
  if (e) throw new Error(e.message || 'The database refused the request.');
};

export function createBimCloud(sb: SupabaseClient): BimCloud {
  const rpc = async <T = any>(name: string, args: Record<string, any>): Promise<T> => {
    const { data, error } = await sb.rpc(name, args);
    raise(error);
    return data as T;
  };
  return {
    begin: (p, name, sha, options) => rpc<BimBegin>('bim_import_begin', { p_project: p, p_source_name: name, p_source_sha256: sha ?? null, p_options: options ?? {} }),
    addRows: (m, kind, rows) => rpc<number>('bim_import_add_rows', { p_model: m, p_kind: kind, p_rows: rows }),
    commit: (m, counts, info) => rpc('bim_import_commit', { p_model: m, p_counts: counts, p_model_info: info }),
    copyBegin: async (s, t, idMap) => (await rpc<BimCopyBegin | null>('bim_copy_begin', { p_source: s, p_target: t, p_task_map: idMap })) ?? null,
    copyFile: async (from, to) => {
      const { error } = await sb.storage.from(BIM_BUCKET).copy(from, to);
      raise(error);
    },
    fail: async (m, text, paths) => {
      await rpc('bim_import_fail', { p_model: m, p_error: text, p_paths: paths });
    },
    deleteModel: async (p) => {
      const out = await rpc<{ paths: string[] }>('bim_delete_model', { p_project: p });
      return out?.paths ?? [];
    },
    manifest: (p) => rpc<BimManifest | null>('bim_model_manifest', { p_project: p }),
    elementsPage: (m, after, limit = 5000) => rpc<BimElementsPage>('bim_elements_page', { p_model: m, p_after: after, p_limit: limit }),
    property: (m, g) => rpc('bim_property_get', { p_model: m, p_ifc_guid: g }),
    downloadChunk: async (path) => {
      const { data, error } = await sb.storage.from(BIM_BUCKET).createSignedUrl(path, 3600);
      raise(error);
      const res = await fetch(data!.signedUrl);
      if (!res.ok) throw new Error(`The chunk could not be downloaded (${res.status}).`);
      return res.arrayBuffer();
    },
    removeFiles: async (paths) => {
      if (!paths.length) return;
      const { error } = await sb.storage.from(BIM_BUCKET).remove(paths);
      raise(error);
      await rpc('bim_storage_cleanup_confirm', { p_paths: paths });
    },
    pendingFiles: async () => (await rpc<string[]>('bim_storage_cleanup_pending', { p_limit: 200 })) ?? [],
  };
}
