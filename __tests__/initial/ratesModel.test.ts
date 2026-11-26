// The exchange rates of the initial data: the day, the CSV template and its reader (pure functions).
import {
  buildRatesTemplate, parseRateDay, parseRatesCsv, previousYearEnd, rateCurrencies, rateRowsOf, RATES_CSV_HEADER, RATES_TEMPLATE_FILE, ratesInForce, splitCsvLine, yearStart,
} from '../../kit8/initial/data/code/rates/ratesModel';

const cur = (code: string, rowGUID = `g-${code}`, extra: any = {}) => ({ rowGUID, rowJSON: { currencyCode: code, ...extra } });
const catalog = [cur('EUR'), cur('USD'), cur('GBP'), cur('CHF'), cur('JPY', 'g-JPY', { isActive: false })];

describe('the days', () => {
  it('31 December of the previous year, 1 January of this year', () => {
    expect(previousYearEnd('2026-11-26')).toBe('2025-12-31');
    expect(previousYearEnd('2027-01-01')).toBe('2026-12-31');
    expect(yearStart('2026-11-26')).toBe('2026-01-01');
  });
  it('the file is named as the owner wrote it', () => { expect(RATES_TEMPLATE_FILE).toBe('currencies_reates_import_template.csv'); });
});

describe('which currencies', () => {
  it('the active ones of the catalog, the base excluded', () => {
    expect(rateCurrencies(catalog, 'EUR').map((c) => c.rowJSON.currencyCode)).toEqual(['USD', 'GBP', 'CHF']);
    expect(rateCurrencies(catalog, 'usd').map((c) => c.rowJSON.currencyCode)).toEqual(['EUR', 'GBP', 'CHF']);
  });
  it('ratesInForce: USD and GBP need a Default rate on or before the day (EUR is the base)', () => {
    const rows = [{ rowOwnerGUID: 'g-USD', rowParentGUID: '2025-12-30' }, { rowOwnerGUID: 'g-GBP', rowParentGUID: '2025-12-31' }];
    expect(ratesInForce(catalog, rows, '2025-12-31', 'EUR')).toBe(true);
    expect(ratesInForce(catalog, rows.slice(0, 1), '2025-12-31', 'EUR')).toBe(false);
    // a Budget rate does not count, a rate AFTER the day does not count
    expect(ratesInForce(catalog, [{ rowOwnerGUID: 'g-USD', rowParentGUID: '2025-12-30|Budget' }, rows[1]], '2025-12-31', 'EUR')).toBe(false);
    expect(ratesInForce(catalog, [{ rowOwnerGUID: 'g-USD', rowParentGUID: '2026-01-02' }, rows[1]], '2025-12-31', 'EUR')).toBe(false);
    expect(ratesInForce([], rows, '2025-12-31', 'EUR')).toBe(false);
  });
});

describe('the template', () => {
  it('a header and a line per currency (the base and the inactive ones left out) with an empty ratio', () => {
    const text = buildRatesTemplate(catalog, 'EUR', '2026-11-26');
    const lines = text.trim().split('\r\n');
    expect(lines[0]).toBe(RATES_CSV_HEADER.join(','));
    expect(lines.slice(1)).toEqual(['CHF,2026-01-01,,Default', 'GBP,2026-01-01,,Default', 'USD,2026-01-01,,Default']);
  });
  it('the template read back has nothing to import, only empty lines', () => {
    const r = parseRatesCsv(buildRatesTemplate(catalog, 'EUR', '2026-11-26'), catalog, 'EUR');
    expect(r.rates).toEqual([]);
    expect(r.emptyLines).toBe(3);
    expect(r.errors).toEqual([]);
  });
});

describe('the reader of the file', () => {
  const csv = (...lines: string[]) => `currencyCode,startingDate,currencyRatio,rateType\n${lines.join('\n')}\n`;
  it('reads the rates, a comma as the decimal separator included', () => {
    const r = parseRatesCsv(csv('USD,2026-01-02,1.0842,Default', 'gbp,2026-01-02,"0,8590",', 'CHF,2026-01-02,0.93,budget'), catalog, 'EUR');
    expect(r.errors).toEqual([]);
    expect(r.rates.map((x) => [x.currencyCode, x.day, x.ratio, x.rateType])).toEqual([['USD', '2026-01-02', 1.0842, 'Default'], ['GBP', '2026-01-02', 0.859, 'Default'], ['CHF', '2026-01-02', 0.93, 'Budget']]);
  });
  it('a semicolon file with a BOM and the day written 02.01.2026', () => {
    const r = parseRatesCsv('﻿currencyCode;startingDate;currencyRatio\r\nUSD;02.01.2026;1,08\r\n', catalog, 'EUR');
    expect(r.errors).toEqual([]);
    expect(r.rates[0]).toMatchObject({ currencyCode: 'USD', day: '2026-01-02', ratio: 1.08, rateType: 'Default' });
  });
  it('a line with a problem is reported with its number, the good lines are kept', () => {
    const r = parseRatesCsv(csv('USD,2026-01-02,1.08,Default', 'XXX,2026-01-02,1,Default', 'EUR,2026-01-02,1,Default', 'GBP,2026-02-30,0.85,Default', 'CHF,2026-01-02,-1,Default', 'CHF,2026-01-02,0.9,Weekly', 'USD,2026-01-02,1.09,Default'), catalog, 'EUR');
    expect(r.rates.length).toBe(1);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(r.errors[0].message).toContain('not a currency');
    expect(r.errors[1].message).toContain('base currency');
    expect(r.errors[2].message).toContain('not a day');
    expect(r.errors[3].message).toContain('above zero');
    expect(r.errors[4].message).toContain('rate type');
    expect(r.errors[5].message).toContain('twice');
  });
  it('a file without the columns, an empty file', () => {
    expect(parseRatesCsv('a,b,c\n1,2,3', catalog, 'EUR').errors[0].message).toContain('currencyCode, startingDate, currencyRatio');
    expect(parseRatesCsv('', catalog, 'EUR').errors[0].message).toBe('The file is empty');
  });
  it('a quoted cell and the helpers', () => {
    expect(splitCsvLine('a,"b,""c""",d', ',')).toEqual(['a', 'b,"c"', 'd']);
    expect(parseRateDay('1.2.2026')).toBe('2026-02-01');
    expect(parseRateDay('2026-13-01')).toBe('');
  });
  it('the rows for the table: the key of a Budget rate carries the type, the newer day has the smaller order', () => {
    const r = parseRatesCsv(csv('USD,2026-01-02,1.08,Default', 'USD,2026-01-02,1.1,Budget'), catalog, 'EUR');
    const rows = rateRowsOf(r.rates, 'EUR');
    expect(rows.map((x) => x.rowParentGUID)).toEqual(['2026-01-02', '2026-01-02|Budget']);
    expect(rows[0].rowJSON).toMatchObject({ startingDate: '2026-01-02', currencyRatio: 1.08, rateType: 'Default', rateSource: 'csv', rateBase: 'EUR' });
    expect(rows[0].orderInList).toBeLessThan(0);
  });
});
