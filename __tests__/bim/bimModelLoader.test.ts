import { chunkLoadOrder, loadBimModel, loadChunk, loadChunks } from '../../kit8/pm/bim/view/bimModelLoader';
import { BimMemoryChunkCache, BimMemoryLocalDb } from '../../kit8/pm/bim/local/bimLocalMemory';
import type { BimElementRow, BimManifest } from '../../kit8/pm/bim/model/bimModel';
import { readChunkBytes, readExampleBundle } from './bimTestKit';

const b = readExampleBundle();
const manifest = (rev = 1): BimManifest => ({
  model: { modelGUID: 'M', revision: rev, sourceName: 'x', originShift: [0, 0, 0], bbox: b.model.bbox, counts: {} },
  storeys: b.storeys.map((s, i) => ({ storeyGUID: `s${i}`, ifcGuid: s.ifcGuid, name: s.name, elevation: s.elevation, orderInList: s.orderInList, stageGUID: null })),
  chunks: b.chunks.map((c) => ({ storeyGUID: `s${b.storeys.findIndex((s) => s.ifcGuid === c.storeyIfcGuid)}`, contentHash: c.hash, part: c.part, byteSize: c.byteSize, formatVersion: 1, vertexCount: c.vertexCount, elementCount: c.elementCount, bboxMin: c.bboxMin, bboxSize: c.bboxSize, storagePath: c.storagePath })),
});
const rows = (n: number): BimElementRow[] => Array.from({ length: n }, (_, i) => ({ ifcGuid: `E${i}`, ifcClass: 'IfcWall', name: '', typeName: '', storeyGUID: 's0', taskGUID: null, chunkHash: 'h', elementNumber: i, bbox: [0, 0, 0, 1, 1, 1] }));

function cloudOf(over: any = {}) {
  const calls: string[] = [];
  return {
    calls,
    cloud: {
      manifest: async () => (calls.push('manifest'), manifest()),
      elementsPage: async (_m: string, after: string | null) => (calls.push(`page:${after}`), after === null ? { rows: rows(5000), next: 'k1' } : { rows: rows(7), next: null }),
      downloadChunk: async (path: string) => (calls.push(`download:${path.split('/').pop()!.slice(0, 6)}`), readChunkBytes(path.split('/').pop()!.replace('.bimc', ''))),
      ...over,
    },
  };
}

describe('loadBimModel', () => {
  it('first time: the cloud in pages, saved locally; second time: the cache, no paging', async () => {
    const local = new BimMemoryLocalDb();
    const { cloud, calls } = cloudOf();
    const a = await loadBimModel({ cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P');
    expect(a?.elements.length).toBe(5007);
    expect(calls).toEqual(['manifest', 'page:null', 'page:k1']);
    expect(await local.cachedModel('P')).toEqual({ modelGUID: 'M', revision: 1 });
    calls.length = 0;
    const again = await loadBimModel({ cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P');
    expect(again?.elements.length).toBe(5007);
    expect(calls).toEqual(['manifest']);
  });

  it('a new revision in the cloud is paged again', async () => {
    const local = new BimMemoryLocalDb();
    const { cloud, calls } = cloudOf();
    await loadBimModel({ cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P');
    calls.length = 0;
    cloud.manifest = async () => manifest(2) as any;
    (cloud as any).manifest = async () => ({ ...manifest(2), model: { ...manifest(2).model, modelGUID: 'M2' } });
    await loadBimModel({ cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P');
    expect(calls).toEqual(['page:null', 'page:k1']);
    expect(await local.cachedModel('P')).toEqual({ modelGUID: 'M2', revision: 2 });
  });

  it('no model in the cloud: null, and the cache of the project is forgotten', async () => {
    const local = new BimMemoryLocalDb();
    await local.saveModel('P', manifest(), rows(2));
    const { cloud } = cloudOf({ manifest: async () => null });
    expect(await loadBimModel({ cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P')).toBeNull();
    expect(await local.cachedModel('P')).toBeNull();
  });

  it('no network: the cached model serves (source cache); nothing cached: the error', async () => {
    const local = new BimMemoryLocalDb();
    await local.saveModel('P', manifest(), rows(3));
    const offline = cloudOf({ manifest: async () => { throw new Error('Failed to fetch'); } });
    const out = await loadBimModel({ cloud: offline.cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P');
    expect(out?.source).toBe('cache');
    expect(out?.elements.length).toBe(3);
    await expect(loadBimModel({ cloud: offline.cloud, local: new BimMemoryLocalDb(), chunkCache: new BimMemoryChunkCache() }, 'Q')).rejects.toThrow('Failed to fetch');
  });

  it('"No permission" is an answer, not a network problem: the cache is dropped and the error is raised', async () => {
    const local = new BimMemoryLocalDb();
    await local.saveModel('P', manifest(), rows(3));
    const denied = cloudOf({ manifest: async () => { throw new Error('No permission: you cannot read the BIM model of this project'); } });
    await expect(loadBimModel({ cloud: denied.cloud, local, chunkCache: new BimMemoryChunkCache() }, 'P')).rejects.toThrow(/No permission/);
    expect(await local.cachedModel('P')).toBeNull();
  });
});

describe('chunks', () => {
  it('the storey of the selected task is loaded first, then by storey order', () => {
    const m = manifest();
    const order = chunkLoadOrder(m, 's2').map((c) => c.storeyGUID);
    expect(order[0]).toBe('s2');
    expect(chunkLoadOrder(m).map((c) => c.storeyGUID)).toEqual(['s0', 's1', 's2', 's3']);
  });

  it('a chunk is downloaded once ever: the second time it comes from the file cache; a damaged cache file is fetched again', async () => {
    const info = manifest().chunks[0];
    const { cloud, calls } = cloudOf();
    const cache = new BimMemoryChunkCache();
    await loadChunk({ cloud: cloud as any, chunkCache: cache }, info);
    await loadChunk({ cloud: cloud as any, chunkCache: cache }, info);
    expect(calls.filter((c) => c.startsWith('download'))).toHaveLength(1);
    await cache.put(info.contentHash, new ArrayBuffer(100));
    const c = await loadChunk({ cloud: cloud as any, chunkCache: cache }, info);
    expect(c.elementCount).toBe(info.elementCount);
    expect(calls.filter((x) => x.startsWith('download'))).toHaveLength(2);
  });

  it('loadChunks reports each chunk, in any order, and prunes the cache to the manifest', async () => {
    const { cloud } = cloudOf();
    const cache = new BimMemoryChunkCache();
    await cache.put('old-revision', new ArrayBuffer(4));
    const got: string[] = [];
    await loadChunks({ cloud: cloud as any, chunkCache: cache }, manifest().chunks, (h, _c, done, total) => got.push(`${done}/${total}`));
    expect(got.sort()).toEqual(['1/4', '2/4', '3/4', '4/4']);
    expect(await cache.get('old-revision')).toBeNull();
    expect(await cache.get(b.chunks[0].hash)).not.toBeNull();
  });

  it('loadChunks without prune (the component screen loads ONE chunk of a bigger model) keeps the other cached files', async () => {
    const { cloud } = cloudOf();
    const cache = new BimMemoryChunkCache();
    await cache.put('another-chunk-of-this-model', new ArrayBuffer(4));
    await loadChunks({ cloud: cloud as any, chunkCache: cache }, manifest().chunks.slice(0, 1), () => undefined, 3, false);
    expect(await cache.get('another-chunk-of-this-model')).not.toBeNull();
    expect(await cache.get(b.chunks[0].hash)).not.toBeNull();
  });
});
