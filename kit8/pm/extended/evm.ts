// C8 Earned value (pure): PV, EV, AC and the indices at the status date.
//   BAC  budget at completion = the planned cost of the task (the plan of its Time + Material + Expense lines)
//   PV   planned value  = BAC x the share of the task that should be done at the status date (by its dates)
//   EV   earned value   = BAC x % complete
//   AC   actual cost    = what was used / invoiced until now (the fact of Monitor01)
//   SV = EV - PV   CV = EV - AC   SPI = EV / PV   CPI = EV / AC   EAC = BAC / CPI   ETC = EAC - AC   VAC = BAC - EAC   TCPI = (BAC - EV) / (BAC - AC)
import type { PMScheduledRow } from '../model/types';
import { expectedPercent } from './tracking';

export interface PMEvm {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  cv: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpi: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const ratio = (a: number, b: number): number | null => (b !== 0 && Number.isFinite(a / b) ? Math.round((a / b) * 1000) / 1000 : null);

export function evmOf(bac: number, pv: number, ev: number, ac: number): PMEvm {
  const cpi = ratio(ev, ac);
  // EAC = BAC / CPI = BAC x AC / EV (from the unrounded values)
  const eac = ev !== 0 && ac !== 0 ? r2((bac * ac) / ev) : ac === 0 ? r2(bac) : null;
  return {
    bac: r2(bac), pv: r2(pv), ev: r2(ev), ac: r2(ac), sv: r2(ev - pv), cv: r2(ev - ac),
    spi: ratio(ev, pv), cpi,
    eac, etc: eac === null ? null : r2(eac - ac), vac: eac === null ? null : r2(bac - eac),
    tcpi: ratio(bac - ev, bac - ac),
  };
}

/** the project EVM: sums over the tasks; `budgetByTask` / `actualByTask` in one currency (the budget currency of the project) */
export function projectEvm(opts: {
  rows: Record<string, PMScheduledRow>;
  budgetByTask: Record<string, number>;
  actualByTask: Record<string, number>;
  progressByTask: Record<string, number>;
  statusMs: number;
}): { total: PMEvm; byTask: Record<string, PMEvm> } {
  const byTask: Record<string, PMEvm> = {};
  let bac = 0, pv = 0, ev = 0, ac = 0;
  for (const guid of Object.keys(opts.budgetByTask)) {
    const row = opts.rows[guid];
    const b = opts.budgetByTask[guid] || 0;
    const a = opts.actualByTask[guid] || 0;
    const pct = Math.max(0, Math.min(100, opts.progressByTask[guid] ?? row?.progress ?? 0));
    const tpv = row ? (b * expectedPercent(row, opts.statusMs)) / 100 : 0;
    const tev = (b * pct) / 100;
    byTask[guid] = evmOf(b, tpv, tev, a);
    bac += b; pv += tpv; ev += tev; ac += a;
  }
  // an actual cost on a task that has no budget still counts in AC
  for (const guid of Object.keys(opts.actualByTask)) if (!(guid in opts.budgetByTask)) { ac += opts.actualByTask[guid] || 0; byTask[guid] = evmOf(0, 0, 0, opts.actualByTask[guid] || 0); }
  return { total: evmOf(bac, pv, ev, ac), byTask };
}
