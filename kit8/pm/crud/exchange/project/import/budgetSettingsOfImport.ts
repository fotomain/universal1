// Budget settings of an imported project file (Project settings -> Budgets): they travel in project.rowJSON and are applied to the target,
// but they POINT INTO CATALOGS (budget scenarios, business units) that may differ in the database the file is imported into:
//   * budgetScenarioForPlan / budgetScenarioForFact   a scenario that is missing here, or of the wrong kind, is NOT taken (the target keeps its own)
//   * the four project centers (+ projectBusinessUnitsRequired)  one set: if ANY center is missing here / does not fit its field, the whole set stays
//     the target's (the project_table trigger refuses an unknown unit, which would fail the import AFTER the tasks were written)
// Catalogs not loaded (null) = no check, the value passes (a slow read never drops a valid setting). Pure - unit-tested in projectExchange.test.ts.

import type { DefRow } from '../../../../../catalog/product/productModel';
import { PROJECT_CENTER_FIELDS, unitFitsProjectCenter } from '../../../../../catalog/business_unit/businessUnitModel';
import { PMRowJSON } from '../../../../model/types';

export interface BudgetCatalogsForImport {
  /** budgetScenarioTable rows, null = not loaded */
  scenarios?: DefRow<any>[] | null;
  /** businessUnitTable rows + the CFR enumeration, null = not loaded */
  units?: DefRow<any>[] | null;
  cfrRows?: DefRow<any>[] | null;
}

const SCENARIO_FIELDS = [
  { key: 'budgetScenarioForPlan', kind: 'plan', title: 'Plan scenario' },
  { key: 'budgetScenarioForFact', kind: 'fact', title: 'Fact scenario' },
] as const;

const isSet = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** `merged` = target.rowJSON + the file's settings; returns it with the unusable budget references put back to the target's. `notTaken` = messages for the user. */
export function applyBudgetSettingsOfImport(
  merged: PMRowJSON,
  target: PMRowJSON,
  catalogs: BudgetCatalogsForImport = {}
): { rowJSON: PMRowJSON; notTaken: string[] } {
  const out: PMRowJSON = { ...merged };
  const notTaken: string[] = [];

  if (catalogs.scenarios) {
    for (const f of SCENARIO_FIELDS) {
      const g = out[f.key];
      if (!isSet(g) || g === target[f.key]) continue;
      const row = catalogs.scenarios.find((r) => r.rowGUID === g);
      if (!row) notTaken.push(`${f.title} "${g}" does not exist here`);
      else if (row.rowJSON?.scenarioKind !== f.kind) notTaken.push(`"${g}" is not a ${f.kind} scenario`);
      else continue;
      out[f.key] = target[f.key] ?? null;
    }
  }

  if (catalogs.units) {
    const units = catalogs.units;
    const problems: string[] = [];
    for (const f of PROJECT_CENTER_FIELDS) {
      const g = out[f.key];
      if (!isSet(g) || g === target[f.key]) continue;
      if (!units.some((r) => r.rowGUID === g)) problems.push(`${f.title} "${g}" does not exist here`);
      else if (!unitFitsProjectCenter(units, catalogs.cfrRows, f.key, g)) problems.push(`"${g}" cannot be the ${f.title.toLowerCase()} (it must be ${f.must})`);
    }
    if (problems.length > 0) {
      for (const f of PROJECT_CENTER_FIELDS) out[f.key] = target[f.key] ?? null;
      out.projectBusinessUnitsRequired = target.projectBusinessUnitsRequired;
      notTaken.push(...problems, 'the project centers of the file were not taken (the project keeps its own)');
    }
  }
  return { rowJSON: out, notTaken };
}
