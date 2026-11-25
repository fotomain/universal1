// The reads of the norm books (Supabase). A book has tens of thousands of rows: they are NEVER read at once - the tree of books is small (read whole), the children of a section and the search
// results are read a page at a time, the translations only for the rows on the screen.
import { readAllPages } from '../../crud/api/apiUtils';
import type { DefRow } from '../../../catalog/product/productModel';
import { ESTIMATION_TABLES } from '../model/estimationModel';
import type { NormBookNodeJSON } from '../model/normBookModel';
import type { PricedResource } from '../model/normCosting';

export type NormRow = DefRow<Record<string, any>>;
const fail = (e: any): Error => new Error(String(e?.message ?? e));

export async function readNormBookTree(client: any): Promise<DefRow<NormBookNodeJSON>[]> {
  return readAllPages<DefRow<NormBookNodeJSON>>((from, to) => client.from(ESTIMATION_TABLES.normBook.table).select('*').order('orderInList').order('rowGUID').range(from, to));
}

/** the children of a section (or the top of the book: parent 'empty'), one page */
export async function readNormChildren(client: any, bookGUID: string, parentGUID: string, limit = 300): Promise<NormRow[]> {
  const { data, error } = await client.from(ESTIMATION_TABLES.norm.table).select('*').eq('rowOwnerGUID', bookGUID).eq('rowParentGUID', parentGUID).order('orderInList').limit(limit);
  if (error) throw fail(error);
  return data ?? [];
}

/** the shortest search text: the trigram indexes (start1) need 3 characters, a shorter text would scan every norm and hit the statement timeout */
export const NORM_SEARCH_MIN_CHARS = 3;
const likeSafe = (t: string): string => t.replace(/[%*,()]/g, ' ').trim();

/** the text of the message when the database gave up (the 8 s limit): the user is told what to do, not the words of the database */
export const NORM_SEARCH_TIMEOUT_TEXT = 'The search took too long. Type more letters to narrow it.';
export class NormSearchTimeoutError extends Error {
  constructor() { super(NORM_SEARCH_TIMEOUT_TEXT); this.name = 'NormSearchTimeoutError'; }
}
const isStatementTimeout = (e: any): boolean => /statement timeout/i.test(String(e?.message ?? e)) || String(e?.code ?? '') === '57014';

/** where the text must stand in the code / title: at the start (default), anywhere, or at the end */
export type NormSearchMode = 'start' | 'contains' | 'finished';
export const DEFAULT_NORM_SEARCH_MODE: NormSearchMode = 'start';
/** the ilike pattern of PostgREST (`*` = any text) of a search text in a mode; the trigram indexes serve all three */
export const normSearchPattern = (q: string, mode: NormSearchMode): string => (mode === 'start' ? `${q}*` : mode === 'finished' ? `*${q}` : `*${q}*`);

/** the norms whose code or title starts with / contains / ends with the text (mode): of ONE book, or (bookGUID null) of ALL the norm books */
export async function searchNorms(client: any, bookGUID: string | null, text: string, limit = 60, mode: NormSearchMode = DEFAULT_NORM_SEARCH_MODE): Promise<NormRow[]> {
  const q = likeSafe(text);
  if (q.length < NORM_SEARCH_MIN_CHARS) return [];
  let query = client.from(ESTIMATION_TABLES.norm.table).select('*');
  if (bookGUID) query = query.eq('rowOwnerGUID', bookGUID);
  const pattern = normSearchPattern(q, mode);
  // NO ORDER BY on purpose: with an order the database must find EVERY match before it can give the first 60 (a common start like "Разр" = tens of thousands of norms; with no trigram index
  // that is a scan of the whole table = "canceling statement due to statement timeout"); without it the first 60 matches end the query at once. The 60 are sorted by code here.
  const { data, error } = await query.eq('rowJSON->>nodeKind', 'norm')
    .or(`rowJSON->>code.ilike.${pattern},rowJSON->>title.ilike.${pattern}`)
    .limit(limit);
  if (error) throw isStatementTimeout(error) ? new NormSearchTimeoutError() : fail(error);
  return [...(data ?? [])].sort((a: NormRow, b: NormRow) => String(a.rowJSON.code ?? '').localeCompare(String(b.rowJSON.code ?? ''), undefined, { numeric: true }));
}

/** the priced resources of a book by code (what a norm needs) */
export async function readPricedResources(client: any, bookGUID: string, codes: readonly string[]): Promise<Map<string, PricedResource>> {
  const out = new Map<string, PricedResource>();
  const unique = [...new Set(codes)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 80) {
    const part = unique.slice(i, i + 80);
    const { data, error } = await client.from(ESTIMATION_TABLES.resource.table).select('rowJSON').eq('rowOwnerGUID', bookGUID).eq('rowJSON->>nodeKind', 'resource').in('rowJSON->>code', part);
    if (error) throw fail(error);
    for (const r of data ?? []) { const j = r.rowJSON; out.set(String(j.code), { code: String(j.code), price: typeof j.price === 'number' ? j.price : null, operatorPay: typeof j.operatorPay === 'number' ? j.operatorPay : null, resourceKind: j.resourceKind ?? null, title: j.title ?? null }); }
  }
  return out;
}

/** the title of items in a language (catalogTranslationTable); a missing one = the title of the item itself */
export async function readNormTitles(client: any, guids: readonly string[], language: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!guids.length || !language) return out;
  const { data, error } = await client.from('catalogTranslationTable').select('rowOwnerGUID,rowJSON').eq('rowParentGUID', language).in('rowOwnerGUID', [...guids]).limit(guids.length * 2);
  if (error) return out;
  for (const r of data ?? []) if (r.rowJSON?.translationField === 'title' && r.rowJSON.translationText) out.set(r.rowOwnerGUID, r.rowJSON.translationText);
  return out;
}
