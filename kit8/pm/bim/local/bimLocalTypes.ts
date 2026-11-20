// The local read cache of the BIM data (documentation/BIM_WBS.html section 7). Types only - a `.web.ts` must not import from its twin, so every file imports the types from here.
//   * database kit8bimdb_<organizationGUID>: one file per organization (bimLocalDbName); a switch of the organization opens another file, leaving an organization deletes one
//   * the same SQL on every platform: expo-sqlite on iOS / Android, the official SQLite WASM + OPFS (opfs-sahpool in a SharedWorker) on the web, a memory twin when neither is there
//   * it is a CACHE: the cloud (Supabase) is the truth; a new revision replaces the rows of the project in ONE transaction; the chunk binaries are FILES (bimChunkCache), not rows
import type { BimElementRow, BimManifest } from '../model/bimModel';

export type BimSqlValue = string | number | null;

/** one statement of a batch; `rows` = the same statement for many parameter rows (a prepared statement, one transaction) */
export interface BimSqlOp {
  sql: string;
  params?: BimSqlValue[];
  rows?: BimSqlValue[][];
}

/** the three things the local database needs from a SQLite: run a script, read rows, run a batch atomically */
export interface BimSqlExecutor {
  exec(sql: string): Promise<void>;
  all<T = Record<string, any>>(sql: string, params?: BimSqlValue[]): Promise<T[]>;
  /** all operations in ONE transaction (all or nothing) */
  batch(ops: BimSqlOp[]): Promise<void>;
  close?(): Promise<void>;
}

export interface BimCachedModel {
  modelGUID: string;
  revision: number;
}

export interface BimLocalDb {
  readonly kind: 'sqlite-native' | 'sqlite-wasm-opfs' | 'memory';
  /** the revision cached for the project, or null */
  cachedModel(projectGUID: string): Promise<BimCachedModel | null>;
  /** replaces everything cached for the project by this manifest + these elements (one transaction) */
  saveModel(projectGUID: string, manifest: BimManifest, elements: BimElementRow[]): Promise<void>;
  loadManifest(projectGUID: string): Promise<BimManifest | null>;
  loadElements(modelGUID: string): Promise<BimElementRow[]>;
  /** the IFC ids of the elements of these tasks (a stage is given as the ids of its tasks too) */
  elementsOfTasks(modelGUID: string, taskGUIDs: string[]): Promise<string[]>;
  taskOfElement(modelGUID: string, ifcGuid: string): Promise<{ taskGUID: string | null; storeyGUID: string | null } | null>;
  forgetProject(projectGUID: string): Promise<void>;
  /** everything (sign out, the user left the organization) */
  wipe(): Promise<void>;
  close(): Promise<void>;
}

/** the cache of the chunk binaries: the file name is the content hash, so a chunk is downloaded once ever */
export interface BimChunkCache {
  get(hash: string): Promise<ArrayBuffer | null>;
  put(hash: string, bytes: ArrayBuffer): Promise<void>;
  /** removes the chunks that are not in `keep` (an older revision); all of them when `keep` is empty */
  prune(keep: string[]): Promise<void>;
  wipe(): Promise<void>;
}
