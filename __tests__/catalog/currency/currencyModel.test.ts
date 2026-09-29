// kit8/catalog/currency/currencyModel: table name, normalize, validation, card mapping.
import { currenciesTable, currencyToCard, normalizeCurrency, validateCurrency } from '../../../kit8/catalog/currency/currencyModel';

const rowOf = (rowGUID: string, currencyCode: string) => ({ rowGUID, rowJSON: { currencyCode } as any });

it('table name', () => expect(currenciesTable).toBe('currencyTable'));

it('normalize: trim, upper-case code, numeric decimals', () => {
  expect(normalizeCurrency({ currencyCode: ' eur ', currencyName: ' Euro ', currencySymbol: ' € ', decimalDigits: '2' as any, isActive: undefined }))
    .toEqual({ currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', currencyNumericCode: '', decimalDigits: 2, isActive: true });
});

it('validate: ISO code, unique code (other rows), name, symbol, numeric code, decimals 0..4', () => {
  const ok = normalizeCurrency({ currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', currencyNumericCode: '978', decimalDigits: 2 });
  expect(validateCurrency(ok)).toEqual({});
  expect(validateCurrency({ ...ok, currencyCode: 'EU' }).currencyCode).toMatch(/3 letters/);
  expect(validateCurrency(ok, [rowOf('x', 'eur')], null).currencyCode).toMatch(/already in the catalog/);
  expect(validateCurrency(ok, [rowOf('me', 'EUR')], 'me')).toEqual({}); // editing itself
  expect(validateCurrency({ ...ok, currencyName: '' }).currencyName).toBeDefined();
  expect(validateCurrency({ ...ok, currencySymbol: 'TOOLONG' }).currencySymbol).toBeDefined();
  expect(validateCurrency({ ...ok, currencyNumericCode: '97' }).currencyNumericCode).toBeDefined();
  expect(validateCurrency({ ...ok, decimalDigits: 5 }).decimalDigits).toBeDefined();
  expect(validateCurrency({ ...ok, decimalDigits: NaN }).decimalDigits).toBeDefined();
});

it('card: title "CODE — Name", description with symbol, decimals, numeric code, inactive', () => {
  const card = currencyToCard({ rowGUID: 'g', orderInList: 5, rowJSON: { currencyCode: 'JPY', currencyName: 'Yen', currencySymbol: '¥', currencyNumericCode: '392', decimalDigits: 0, isActive: false } });
  expect(card).toMatchObject({ id: 'g', title: 'JPY — Yen', description: '¥ · 0 decimals · 392 · inactive', orderInList: 5 });
});
