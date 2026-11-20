// The local database of BIM: ONE implementation of the SQL (BimSqlLocalDb) run on sql.js (a real SQLite) and the memory twin - the same contract.
import initSqlJs from 'sql.js';
import { BimSqlLocalDb } from '../../kit8/pm/bim/local/bimLocalSql';
import { BimMemoryChunkCache, BimMemoryLocalDb } from '../../kit8/pm/bim/local/bimLocalMemory';
import type { BimLocalDb, BimSqlExecutor, BimSqlOp } from '../../kit8/pm/bim/local/bimLocalTypes';
import { bimLocalDbName, type BimElementRow, type BimManifest } from '../../kit8/pm/bim/model/bimModel';

async function sqlJsExecutor(): Promise<BimSqlExecutor> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  return {
    exec: async (sql) => void db.exec(sql),
    all: async (sql, params = []) => {
      const st = db.prepare(sql);
      try {
        st.bind(params as any[]);
        const out: any[] = [];
        while (st.step()) out.push(st.getAsObject());
        return out;
      } finally {
        st.free();
      }
    },
    batch: async (ops: BimSqlOp[]) => {
      db.exec('BEGIN');
      try {
        for (const op of ops) {
          const st = db.prepare(op.sql);
          try {
            for (const r of op.rows ?? [op.params ?? []]) {
              st.bind(r as any[]);
              st.step();
              st.reset();
            }
          } finally {
            st.free();
          }
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const manifest = (modelGUID: string, revision: number): BimManifest => ({
  model: { modelGUID, revision, sourceName: 'x.ifc', originShift: [0, 0, 0], bbox: [0, 0, 0, 1, 1, 1], counts: { elements: 3 } },
  storeys: [{ storeyGUID: 's1', ifcGuid: 'S1', name: 'L1', elevation: 0, orderInList: 1, stageGUID: 'stage1' }],
  chunks: [{ storeyGUID: 's1', contentHash: 'h1', part: 0, byteSize: 10, formatVersion: 1, vertexCount: 8, elementCount: 3, bboxMin: [0, 0, 0], bboxSize: [1, 1, 1], storagePath: 'p/m/h1.bimc' }],
});
const el = (i: number, taskGUID: string | null): BimElementRow => ({ ifcGuid: `E${i}`, ifcClass: 'IfcWall', name: `Wall ${i}`, typeName: 'T', storeyGUID: 's1', taskGUID, chunkHash: 'h1', elementNumber: i, bbox: [0, 0, 0, 1, 1, i] });

const backends: Array<[string, () => Promise<BimLocalDb>]> = [
  ['SQL (sql.js)', async () => new BimSqlLocalDb(await sqlJsExecutor(), 'sqlite-native')],
  ['memory twin', async () => new BimMemoryLocalDb()],
];

describe.each(backends)('BimLocalDb on %s', (_name, make) => {
  let db: BimLocalDb;
  beforeEach(async () => {
    db = await make();
  });

  it('nothing cached at the start', async () => {
    expect(await db.cachedModel('P')).toBeNull();
    expect(await db.loadManifest('P')).toBeNull();
  });

  it('saveModel keeps the manifest and the elements, in one go', async () => {
    await db.saveModel('P', manifest('M1', 1), [el(0, 'T1'), el(1, 'T1'), el(2, null)]);
    expect(await db.cachedModel('P')).toEqual({ modelGUID: 'M1', revision: 1 });
    expect((await db.loadManifest('P'))?.model.sourceName).toBe('x.ifc');
    const rows = await db.loadElements('M1');
    expect(rows.map((r) => r.ifcGuid)).toEqual(['E0', 'E1', 'E2']);
    expect(rows[2]).toMatchObject({ taskGUID: null, bbox: [0, 0, 0, 1, 1, 2], name: 'Wall 2' });
  });

  it('elements of tasks, the task of an element', async () => {
    await db.saveModel('P', manifest('M1', 1), [el(0, 'T1'), el(1, 'T1'), el(2, 'T2'), el(3, null)]);
    expect((await db.elementsOfTasks('M1', ['T1'])).sort()).toEqual(['E0', 'E1']);
    expect((await db.elementsOfTasks('M1', ['T1', 'T2'])).sort()).toEqual(['E0', 'E1', 'E2']);
    expect(await db.elementsOfTasks('M1', [])).toEqual([]);
    expect(await db.taskOfElement('M1', 'E2')).toEqual({ taskGUID: 'T2', storeyGUID: 's1' });
    expect(await db.taskOfElement('M1', 'E3')).toEqual({ taskGUID: null, storeyGUID: 's1' });
    expect(await db.taskOfElement('M1', 'nope')).toBeNull();
  });

  it('a stage with more than 999 tasks does not hit the SQLite parameter limit', async () => {
    const many = Array.from({ length: 1500 }, (_, i) => `T${i}`);
    await db.saveModel('P', manifest('M1', 1), [el(0, 'T1499'), el(1, 'T0')]);
    expect((await db.elementsOfTasks('M1', many)).sort()).toEqual(['E0', 'E1']);
  });

  it('a new revision replaces the old rows of the project', async () => {
    await db.saveModel('P', manifest('M1', 1), [el(0, 'T1'), el(1, 'T1')]);
    await db.saveModel('P', manifest('M2', 2), [el(0, 'T9')]);
    expect(await db.cachedModel('P')).toEqual({ modelGUID: 'M2', revision: 2 });
    expect(await db.loadElements('M1')).toEqual([]);
    expect((await db.loadElements('M2')).map((r) => r.taskGUID)).toEqual(['T9']);
  });

  it('two projects do not touch each other; forgetProject and wipe', async () => {
    await db.saveModel('P', manifest('M1', 1), [el(0, 'T1')]);
    await db.saveModel('Q', manifest('M7', 1), [el(0, 'T2'), el(1, 'T2')]);
    await db.forgetProject('P');
    expect(await db.cachedModel('P')).toBeNull();
    expect(await db.loadElements('M1')).toEqual([]);
    expect((await db.loadElements('M7')).length).toBe(2);
    await db.wipe();
    expect(await db.cachedModel('Q')).toBeNull();
    expect(await db.loadElements('M7')).toEqual([]);
  });

  it('10 000 elements in one save', async () => {
    const rows = Array.from({ length: 10000 }, (_, i) => el(i, `T${i % 50}`));
    await db.saveModel('P', manifest('M1', 1), rows);
    expect((await db.loadElements('M1')).length).toBe(10000);
    expect((await db.elementsOfTasks('M1', ['T3'])).length).toBe(200);
  });
});

describe('the chunk cache (memory twin) and the names', () => {
  it('get / put / prune / wipe', async () => {
    const c = new BimMemoryChunkCache();
    expect(await c.get('a')).toBeNull();
    await c.put('a', new Uint8Array([1]).buffer);
    await c.put('b', new Uint8Array([2]).buffer);
    expect(new Uint8Array((await c.get('a'))!)[0]).toBe(1);
    await c.prune(['b']);
    expect(await c.get('a')).toBeNull();
    expect(await c.get('b')).not.toBeNull();
    await c.wipe();
    expect(await c.get('b')).toBeNull();
  });

  it('one database per organization: kit8bimdb_<organizationGUID>', () => {
    expect(bimLocalDbName('0a1b-22')).toBe('kit8bimdb_0a1b-22');
    expect(bimLocalDbName(null)).toBe('kit8bimdb_none');
    expect(bimLocalDbName('a/b c')).toBe('kit8bimdb_a_b_c');
  });
});
