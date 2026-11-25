// Norm books - the tree World Norms (v2) -> continent -> country -> book, the countries the tree knows by code, and the helpers of the tree (pure).
// SQL PART 58 seeds the world node, the six continents and Russia (start4); ImportNormBooks adds the country node of a book when it is missing.
import type { DefRow } from '../../../catalog/product/productModel';
import { ESTIMATION_CATALOG_OWNER } from './estimationModel';

export const WORLD_NORMS_GUID = 'estWorldNorms2';

export type NormNodeKind = 'world' | 'continent' | 'country' | 'book';

export interface NormBookNodeJSON {
  nodeKind: NormNodeKind;
  code?: string | null;
  title?: string | null;
  countryCode?: string | null;
  /** the currency of the prices of a book (after the conversion) */
  currency?: string | null;
  /** the currency the book was published in (RUB for the Russian FSNB) */
  sourceCurrency?: string | null;
  /** the language of the original texts */
  language?: string | null;
  version?: string | null;
  fxRate?: number | null;
  fxDate?: string | null;
  normCount?: number;
  resourceCount?: number;
}

export interface Continent { guid: string; code: string; title: string }
export const CONTINENTS: Continent[] = [
  { guid: 'estContinentEurope', code: 'EUROPE', title: 'Europe' },
  { guid: 'estContinentAsia', code: 'ASIA', title: 'Asia' },
  { guid: 'estContinentAfrica', code: 'AFRICA', title: 'Africa' },
  { guid: 'estContinentNorthAmerica', code: 'NORTHAMERICA', title: 'North America' },
  { guid: 'estContinentSouthAmerica', code: 'SOUTHAMERICA', title: 'South America' },
  { guid: 'estContinentOceania', code: 'OCEANIA', title: 'Oceania' },
];

export interface CountryInfo { code: string; title: string; continent: string; currency: string }
const C = (code: string, title: string, continent: string, currency: string): CountryInfo => ({ code, title, continent: `estContinent${continent}`, currency });
/** the countries a norm book can be filed under (more can be added as rows of the catalog by an estimation manager) */
export const COUNTRIES: CountryInfo[] = [
  C('RU', 'Russia', 'Europe', 'RUB'), C('LV', 'Latvia', 'Europe', 'EUR'), C('LT', 'Lithuania', 'Europe', 'EUR'), C('EE', 'Estonia', 'Europe', 'EUR'), C('DE', 'Germany', 'Europe', 'EUR'),
  C('AT', 'Austria', 'Europe', 'EUR'), C('IT', 'Italy', 'Europe', 'EUR'), C('ES', 'Spain', 'Europe', 'EUR'), C('FR', 'France', 'Europe', 'EUR'), C('PT', 'Portugal', 'Europe', 'EUR'),
  C('NL', 'Netherlands', 'Europe', 'EUR'), C('BE', 'Belgium', 'Europe', 'EUR'), C('PL', 'Poland', 'Europe', 'PLN'), C('CZ', 'Czechia', 'Europe', 'CZK'), C('SK', 'Slovakia', 'Europe', 'EUR'),
  C('HU', 'Hungary', 'Europe', 'HUF'), C('RO', 'Romania', 'Europe', 'RON'), C('BG', 'Bulgaria', 'Europe', 'BGN'), C('GR', 'Greece', 'Europe', 'EUR'), C('SE', 'Sweden', 'Europe', 'SEK'),
  C('FI', 'Finland', 'Europe', 'EUR'), C('DK', 'Denmark', 'Europe', 'DKK'), C('NO', 'Norway', 'Europe', 'NOK'), C('IE', 'Ireland', 'Europe', 'EUR'), C('GB', 'United Kingdom', 'Europe', 'GBP'),
  C('CH', 'Switzerland', 'Europe', 'CHF'), C('UA', 'Ukraine', 'Europe', 'UAH'), C('BY', 'Belarus', 'Europe', 'BYN'), C('TR', 'Turkey', 'Asia', 'TRY'),
  C('CN', 'China', 'Asia', 'CNY'), C('IN', 'India', 'Asia', 'INR'), C('JP', 'Japan', 'Asia', 'JPY'), C('KR', 'South Korea', 'Asia', 'KRW'), C('KZ', 'Kazakhstan', 'Asia', 'KZT'),
  C('AE', 'United Arab Emirates', 'Asia', 'AED'), C('SA', 'Saudi Arabia', 'Asia', 'SAR'), C('IL', 'Israel', 'Asia', 'ILS'), C('SG', 'Singapore', 'Asia', 'SGD'), C('TH', 'Thailand', 'Asia', 'THB'),
  C('VN', 'Vietnam', 'Asia', 'VND'), C('ID', 'Indonesia', 'Asia', 'IDR'), C('IR', 'Iran', 'Asia', 'IRR'), C('BD', 'Bangladesh', 'Asia', 'BDT'),
  C('EG', 'Egypt', 'Africa', 'EGP'), C('ZA', 'South Africa', 'Africa', 'ZAR'), C('NG', 'Nigeria', 'Africa', 'NGN'), C('KE', 'Kenya', 'Africa', 'KES'), C('MA', 'Morocco', 'Africa', 'MAD'),
  C('US', 'United States', 'NorthAmerica', 'USD'), C('CA', 'Canada', 'NorthAmerica', 'CAD'), C('MX', 'Mexico', 'NorthAmerica', 'MXN'),
  C('BR', 'Brazil', 'SouthAmerica', 'BRL'), C('AR', 'Argentina', 'SouthAmerica', 'ARS'), C('CL', 'Chile', 'SouthAmerica', 'CLP'), C('CO', 'Colombia', 'SouthAmerica', 'COP'),
  C('AU', 'Australia', 'Oceania', 'AUD'), C('NZ', 'New Zealand', 'Oceania', 'NZD'),
];

