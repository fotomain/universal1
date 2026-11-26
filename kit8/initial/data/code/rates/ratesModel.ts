// ratesModel - the exchange rates of the initial data (Q5 of documentation/INITIAL_DATA_WBS.html), pure functions:
//   * the day that must have a rate: 31 December of the PREVIOUS year (the opening rate of the year)
//   * the CSV template  currencies_reates_import_template.csv  and the reader of the file the user fills in
//   * "is the rate there" for the check at the start
// A rate row is { rowOwnerGUID = currencyTable.rowGUID, rowParentGUID = 'YYYY-MM-DD' (+ '|Budget'), rowJSON { startingDate, currencyRatio, rateType } } (kit8/catalog/currency/exchange).
import { DEFAULT_RATE_TYPE, isValidISODate, orderInListForDate, parseRatio, rateKeyOf, todayISO } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { RATES_REQUIRED_CODES } from '../initialDataModel';

/** the name of the file the user may download / fill in / import (the spelling is the owner's) */
export const RATES_TEMPLATE_FILE = 'currencies_reates_import_template.csv';
export const RATES_CSV_HEADER = ['currencyCode', 'startingDate', 'currencyRatio', 'rateType'] as const;

/** 31 December of the previous year ('2026-11-26' -> '2025-12-31') */
export const previousYearEnd = (today: string = todayISO()): string => `${Number(today.slice(0, 4)) - 1}-12-31`;
/** 1 January of the year of `today` */
export const yearStart = (today: string = todayISO()): string => `${today.slice(0, 4)}-01-01`;

const codeOf = (c: any): string => String(c?.rowJSON?.currencyCode ?? '').trim().toUpperCase();

/** the currencies a rate is wanted for: active ones of the catalog, the base currency excluded (its ratio is always 1) */
export const rateCurrencies = (currencies: any[], base: string): any[] => currencies.filter((c) => c?.rowGUID && codeOf(c) && codeOf(c) !== base.toUpperCase() && c.rowJSON?.isActive !== false);

export interface RateRowLike { rowOwnerGUID: string; rowParentGUID: string }

/** every REQUIRED currency (USD, EUR, GBP minus the base) of the catalog has a Default rate that is in force on `day` (a rate of that day or an earlier one) */
export function ratesInForce(currencies: any[], rows: RateRowLike[], day: string, base: string): boolean {
  const required = new Set<string>(RATES_REQUIRED_CODES.filter((c) => c !== base.toUpperCase()));
  const wanted = currencies.filter((c) => c?.rowGUID && required.has(codeOf(c)));
  if (wanted.length === 0) return false;
  return wanted.every((c) => rows.some((r) => r.rowOwnerGUID === c.rowGUID && !r.rowParentGUID.includes('|') && r.rowParentGUID <= day));
}

