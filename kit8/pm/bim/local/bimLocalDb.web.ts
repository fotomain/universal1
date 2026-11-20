// Web: the official SQLite WASM with the OPFS VFS "opfs-sahpool" in a DEDICATED worker (public/bim/bim-sqlite-worker.mjs; OPFS synchronous access exists in dedicated workers only).
// A sahpool database allows ONE connection, and the app opens task windows and routes in new browser windows, so:
//   * LEADER: the window that gets the Web Lock "kit8bim-db-leader" starts the worker and answers the other windows;
//   * FOLLOWERS: every other window sends its SQL to the leader through a BroadcastChannel; when the leader window closes, a waiting follower gets the lock and becomes the leader.
// No Web Locks / no OPFS / the worker files are not deployed (npm run bim:copy-wasm) / the leader does not answer = the memory twin (nothing survives a reload, everything still works).
// The chunk files live in the Cache Storage of the browser.
import { bimLocalDbName } from '../model/bimModel';
import { BimMemoryChunkCache, BimMemoryLocalDb } from './bimLocalMemory';
import { BimSqlLocalDb } from './bimLocalSql';
import type { BimChunkCache, BimLocalDb, BimSqlExecutor, BimSqlOp, BimSqlValue } from './bimLocalTypes';

const WORKER_URL = '/bim/bim-sqlite-worker.mjs';
const LOCK = 'kit8bim-db-leader';
const CHANNEL = 'kit8bim-db-v1';
const CALL_TIMEOUT_MS = 20000;

/** one window = one Cluster: it knows whether it is the leader and sends every call the right way */
class DbCluster {
  private leader = false;
  private worker: Worker | null = null;
  private seq = 0;
  private waiting = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>();
  private channel: BroadcastChannel;
  private roleKnown: Promise<void>;
  private readonly me = Math.random().toString(36).slice(2);
  private workerReady: Promise<void> | null = null;

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL);
    let resolveRole!: () => void;
    this.roleKnown = new Promise<void>((r) => (resolveRole = r));
    this.channel.onmessage = (ev) => {
      const m = ev.data;
      if (m.kind === 'req' && this.leader) {
        this.callWorker(m.msg).then(
          (result) => this.channel.postMessage({ kind: 'res', to: m.from, id: m.id, ok: true, result }),
          (err) => this.channel.postMessage({ kind: 'res', to: m.from, id: m.id, ok: false, error: String(err?.message || err) })
        );
      } else if (m.kind === 'res' && m.to === this.me) {
        const w = this.waiting.get(m.id);
        if (!w) return;
        this.waiting.delete(m.id);
        if (m.ok) w.ok(m.result);
        else w.fail(new Error(m.error));
      }
    };
    const locks: LockManager = (navigator as any).locks;
    // first try: leader if the lock is free, else follower; then wait in the queue to take over when the leader closes
    locks.request(LOCK, { ifAvailable: true }, async (lock) => {
      if (lock) {
        this.leader = true;
        resolveRole();
        await new Promise<void>(() => {}); // held until the window closes
      } else {
        resolveRole();
        locks.request(LOCK, async () => {
          this.leader = true;
          await new Promise<void>(() => {});
        });
      }
    });
  }

  private startWorker(): Promise<void> {
    if (!this.workerReady) {
      this.worker = new Worker(WORKER_URL, { type: 'module' });
      this.worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        const w = this.waiting.get(m.id);
        if (!w) return;
        this.waiting.delete(m.id);
        if (m.ok) w.ok(m.result);
        else w.fail(new Error(m.error));
      };
      this.workerReady = Promise.resolve();
    }
    return this.workerReady;
  }

  private withTimeout<T>(p: Promise<T>, id: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, rej) =>
        setTimeout(() => {
          this.waiting.delete(id);
          rej(new Error('the BIM database did not answer'));
        }, CALL_TIMEOUT_MS)
      ),
    ]);
  }

  private callWorker(msg: Record<string, any>): Promise<any> {
    return this.startWorker().then(() => {
      const id = ++this.seq;
      const p = new Promise<any>((ok, fail) => this.waiting.set(id, { ok, fail }));
      this.worker!.postMessage({ id, ...msg });
      return this.withTimeout(p, id);
    });
  }

  async call(msg: Record<string, any>): Promise<any> {
    await this.roleKnown;
    if (this.leader) return this.callWorker(msg);
    const id = ++this.seq;
    const p = new Promise<any>((ok, fail) => this.waiting.set(id, { ok, fail }));
    this.channel.postMessage({ kind: 'req', from: this.me, id, msg });
    return this.withTimeout(p, id);
  }
}

let cluster: DbCluster | null = null;

function executorOf(db: string): BimSqlExecutor {
  const c = (cluster ??= new DbCluster());
  return {
    exec: (sql: string) => c.call({ db, op: 'exec', sql }),
    all: (sql: string, params: BimSqlValue[] = []) => c.call({ db, op: 'all', sql, params }),
    batch: (ops: BimSqlOp[]) => c.call({ db, op: 'batch', ops }),
    close: () => c.call({ db, op: 'close' }),
  };
}

export async function createBimLocalDb(organizationGUID: string | null | undefined): Promise<BimLocalDb> {
  try {
    if (typeof Worker === 'undefined' || typeof BroadcastChannel === 'undefined' || !(navigator as any).locks) throw new Error('no Web Locks / BroadcastChannel / Worker');
    const exec = executorOf(bimLocalDbName(organizationGUID));
    await exec.exec('SELECT 1'); // a worker whose files are missing, or a leader that is gone, never answers: the call times out
    return new BimSqlLocalDb(exec, 'sqlite-wasm-opfs');
  } catch {
    return new BimMemoryLocalDb();
  }
}

export async function createBimChunkCache(organizationGUID: string | null | undefined): Promise<BimChunkCache> {
  if (typeof caches === 'undefined') return new BimMemoryChunkCache();
  const name = `kit8bim-chunks-${bimLocalDbName(organizationGUID)}`;
  const key = (hash: string) => new Request(`https://kit8bim.local/chunk/${hash}`);
  return {
    async get(hash) {
      const hit = await (await caches.open(name)).match(key(hash));
      return hit ? hit.arrayBuffer() : null;
    },
    async put(hash, bytes) {
      await (await caches.open(name)).put(key(hash), new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
    },
    async prune(keepHashes) {
      const c = await caches.open(name);
      const keep = new Set(keepHashes.map((h) => key(h).url));
      for (const r of await c.keys()) if (!keep.has(r.url)) await c.delete(r);
    },
    async wipe() {
      await caches.delete(name);
    },
  };
}
