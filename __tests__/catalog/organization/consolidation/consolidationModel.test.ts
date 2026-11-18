// The pure rules of the consolidation settings (kit8/catalog/organization/consolidation/consolidationModel.ts); the SQL twin is tested by kit8/docker/tests/100_consolidation.sql.
import {
  CONSOLIDATION_DEFAULT_RATE_TYPE,
  changedConsolidation,
  consolidationAmount,
  consolidationChangeLines,
  consolidationPatchOf,
  consolidationSettingsOf,
  consolidationSideOf,
  consolidationVatWords,
  parseConsolidationStatus,
} from '../../../../kit8/catalog/organization/consolidation/consolidationModel';
import { normalizeOrganization } from '../../../../kit8/catalog/organization/organizationModel';

describe('consolidation settings of an organization row', () => {
  it('reads the keys; a missing key is the default (Default rate type, both VAT switches OFF, no currency)', () => {
    expect(consolidationSettingsOf({})).toEqual({ currency: '', rateType: CONSOLIDATION_DEFAULT_RATE_TYPE, includePurchaseVAT: false, includeSaleVAT: false });
    expect(consolidationSettingsOf(null).currency).toBe('');
    expect(consolidationSettingsOf({ currencyForConsolidation: 'eur', exchangeRateTypeForConsolidation: 'Budget', consolidationIncludePurchaseVAT: true, consolidationIncludeSaleVAT: 'true' })).toEqual({
      currency: 'EUR', rateType: 'Budget', includePurchaseVAT: true, includeSaleVAT: false, // only a stored boolean true counts
    });
    expect(consolidationSettingsOf({ currencyForConsolidation: 'EURO' }).currency).toBe('');
  });

  it('the patch writes the currency only when there is one (the database keeps / fills it) and always the rate type and the booleans', () => {
    expect(consolidationPatchOf({ currency: '', rateType: '', includePurchaseVAT: false, includeSaleVAT: true })).toEqual({
      exchangeRateTypeForConsolidation: 'Default', consolidationIncludePurchaseVAT: false, consolidationIncludeSaleVAT: true,
    });
    expect(consolidationPatchOf({ currency: 'usd', rateType: 'Budget', includePurchaseVAT: true, includeSaleVAT: false }).currencyForConsolidation).toBe('USD');
  });

  it('normalizeOrganization keeps a valid currency (upper case) and the booleans, drops the rest, and NEVER sends the state', () => {
    const n = normalizeOrganization({ organizationTitle: 'Acme', createdByUser: 'a@b.c', currencyForConsolidation: 'eur', exchangeRateTypeForConsolidation: ' Budget ', consolidationIncludePurchaseVAT: true, consolidationIncludeSaleVAT: false, consolidationState: 'gaps' } as any);
    expect(n.currencyForConsolidation).toBe('EUR');
    expect(n.exchangeRateTypeForConsolidation).toBe('Budget');
    expect(n.consolidationIncludePurchaseVAT).toBe(true);
    expect(n.consolidationIncludeSaleVAT).toBe(false);
    expect('consolidationState' in n).toBe(false);
    const bad = normalizeOrganization({ organizationTitle: 'Acme', createdByUser: 'a@b.c', currencyForConsolidation: '', exchangeRateTypeForConsolidation: '  ', consolidationIncludePurchaseVAT: 'yes' } as any);
    expect('currencyForConsolidation' in bad).toBe(false);
    expect('exchangeRateTypeForConsolidation' in bad).toBe(false);
    expect('consolidationIncludePurchaseVAT' in bad).toBe(false);
  });
});

describe('changes', () => {
  const base = { currency: 'USD', rateType: 'Default', includePurchaseVAT: false, includeSaleVAT: false };
  it('a new organization recalculates nothing; a changed currency or rate type recalculates; a VAT switch does not', () => {
    expect(changedConsolidation(null, base).recalculates).toBe(false);
    expect(changedConsolidation(base, { ...base, currency: 'EUR' }).recalculates).toBe(true);
    expect(changedConsolidation(base, { ...base, rateType: 'Budget' }).recalculates).toBe(true);
    const vat = changedConsolidation(base, { ...base, includeSaleVAT: true });
    expect(vat.recalculates).toBe(false);
    expect(vat.vatChanged).toBe(true);
    expect(changedConsolidation({ ...base, currency: '' }, { ...base, currency: 'EUR' }).recalculates).toBe(false); // an old row that had none: the database filled it
  });
  it('one line per change for the approval window', () => {
    expect(consolidationChangeLines(changedConsolidation(base, { ...base, currency: 'EUR', rateType: 'Budget' }))).toEqual(['Currency for consolidation: USD → EUR', 'Exchange rate type: Default → Budget']);
  });
});

describe('the amount a report adds (the twin of public.consolidation_amount)', () => {
  const off = { includePurchaseVAT: false, includeSaleVAT: false };
  it('purchase OFF = the Cost basis, ON = With VAT; sale OFF = net, ON = With VAT', () => {
    expect(consolidationAmount(100, 21, 5, 'purchase', off)).toBe(105);
    expect(consolidationAmount(100, 21, 5, 'purchase', { ...off, includePurchaseVAT: true })).toBe(121);
    expect(consolidationAmount(100, 21, 5, 'sale', off)).toBe(100);
    expect(consolidationAmount(100, 21, 5, 'sale', { ...off, includeSaleVAT: true })).toBe(121);
  });
  it('a switch of the other side changes nothing; a missing part counts as 0', () => {
    expect(consolidationAmount(100, 21, 5, 'purchase', { ...off, includeSaleVAT: true })).toBe(105);
    expect(consolidationAmount(100, 21, 5, 'sale', { ...off, includePurchaseVAT: true })).toBe(100);
    expect(consolidationAmount(100, undefined as any, undefined as any, 'purchase', off)).toBe(100);
  });
  it('the sale side = kind sold or the Revenue genus', () => {
    expect(consolidationSideOf('sold', 'materialGenus')).toBe('sale');
    expect(consolidationSideOf('used', 'revenueGenus')).toBe('sale');
    expect(consolidationSideOf('used', 'timeGenus')).toBe('purchase');
  });
  it('the words of the header', () => {
    expect(consolidationVatWords(off)).toBe('VAT: purchase without, sale without');
    expect(consolidationVatWords({ includePurchaseVAT: true, includeSaleVAT: false })).toBe('VAT: purchase with, sale without');
  });
});

describe('the status of the database', () => {
  it('parses the answer of consolidation_status; an unknown state reads as ready; nothing = null', () => {
    expect(parseConsolidationStatus(null)).toBeNull();
    expect(parseConsolidationStatus({ currency: 'eur', rateType: 'Default', includePurchaseVAT: true, state: 'gaps', gaps: '3', queued: 0 })).toEqual({
      currency: 'EUR', rateType: 'Default', includePurchaseVAT: true, includeSaleVAT: false, state: 'gaps', gaps: 3, queued: 0,
    });
    expect(parseConsolidationStatus({ state: 'nonsense' })!.state).toBe('ready');
  });
});
