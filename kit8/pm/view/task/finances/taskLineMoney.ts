// Task lines - the money rules (pure). One function computes the derived fields of a line on every save; the table's
// computeRowJSON calls it, so the sums in SQL are always qty * price.
//   sumForContract    = round(qty * price, 2)
//   sumVATForContract = round(sumForContract * vat / 100, 2)
// There is no budget in this version: the sums in the accounting / budget currency (and their VAT) are not stored yet.
import { roundMoney } from '../../../../catalog/contract/contractModel';
import { TASK_LINE_GENUS } from './taskLineModel';
import type { TaskLinePriceSource, TaskLineRow, TaskLineRowJSON } from './taskLineModel';

/** a number >= 0 from a cell value; anything else (empty, text, negative) = null */
export const lineNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function lineSums(qty: unknown, price: unknown, vatPercent: unknown): { sumForContract: number | null; sumVATForContract: number | null } {
  const q = lineNumber(qty);
  const p = lineNumber(price);
  if (q === null || p === null) return { sumForContract: null, sumVATForContract: null };
  const sum = roundMoney(q * p);
  const vat = Math.min(100, lineNumber(vatPercent) ?? 0);
  return { sumForContract: sum, sumVATForContract: roundMoney((sum * vat) / 100) };
}

/** what a catalog suggests for a line (see taskLineCatalogs.ts) */
export interface LineSuggestion {
  price: number | null;
  priceSource: Exclude<TaskLinePriceSource, 'manual'> | null;
  measureUnit: string | null;
  vatPercent: number | null;
}

/**
 * The derived fields of a line after a cell changed (the patch saved together with the change):
 *  - the unit and the VAT ratio are taken from the catalog while they are empty (a value the user typed stays)
 *  - the price follows the catalog while it is empty or still equals the last suggestion (priceAutoTaskLine); a price the user
 *    typed ('manual') stays when the role / product changes
 *  - the sums
 */
export function computeLineJSON(json: Partial<TaskLineRowJSON>, suggestion: LineSuggestion | null): Partial<TaskLineRowJSON> {
  const patch: Partial<TaskLineRowJSON> = {};
  const next: Partial<TaskLineRowJSON> = { ...json };
  const price = lineNumber(json.priceTaskLine);
  const auto = lineNumber(json.priceAutoTaskLine);
  const followsCatalog = price === null || (auto !== null && price === auto);

  if (suggestion) {
    if (followsCatalog && suggestion.price !== null && suggestion.price !== price) { next.priceTaskLine = suggestion.price; patch.priceTaskLine = suggestion.price; }
    if (suggestion.price !== null && suggestion.price !== auto) { next.priceAutoTaskLine = suggestion.price; patch.priceAutoTaskLine = suggestion.price; }
    if (!json.measureUnitTaskLine && suggestion.measureUnit) { next.measureUnitTaskLine = suggestion.measureUnit; patch.measureUnitTaskLine = suggestion.measureUnit; }
    if (lineNumber(json.vatRatioTaskLine) === null && suggestion.vatPercent !== null) { next.vatRatioTaskLine = suggestion.vatPercent; patch.vatRatioTaskLine = suggestion.vatPercent; }
  }

  const finalPrice = lineNumber(next.priceTaskLine);
  const finalAuto = lineNumber(next.priceAutoTaskLine);
  const source: TaskLinePriceSource | null = finalPrice === null ? null : finalAuto !== null && finalPrice === finalAuto ? (suggestion?.priceSource ?? json.priceSourceTaskLine ?? 'manual') : 'manual';
  if ((json.priceSourceTaskLine ?? null) !== source) patch.priceSourceTaskLine = source;

  const sums = lineSums(next.qtyTaskLine, next.priceTaskLine, next.vatRatioTaskLine);
  if ((json.sumForContract ?? null) !== sums.sumForContract) patch.sumForContract = sums.sumForContract;
  if ((json.sumVATForContract ?? null) !== sums.sumVATForContract) patch.sumVATForContract = sums.sumVATForContract;
  return patch;
}

export interface GenusTotals {
  genus: string; title: string; count: number; sumForContract: number; sumVATForContract: number;
  /** the same in the accounting / budget currency of the project (0 when the lines have none) */
  sumForAccounting: number; sumVATForAccounting: number; sumForBudget: number; sumVATForBudget: number;
}

/** count + sums per genus tab of the lines of ONE task (a line of another genus is not counted) */
export function taskLineTotals(rows: Pick<TaskLineRow, 'rowParentGUID' | 'rowJSON'>[]): GenusTotals[] {
  return TASK_LINE_GENUS.map((g) => {
    const mine = rows.filter((r) => r.rowParentGUID === g.genus);
    return {
      genus: g.genus,
      title: g.title,
      count: mine.length,
      sumForContract: roundMoney(mine.reduce((a, r) => a + (lineNumber(r.rowJSON?.sumForContract) ?? 0), 0)),
      sumVATForContract: roundMoney(mine.reduce((a, r) => a + (lineNumber(r.rowJSON?.sumVATForContract) ?? 0), 0)),
      sumForAccounting: roundMoney(mine.reduce((a, r) => a + (lineNumber(r.rowJSON?.sumForAccounting) ?? 0), 0)),
      sumVATForAccounting: roundMoney(mine.reduce((a, r) => a + (lineNumber(r.rowJSON?.sumVATForAccounting) ?? 0), 0)),
      sumForBudget: roundMoney(mine.reduce((a, r) => a + (lineNumber(r.rowJSON?.sumForBudget) ?? 0), 0)),
      sumVATForBudget: roundMoney(mine.reduce((a, r) => a + (lineNumber(r.rowJSON?.sumVATForBudget) ?? 0), 0)),
    };
  });
}

/** 1 234.50 */
export const formatMoney = (n: number): string => {
  const fixed = (Number.isFinite(n) ? n : 0).toFixed(2);
  const [int, dec] = fixed.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`;
};