export const countryOf = (code: string | null | undefined): CountryInfo | undefined => COUNTRIES.find((c) => c.code === String(code ?? '').toUpperCase());
export const countryNodeGUID = (code: string): string => `estCountry${code.toUpperCase()}`;

/** the row of a country node (the importer inserts it when the tree has none) */
export function countryNodeRow(code: string): DefRow<NormBookNodeJSON> | null {
  const c = countryOf(code);
  if (!c) return null;
  return { rowGUID: countryNodeGUID(c.code), rowOwnerGUID: ESTIMATION_CATALOG_OWNER, rowParentGUID: c.continent, orderInList: 1000, rowJSON: { nodeKind: 'country', code: c.code, countryCode: c.code, title: c.title } };
}

/** the row of a book node under its country */
export function bookNodeRow(args: { bookGUID: string; countryCode: string; code: string; title: string; currency: string; sourceCurrency: string; language: string; version?: string; fxRate?: number; fxDate?: string; normCount?: number; resourceCount?: number }): DefRow<NormBookNodeJSON> {
  return {
    rowGUID: args.bookGUID, rowOwnerGUID: ESTIMATION_CATALOG_OWNER, rowParentGUID: countryNodeGUID(args.countryCode), orderInList: 1000,
    rowJSON: { nodeKind: 'book', code: args.code, title: args.title, countryCode: args.countryCode.toUpperCase(), currency: args.currency, sourceCurrency: args.sourceCurrency, language: args.language, version: args.version ?? null, fxRate: args.fxRate ?? null, fxDate: args.fxDate ?? null, normCount: args.normCount ?? 0, resourceCount: args.resourceCount ?? 0 },
  };
}

/** the rowGUID of a book: one book per country + code + edition, so a second import of the same edition replaces it */
export const bookGUIDOf = (countryCode: string, code: string, version: string): string => `estBook${countryCode.toUpperCase()}-${code.replace(/[^A-Za-z0-9]+/g, '')}-${version.replace(/[^A-Za-z0-9]+/g, '')}`;

// ---- the tree ------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface NormTreeNode { row: DefRow<NormBookNodeJSON>; children: NormTreeNode[] }

/** the rows -> the tree under the world node (rows whose parent is missing are dropped; children are sorted by orderInList, then by title) */
export function buildNormTree(rows: readonly DefRow<NormBookNodeJSON>[], rootGUID: string = WORLD_NORMS_GUID): NormTreeNode | null {
  const byParent = new Map<string, DefRow<NormBookNodeJSON>[]>();
  let root: DefRow<NormBookNodeJSON> | undefined;
  for (const r of rows) {
    if (r.rowGUID === rootGUID) root = r;
    if (!byParent.has(r.rowParentGUID)) byParent.set(r.rowParentGUID, []);
    byParent.get(r.rowParentGUID)!.push(r);
  }
  if (!root) return null;
  const seen = new Set<string>();
  const build = (row: DefRow<NormBookNodeJSON>): NormTreeNode => {
    seen.add(row.rowGUID);
    const kids = (byParent.get(row.rowGUID) ?? []).filter((k) => !seen.has(k.rowGUID)).sort((a, b) => (Number(a.orderInList) - Number(b.orderInList)) || String(a.rowJSON.title ?? '').localeCompare(String(b.rowJSON.title ?? '')));
    return { row, children: kids.map(build) };
  };
  return build(root);
}

/** the books below a node (any depth) */
export function booksOf(node: NormTreeNode | null): DefRow<NormBookNodeJSON>[] {
  if (!node) return [];
  const out: DefRow<NormBookNodeJSON>[] = [];
  const walk = (n: NormTreeNode) => { if (n.row.rowJSON.nodeKind === 'book') out.push(n.row); n.children.forEach(walk); };
  walk(node);
  return out;
}

/** 'World Norms (v2) / Europe / Russia / FSNB-2022' */
export function nodePath(rows: readonly DefRow<NormBookNodeJSON>[], guid: string): string[] {
  const by = new Map(rows.map((r) => [r.rowGUID, r]));
  const out: string[] = [];
  let cur = by.get(guid);
  let guard = 0;
  while (cur && guard++ < 10) { out.unshift(String(cur.rowJSON.title ?? cur.rowGUID)); cur = by.get(cur.rowParentGUID); }
  return out;
}
