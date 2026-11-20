// The local database of BIM, written ONCE against a tiny SQL executor (bimLocalTypes.BimSqlExecutor): expo-sqlite on a phone, SQLite WASM on the web, sql.js in the tests.
// The tables are the cloud ones in short (bim_cache_state_table, bim_storey_table, bim_chunk_table, bim_element_table).
import type { BimElementRow, BimManifest } from '../model/bimModel';
import type { BimCachedModel, BimLocalDb, BimSqlExecutor, BimSqlOp, BimSqlValue } from './bimLocalTypes';

export const BIM_LOCAL_SCHEMA_VERSION = 1;

export const BIM_LOCAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS bim_cache_state_table (projectGUID TEXT PRIMARY KEY, modelGUID TEXT NOT NULL, revision INTEGER NOT NULL, manifestJSON TEXT NOT NULL, lastOpened INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bim_element_table (
  modelGUID TEXT NOT NULL, ifcGuid TEXT NOT NULL, ifcClass TEXT, name TEXT, typeName TEXT, storeyGUID TEXT, taskGUID TEXT, chunkHash TEXT, elementNumber INTEGER, bbox TEXT,
  PRIMARY KEY (modelGUID, ifcGuid)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_bim_local_element_task ON bim_element_table (modelGUID, taskGUID);
`;

const ELEMENT_INSERT = 'INSERT OR REPLACE INTO bim_element_table (modelGUID, ifcGuid, ifcClass, name, typeName, storeyGUID, taskGUID, chunkHash, elementNumber, bbox) VALUES (?,?,?,?,?,?,?,?,?,?)';
const ELEMENT_ROWS_PER_OP = 5000;

const rowOf = (modelGUID: string, e: BimElementRow): BimSqlValue[] => [modelGUID, e.ifcGuid, e.ifcClass, e.name, e.typeName, e.storeyGUID, e.taskGUID, e.chunkHash, e.elementNumber, JSON.stringify(e.bbox)];

export class BimSqlLocalDb implements BimLocalDb {
  private ready: Promise<void> | null = null;
  constructor(private readonly sql: BimSqlExecutor, readonly kind: BimLocalDb['kind']) {}

  private init(): Promise<void> {
    if (!this.ready) this.ready = this.sql.exec(BIM_LOCAL_SCHEMA);
    return this.ready;
  }

  async cachedModel(projectGUID: string): Promise<BimCachedModel | null> {
    await this.init();
    const r = await this.sql.all<{ modelGUID: string; revision: number }>('SELECT modelGUID, revision FROM bim_cache_state_table WHERE projectGUID = ?', [projectGUID]);
    return r[0] ? { modelGUID: r[0].modelGUID, revision: Number(r[0].revision) } : null;
  }

  async saveModel(projectGUID: string, manifest: BimManifest, elements: BimElementRow[]): Promise<void> {
    await this.init();
    const old = await this.cachedModel(projectGUID);
    const ops: BimSqlOp[] = [];
    if (old) ops.push({ sql: 'DELETE FROM bim_element_table WHERE modelGUID = ?', params: [old.modelGUID] });
    ops.push({ sql: 'DELETE FROM bim_element_table WHERE modelGUID = ?', params: [manifest.model.modelGUID] });
    for (let i = 0; i < elements.length; i += ELEMENT_ROWS_PER_OP) ops.push({ sql: ELEMENT_INSERT, rows: elements.slice(i, i + ELEMENT_ROWS_PER_OP).map((e) => rowOf(manifest.model.modelGUID, e)) });
    ops.push({
      sql: 'INSERT OR REPLACE INTO bim_cache_state_table (projectGUID, modelGUID, revision, manifestJSON, lastOpened) VALUES (?,?,?,?,?)',
      params: [projectGUID, manifest.model.modelGUID, manifest.model.revision, JSON.stringify(manifest), Date.now()],
    });
    await this.sql.batch(ops);
  }

  async loadManifest(projectGUID: string): Promise<BimManifest | null> {
    await this.init();
    const r = await this.sql.all<{ manifestJSON: string }>('SELECT manifestJSON FROM bim_cache_state_table WHERE projectGUID = ?', [projectGUID]);
    if (!r[0]) return null;
    await this.sql.batch([{ sql: 'UPDATE bim_cache_state_table SET lastOpened = ? WHERE projectGUID = ?', params: [Date.now(), projectGUID] }]);
    return JSON.parse(r[0].manifestJSON) as BimManifest;
  }

  async loadElements(modelGUID: string): Promise<BimElementRow[]> {
    await this.init();
    const r = await this.sql.all<any>('SELECT * FROM bim_element_table WHERE modelGUID = ? ORDER BY chunkHash, elementNumber', [modelGUID]);
    return r.map((x) => ({ ifcGuid: x.ifcGuid, ifcClass: x.ifcClass ?? '', name: x.name ?? '', typeName: x.typeName ?? '', storeyGUID: x.storeyGUID ?? null, taskGUID: x.taskGUID ?? null, chunkHash: x.chunkHash, elementNumber: Number(x.elementNumber), bbox: JSON.parse(x.bbox || '[0,0,0,0,0,0]') }));
  }

  async elementsOfTasks(modelGUID: string, taskGUIDs: string[]): Promise<string[]> {
    await this.init();
    const out: string[] = [];
    // SQLite allows 999 parameters: ask in slices
    for (let i = 0; i < taskGUIDs.length; i += 400) {
      const part = taskGUIDs.slice(i, i + 400);
      const r = await this.sql.all<{ ifcGuid: string }>(`SELECT ifcGuid FROM bim_element_table WHERE modelGUID = ? AND taskGUID IN (${part.map(() => '?').join(',')})`, [modelGUID, ...part]);
      for (const x of r) out.push(x.ifcGuid);
    }
    return out;
  }

  async taskOfElement(modelGUID: string, ifcGuid: string): Promise<{ taskGUID: string | null; storeyGUID: string | null } | null> {
    await this.init();
    const r = await this.sql.all<{ taskGUID: string | null; storeyGUID: string | null }>('SELECT taskGUID, storeyGUID FROM bim_element_table WHERE modelGUID = ? AND ifcGuid = ?', [modelGUID, ifcGuid]);
    return r[0] ? { taskGUID: r[0].taskGUID ?? null, storeyGUID: r[0].storeyGUID ?? null } : null;
  }

  async forgetProject(projectGUID: string): Promise<void> {
    await this.init();
    const old = await this.cachedModel(projectGUID);
    const ops: BimSqlOp[] = [];
    if (old) ops.push({ sql: 'DELETE FROM bim_element_table WHERE modelGUID = ?', params: [old.modelGUID] });
    ops.push({ sql: 'DELETE FROM bim_cache_state_table WHERE projectGUID = ?', params: [projectGUID] });
    await this.sql.batch(ops);
  }

  async wipe(): Promise<void> {
    await this.init();
    await this.sql.batch([{ sql: 'DELETE FROM bim_element_table' }, { sql: 'DELETE FROM bim_cache_state_table' }]);
  }

  async close(): Promise<void> {
    await this.sql.close?.();
  }
}
