// ExportNormBooks / ImportNormBooks - the zip of the app (no React): csv + json.
//   manifest.json            { format: 'universal1.normbooks', version: 1, exportedAt, books: [{ rowGUID, code, title, country, currency, normCount, resourceCount }], counts }
//   json/<table>.json        the rows as they are (rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON): THE DATA, the import reads these
//   csv/<table>.csv          the same rows flat (a nested key is a dotted column, an array is JSON text) to open in Excel; the import never reads them
// Tables: estimation_norm_book_catalog (the book + its country / continent / world nodes), estimation_norm_catalog, estimation_resource_catalog, catalogTranslationTable (the translations of the
// norms / resources / sections of the book). Pure + a NormStore for the import: unit-tested in __tests__/pm/estimation/normBookZip.test.ts.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { csvText, flattenJson } from '../../crud/exchange/project/package/csvExport';
import { ESTIMATION_TABLES, isNormGUID } from '../model/estimationModel';
import type { NormStore } from '../import/importNormBooks';

export const NORM_ZIP_FORMAT = 'universal1.normbooks';
export const NORM_ZIP_VERSION = 1;
export const TRANSLATION_TABLE = 'catalogTranslationTable';

/** the order the tables are written in: the tree first, the rows that point at it after */
export const NORM_ZIP_TABLES = [ESTIMATION_TABLES.normBook.table, ESTIMATION_TABLES.norm.table, ESTIMATION_TABLES.resource.table, TRANSLATION_TABLE] as const;
export type NormZipTable = (typeof NORM_ZIP_TABLES)[number];

export interface NormZipRow { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; orderInList?: number; rowJSON: Record<string, any> }
export type NormZipData = Partial<Record<NormZipTable, NormZipRow[]>>;

export interface NormZipManifest {
  format: typeof NORM_ZIP_FORMAT;
  version: number;
  exportedAt: string;
  books: { rowGUID: string; code: string; title: string; country: string; currency: string; normCount: number; resourceCount: number }[];
  counts: Record<string, number>;
}

const csvColumns = (rows: NormZipRow[]): { columns: string[]; flat: Record<string, unknown>[] } => {
  const flat = rows.map((r) => ({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID, rowParentGUID: r.rowParentGUID, orderInList: r.orderInList ?? 0, ...flattenJson(r.rowJSON) }));
  const columns: string[] = ['rowGUID', 'rowOwnerGUID', 'rowParentGUID', 'orderInList'];
  const seen = new Set(columns);
  for (const f of flat) for (const k of Object.keys(f)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
  return { columns, flat };
};

/** the zip (bytes) of the rows of one or more books */
export function buildNormBookZip(data: NormZipData, now: Date = new Date()): Uint8Array {
  const files: Zippable = {};
  const counts: Record<string, number> = {};
  for (const table of NORM_ZIP_TABLES) {
    const rows = data[table] ?? [];
    counts[table] = rows.length;
    files[`json/${table}.json`] = strToU8(JSON.stringify(rows));
    const { columns, flat } = csvColumns(rows);
    files[`csv/${table}.csv`] = strToU8(csvText(columns, flat));
  }
  const books = (data[ESTIMATION_TABLES.normBook.table] ?? []).filter((r) => r.rowJSON?.nodeKind === 'book').map((r) => ({
    rowGUID: r.rowGUID, code: String(r.rowJSON.code ?? ''), title: String(r.rowJSON.title ?? ''), country: String(r.rowJSON.countryCode ?? ''), currency: String(r.rowJSON.currency ?? ''),
    normCount: Number(r.rowJSON.normCount ?? 0), resourceCount: Number(r.rowJSON.resourceCount ?? 0),
  }));
  const manifest: NormZipManifest = { format: NORM_ZIP_FORMAT, version: NORM_ZIP_VERSION, exportedAt: now.toISOString(), books, counts };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}

export class NormZipError extends Error {}

/** reads a zip made by buildNormBookZip; a zip of another kind is refused with a clear message */
export function readNormBookZip(bytes: Uint8Array): { manifest: NormZipManifest; data: NormZipData } {
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(bytes); } catch { throw new NormZipError('This file is not a zip archive.'); }
  if (!entries['manifest.json']) throw new NormZipError('This zip has no manifest.json: it is not a norm book zip of this application.');
  let manifest: NormZipManifest;
  try { manifest = JSON.parse(strFromU8(entries['manifest.json'])); } catch { throw new NormZipError('manifest.json is not valid JSON.'); }
  if (manifest.format !== NORM_ZIP_FORMAT) throw new NormZipError(`Unknown format "${String(manifest.format)}".`);
  if (!(manifest.version >= 1) || manifest.version > NORM_ZIP_VERSION) throw new NormZipError(`The zip is of version ${manifest.version}; this application reads version ${NORM_ZIP_VERSION}.`);
  const data: NormZipData = {};
  for (const table of NORM_ZIP_TABLES) {
    const e = entries[`json/${table}.json`];
    if (!e) continue;
    let rows: unknown;
    try { rows = JSON.parse(strFromU8(e)); } catch { throw new NormZipError(`json/${table}.json is not valid JSON.`); }
    if (!Array.isArray(rows)) throw new NormZipError(`json/${table}.json is not a list of rows.`);
    for (const r of rows) if (!r || typeof r.rowGUID !== 'string' || typeof r.rowJSON !== 'object') throw new NormZipError(`json/${table}.json has a row without rowGUID / rowJSON.`);
    data[table] = rows as NormZipRow[];
  }
  return { manifest, data };
}

