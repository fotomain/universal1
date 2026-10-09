// Task lines - the cost of a PERSON from his contract (pure). A contract holds a sum per payment period (contractSumBeforeVAT per
// contractPaymentsPeriod); a Time line is counted in HOURS, so the sum is divided by the working hours of the period:
//     Day 8 h · Week 40 h (5 days) · Month 168 h (21 days) · Quarter 504 h · Year 2016 h · OneTime: no hourly price
// The working time is the standard one (8 h a day, 5 days a week, 21 days a month); change the constants to change the conversion.
// Only the hour can be derived: another unit has no price from a contract (the rate of the role is used then).
import { roundMoney } from '../../../../catalog/contract/contractModel';
import { lineNumber } from './taskLineMoney';

export const CONTRACT_UNIT_HOUR = 'unit_hour';
export const WORKING_HOURS_PER_DAY = 8;
export const WORKING_DAYS_PER_WEEK = 5;
export const WORKING_DAYS_PER_MONTH = 21;

/** the working hours one payment period of a contract covers (null = a period without a length: OneTime) */
export function contractPeriodHours(period: unknown): number | null {
  switch (period) {
    case 'Day': return WORKING_HOURS_PER_DAY;
    case 'Week': return WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_WEEK;
    case 'Month': return WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH;
    case 'Quarter': return WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * 3;
    case 'Year': return WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * 12;
    default: return null;
  }
}

/** the price of ONE unit from a contract's rowJSON, in the currency of the contract; null = the contract gives no price for that unit */
export function contractUnitPrice(contract: { contractSumBeforeVAT?: unknown; contractPaymentsPeriod?: unknown } | null | undefined, unit: string | null | undefined): number | null {
  if (!contract || unit !== CONTRACT_UNIT_HOUR) return null;
  const hours = contractPeriodHours(contract.contractPaymentsPeriod);
  const sum = lineNumber(contract.contractSumBeforeVAT);
  if (!hours || sum === null || sum <= 0) return null;
  return roundMoney(sum / hours);
}
