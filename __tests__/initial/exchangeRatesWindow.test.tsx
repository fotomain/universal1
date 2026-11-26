/** @jest-environment jsdom */
// The separate window of the exchange rates (Q5): fill from 1 January, download the template, import the CSV.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, renderUI, textOf, wait } from '../pm/ui/pmUiTestKit';

const mockFillYear = jest.fn();
const mockImport = jest.fn();
const mockDownload = jest.fn();
const mockPick = jest.fn();
const currencies = [{ rowGUID: 'g-USD', rowJSON: { currencyCode: 'USD' } }, { rowGUID: 'g-GBP', rowJSON: { currencyCode: 'GBP' } }, { rowGUID: 'g-EUR', rowJSON: { currencyCode: 'EUR' } }];
jest.doMock('../../kit8/initial/data/code/rates/ratesApi', () => ({
  readCurrencies: async () => currencies,
  fillRatesFromYearStart: (...a: any[]) => mockFillYear(...a),
  importRates: (...a: any[]) => mockImport(...a),
}));
// the base currency of the test is EUR whatever .env says
jest.doMock('../../kit8/catalog/currency/refresh/currencyRefreshConfig', () => ({ currencyRefreshConfig: () => ({ apiUrl: 'https://rates.test/v2', base: 'EUR', months: 2, providers: '' }) }));
jest.doMock('../../kit8/pm/crud/exchange/project/export/downloadTextFile', () => ({ downloadTextFile: (...a: any[]) => mockDownload(...a) }));
jest.doMock('../../kit8/files/common/pickFiles', () => ({ pickFiles: (...a: any[]) => mockPick(...a) }));

const ExchangeRatesWindow = require('../../kit8/initial/data/code/rates/ExchangeRatesWindow').default;
const { RATES_TEMPLATE_FILE } = require('../../kit8/initial/data/code/rates/ratesModel');
const flush = () => act(async () => { await wait(0); });
const fileOf = (text: string) => ({ name: 'my rates.csv', mime: 'text/csv', size: text.length, blob: { text: async () => text } });

beforeEach(() => {
  [mockFillYear, mockImport, mockDownload, mockPick].forEach((m) => m.mockReset());
  mockFillYear.mockResolvedValue({ from: '2026-01-01', to: '2026-11-26', base: 'EUR', added: { USD: 230, GBP: 230 }, addedTotal: 460, upToDate: [], unsupported: [], baseSkipped: false });
  mockImport.mockResolvedValue({ written: 2, skipped: 0 });
  mockDownload.mockResolvedValue('downloaded');
});
afterEach(() => cleanupUI());

async function open(onClose = jest.fn()) {
  renderUI(<ExchangeRatesWindow visible supabase={{}} onClose={onClose} />);
  await flush();
  return onClose;
}

describe('ExchangeRatesWindow', () => {
  it('is closed when it is not visible', () => {
    renderUI(<ExchangeRatesWindow visible={false} supabase={{}} onClose={jest.fn()} />);
    expect(q('exchange-rates')).toBeNull();
  });
  it('fills every missing day from 1 January to today for the currencies of the catalog', async () => {
    await open();
    press('exchange-rates-fill');
    await flush();
    expect(mockFillYear).toHaveBeenCalledTimes(1);
    expect(mockFillYear.mock.calls[0][0].currencies).toEqual(currencies);
    expect(textOf('exchange-rates-message')).toContain('Rates added');
  });
  it('offers the template for download under the name the owner gave', async () => {
    await open();
    press('exchange-rates-download');
    await flush();
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [name, text, mime] = mockDownload.mock.calls[0];
    expect(name).toBe(RATES_TEMPLATE_FILE);
    expect(name).toBe('currencies_reates_import_template.csv');
    expect(mime).toBe('text/csv');
    expect(String(text).split('\r\n')[0]).toBe('currencyCode,startingDate,currencyRatio,rateType');
    expect(String(text)).toContain('USD,');
    expect(String(text)).toContain('GBP,');
    expect(String(text)).not.toContain('EUR,');
    expect(textOf('exchange-rates-message')).toContain(RATES_TEMPLATE_FILE);
  });
  it('imports a file: a preview first (how many, which lines are wrong), then the import', async () => {
    mockPick.mockResolvedValue([fileOf('currencyCode,startingDate,currencyRatio,rateType\nUSD,2026-01-02,1.08,Default\nGBP,2026-01-02,0.86,\nXXX,2026-01-02,1,Default\nUSD,2026-01-05,,Default\n')]);
    await open();
    press('exchange-rates-import');
    await flush();
    expect(textOf('exchange-rates-preview')).toContain('2 rate(s) can be imported');
    expect(textOf('exchange-rates-preview')).toContain('1 line(s) without a ratio are skipped');
    expect(textOf('exchange-rates-preview')).toContain('Line 4');
    expect(mockImport).not.toHaveBeenCalled();
    press('exchange-rates-import-go');
    await flush();
    expect(mockImport).toHaveBeenCalledTimes(1);
    const args = mockImport.mock.calls[0][0];
    expect(args.rates.map((r: any) => [r.currencyCode, r.day, r.ratio])).toEqual([['USD', '2026-01-02', 1.08], ['GBP', '2026-01-02', 0.86]]);
    expect(args.overwrite).toBe(false);
    expect(textOf('exchange-rates-message')).toContain('2 rate(s) written');
  });
  it('"replace" is a choice of the user, off by default', async () => {
    mockPick.mockResolvedValue([fileOf('currencyCode,startingDate,currencyRatio\nUSD,2026-01-02,1.08\n')]);
    await open();
    press('exchange-rates-import');
    await flush();
    press('exchange-rates-overwrite');
    press('exchange-rates-import-go');
    await flush();
    expect(mockImport.mock.calls[0][0].overwrite).toBe(true);
  });
  it('a file with nothing to import cannot be imported', async () => {
    mockPick.mockResolvedValue([fileOf('currencyCode,startingDate,currencyRatio\nUSD,2026-01-02,\n')]);
    await open();
    press('exchange-rates-import');
    await flush();
    expect(mustGet('exchange-rates-import-go').getAttribute('aria-disabled')).toBe('true');
  });
  it('cancelling the file dialog changes nothing', async () => {
    mockPick.mockResolvedValue([]);
    await open();
    press('exchange-rates-import');
    await flush();
    expect(q('exchange-rates-preview')).toBeNull();
  });
  it('a failure is shown in words', async () => {
    mockFillYear.mockRejectedValue(new Error('Rates service is not reachable (offline)'));
    await open();
    press('exchange-rates-fill');
    await flush();
    expect(textOf('exchange-rates-problem')).toContain('not reachable');
  });
  it('the button Close closes it', async () => {
    const onClose = await open();
    press('exchange-rates-close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('the ✕ at the top right closes it too', async () => {
    const onClose = await open();
    press('exchange-rates-close-x');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
