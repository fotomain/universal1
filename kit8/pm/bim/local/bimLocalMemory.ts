// The memory twin of the local database: used when neither expo-sqlite nor the SQLite WASM worker is there (a Jest test, a browser without OPFS). Nothing survives a reload.
import type { BimElementRow, BimManifest } from '../model/bimModel';
import type { BimCachedModel, BimChunkCache, BimLocalDb } from './bimLocalTypes';

export class BimMemoryLocalDb implements BimLocalDb {
  readonly kind = 'memory' as const;
  private manifests = new Map<string, BimManifest>();
  private elements = new Map<string, BimElementRow[]>();

  async cachedModel(projectGUID: string): Promise<BimCachedModel | null> {
    const m = this.manifests.get(projectGUID);
    return m ? { modelGUID: m.model.modelGUID, revision: m.model.revision } : null;
  }
  async saveModel(projectGUID: string, manifest: BimManifest, elements: BimElementRow[]): Promise<void> {
    const old = this.manifests.get(projectGUID);
    if (old) this.elements.delete(old.model.modelGUID);
    this.manifests.set(projectGUID, manifest);
    this.elements.set(manifest.model.modelGUID, elements.map((e) => ({ ...e })));
  }
  async loadManifest(projectGUID: string): Promise<BimManifest | null> {
    return this.manifests.get(projectGUID) ?? null;
  }
  async loadElements(modelGUID: string): Promise<BimElementRow[]> {
    return (this.elements.get(modelGUID) ?? []).map((e) => ({ ...e }));
  }
  async elementsOfTasks(modelGUID: string, taskGUIDs: string[]): Promise<string[]> {
    const set = new Set(taskGUIDs);
    return (this.elements.get(modelGUID) ?? []).filter((e) => e.taskGUID && set.has(e.taskGUID)).map((e) => e.ifcGuid);
  }
  async taskOfElement(modelGUID: string, ifcGuid: string) {
    const e = (this.elements.get(modelGUID) ?? []).find((x) => x.ifcGuid === ifcGuid);
    return e ? { taskGUID: e.taskGUID, storeyGUID: e.storeyGUID } : null;
  }
  async forgetProject(projectGUID: string): Promise<void> {
    const old = this.manifests.get(projectGUID);
    if (old) this.elements.delete(old.model.modelGUID);
    this.manifests.delete(projectGUID);
  }
  async wipe(): Promise<void> {
    this.manifests.clear();
    this.elements.clear();
  }
  async close(): Promise<void> {}
}

export class BimMemoryChunkCache implements BimChunkCache {
  private files = new Map<string, ArrayBuffer>();
  async get(hash: string) {
    return this.files.get(hash) ?? null;
  }
  async put(hash: string, bytes: ArrayBuffer) {
    this.files.set(hash, bytes);
  }
  async prune(keep: string[]) {
    const k = new Set(keep);
    for (const h of [...this.files.keys()]) if (!k.has(h)) this.files.delete(h);
  }
  async wipe() {
    this.files.clear();
  }
}
