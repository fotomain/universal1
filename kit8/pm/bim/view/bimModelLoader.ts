// Loads a BIM model for the viewer, without React: manifest (cloud, else the local cache when offline) -> elements (local cache when the revision is the same, else the cloud in pages and
// saved locally in ONE transaction) -> chunks (file cache by content hash, else the cloud). The chunks are parsed as they arrive, so the first storey shows at once.
// Everything comes in through `deps`, so the order is tested without a network.
import { parseBimc, type BimcChunk } from '../bimc/bimcReader';
import type { BimCloud } from '../cloud/bimCloud';
import type { BimChunkInfo, BimElementRow, BimManifest } from '../model/bimModel';
import type { BimChunkCache, BimLocalDb } from '../local/bimLocalTypes';

export interface BimLoaderDeps {
  cloud: Pick<BimCloud, 'manifest' | 'elementsPage' | 'downloadChunk'>;
  local: BimLocalDb;
  chunkCache: BimChunkCache;
}

export interface BimLoadedModel {
  manifest: BimManifest;
  elements: BimElementRow[];
  /** where the manifest came from: the cloud, or the cache while the cloud could not be reached */
  source: 'cloud' | 'cache';
}

/** the manifest + the elements. Returns null when the project has no ready model (and forgets the cache of it). */
export async function loadBimModel(deps: BimLoaderDeps, projectGUID: string): Promise<BimLoadedModel | null> {
  let manifest: BimManifest | null;
  let source: 'cloud' | 'cache' = 'cloud';
  try {
    manifest = await deps.cloud.manifest(projectGUID);
  } catch (e) {
    // refused ("No permission") is an answer; anything else = no network: the cache may serve
    if (/No permission/i.test((e as Error)?.message || '')) {
      await deps.local.forgetProject(projectGUID);
      throw e;
    }
    manifest = await deps.local.loadManifest(projectGUID);
    if (!manifest) throw e;
    source = 'cache';
  }
  if (!manifest) {
    await deps.local.forgetProject(projectGUID);
    return null;
  }
  const cached = await deps.local.cachedModel(projectGUID);
  if (cached && cached.modelGUID === manifest.model.modelGUID) {
    const elements = await deps.local.loadElements(manifest.model.modelGUID);
    if (elements.length > 0) return { manifest, elements, source };
  }
  if (source === 'cache') throw new Error('The model is not cached on this device and the network is not there.');
  const elements: BimElementRow[] = [];
  let after: string | null = null;
  for (;;) {
    const page = await deps.cloud.elementsPage(manifest.model.modelGUID, after, 5000);
    elements.push(...page.rows);
    if (!page.next) break;
    after = page.next;
  }
  await deps.local.saveModel(projectGUID, manifest, elements);
  return { manifest, elements, source };
}

/** the order the chunks are fetched in: the storey of the selected task first (priorityStoreyGUID), then the rest by storey order and part */
export function chunkLoadOrder(manifest: BimManifest, priorityStoreyGUID?: string | null): BimChunkInfo[] {
  const rank = new Map(manifest.storeys.map((s) => [s.storeyGUID, s.orderInList]));
  return [...manifest.chunks].sort((a, b) => {
    const pa = priorityStoreyGUID && a.storeyGUID === priorityStoreyGUID ? 0 : 1;
    const pb = priorityStoreyGUID && b.storeyGUID === priorityStoreyGUID ? 0 : 1;
    return pa - pb || (rank.get(a.storeyGUID ?? '') ?? 1e9) - (rank.get(b.storeyGUID ?? '') ?? 1e9) || a.part - b.part;
  });
}

/** One chunk: the file cache first, else the cloud (and kept in the cache). A chunk that does not parse is dropped from the cache and fetched again once. */
export async function loadChunk(deps: Pick<BimLoaderDeps, 'cloud' | 'chunkCache'>, info: BimChunkInfo): Promise<BimcChunk> {
  const hit = await deps.chunkCache.get(info.contentHash);
  if (hit) {
    try {
      return parseBimc(hit);
    } catch {
      /* a damaged cache file: fetch it again */
    }
  }
  const bytes = await deps.cloud.downloadChunk(info.storagePath);
  const chunk = parseBimc(bytes);
  await deps.chunkCache.put(info.contentHash, bytes);
  return chunk;
}

/** all chunks, a few at a time; `onChunk` is called as each one is ready (in arrival order) */
export async function loadChunks(
  deps: Pick<BimLoaderDeps, 'cloud' | 'chunkCache'>,
  infos: BimChunkInfo[],
  onChunk: (hash: string, chunk: BimcChunk, done: number, total: number) => void,
  concurrency = 3,
  /** false = do not drop the cached files that are not in `infos` (the component screen loads ONE chunk of a bigger model) */
  prune = true
): Promise<void> {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < infos.length) {
      const info = infos[next++];
      const chunk = await loadChunk(deps, info);
      done++;
      onChunk(info.contentHash, chunk, done, infos.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, infos.length) }, worker));
  if (prune) await deps.chunkCache.prune(infos.map((i) => i.contentHash));
}
