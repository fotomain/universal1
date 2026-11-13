// The price list of the cost calculator: the built-in snapshot (documentation/PRICE_PLAN_CALCULATOR.html section 2) and the checks a fetched list must pass (section 8).
import { BUILT_IN_PRICES, priceListAgeDays, priceListDate, priceListState, validatePriceList, type SupabasePriceList } from '../../../kit8/system/costcalculator/supabasePrices';

const copy = (): SupabasePriceList => JSON.parse(JSON.stringify(BUILT_IN_PRICES));

describe('the built-in snapshot', () => {
  it('is a valid list with ten sizes whose prices rise', () => {
    expect(validatePriceList(BUILT_IN_PRICES)).toEqual({ ok: true, problems: [] });
    expect(BUILT_IN_PRICES.compute.map((s) => s.size)).toEqual(['Micro', 'Small', 'Medium', 'Large', 'XL', '2XL', '4XL', '8XL', '12XL', '16XL']);
    const prices = BUILT_IN_PRICES.compute.map((s) => s.perMonth);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
  it('has the numbers of the document', () => {
    expect(BUILT_IN_PRICES.plans).toEqual({ pro: { fee: 25, computeCredits: 10 }, team: { fee: 599, computeCredits: 10 } });
    expect(BUILT_IN_PRICES.included.diskGBPerProject).toBe(8);
    expect(BUILT_IN_PRICES.overage.diskGB).toBe(0.125);
    expect(BUILT_IN_PRICES.compute[0]).toMatchObject({ size: 'Micro', perMonth: 10, memoryGB: 1, maxDatabaseGB: 10 });
    expect(BUILT_IN_PRICES.unconfirmed).toContain('addons.ipv4');
  });
});

describe('validatePriceList', () => {
  it('refuses a list with a missing key, a silly fee, too few sizes or a size that is not dearer', () => {
    const noKey = copy(); delete (noKey.overage as any).egressGB;
    expect(validatePriceList(noKey).ok).toBe(false);
    const silly = copy(); silly.plans.pro.fee = 0.5;
    expect(validatePriceList(silly).problems.join()).toMatch(/plans\.pro\.fee/);
    const few = copy(); few.compute = few.compute.slice(0, 5);
    expect(validatePriceList(few).problems.join()).toMatch(/at least 8/);
    const flat = copy(); flat.compute[3].perMonth = flat.compute[2].perMonth;
    expect(validatePriceList(flat).problems.join()).toMatch(/does not cost more/);
    expect(validatePriceList(null).ok).toBe(false);
  });
  it('flags a number that moved more than x 3 against the last good list', () => {
    const jumped = copy(); jumped.plans.pro.fee = 100;
    expect(validatePriceList(jumped, BUILT_IN_PRICES).problems.join()).toMatch(/moved more than x 3/);
    const small = copy(); small.plans.pro.fee = 30;
    expect(validatePriceList(small, BUILT_IN_PRICES).ok).toBe(true);
  });
});

describe('age and state', () => {
  it('the snapshot is "builtIn"; a fetched list is fresh for 30 days and then old', () => {
    const now = new Date('2026-12-20T00:00:00Z');
    expect(priceListState(BUILT_IN_PRICES, now)).toBe('builtIn');
    const fetched = { ...copy(), source: 'github:supabase/supabase@abc', fetchedAt: '2026-12-01T00:00:00Z' };
    expect(priceListAgeDays(fetched, now)).toBe(19);
    expect(priceListState(fetched, now)).toBe('fresh');
    expect(priceListState({ ...fetched, fetchedAt: '2026-11-01T00:00:00Z' }, now)).toBe('old');
    expect(priceListState({ ...fetched, fetchedAt: 'garbage' }, now)).toBe('old');
    expect(priceListDate(BUILT_IN_PRICES)).toBe('2026-11-12');
  });
});
