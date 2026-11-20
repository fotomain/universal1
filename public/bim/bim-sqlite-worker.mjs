// The DEDICATED WORKER of the BIM local database (kit8/pm/bim/local/bimLocalDb.web.ts): the official SQLite WASM + the OPFS VFS "opfs-sahpool" (no COOP / COEP headers needed; it allows ONE
// connection, so only the LEADER window starts this worker - the other windows send their SQL to the leader through a BroadcastChannel). OPFS synchronous access exists in a dedicated
// worker only (a SharedWorker cannot use it). It is a thin SQL server: exec / all / batch (one transaction) / close, one database file per organization.
// Needs ./sqlite3.mjs + ./sqlite3.wasm next to it: `npm run bim:copy-wasm` copies them from node_modules/@sqlite.org/sqlite-wasm/dist (git-ignored).
import sqlite3InitModule from './sqlite3.mjs';

let ready = null;
const dbs = new Map();

function sqlite() {
  if (!ready) {
    ready = (async () => {
      const sqlite3 = await sqlite3InitModule();
      const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'kit8bim-sahpool', directory: '/kit8bim', initialCapacity: 6 });
      return { sqlite3, pool };
    })();
  }
  return ready;
}

async function open(name) {
  const { pool } = await sqlite();
  let db = dbs.get(name);
  if (!db) {
    db = new pool.OpfsSAHPoolDb(`/${name}.sqlite3`);
    dbs.set(name, db);
  }
  return db;
}

async function handle(m) {
  const db = await open(m.db);
  if (m.op === 'exec') {
    db.exec(m.sql);
    return null;
  }
  if (m.op === 'all') return db.exec({ sql: m.sql, bind: m.params || [], rowMode: 'object', returnValue: 'resultRows' });
  if (m.op === 'batch') {
    db.exec('BEGIN');
    try {
      for (const o of m.ops) {
        if (o.rows) {
          const st = db.prepare(o.sql);
          try {
            for (const r of o.rows) st.bind(r).stepReset();
          } finally {
            st.finalize();
          }
        } else db.exec({ sql: o.sql, bind: o.params || [] });
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return null;
  }
  if (m.op === 'close') {
    db.close();
    dbs.delete(m.db);
    return null;
  }
  throw new Error(`unknown op ${m.op}`);
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    self.postMessage({ id: m.id, ok: true, result: await handle(m) });
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
