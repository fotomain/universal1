// The project PACKAGE: one zip that carries a project WITH its BIM model (BUILT 2026-11-20, README.md of this folder).
//
//   project_package_<project guid>.zip
//     package.json                      kit8.pm.package v1: what is in it (counts, flags)
//     project_data_<guid>.json          the ordinary exchange file (kit8.pm.project v1: project, tasks, dependencies, TASK LINES, Gantt settings) - an old app can read this entry on its own
//     csv/*.csv                         the same data as CSV files for people (project, tasks, dependencies, task_lines, bim_*; csvExport.ts) - the import never reads them
//     bim/manifest.json                 kit8.pm.bim v1: the model facts, the storeys (with the stage task of the file), the chunks (hash, size, counts, bbox)
//     bim/elements.ndjson               one element per line (BimBundleElement: the task is the task of the FILE)
//     bim/properties.ndjson             OPTIONAL, one { ifcGuid, rowJSON } per line (the IFC properties are large: an option)
//     bim/chunks/<content hash>.bimc    the geometry files (BIMC v1), exactly as in Storage
//
// The BIM part is the shape the converter's bundle already has (BimBundle), so the import is the BIM importer's own row path (buildBimRows + bim_import_*), with the task ids of the file mapped to
// the ones the importer gives the tasks. Pure (no React / Supabase / network): unit-tested in __tests__/pm/crud/exchange/projectPackage.test.ts.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { BimBundle, BimBundleChunk, BimBundleElement, BimBundleStorey } from '../../../../bim/import/bimImportModel';
import type { BimManifest } from '../../../../bim/model/bimModel';
import { buildCsvEntries } from './csvExport';
import { parseProjectExchangeFile, PMProjectExchangeError, projectDataFileName, type PMProjectExchangeFile } from '../projectExchangeFormat';

export const PM_PACKAGE_FORMAT = 'kit8.pm.package';
export const PM_PACKAGE_VERSION = 1;
export const PM_BIM_PART_FORMAT = 'kit8.pm.bim';
export const PM_BIM_PART_VERSION = 1;

export const projectPackageFileName = (projectGUID: string): string => `project_package_${projectGUID}.zip`;
export const isProjectPackageFileName = (name: string | undefined | null): boolean => /\.zip$/i.test(name || '');

export const PACKAGE_ENTRY = {
  manifest: 'package.json',
  bimManifest: 'bim/manifest.json',
  elements: 'bim/elements.ndjson',
  properties: 'bim/properties.ndjson',
  chunk: (hash: string) => `bim/chunks/${hash}.bimc`,
} as const;

/** a zip starts with PK 03 04 (an empty one with PK 05 06) */
export const isZipBytes = (b: Uint8Array | ArrayBuffer | null | undefined): boolean => {
  if (!b) return false;
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  return u.length >= 4 && u[0] === 0x50 && u[1] === 0x4b && (u[2] === 3 || u[2] === 5) && (u[3] === 4 || u[3] === 6);
};

/** what the user asks for in the Export tab */
export interface PMExportOptions {
  /** the Time / Material / Expense / Revenue lines of the tasks (default true: without them an export loses the whole budget) */
  taskLines: boolean;
  /** the BIM model of the project (stages and tasks are in the file anyway; this adds the 3D model) */
  bim: boolean;
  /** the IFC properties of the elements (large: tens of MB for a big model) */
  bimProperties: boolean;
}
// BIM properties are ON by default (owner 2026-11-20): a package carries the element properties unless the user switches them off
export const DEFAULT_EXPORT_OPTIONS: PMExportOptions = { taskLines: true, bim: true, bimProperties: true };

export interface PMPackageManifest {
  format: typeof PM_PACKAGE_FORMAT;
  version: number;
  exportedAt: string;
  projectGUID: string;
  projectName: string;
  /** the entry of the exchange file */
  projectFile: string;
  tasks: number;
  taskLines: number;
  /** the entries of the csv/ folder */
  csvFiles?: string[];
  bim?: { storeys: number; chunks: number; elements: number; properties: number; bytes: number; propertiesIncluded: boolean; sourceName: string };
}

