// ImportNormBooks - the engine (no React): a ZIP / XML file of a norm book -> rows of the norm book tables of the app, in batches.
//   1. the zip is opened (fflate), every XML file is classified (classifyNormFile); the files that are not norms / priced resources are listed as skipped;
//   2. the country node and the BOOK node are made (rowGUID of the book = country + code + edition: a second import of the same edition updates it);
//   3. every file is read as a stream (fsnbReader), the prices are converted from the source currency into the currency of the book, batches of `batchSize` rows are written with upsert on
//      rowGUID (deterministic ids: nothing is doubled);
//   4. the texts: the main title of a row is ENGLISH when a translator is given, else the original; with `storeOriginals` the original and the English text are written as rows of
//      catalogTranslationTable (language ru / en, rowOwnerGUID = the item), so the interface language can show either.
// The Supabase side is the NormStore (one method), so the whole flow is tested with a fake.
import { strFromU8, unzipSync } from 'fflate';
import { ESTIMATION_TABLES } from '../model/estimationModel';
import { bookGUIDOf, bookNodeRow, countryNodeRow, countryOf } from '../model/normBookModel';
import { classifyNormFile, readNormFile, type CatalogImportRow } from './fsnbReader';
import type { NormTranslator } from './normTranslator';

export interface NormStore { upsert(table: string, rows: Record<string, any>[]): Promise<void> }

/** the Supabase client as a NormStore */
export const supabaseNormStore = (client: any): NormStore => ({
  async upsert(table, rows) {
    if (!rows.length) return;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'rowGUID' });
    if (error) throw new Error(`${table}: ${error.message ?? String(error)}`);
  },
});

export interface NormInputFile { name: string; bytes: Uint8Array }

/** a .zip is opened; anything else is one file (the entries of a zip may be zips inside are NOT opened) */
export function expandNormFiles(files: readonly NormInputFile[]): NormInputFile[] {
  const out: NormInputFile[] = [];
  for (const f of files) {
    const isZip = f.bytes.length > 3 && f.bytes[0] === 0x50 && f.bytes[1] === 0x4b && f.bytes[2] === 0x03 && f.bytes[3] === 0x04;
    if (!isZip) { out.push(f); continue; }
    const entries = unzipSync(f.bytes, { filter: (e) => !e.name.endsWith('/') });
    for (const [name, bytes] of Object.entries(entries)) out.push({ name, bytes });
  }
  return out;
}

export interface ImportNormBooksOptions {
  files: readonly NormInputFile[];
  countryCode: string;
  bookCode: string;
  bookTitle: string;
  version: string;
  sourceCurrency: string;
  /** the currency of the prices of the book (EUR by default of the app) */
  targetCurrency: string;
  /** 1 unit of the source currency = fxRate units of the target currency */
  fxRate: number;
  fxDate: string;
  language: string;
  translator?: NormTranslator;
  /** the language of the main titles when a translator is given */
  mainLanguage?: string;
  storeOriginals?: boolean;
  batchSize?: number;
  onProgress?: (p: { step: string; done: number; total?: number }) => void;
  isCancelled?: () => boolean;
}

export interface ImportNormBooksResult {
  bookGUID: string;
  norms: number;
  sections: number;
  resources: number;
  groups: number;
  translations: number;
  skippedFiles: string[];
  cancelled: boolean;
}

export class ImportCancelledError extends Error { constructor() { super('Import cancelled.'); } }

/** a translation row (catalogTranslationTable) of the title of a catalog item */
export const translationRow = (itemGUID: string, language: string, text: string): Record<string, any> => ({
  rowGUID: `${itemGUID}~${language}~title`, rowOwnerGUID: itemGUID, rowParentGUID: language, orderInList: 0,
  rowJSON: { translationField: 'title', translationText: text },
});

