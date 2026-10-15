// Project cost total - the pure part (no React, no Supabase): the switch rules, the rows of project_task_cost_total, the realtime events and the texts.
//   costTotalForBudget of a task = the plan in the budget currency, Time + Material + Expense; of a stage = its own + everything below it.
//   The server (start2_sql_code.sql PART 27) keeps the numbers while a cost budget is on; the app only shows them. Design: documentation/UPDATE_PROJECT_COST.html.
import { projectCostBudgetOn } from '../model/taskInputScope';

export const COST_TOTAL_TABLE = 'project_task_cost_total';
export const RPC_UPDATE_PROJECT_COST_TOTAL = 'update_project_cost_total';
/** events within this time are applied together (one render) */
export const COST_EVENT_BATCH_MS = 150;
export const COST_PAGE_SIZE = 1000;

type SwitchJson = (Parameters<typeof projectCostBudgetOn>[0] & { showTotalCostOnTheGanttChart?: unknown; currencyForBudget?: unknown }) | null | undefined;

/** the switch showTotalCostOnTheGanttChart can be used only while a cost budget is on (Time or Material or Expense) */
export const costSwitchUsable = (json: SwitchJson): boolean => projectCostBudgetOn(json);

/** the Cost column is shown: a cost budget is on AND the project switch is on (the stored value is kept when the budget is turned off) */
export const costColumnShown = (json: SwitchJson): boolean => projectCostBudgetOn(json) && json?.showTotalCostOnTheGanttChart === true;

/** the budget currency of the project (ISO code) for the header of the column; '' when the project has none */
export const costCurrencyOf = (json: SwitchJson): string => (typeof json?.currencyForBudget === 'string' ? json.currencyForBudget.toUpperCase() : '');

/** a row of project_task_cost_total as the app keeps it (numeric columns arrive as strings) */
export interface CostTotalRow { taskGUID: string; own: number; total: number }

export const parseCostRow = (raw: any): CostTotalRow => ({
  taskGUID: String(raw?.rowOwnerGUID ?? ''),
  own: Number(raw?.costOwnForBudget) || 0,
  total: Number(raw?.costTotalForBudget) || 0,
});

export type CostTotals = ReadonlyMap<string, number>;
export const NO_COST_TOTALS: CostTotals = new Map();

export function costTotalsOf(rows: readonly CostTotalRow[]): CostTotals {
  const m = new Map<string, number>();
  for (const r of rows) if (r.taskGUID && r.total !== 0) m.set(r.taskGUID, r.total);
  return m;
}

/** a Realtime payload of postgres_changes (REPLICA IDENTITY FULL: the whole row; a DELETE carries the key) */
export interface CostEvent { eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string; new?: any; old?: any }

/** the events patched into the map by the key of the task; the SAME map when nothing changed */
export function applyCostEvents(current: CostTotals, events: readonly CostEvent[]): CostTotals {
  let next: Map<string, number> | null = null;
  const write = () => (next ??= new Map(current));
  for (const e of events) {
    if (e.eventType === 'DELETE') {
      const key = String(e.old?.rowOwnerGUID ?? '');
      if (key && (next ?? current).has(key)) write().delete(key);
    } else {
      const r = parseCostRow(e.new);
      if (!r.taskGUID) continue;
      if (r.total === 0) { if ((next ?? current).has(r.taskGUID)) write().delete(r.taskGUID); continue; }
      if ((next ?? current).get(r.taskGUID) !== r.total) write().set(r.taskGUID, r.total);
    }
  }
  return next ?? current;
}

/** 48250 -> "48 250.00" (a thin fixed format: the cell is narrow, the currency is in the header); undefined / 0 -> '' (no cost = an empty cell) */
export function formatCost(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return '';
  const neg = value < 0;
  const [int, dec] = Math.abs(value).toFixed(2).split('.');
  return `${neg ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`;
}

/** the answer of update_project_cost_total */
export interface CostUpdateAnswer { tasks: number; rows: number; projectTotal: number; changedRows: number; ms: number; flushed: number }

export function parseCostAnswer(d: any): CostUpdateAnswer {
  return {
    tasks: Number(d?.tasks) || 0,
    rows: Number(d?.rows) || 0,
    projectTotal: Number(d?.projectTotal) || 0,
    changedRows: Number(d?.changedRows) || 0,
    ms: Number(d?.ms) || 0,
    flushed: Number(d?.flushed) || 0,
  };
}

// the "stale" bus: the toolbar command (or a Post) tells the open tree to read the totals again, without a prop chain between two far screens
type Listener = (projectGUID: string | null) => void;
const listeners = new Set<Listener>();
export const onCostTotalsStale = (fn: Listener): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const emitCostTotalsStale = (projectGUID: string | null): void => { for (const fn of [...listeners]) fn(projectGUID); };
