import { computeLineJSON, formatMoney, lineNumber, lineSums, taskLineTotals } from '../../../../../kit8/pm/view/task/finances/taskLineMoney';

describe('lineNumber', () => {
  it('a number >= 0, else null', () => {
    expect(lineNumber('12.5')).toBe(12.5);
    expect(lineNumber(0)).toBe(0);
    expect(lineNumber(-1)).toBeNull();
    expect(lineNumber('')).toBeNull();
    expect(lineNumber(null)).toBeNull();
    expect(lineNumber(undefined)).toBeNull();
    expect(lineNumber('abc')).toBeNull();
  });
});

describe('lineSums', () => {
  it('sum = qty * price, VAT = sum * ratio / 100, both to 2 decimals', () => {
    expect(lineSums(8, 12.5, 21)).toEqual({ sumForContract: 100, sumVATForContract: 21 });
    expect(lineSums(3, 0.1, 21)).toEqual({ sumForContract: 0.3, sumVATForContract: 0.06 });
    expect(lineSums(1.5, 33.33, 0)).toEqual({ sumForContract: 50, sumVATForContract: 0 });
  });
  it('qty or price missing = no sum; an empty VAT is 0 %; VAT above 100 is cut', () => {
    expect(lineSums(null, 5, 21)).toEqual({ sumForContract: null, sumVATForContract: null });
    expect(lineSums(2, '', 21)).toEqual({ sumForContract: null, sumVATForContract: null });
    expect(lineSums(2, 5, null)).toEqual({ sumForContract: 10, sumVATForContract: 0 });
    expect(lineSums(2, 5, 500)).toEqual({ sumForContract: 10, sumVATForContract: 10 });
  });
});

describe('computeLineJSON', () => {
  const role = { price: 40, priceSource: 'role' as const, measureUnit: 'unit_hour', vatPercent: 0 };

  it('fills the unit, VAT and price from the catalog of an empty line, and the sums', () => {
    expect(computeLineJSON({ resourceRoleItem: 'r1', qtyTaskLine: 10 }, role)).toEqual({
      priceTaskLine: 40, priceAutoTaskLine: 40, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0,
      priceSourceTaskLine: 'role', sumForContract: 400, sumVATForContract: 0,
    });
  });

  it('a price that still equals the last suggestion follows the catalog when the role changes', () => {
    const line = { qtyTaskLine: 2, priceTaskLine: 40, priceAutoTaskLine: 40, priceSourceTaskLine: 'role' as const, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, sumForContract: 80, sumVATForContract: 0 };
    expect(computeLineJSON(line, { ...role, price: 55 })).toEqual({ priceTaskLine: 55, priceAutoTaskLine: 55, sumForContract: 110 });
  });

  it('a price the user typed stays (manual), also when the role changes; the sums follow it', () => {
    const typed = { qtyTaskLine: 2, priceTaskLine: 47, priceAutoTaskLine: 40, priceSourceTaskLine: 'role' as const, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, sumForContract: 80, sumVATForContract: 0 };
    expect(computeLineJSON(typed, role)).toEqual({ priceSourceTaskLine: 'manual', sumForContract: 94 });
    const manual = { ...typed, priceSourceTaskLine: 'manual' as const, sumForContract: 94 };
    expect(computeLineJSON(manual, { ...role, price: 99 })).toEqual({ priceAutoTaskLine: 99 }); // remembered, the price is not touched
  });

  it('a unit and a VAT ratio the user chose stay; 0 % is a real value', () => {
    const patch = computeLineJSON({ qtyTaskLine: 1, priceTaskLine: 100, priceAutoTaskLine: 100, measureUnitTaskLine: 'unit_pcs', vatRatioTaskLine: 0 }, { price: 100, priceSource: 'product', measureUnit: 'unit_kg', vatPercent: 21 });
    expect(patch.measureUnitTaskLine).toBeUndefined();
    expect(patch.vatRatioTaskLine).toBeUndefined();
    expect([patch.sumForContract, patch.sumVATForContract]).toEqual([100, 0]); // 0 % VAT stays 0 %, not the catalog's 21 %
  });

  it('no suggestion (nothing chosen): only the sums; qty cleared = the sums are cleared', () => {
    expect(computeLineJSON({ qtyTaskLine: 3, priceTaskLine: 5, vatRatioTaskLine: 10 }, null)).toEqual({
      priceSourceTaskLine: 'manual', sumForContract: 15, sumVATForContract: 1.5,
    });
    expect(computeLineJSON({ qtyTaskLine: null, priceTaskLine: 5, priceSourceTaskLine: 'manual', sumForContract: 15, sumVATForContract: 1.5 }, null)).toEqual({ sumForContract: null, sumVATForContract: null });
  });

  it('writes nothing when nothing changed', () => {
    const settled = { qtyTaskLine: 2, priceTaskLine: 40, priceAutoTaskLine: 40, priceSourceTaskLine: 'role' as const, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, sumForContract: 80, sumVATForContract: 0 };
    expect(computeLineJSON(settled, role)).toEqual({});
  });
});

describe('taskLineTotals / formatMoney', () => {
  it('count and sums per genus tab; other genus are not counted', () => {
    const totals = taskLineTotals([
      { rowParentGUID: 'timeGenus', rowJSON: { sumForContract: 100.1, sumVATForContract: 21 } },
      { rowParentGUID: 'timeGenus', rowJSON: { sumForContract: 50.2, sumVATForContract: null } },
      { rowParentGUID: 'materialGenus', rowJSON: { sumForContract: 10, sumVATForContract: 2.1 } },
      { rowParentGUID: 'paymentsGenus', rowJSON: { sumForContract: 999 } },
    ]);
    expect(totals.map((t) => [t.genus, t.count, t.sumForContract, t.sumVATForContract])).toEqual([
      ['timeGenus', 2, 150.3, 21], ['materialGenus', 1, 10, 2.1], ['expenseGenus', 0, 0, 0], ['revenueGenus', 0, 0, 0],
    ]);
  });
  it('formats with a space for thousands and 2 decimals', () => {
    expect(formatMoney(1234567.5)).toBe('1 234 567.50');
    expect(formatMoney(0)).toBe('0.00');
    expect(formatMoney(NaN)).toBe('0.00');
  });
});
