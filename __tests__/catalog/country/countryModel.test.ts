import {
  countryTable,
  COUNTRY_ENTITY,
  COUNTRY_CATALOG_OWNER,
  emptyCountry,
  normalizeCountry,
  validateCountry,
  countryToCard,
  DEFAULT_COUNTRIES,
  CountryRow,
} from '../../../kit8/catalog/country/countryModel';

describe('countryModel', () => {
  it('defines correct table and entity constants following defTable.md', () => {
    expect(countryTable).toBe('countryTable');
    expect(COUNTRY_ENTITY).toBe('countryReusable');
    expect(COUNTRY_CATALOG_OWNER).toBe('countryCatalog');
  });

  it('creates emptyCountry with default values', () => {
    const empty = emptyCountry();
    expect(empty.countryName).toBe('');
    expect(empty.countryCode).toBe('');
    expect(empty.currencyCode).toBe('EUR');
    expect(empty.isActive).toBe(true);
  });

  it('normalizes country data properly', () => {
    const normalized = normalizeCountry({
      countryName: '  Latvia  ',
      countryCode: 'lv',
      countryCodeAlpha3: 'lva',
      phonePrefix: '371',
      currencyCode: 'eur',
      flagEmoji: '🇱🇻',
    });

    expect(normalized.countryName).toBe('Latvia');
    expect(normalized.countryCode).toBe('LV');
    expect(normalized.countryCodeAlpha3).toBe('LVA');
    expect(normalized.phonePrefix).toBe('+371');
    expect(normalized.currencyCode).toBe('EUR');
    expect(normalized.flagEmoji).toBe('🇱🇻');
    expect(normalized.isActive).toBe(true);
  });

  it('validates required fields for country', () => {
    const invalid = validateCountry({});
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.countryName).toBeDefined();
    expect(invalid.errors.countryCode).toBeDefined();

    const valid = validateCountry({
      countryName: 'Estonia',
      countryCode: 'EE',
      countryCodeAlpha3: 'EST',
      currencyCode: 'EUR',
    });
    expect(valid.valid).toBe(true);
    expect(Object.keys(valid.errors).length).toBe(0);
  });

  it('rejects invalid country codes', () => {
    const badCode = validateCountry({
      countryName: 'France',
      countryCode: 'FRA', // should be 2 letters
    });
    expect(badCode.valid).toBe(false);
    expect(badCode.errors.countryCode).toBeDefined();

    const badAlpha3 = validateCountry({
      countryName: 'France',
      countryCode: 'FR',
      countryCodeAlpha3: 'F', // should be 3 letters
    });
    expect(badAlpha3.valid).toBe(false);
    expect(badAlpha3.errors.countryCodeAlpha3).toBeDefined();
  });

  it('contains seed default countries', () => {
    expect(DEFAULT_COUNTRIES.length).toBeGreaterThanOrEqual(15);
    const lv = DEFAULT_COUNTRIES.find((c) => c.countryCode === 'LV');
    expect(lv).toBeDefined();
    expect(lv?.countryName).toBe('Latvia');
    expect(lv?.phonePrefix).toBe('+371');
  });

  it('converts country row to card item for ListWebCardsComponent', () => {
    const row: CountryRow = {
      rowGUID: 'country-lv-123',
      rowOwnerGUID: COUNTRY_CATALOG_OWNER,
      rowParentGUID: 'empty',
      orderInList: 0,
      rowJSON: {
        countryName: 'Latvia',
        countryCode: 'LV',
        countryCodeAlpha3: 'LVA',
        phonePrefix: '+371',
        currencyCode: 'EUR',
        flagEmoji: '🇱🇻',
        isActive: true,
      },
    };

    const card = countryToCard(row, 0);
    expect(card.id).toBe('country-lv-123');
    expect(card.title).toContain('Latvia');
    expect(card.title).toContain('LV');
    expect(card.title).toContain('🇱🇻');
    expect(card.description).toContain('Alpha-3: LVA');
    expect(card.description).toContain('Phone: +371');
    expect(card.description).toContain('Currency: EUR');
  });
});
