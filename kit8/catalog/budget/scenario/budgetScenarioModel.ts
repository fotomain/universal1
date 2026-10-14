// Budget scenario - a plain list of the scenarios a project budgets in: Plan (what is planned) | Fact (what really happened).
//   budgetScenarioTable  rowGUID = the code (seeds: planScenarioProject1, factScenarioProject1) · rowOwnerGUID 'budgetScenarioCatalog' · rowParentGUID 'empty' always
//                        · orderInList · rowJSON { title, description, scenarioKind: 'plan' | 'fact', isActive }
//   project_table.rowJSON.budgetScenarioForPlan  = a scenario of kind 'plan'      (Project settings -> Budgets -> Main)
//   project_table.rowJSON.budgetScenarioForFact  = a scenario of kind 'fact'
//   SQL: kit8/sql/start/start1_sql_structure.sql PART 19 · Screen: BudgetScenarioCRUD · route BUDGET_SCENARIO_ROUTES.list
//   Design: documentation/BUDGET_PLAN_CALCULATION.html (Part 1)
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const BUDGET_SCENARIO_ROUTES = { list: '/budget/scenario/list' } as const;

export type BudgetScenarioKind = 'plan' | 'fact';
export const BUDGET_SCENARIO_KINDS: { value: BudgetScenarioKind; label: string }[] = [
  { value: 'plan', label: 'Plan' },
  { value: 'fact', label: 'Fact' },
];

export const BUDGET_SCENARIO = { plan: 'planScenarioProject1', fact: 'factScenarioProject1' } as const;

export interface BudgetScenarioJSON {
  title: string | null;
  description: string | null;
  scenarioKind: BudgetScenarioKind;
  isActive: boolean;
}

export const emptyBudgetScenario = (): BudgetScenarioJSON => ({ title: null, description: null, scenarioKind: 'plan', isActive: true });

export const BUDGET_SCENARIO_TABLE: ProductTableDef = {
  table: 'budgetScenarioTable',
  entity: 'budgetScenarioReusable',
  itemLabel: 'Budget scenario',
  catalogOwner: 'budgetScenarioCatalog',
  purpose: 'The scenarios a project budgets in: a Plan scenario (what is planned) and a Fact scenario (what really happened). A project points at one of each.',
  emptyRowJSON: () => ({ ...emptyBudgetScenario() }),
};

export const budgetScenarioTitle = (r: DefRow<any> | undefined | null): string => String(r?.rowJSON?.title ?? '').trim() || r?.rowGUID || '';
export const isBudgetScenarioActive = (r: DefRow<any>): boolean => r.rowJSON?.isActive !== false;

/** the scenarios the picker of a project offers for a kind: that kind, active (the one already chosen stays, so an old choice is never hidden) */
export function budgetScenariosOfKind(rows: DefRow<any>[], kind: BudgetScenarioKind, keepGUID?: string | null): DefRow<any>[] {
  return (rows || [])
    .filter((r) => r.rowJSON?.scenarioKind === kind && (isBudgetScenarioActive(r) || r.rowGUID === keepGUID))
    .slice()
    .sort((a, b) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
}

/** the error of a project's two scenario fields, or null: the Plan field must name a plan scenario and the Fact field a fact scenario (checked once the rows are read) */
export function projectBudgetScenariosError(
  values: { budgetScenarioForPlan?: string | null; budgetScenarioForFact?: string | null },
  rows: DefRow<any>[],
  loaded: boolean,
): string | null {
  if (!loaded) return null;
  const kindOf = (g?: string | null) => (g ? rows.find((r) => r.rowGUID === g)?.rowJSON?.scenarioKind : undefined);
  const plan = values.budgetScenarioForPlan, fact = values.budgetScenarioForFact;
  if (plan && kindOf(plan) !== undefined && kindOf(plan) !== 'plan') return 'budgetScenarioForPlan must be a Plan scenario';
  if (fact && kindOf(fact) !== undefined && kindOf(fact) !== 'fact') return 'budgetScenarioForFact must be a Fact scenario';
  return null;
}
