// The generic entry (used by Jest and by any platform without a twin): the memory database. bimLocalDb.native.ts = expo-sqlite, bimLocalDb.web.ts = SQLite WASM + OPFS in a SharedWorker.
import { BimMemoryChunkCache, BimMemoryLocalDb } from './bimLocalMemory';
import type { BimChunkCache, BimLocalDb } from './bimLocalTypes';

export async function createBimLocalDb(_organizationGUID: string | null | undefined): Promise<BimLocalDb> {
  return new BimMemoryLocalDb();
}

export async function createBimChunkCache(_organizationGUID: string | null | undefined): Promise<BimChunkCache> {
  return new BimMemoryChunkCache();
}
