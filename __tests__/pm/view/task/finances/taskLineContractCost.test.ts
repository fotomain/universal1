import { contractPeriodHours, contractUnitPrice } from '../../../../../kit8/pm/view/task/finances/taskLineContractCost';

describe('working hours of a contract period', () => {
  it('Day 8 · Week 40 · Month 168 · Quarter 504 · Year 2016; OneTime and unknown have none', () => {
    expect(['Day', 'Week', 'Month', 'Quarter', 'Year'].map(contractPeriodHours)).toEqual([8, 40, 168, 504, 2016]);
    expect(contractPeriodHours('OneTime')).toBeNull();
    expect(contractPeriodHours(undefined)).toBeNull();
  });
});

describe('contractUnitPrice: the price of one hour from a contract', () => {
  it('sum of the period / hours of the period, rounded to 2 decimals', () => {
    expect(contractUnitPrice({ contractSumBeforeVAT: 3360, contractPaymentsPeriod: 'Month' }, 'unit_hour')).toBe(20);
    expect(contractUnitPrice({ contractSumBeforeVAT: 5500, contractPaymentsPeriod: 'Month' }, 'unit_hour')).toBe(32.74);
    expect(contractUnitPrice({ contractSumBeforeVAT: 240, contractPaymentsPeriod: 'Day' }, 'unit_hour')).toBe(30);
    expect(contractUnitPrice({ contractSumBeforeVAT: 1600, contractPaymentsPeriod: 'Week' }, 'unit_hour')).toBe(40);
  });
  it('no price: another unit, a one-time contract, an empty / zero sum, no contract', () => {
    expect(contractUnitPrice({ contractSumBeforeVAT: 3360, contractPaymentsPeriod: 'Month' }, 'unit_pcs')).toBeNull();
    expect(contractUnitPrice({ contractSumBeforeVAT: 3360, contractPaymentsPeriod: 'OneTime' }, 'unit_hour')).toBeNull();
    expect(contractUnitPrice({ contractSumBeforeVAT: 0, contractPaymentsPeriod: 'Month' }, 'unit_hour')).toBeNull();
    expect(contractUnitPrice({ contractPaymentsPeriod: 'Month' }, 'unit_hour')).toBeNull();
    expect(contractUnitPrice(undefined, 'unit_hour')).toBeNull();
    expect(contractUnitPrice({ contractSumBeforeVAT: 100, contractPaymentsPeriod: 'Day' }, undefined)).toBeNull();
  });
});