/** bim/manifest.json: the model without its rows (those are the ndjson files) */
export interface PMBimPartManifest {
  format: typeof PM_BIM_PART_FORMAT;
  version: number;
  model: BimBundle['model'];
  storeys: BimBundleStorey[];
  /** `storagePath` is not stored: the import uploads to the folder of its own model */
  chunks: Omit<BimBundleChunk, 'storagePath'>[];
  propertiesIncluded: boolean;
}

/** what the export reads out of a project's BIM model (bimExportRead.ts) in the shape of the BIM bundle */
export interface PMBimExportData {
  model: BimBundle['model'];
  storeys: BimBundleStorey[];
  chunks: BimBundleChunk[];
  elements: BimBundleElement[];
  properties: { ifcGuid: string; rowJSON: Record<string, any> }[];
  propertiesIncluded: boolean;
  /** content hash -> the bytes of the chunk file */
  chunkBytes: Map<string, Uint8Array>;
}

const ndjson = (rows: unknown[]): Uint8Array => strToU8(rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
const readNdjson = <T>(u: Uint8Array | undefined): T[] =>
  !u ? [] : strFromU8(u).split('\n').filter((l) => l.trim().length > 0).map((l, i) => {
    try { return JSON.parse(l) as T; } catch { throw new PMProjectExchangeError(`The package is damaged: line ${i + 1} of a BIM list is not valid.`); }
  });

/** the entries of the zip (not compressed yet) */
export function buildPackageEntries(file: PMProjectExchangeFile, bim: PMBimExportData | null, now: Date = new Date()): Record<string, Uint8Array> {
  const projectEntry = projectDataFileName(file.project.rowGUID);
  const entries: Record<string, Uint8Array> = {};
  const manifest: PMPackageManifest = {
    format: PM_PACKAGE_FORMAT, version: PM_PACKAGE_VERSION, exportedAt: now.toISOString(), projectGUID: file.project.rowGUID, projectName: file.project.rowJSON?.name || '',
    projectFile: projectEntry, tasks: file.tasks.length, taskLines: (file.taskLines ?? []).length,
  };
  entries[projectEntry] = strToU8(JSON.stringify(file));
  if (bim) {
    manifest.bim = {
      storeys: bim.storeys.length, chunks: bim.chunks.length, elements: bim.elements.length, properties: bim.properties.length,
      bytes: bim.chunks.reduce((n, c) => n + c.byteSize, 0), propertiesIncluded: bim.propertiesIncluded, sourceName: String((bim.model as any).sourceName || ''),
    };
    const part: PMBimPartManifest = {
      format: PM_BIM_PART_FORMAT, version: PM_BIM_PART_VERSION, model: bim.model, storeys: bim.storeys,
      chunks: bim.chunks.map(({ storagePath: _s, ...c }) => c), propertiesIncluded: bim.propertiesIncluded,
    };
    entries[PACKAGE_ENTRY.bimManifest] = strToU8(JSON.stringify(part));
    entries[PACKAGE_ENTRY.elements] = ndjson(bim.elements);
    if (bim.propertiesIncluded) entries[PACKAGE_ENTRY.properties] = ndjson(bim.properties);
    for (const c of bim.chunks) {
      const bytes = bim.chunkBytes.get(c.hash);
      if (!bytes) throw new PMProjectExchangeError(`The chunk ${c.hash} of the BIM model was not read.`);
      entries[PACKAGE_ENTRY.chunk(c.hash)] = bytes;
    }
  }
  const csv = buildCsvEntries(file, bim);
  manifest.csvFiles = Object.keys(csv);
  Object.assign(entries, csv);
  entries[PACKAGE_ENTRY.manifest] = strToU8(JSON.stringify(manifest, null, 2));
  return entries;
}

/** the zip: the JSON / ndjson entries are compressed, the chunk files (already dense binary) with a light level */
export function packZip(entries: Record<string, Uint8Array>): Uint8Array {
  const z: Zippable = {};
  for (const [name, data] of Object.entries(entries)) z[name] = [data, { level: name.endsWith('.bimc') ? 1 : 6 }];
  return zipSync(z);
}

/** what a package gives the importer */
export interface PMPackage {
  manifest: PMPackageManifest;
  /** the ordinary exchange file (tasks, dependencies, task lines ...) */
  file: PMProjectExchangeFile;
  /** the BIM part as the BIM bundle (the chunk `storagePath` is empty: the importer sets the path of its model) - null = the package has no model */
  bim: { bundle: BimBundle; propertiesIncluded: boolean; chunkBytes: (hash: string) => Uint8Array } | null;
}

/** Reads a package. The zip is opened entry by entry (the chunk files are inflated only when the importer asks for them). Throws PMProjectExchangeError with a readable message. */
export function readPackage(bytes: Uint8Array): PMPackage {
  const zipOf = (pick: (n: string) => boolean): Record<string, Uint8Array> => {
    try {
      return unzipSync(bytes, { filter: (f) => pick(f.name) });
    } catch {
      throw new PMProjectExchangeError('The file is not a readable zip package.');
    }
  };
  const head = zipOf((n) => n === PACKAGE_ENTRY.manifest || n === PACKAGE_ENTRY.bimManifest || n === PACKAGE_ENTRY.elements || n === PACKAGE_ENTRY.properties || /^project_data_.+\.json$/i.test(n));
  const manifestBytes = head[PACKAGE_ENTRY.manifest];
  if (!manifestBytes) throw new PMProjectExchangeError('This zip is not a project package (package.json is missing).');
  let manifest: PMPackageManifest;
  try { manifest = JSON.parse(strFromU8(manifestBytes)); } catch { throw new PMProjectExchangeError('The package is damaged: package.json is not valid.'); }
  if (manifest.format !== PM_PACKAGE_FORMAT) throw new PMProjectExchangeError('This zip is not a project package.');
  if (typeof manifest.version !== 'number' || manifest.version > PM_PACKAGE_VERSION) throw new PMProjectExchangeError(`Unsupported package version ${manifest.version} - update the app.`);
  const projectBytes = head[manifest.projectFile];
  if (!projectBytes) throw new PMProjectExchangeError(`The package is damaged: ${manifest.projectFile} is missing.`);
  const file = parseProjectExchangeFile(strFromU8(projectBytes));

  if (!manifest.bim) return { manifest, file, bim: null };
  const partBytes = head[PACKAGE_ENTRY.bimManifest];
  if (!partBytes) throw new PMProjectExchangeError('The package is damaged: bim/manifest.json is missing.');
  let part: PMBimPartManifest;
  try { part = JSON.parse(strFromU8(partBytes)); } catch { throw new PMProjectExchangeError('The package is damaged: bim/manifest.json is not valid.'); }
  if (part.format !== PM_BIM_PART_FORMAT) throw new PMProjectExchangeError('The BIM part of the package has an unknown format.');
  if (typeof part.version !== 'number' || part.version > PM_BIM_PART_VERSION) throw new PMProjectExchangeError(`Unsupported BIM part version ${part.version} - update the app.`);
  const elements = readNdjson<BimBundleElement>(head[PACKAGE_ENTRY.elements]);
  const properties = part.propertiesIncluded ? readNdjson<{ ifcGuid: string; rowJSON: Record<string, any> }>(head[PACKAGE_ENTRY.properties]) : [];
  const bundle: BimBundle = {
    model: part.model,
    storeys: part.storeys,
    chunks: part.chunks.map((c) => ({ ...c, storagePath: '' })),
    elements,
    properties,
    project: file,
  };
  const cache = new Map<string, Uint8Array>();
  const chunkBytes = (hash: string): Uint8Array => {
    const hit = cache.get(hash);
    if (hit) return hit;
    const name = PACKAGE_ENTRY.chunk(hash);
    const got = zipOf((n) => n === name)[name];
    if (!got) throw new PMProjectExchangeError(`The package is damaged: the chunk ${hash} is missing.`);
    cache.set(hash, got);
    return got;
  };
  return { manifest, file, bim: { bundle, propertiesIncluded: part.propertiesIncluded === true, chunkBytes } };
}

/** The checks of the BIM part before anything is written (the twin of checkBundle: a package project file DOES have task lines and links). */
export function checkPackageBim(b: BimBundle, chunkSizeOf: (hash: string) => number | null): string | null {
  if (!Array.isArray(b.chunks) || !Array.isArray(b.elements) || !Array.isArray(b.storeys)) return 'The BIM part of the package is incomplete.';
  if (b.elements.length === 0 || b.chunks.length === 0) return 'The BIM part of the package has no element with geometry.';
  const hashes = new Set(b.chunks.map((c) => c.hash));
  for (const e of b.elements) if (!hashes.has(e.chunkHash)) return `The element ${e.ifcGuid} points to a chunk that is not in the package.`;
  const taskIds = new Set(b.project.tasks.map((t) => t.rowGUID));
  for (const e of b.elements) if (e.taskGUID && !taskIds.has(e.taskGUID)) return `The element ${e.ifcGuid} points to a task that is not in the project file.`;
  for (const s of b.storeys) if (s.stageGUID && !taskIds.has(s.stageGUID)) return `The storey "${s.name}" points to a stage that is not in the project file.`;
  for (const c of b.chunks) {
    const size = chunkSizeOf(c.hash);
    if (size === null) return `The chunk ${c.hash} is missing in the package.`;
    if (size !== c.byteSize) return `The chunk ${c.hash} has ${size} bytes, the model says ${c.byteSize}: the package is damaged.`;
  }
  return null;
}

/** the BIM bundle of a manifest + the pages read out of the database (ids of the database -> the ifcGuid of the storey / the task id as it is in the project) */
export function bimExportDataOf(
  manifest: BimManifest,
  elements: { ifcGuid: string; ifcClass: string; name: string; typeName: string; storeyGUID: string | null; taskGUID: string | null; chunkHash: string; elementNumber: number; bbox: number[] }[],
  properties: { ifcGuid: string; rowJSON: Record<string, any> }[],
  propertiesIncluded: boolean,
  chunkBytes: Map<string, Uint8Array>
): PMBimExportData {
  const storeyIfc = new Map(manifest.storeys.map((s) => [s.storeyGUID, s.ifcGuid]));
  const m = manifest.model as any;
  return {
    model: {
      sourceName: m.sourceName, sourceSha256: m.sourceSha256 ?? null, ifcSchema: m.ifcSchema ?? null, converterVersion: m.converterVersion ?? null, unitScale: m.unitScale ?? null,
      originShift: m.originShift, bbox: m.bbox, counts: m.counts,
    } as BimBundle['model'],
    storeys: manifest.storeys.map((s) => ({ ifcGuid: s.ifcGuid, name: s.name, elevation: s.elevation, orderInList: s.orderInList, stageGUID: s.stageGUID })),
    chunks: manifest.chunks.map((c) => ({
      hash: c.contentHash, byteSize: c.byteSize, storeyIfcGuid: c.storeyGUID ? storeyIfc.get(c.storeyGUID) ?? null : null, part: c.part, formatVersion: c.formatVersion, vertexCount: c.vertexCount,
      elementCount: c.elementCount, bboxMin: c.bboxMin ?? [], bboxSize: c.bboxSize ?? [], storagePath: c.storagePath,
    })),
    elements: elements.map((e) => ({
      ifcGuid: e.ifcGuid, ifcClass: e.ifcClass, name: e.name, typeName: e.typeName, storeyIfcGuid: e.storeyGUID ? storeyIfc.get(e.storeyGUID) ?? null : null,
      chunkHash: e.chunkHash, elementNumber: e.elementNumber, bbox: e.bbox, taskGUID: e.taskGUID,
    })),
    properties,
    propertiesIncluded,
    chunkBytes,
  };
}