const needsQuote = (v: string) => /[",;\n\r]/.test(v);
const quote = (v: string) => (needsQuote(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const csvLine = (cells: (string | number)[]): string => cells.map((c) => quote(String(c))).join(',');

/**
 * The template: the header and one line per currency of the catalog (the base excluded) for 1 January of this year, with an EMPTY ratio.
 * A line with an empty ratio is skipped by the import, so the user fills in only the rows he has. rateType: Default (the daily rate) or Budget.
 * A ratio = units of the currency for 1 unit of the base currency (EUR unless EXPO_PUBLIC_CURRENCY_RATES_BASE says otherwise).
 */
export function buildRatesTemplate(currencies: any[], base: string, today: string = todayISO()): string {
  const lines = [csvLine([...RATES_CSV_HEADER])];
  const day = yearStart(today);
  for (const c of rateCurrencies(currencies, base).sort((a, b) => codeOf(a).localeCompare(codeOf(b)))) lines.push(csvLine([codeOf(c), day, '', DEFAULT_RATE_TYPE]));
  return `${lines.join('\r\n')}\r\n`;
}

/** one line of a CSV file into cells; a cell may be "quoted, with ""quotes"" and the separator" */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { out.push(cell); cell = ''; }
    else cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

/** 'YYYY-MM-DD' or 'DD.MM.YYYY' (what a spreadsheet of the region writes) -> 'YYYY-MM-DD', '' when it is not a day */
export function parseRateDay(v: string): string {
  const s = v.trim();
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  const iso = dotted ? `${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}` : s;
  return isValidISODate(iso) ? iso : '';
}

export interface ParsedRate { currencyGUID: string; currencyCode: string; day: string; ratio: number; rateType: string; line: number }
export interface RatesCsvResult {
  rates: ParsedRate[];
  /** lines with an empty ratio (the template lines the user did not fill in) */
  emptyLines: number;
  errors: { line: number; message: string }[];
}

/** reads the text of a CSV file; separator , or ; (the header decides); a BOM is ignored; a line with an empty ratio is skipped; a bad line is reported, the others are kept */
export function parseRatesCsv(text: string, currencies: any[], base: string): RatesCsvResult {
  const result: RatesCsvResult = { rates: [], emptyLines: 0, errors: [] };
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const headerAt = lines.findIndex((l) => l.trim() !== '');
  if (headerAt < 0) { result.errors.push({ line: 1, message: 'The file is empty' }); return result; }
  const delimiter = lines[headerAt].includes(';') && !lines[headerAt].includes(',') ? ';' : ',';
  const header = splitCsvLine(lines[headerAt], delimiter).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const [iCode, iDay, iRatio, iType] = [col('currencyCode'), col('startingDate'), col('currencyRatio'), col('rateType')];
  if (iCode < 0 || iDay < 0 || iRatio < 0) { result.errors.push({ line: headerAt + 1, message: 'The first line must name the columns currencyCode, startingDate, currencyRatio (rateType is optional)' }); return result; }
  const byCode = new Map(currencies.filter((c) => c?.rowGUID && codeOf(c)).map((c) => [codeOf(c), c]));
  const seen = new Set<string>();
  for (let i = headerAt + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const cells = splitCsvLine(lines[i], delimiter);
    const line = i + 1;
    const code = (cells[iCode] ?? '').toUpperCase();
    const ratioText = cells[iRatio] ?? '';
    if (ratioText.trim() === '') { result.emptyLines += 1; continue; }
    if (code === base.toUpperCase()) { result.errors.push({ line, message: `${code} is the base currency: its ratio is always 1` }); continue; }
    const cur = byCode.get(code);
    if (!cur) { result.errors.push({ line, message: `"${code}" is not a currency of the catalog` }); continue; }
    const day = parseRateDay(cells[iDay] ?? '');
    if (!day) { result.errors.push({ line, message: `"${cells[iDay] ?? ''}" is not a day (YYYY-MM-DD or DD.MM.YYYY)` }); continue; }
    const ratio = parseRatio(ratioText);
    if (!(ratio > 0)) { result.errors.push({ line, message: `"${ratioText}" is not a ratio above zero` }); continue; }
    const typeText = (iType >= 0 ? cells[iType] : '') || DEFAULT_RATE_TYPE;
    const rateType = typeText.toLowerCase() === 'budget' ? 'Budget' : typeText.toLowerCase() === 'default' ? DEFAULT_RATE_TYPE : '';
    if (!rateType) { result.errors.push({ line, message: `"${typeText}" is not a rate type (Default or Budget)` }); continue; }
    const key = `${code}|${rateKeyOf(day, rateType)}`;
    if (seen.has(key)) { result.errors.push({ line, message: `${code} ${day} ${rateType} is in the file twice` }); continue; }
    seen.add(key);
    result.rates.push({ currencyGUID: cur.rowGUID, currencyCode: code, day, ratio: Math.round(ratio * 1e6) / 1e6, rateType, line });
  }
  return result;
}

/** the rows of currencyExchangeRateTable for the parsed rates */
export function rateRowsOf(rates: ParsedRate[], base: string) {
  return rates.map((r) => ({
    rowOwnerGUID: r.currencyGUID,
    rowParentGUID: rateKeyOf(r.day, r.rateType),
    orderInList: orderInListForDate(r.day),
    rowJSON: { startingDate: r.day, currencyRatio: r.ratio, rateType: r.rateType, rateSource: 'csv', rateBase: base.toUpperCase() },
  }));
}