export async function importNormBooks(store: NormStore, o: ImportNormBooksOptions): Promise<ImportNormBooksResult> {
  if (!countryOf(o.countryCode)) throw new Error(`Unknown country code ${o.countryCode}: add the country to the tree first.`);
  if (!(o.fxRate > 0)) throw new Error('The exchange rate must be above zero.');
  const progress = o.onProgress ?? (() => {});
  const cancelled = () => o.isCancelled?.() === true;
  const batchSize = Math.max(1, o.batchSize ?? 400);
  const mainLanguage = o.mainLanguage ?? 'en';
  const bookGUID = bookGUIDOf(o.countryCode, o.bookCode, o.version);
  const result: ImportNormBooksResult = { bookGUID, norms: 0, sections: 0, resources: 0, groups: 0, translations: 0, skippedFiles: [], cancelled: false };

  progress({ step: 'Reading the files', done: 0 });
  const files = expandNormFiles(o.files);
  const kinds = files.map((f) => ({ f, info: classifyNormFile(f.bytes) }));
  const usable = kinds.filter((k) => k.info.kind !== 'skipped');
  result.skippedFiles = kinds.filter((k) => k.info.kind === 'skipped').map((k) => k.f.name);
  if (!usable.length) throw new Error('No norm file was found: the files are not norm books (norms or priced resources).');

  // the tree: the country (when missing) and the book
  const country = countryNodeRow(o.countryCode);
  if (country) await store.upsert(ESTIMATION_TABLES.normBook.table, [country]);
  const bookRow = (counts?: { norms: number; resources: number }) => bookNodeRow({ bookGUID, countryCode: o.countryCode, code: o.bookCode, title: o.bookTitle, currency: o.targetCurrency, sourceCurrency: o.sourceCurrency, language: o.language, version: o.version, fxRate: o.fxRate, fxDate: o.fxDate, normCount: counts?.norms, resourceCount: counts?.resources });
  await store.upsert(ESTIMATION_TABLES.normBook.table, [bookRow()]);

  const convert = (a: number) => a * o.fxRate;
  let written = 0;
  let normBatch: Record<string, any>[] = [];
  let resBatch: Record<string, any>[] = [];
  let trBatch: Record<string, any>[] = [];
  let pending: CatalogImportRow[] = [];

  const flushPending = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    let english: string[] | null = null;
    if (o.translator && o.language !== mainLanguage) english = await o.translator(batch.map((b) => b.originalTitle), o.language, mainLanguage);
    batch.forEach((b, i) => {
      const row = b.row;
      if (english) row.rowJSON = { ...row.rowJSON, title: english[i] || b.originalTitle, titleOriginal: b.originalTitle, titleLanguage: mainLanguage, originalLanguage: o.language };
      else row.rowJSON = { ...row.rowJSON, titleLanguage: o.language };
      (b.table === 'norm' ? normBatch : resBatch).push(row);
      if (o.storeOriginals && b.originalTitle) {
        trBatch.push(translationRow(row.rowGUID, o.language, b.originalTitle));
        if (english) trBatch.push(translationRow(row.rowGUID, mainLanguage, english[i] || b.originalTitle));
      }
      if (row.rowJSON.nodeKind === 'norm') result.norms++;
      else if (row.rowJSON.nodeKind === 'section') result.sections++;
      else if (row.rowJSON.nodeKind === 'resource') result.resources++;
      else result.groups++;
    });
    // sections / groups first (their rowGUIDs are the parents), then the rest, then the translations
    await store.upsert(ESTIMATION_TABLES.norm.table, normBatch);
    await store.upsert(ESTIMATION_TABLES.resource.table, resBatch);
    await store.upsert('catalogTranslationTable', trBatch);
    result.translations += trBatch.length;
    written += normBatch.length + resBatch.length;
    normBatch = []; resBatch = []; trBatch = [];
    progress({ step: 'Writing the rows', done: written });
  };

  for (const { f } of usable) {
    progress({ step: `Reading ${f.name}`, done: written });
    for (const row of readNormFile(f.bytes, { bookGUID, convert, sourceCurrency: o.sourceCurrency, currency: o.targetCurrency, language: o.language })) {
      if (cancelled()) { result.cancelled = true; break; }
      pending.push(row);
      if (pending.length >= batchSize) await flushPending();
    }
    if (result.cancelled) break;
    await flushPending();
  }
  await flushPending();
  await store.upsert(ESTIMATION_TABLES.normBook.table, [bookRow({ norms: result.norms, resources: result.resources })]);
  progress({ step: result.cancelled ? 'Cancelled' : 'Done', done: written });
  return result;
}