/** writes the rows of a zip into the app in batches (tree first); the translations of rows that are not in the zip are refused */
export async function importNormBookZip(store: NormStore, bytes: Uint8Array, opts: { batchSize?: number; onProgress?: (p: { step: string; done: number; total: number }) => void; isCancelled?: () => boolean } = {}): Promise<{ written: Record<string, number>; cancelled: boolean }> {
  const { data } = readNormBookZip(bytes);
  const batch = Math.max(1, opts.batchSize ?? 400);
  const total = NORM_ZIP_TABLES.reduce((a, t) => a + (data[t]?.length ?? 0), 0);
  const written: Record<string, number> = {};
  let done = 0;
  for (const table of NORM_ZIP_TABLES) {
    const rows = data[table] ?? [];
    if (table === TRANSLATION_TABLE) {
      const bad = rows.find((r) => !isNormGUID(r.rowOwnerGUID));
      if (bad) throw new NormZipError(`A translation points at "${bad.rowOwnerGUID}", which is not an imported norm book row.`);
    }
    for (let i = 0; i < rows.length; i += batch) {
      if (opts.isCancelled?.()) return { written, cancelled: true };
      const part = rows.slice(i, i + batch).map((r) => ({ ...r, orderInList: r.orderInList ?? 0 }));
      await store.upsert(table, part);
      done += part.length;
      written[table] = (written[table] ?? 0) + part.length;
      opts.onProgress?.({ step: table, done, total });
    }
  }
  return { written, cancelled: false };
}

/** reading the rows of a book (and its ancestors in the tree) from the app, for an export */
export async function readNormBookData(client: any, bookGUID: string, readAllPages: (page: (from: number, to: number) => PromiseLike<{ data: any; error: any }>) => Promise<any[]>): Promise<NormZipData> {
  const tree: NormZipRow[] = [];
  let guid: string | undefined = bookGUID;
  for (let i = 0; guid && guid !== 'empty' && i < 10; i++) {
    const res: { data: any; error: any } = await client.from(ESTIMATION_TABLES.normBook.table).select('*').eq('rowGUID', guid).limit(1);
    const { data, error } = res;
    if (error) throw new Error(error.message);
    const row: NormZipRow | undefined = data?.[0];
    if (!row) break;
    tree.unshift(row);
    guid = row.rowParentGUID;
  }
  const byOwner = (table: string) => readAllPages((from, to) => client.from(table).select('*').eq('rowOwnerGUID', bookGUID).order('orderInList').order('rowGUID').range(from, to));
  const norms = await byOwner(ESTIMATION_TABLES.norm.table);
  const resources = await byOwner(ESTIMATION_TABLES.resource.table);
  const prefix = bookGUID === '' ? '' : `${normPrefixOfBook(bookGUID)}`;
  const translations = await readAllPages((from, to) => client.from(TRANSLATION_TABLE).select('*').like('rowOwnerGUID', `${prefix}%`).order('rowGUID').range(from, to));
  return { [ESTIMATION_TABLES.normBook.table]: tree, [ESTIMATION_TABLES.norm.table]: norms, [ESTIMATION_TABLES.resource.table]: resources, [TRANSLATION_TABLE]: translations } as NormZipData;
}

// the rowGUIDs of the rows of a book start with estn-<hash of the book guid>-
import { NORM_GUID_PREFIX, stableHash } from '../model/estimationModel';
export const normPrefixOfBook = (bookGUID: string): string => `${NORM_GUID_PREFIX}${stableHash(bookGUID)}-`;
