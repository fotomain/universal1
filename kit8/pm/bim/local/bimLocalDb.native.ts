// iOS / Android: expo-sqlite, one database file per organization (kit8bimdb_<organizationGUID>), the chunk binaries as files of the document folder (bim/<org>/<hash>.bimc).
import * as SQLite from 'expo-sqlite';
import * as ExpoFileSystem from 'expo-file-system';
import { bimLocalDbName } from '../model/bimModel';
import { BimSqlLocalDb } from './bimLocalSql';
import type { BimChunkCache, BimLocalDb, BimSqlExecutor, BimSqlOp } from './bimLocalTypes';

function executorOf(name: string): BimSqlExecutor {
  let opened: Promise<SQLite.SQLiteDatabase> | null = null;
  const db = () => (opened ??= SQLite.openDatabaseAsync(name).then(async (d) => (await d.execAsync('PRAGMA journal_mode = WAL;'), d)));
  return {
    exec: async (sql) => (await db()).execAsync(sql),
    all: async (sql, params = []) => (await db()).getAllAsync(sql, params as any[]) as Promise<any[]>,
    batch: async (ops: BimSqlOp[]) => {
      const d = await db();
      await d.withTransactionAsync(async () => {
        for (const op of ops) {
          if (op.rows) {
            const st = await d.prepareAsync(op.sql);
            try {
              for (const r of op.rows) await st.executeAsync(r as any[]);
            } finally {
              await st.finalizeAsync();
            }
          } else await d.runAsync(op.sql, (op.params ?? []) as any[]);
        }
      });
    },
    close: async () => {
      if (opened) await (await opened).closeAsync();
      opened = null;
    },
  };
}

export async function createBimLocalDb(organizationGUID: string | null | undefined): Promise<BimLocalDb> {
  return new BimSqlLocalDb(executorOf(bimLocalDbName(organizationGUID)), 'sqlite-native');
}

// tsc resolves `.web` first, so expo-file-system shows its WEB typings (no File / Directory methods): the native classes are used through any (the pitfall of KNOW_HOW section 7)
const { Directory, File, Paths } = ExpoFileSystem as any;

const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');

export async function createBimChunkCache(organizationGUID: string | null | undefined): Promise<BimChunkCache> {
  const dir = new Directory(Paths.document, 'kit8bim', safe(String(organizationGUID || 'none')));
  const ensure = () => {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  };
  const fileOf = (hash: string) => new File(dir, `${safe(hash)}.bimc`);
  return {
    async get(hash) {
      ensure();
      const f = fileOf(hash);
      if (!f.exists) return null;
      const b = await f.bytes();
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    },
    async put(hash, bytes) {
      ensure();
      const f = fileOf(hash);
      if (f.exists) f.delete();
      f.create();
      f.write(new Uint8Array(bytes));
    },
    async prune(keep) {
      ensure();
      const k = new Set(keep.map((h) => `${safe(h)}.bimc`));
      for (const item of dir.list() as any[]) if (item instanceof File && !k.has(item.name)) item.delete();
    },
    async wipe() {
      if (dir.exists) dir.delete();
    },
  };
}
