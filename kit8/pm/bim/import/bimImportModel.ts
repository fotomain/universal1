// BIM import, the PURE part: what the converter server returns (the bundle), how it becomes the rows of the bim_ RPCs, the project file that makes the tasks.
// documentation/BIM_WBS.html sections 3, 6 and 9. No React, no Supabase, no network.
import type { PMProjectExchangeFile } from '../../crud/exchange/project/projectExchangeFormat';
import type { BimModelInfo } from '../model/bimModel';

export type BimGranularity = 'auto' | 'element' | 'group';

export interface BimImportOptions {
  granularity: BimGranularity;
  /** skip the storeys that hold no element (default true) */
  skipEmptyStoreys: boolean;
  /** YYYY-MM-DD: the first working day of the imported plan (default today) */
  startDate?: string;
}

export const DEFAULT_BIM_IMPORT_OPTIONS: BimImportOptions = { granularity: 'auto', skipEmptyStoreys: true };

export interface BimBundleStorey {
  ifcGuid: string | null;
  name: string;
  elevation: number | null;
  orderInList: number;
  /** the stage task in the project FILE (not yet in the database: the importer gives every task a new id) */
  stageGUID: string | null;
}

export interface BimBundleChunk {
  hash: string;
  byteSize: number;
  storeyIfcGuid: string | null;
  part: number;
  formatVersion: number;
  vertexCount: number;
  elementCount: number;
  bboxMin: number[];
  bboxSize: number[];
  storagePath: string;
}

export interface BimBundleElement {
  ifcGuid: string;
  ifcClass: string;
  name: string;
  typeName: string;
  storeyIfcGuid: string | null;
  chunkHash: string;
  elementNumber: number;
  bbox: number[];
  /** the task in the project FILE */
  taskGUID: string | null;
}

export interface BimBundle {
  model: Omit<BimModelInfo, 'modelGUID' | 'revision'> & { projectName?: string; modelGUID?: string };
  storeys: BimBundleStorey[];
  chunks: BimBundleChunk[];
  elements: BimBundleElement[];
  properties: { ifcGuid: string; rowJSON: Record<string, any> }[];
  project: PMProjectExchangeFile;
  /** files the server made (a development server writes them to disk instead of Storage: uploaded = 0) */
  uploaded?: number;
}

export class BimImportError extends Error {}

/** the checks of a bundle before anything is written */
export function checkBundle(b: BimBundle): void {
  if (!b || !Array.isArray(b.chunks) || !Array.isArray(b.elements) || !Array.isArray(b.storeys) || !b.project) throw new BimImportError('The answer of the converter is not a BIM bundle.');
  if (b.elements.length === 0 || b.chunks.length === 0) throw new BimImportError('The model has no element with geometry.');
  const hashes = new Set(b.chunks.map((c) => c.hash));
  for (const e of b.elements) if (!hashes.has(e.chunkHash)) throw new BimImportError(`The element ${e.ifcGuid} points to a chunk that is not in the bundle.`);
  const taskIds = new Set(b.project.tasks.map((t) => t.rowGUID));
  for (const e of b.elements) if (e.taskGUID && !taskIds.has(e.taskGUID)) throw new BimImportError(`The element ${e.ifcGuid} points to a task that is not in the project file.`);
  if (b.project.dependencies.length > 0) throw new BimImportError('A BIM project file has no links between tasks.');
  if ((b.project.taskLines ?? []).length > 0) throw new BimImportError('A BIM project file has no task lines.');
}

export interface BimRowBatches {
  storeys: Record<string, any>[][];
  chunks: Record<string, any>[][];
  elements: Record<string, any>[][];
  properties: Record<string, any>[][];
  counts: { storeys: number; chunks: number; elements: number; properties: number };
}

export const BIM_ROW_BATCH = { storeys: 500, chunks: 500, elements: 3000, properties: 800 };

const slices = <T>(rows: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

/** The rows for bim_import_add_rows. `idMap` = file task id -> the id the importer gave the task (planProjectImport.idMap); `prefix` = storagePrefix of bim_import_begin. */
export function buildBimRows(b: BimBundle, idMap: Record<string, string>, prefix: string): BimRowBatches {
  const mapTask = (g: string | null | undefined) => (g ? idMap[g] ?? null : null);
  const storeys = b.storeys.map((s) => ({ ifcGuid: s.ifcGuid, name: s.name, elevation: s.elevation, orderInList: s.orderInList, stageGUID: mapTask(s.stageGUID) }));
  const chunks = b.chunks.map((c) => ({
    storeyIfcGuid: c.storeyIfcGuid, contentHash: c.hash, part: c.part, byteSize: c.byteSize, formatVersion: c.formatVersion, vertexCount: c.vertexCount, elementCount: c.elementCount,
    bboxMin: c.bboxMin, bboxSize: c.bboxSize, storagePath: `${prefix}/${c.hash}.bimc`,
  }));
  const elements = b.elements.map((e) => ({
    ifcGuid: e.ifcGuid, ifcClass: e.ifcClass, name: e.name, typeName: e.typeName, storeyIfcGuid: e.storeyIfcGuid, taskGUID: mapTask(e.taskGUID), chunkHash: e.chunkHash, elementNumber: e.elementNumber, bbox: e.bbox,
  }));
  const properties = (b.properties ?? []).map((p) => ({ ifcGuid: p.ifcGuid, rowJSON: p.rowJSON }));
  return {
    storeys: slices(storeys, BIM_ROW_BATCH.storeys),
    chunks: slices(chunks, BIM_ROW_BATCH.chunks),
    elements: slices(elements, BIM_ROW_BATCH.elements),
    properties: slices(properties, BIM_ROW_BATCH.properties),
    counts: { storeys: storeys.length, chunks: chunks.length, elements: elements.length, properties: properties.length },
  };
}

/** the facts of the converter the commit keeps in bim_model_table */
export function modelInfoOfBundle(b: BimBundle): Record<string, any> {
  const m = b.model;
  return { ifcSchema: m.ifcSchema, converterVersion: m.converterVersion, unitScale: m.unitScale, originShift: m.originShift, bbox: m.bbox, sourceSha256: m.sourceSha256 };
}

/** the storage paths a failed import may have uploaded (queued for removal by bim_import_fail) */
export const uploadedPathsOf = (b: BimBundle, prefix: string): string[] => b.chunks.map((c) => `${prefix}/${c.hash}.bimc`);

/** short text of a bundle for the preview before the import is confirmed */
export function bundleSummary(b: BimBundle): { storeys: number; stages: number; tasks: number; elements: number; chunks: number; bytes: number; granularity: string } {
  const stages = b.project.tasks.filter((t) => t.rowJSON.rowKind === 'stage').length;
  const tasks = b.project.tasks.filter((t) => t.rowJSON.rowKind === 'task').length;
  const g = b.project.tasks.some((t) => (t.rowJSON as any).bimGroupKey) ? 'one task per group (storey, class, type)' : 'one task per element';
  return { storeys: b.storeys.length, stages, tasks, elements: b.elements.length, chunks: b.chunks.length, bytes: b.chunks.reduce((n, c) => n + c.byteSize, 0), granularity: g };
}
