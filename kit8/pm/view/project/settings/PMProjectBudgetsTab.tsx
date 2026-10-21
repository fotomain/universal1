// PMProjectBudgetsTab - "Budgets" tab of the Project settings window (TabBudgets, after TabMain): currencies + what the task edit screens
// (the Finances view / the task page) offer to enter. It has its own SubTabs (BUDGETS_SUBTABS):
//   TabBudgetsMain (currencies, rate types, task plan calendar, the two "Budget needed" switches) | TabForTime (Time input: the kinds of work center) |
//   TabForMaterial (Material input) | TabForExpense (Expense input) | TabBusinessUnits (the four centers).
//   The three TabFor* are offered only while projectExpenseBudgetNeeded is on (as the input switches always were).
//   project_table.rowJSON:
//     currencyForBudget / currencyForAccounting / currencyForContract (default currency for contracts)
//       = ISO 4217 codes of the currency catalog (same shape as contract.contractCurrency: "EUR")
//     exchangeRateTypeForAccounting / exchangeRateTypeForBudget = the exchange RATE TYPE (Default | Budget, as D365 FO) used to convert the sums of the
//       task lines into the accounting / the budget currency (task lines, kit8/pm/view/task/finances/taskLineFx.ts)
//     projectRevenueBudgetNeeded / projectExpenseBudgetNeeded = "Budgets" checkboxes; while projectExpenseBudgetNeeded is on the INPUT switches appear
//       (kit8/pm/model/taskInputScope.ts): projectTimeCostsNeeded > projectTimeOfPersonNeeded / projectTimeOfEquipmentNeeded / projectTimeOfPartnerNeeded (the kinds of work center a Time line may pick), projectMaterialCostsNeeded,
//       projectExpenseCostsNeeded - they decide which tabs of the task lines are offered and whether a Time line may be an equipment
//     calendarForTaskPlan = the management calendar (managementCalendarTable) whose excluded days divide the timeline of a task plan (Post of the task
//       lines, kit8/pm/view/task/plan); default workingDaysCalendar (Mon-Fri, no holidays)
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY } from '../../../../catalog/currency/currencyModel';
import SegmentButtonsApp from '../../../../ui/components/common/SegmentButtonsApp';
import { BUDGET_RATE_TYPE, DEFAULT_RATE_TYPE, RATE_TYPES } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { pmT } from '../../../i18n/pmT';
import { withAlpha } from '../../theme';
import { DEFAULT_CALENDAR_FOR_TASK_PLAN, MANAGEMENT_CALENDAR_TABLE, isCalendarFolder } from '../../../../catalog/management/calendar/managementCalendarModel';
import { applyTaskInputPatch, projectCostBudgetOn, taskInputSwitchesOf, TaskInputSwitches } from '../../../model/taskInputScope';
import BusinessUnitPickerField from '../../../../catalog/business_unit/BusinessUnitPickerField';
import { useBusinessUnitData } from '../../../../catalog/business_unit/useBusinessUnitData';
import { BUDGET_SCENARIO_TABLE, budgetScenarioTitle, budgetScenariosOfKind, projectBudgetScenariosError } from '../../../../catalog/budget/scenario/budgetScenarioModel';
import { useBudgetScenarioData } from '../../../../catalog/budget/scenario/useBudgetScenarioData';
import { PROJECT_CENTER_FIELDS, projectCentersError, unitFitsProjectCenter } from '../../../../catalog/business_unit/businessUnitModel';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';

export interface PMProjectBudgetsValues extends Partial<TaskInputSwitches> {
  currencyForBudget?: string | null;
  currencyForAccounting?: string | null;
  currencyForContract?: string | null;
  exchangeRateTypeForAccounting?: string | null;
  exchangeRateTypeForBudget?: string | null;
  projectRevenueBudgetNeeded?: boolean;
  /** Project cost total (kit8/pm/cost): the tree column "Cost" (costTotalForBudget). Usable only while a cost budget is on (Time or Material or Expense); display only */
  showTotalCostOnTheGanttChart?: boolean;
  showTotalCostWithVATOnTheGanttChart?: boolean;
  /** Fact input: true = a new fact document keeps the task line GUIDs, delete and update only (kit8/documents/fact/input) */
  factStrongInputByTaskLine?: boolean;
  calendarForTaskPlan?: string | null;
  projectCostCenter?: string | null;
  projectRevenueCenter?: string | null;
  projectProfitCenter?: string | null;
  projectInvestmentCenter?: string | null;
  projectBusinessUnitsRequired?: boolean;
  budgetScenarioForPlan?: string | null;
  budgetScenarioForFact?: string | null;
}

export type BudgetsSubTab = 'TabBudgetsMain' | 'TabForTime' | 'TabForMaterial' | 'TabForExpense' | 'TabBusinessUnits';

/** the SubTabs in order; `needsExpenseBudget` = offered only while projectExpenseBudgetNeeded is on */
export const BUDGETS_SUBTABS: { id: BudgetsSubTab; label: string; needsExpenseBudget?: boolean }[] = [
  { id: 'TabBudgetsMain', label: 'Main' },
  { id: 'TabForTime', label: 'Time', needsExpenseBudget: true },
  { id: 'TabForMaterial', label: 'Material', needsExpenseBudget: true },
  { id: 'TabForExpense', label: 'Expense', needsExpenseBudget: true },
  { id: 'TabBusinessUnits', label: 'Business units' },
];

export const PM_PROJECT_CURRENCY_FIELDS = [
  { key: 'currencyForBudget', label: 'Budget currency (currencyForBudget)' },
  { key: 'currencyForAccounting', label: 'Accounting currency (currencyForAccounting)' },
  { key: 'currencyForContract', label: 'Default currency for contracts (currencyForContract)' },
] as const;

/** rowJSON -> the finance / input fields of the settings draft (a switch never saved reads as its default, taskInputSwitchesOf) */
export const budgetsValuesOf = (j: PMProjectBudgetsValues | undefined | null): Required<PMProjectBudgetsValues> => ({
  currencyForBudget: j?.currencyForBudget || null,
  currencyForAccounting: j?.currencyForAccounting || null,
  currencyForContract: j?.currencyForContract || null,
  exchangeRateTypeForAccounting: j?.exchangeRateTypeForAccounting || DEFAULT_RATE_TYPE,
  exchangeRateTypeForBudget: j?.exchangeRateTypeForBudget || BUDGET_RATE_TYPE,
  projectRevenueBudgetNeeded: !!j?.projectRevenueBudgetNeeded,
  showTotalCostOnTheGanttChart: !!j?.showTotalCostOnTheGanttChart,
  showTotalCostWithVATOnTheGanttChart: !!j?.showTotalCostWithVATOnTheGanttChart,
  factStrongInputByTaskLine: !!j?.factStrongInputByTaskLine,
  ...taskInputSwitchesOf(j),
  calendarForTaskPlan: j?.calendarForTaskPlan || DEFAULT_CALENDAR_FOR_TASK_PLAN,
  projectCostCenter: j?.projectCostCenter || null,
  projectRevenueCenter: j?.projectRevenueCenter || null,
  projectProfitCenter: j?.projectProfitCenter || null,
  projectInvestmentCenter: j?.projectInvestmentCenter || null,
  projectBusinessUnitsRequired: !!j?.projectBusinessUnitsRequired,
  budgetScenarioForPlan: j?.budgetScenarioForPlan || null,
  budgetScenarioForFact: j?.budgetScenarioForFact || null,
});

export default function PMProjectBudgetsTab({
  values,
  onChange,
  subTab,
  onSubTabChange,
}: {
  values: PMProjectBudgetsValues;
  onChange: (patch: PMProjectBudgetsValues) => void;
  /** controlled SubTab (the settings window jumps to TabBusinessUnits on a missing center); uncontrolled when omitted */
  subTab?: BudgetsSubTab;
  onSubTabChange?: (t: BudgetsSubTab) => void;
}) {
  const { themeColors } = useDesignSystem();
  const [ownSubTab, setOwnSubTab] = React.useState<BudgetsSubTab>('TabBudgetsMain');
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const codeOf = (r: any) => String(r?.rowJSON?.currencyCode || '').toUpperCase();
  const inputs = taskInputSwitchesOf(values);
  const units = useBusinessUnitData(true);
  const scenarios = useBudgetScenarioData(true);
  const scenariosError = projectBudgetScenariosError(values, scenarios.rows, scenarios.loaded);
  const required = !!values.projectBusinessUnitsRequired;
  const centersError = projectCentersError(values, units.rows, units.cfrRows, units.loaded);
  /** one switch of the input tree: the rules of applyTaskInputPatch (Time needs a kind) decide the whole patch */
  const costBudgetOn = projectCostBudgetOn(inputs);
  const setInput = (patch: Partial<TaskInputSwitches>) => {
    const next = applyTaskInputPatch(inputs, patch);
    // the cost budget becomes on (the master, or the first of Time / Material / Expense): the Cost column is offered switched on - the user may turn it off
    onChange(!costBudgetOn && projectCostBudgetOn(next) && !values.showTotalCostOnTheGanttChart ? { ...next, showTotalCostOnTheGanttChart: true } : next);
  };

  const visibleTabs = BUDGETS_SUBTABS.filter((t) => !t.needsExpenseBudget || inputs.projectExpenseBudgetNeeded);
  const requested = subTab ?? ownSubTab;
  // a TabFor* that is no longer offered (expense budget off) falls back to the main SubTab
  const active: BudgetsSubTab = visibleTabs.some((t) => t.id === requested) ? requested : 'TabBudgetsMain';
  const selectSubTab = (t: BudgetsSubTab) => (onSubTabChange ? onSubTabChange(t) : setOwnSubTab(t));

  return (
    <View testID="pm-project-tab-budgets-content">
      {/* SubTabs Bar: TabBudgetsMain, TabForTime, TabForMaterial, TabForExpense, TabBusinessUnits */}
      <ScrollableTabBar testID="pm-project-budgets-subtabs" style={[styles.subTabsBar, { gap: 4 }]}>
        {visibleTabs.map((t) => {
          const on = active === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`pm-project-budgets-subtab-${t.id}`}
              accessibilityRole="tab"
              aria-selected={on}
              onPress={() => selectSubTab(t.id)}
              style={[styles.subTabButton, { backgroundColor: on ? withAlpha(themeColors.primary, 0.12) : 'transparent', borderColor: on ? themeColors.primary : withAlpha(themeColors.text, 0.2) }]}
            >
              <Text style={{ fontSize: 12, color: on ? themeColors.primary : themeColors.text, fontWeight: on ? '700' : '500' }}>{pmT(t.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      {active === 'TabBudgetsMain' && (
        <View testID="pm-project-budgets-main-content">
          {PM_PROJECT_CURRENCY_FIELDS.map(({ key, label }) => {
            const code = String(values[key] || '').toUpperCase();
            const row = code ? currencies.find((r) => codeOf(r) === code) : undefined;
            return (
              <SelectElementFromCatalog
                key={key}
                testID={`pm-project-${key}`}
                label={pmT(label)}
                entityName={CURRENCY_ENTITY}
                rowOwnerGUID={CURRENCY_CATALOG_OWNER}
                scopeFetchByOwner={false}
                value={row?.rowGUID ?? null}
                // a code that is not in the catalog (yet) stays visible until another currency is picked
                placeholder={code || pmT('Select currency...')}
                // inactive currencies are not offered (the one already on the project stays)
                filterItem={(r: any) => r?.rowJSON?.isActive !== false || r?.rowGUID === row?.rowGUID}
                titleExtractor={(r: any) => [r?.rowJSON?.currencyCode, r?.rowJSON?.currencyName].filter(Boolean).join(' — ')}
                subtitleExtractor={(r: any) => r?.rowJSON?.currencySymbol || undefined}
                onChange={(_guid, r) => onChange({ [key]: codeOf(r) || null })}
              />
            );
          })}

          <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Exchange rate types')}</Text>
          {([
            { key: 'exchangeRateTypeForAccounting', label: 'Accounting currency: rate type', fallback: DEFAULT_RATE_TYPE },
            { key: 'exchangeRateTypeForBudget', label: 'Budget currency: rate type', fallback: BUDGET_RATE_TYPE },
          ] as const).map(({ key, label, fallback }) => (
            <View key={key} style={styles.switchRow}>
              <Text style={{ color: themeColors.text, opacity: 0.7, fontSize: 12, marginBottom: 4 }}>{pmT(label)}</Text>
              <SegmentButtonsApp
                testID={`pm-project-${key}`}
                value={values[key] || fallback}
                onValueChange={(v: string) => onChange({ [key]: v })}
                buttons={RATE_TYPES.map((t) => ({ value: t.value, label: t.label, testID: `pm-project-${key}-${t.value}` }))}
              />
            </View>
          ))}

          <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Task plan')}</Text>
          <SelectElementFromCatalog
            testID="pm-project-calendarForTaskPlan"
            label={pmT('Calendar for the task plan (calendarForTaskPlan)')}
            entityName={MANAGEMENT_CALENDAR_TABLE.entity}
            rowOwnerGUID={MANAGEMENT_CALENDAR_TABLE.catalogOwner}
            scopeFetchByOwner={false}
            value={values.calendarForTaskPlan ?? null}
            placeholder={pmT('Working days (default)')}
            // the calendars (level 2) of the Project folder; the one already on the project stays visible
            filterItem={(r: any) => !isCalendarFolder(r) && (r?.rowParentGUID === 'projectCalendarFolder' || r?.rowGUID === values.calendarForTaskPlan)}
            titleExtractor={(r: any) => String(r?.rowJSON?.title || r?.rowGUID)}
            subtitleExtractor={(r: any) => r?.rowJSON?.description || undefined}
            onChange={(guid) => onChange({ calendarForTaskPlan: guid || DEFAULT_CALENDAR_FOR_TASK_PLAN })}
          />


          <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Budget scenarios')}</Text>
          {([
            { key: 'budgetScenarioForPlan', kind: 'plan', label: 'Plan scenario (budgetScenarioForPlan)' },
            { key: 'budgetScenarioForFact', kind: 'fact', label: 'Fact scenario (budgetScenarioForFact)' },
          ] as const).map(({ key, kind, label }) => (
            <SelectElementFromCatalog
              key={key}
              testID={`pm-project-${key}`}
              label={pmT(label)}
              entityName={BUDGET_SCENARIO_TABLE.entity}
              rowOwnerGUID={BUDGET_SCENARIO_TABLE.catalogOwner as string}
              scopeFetchByOwner={false}
              value={values[key] ?? null}
              placeholder={pmT('No scenario')}
              // only the scenarios of this kind, active (the one already on the project stays visible)
              filterItem={(r: any) => budgetScenariosOfKind([r], kind, values[key]).length > 0}
              titleExtractor={(r: any) => budgetScenarioTitle(r)}
              subtitleExtractor={(r: any) => r?.rowJSON?.description || undefined}
              onChange={(guid) => onChange({ [key]: guid || null })}
            />
          ))}
          {!!scenariosError && <Text testID="pm-project-budget-scenarios-error" style={[styles.hint, { color: themeColors.error }]}>{scenariosError}</Text>}

          <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Budgets')}</Text>
          <SwitchApp
            testID="pm-project-revenue-budget-needed"
            label={pmT('Revenue budget needed (projectRevenueBudgetNeeded)')}
            value={!!values.projectRevenueBudgetNeeded}
            onValueChange={(v) => onChange({ projectRevenueBudgetNeeded: v })}
            style={styles.switchRow}
          />
          <SwitchApp
            testID="pm-project-expense-budget-needed"
            label={pmT('Expense budget needed (projectExpenseBudgetNeeded)')}
            value={inputs.projectExpenseBudgetNeeded}
            onValueChange={(v) => setInput({ projectExpenseBudgetNeeded: v })}
            style={styles.switchRow}
          />
          {inputs.projectExpenseBudgetNeeded && <Text style={styles.hint}>{pmT('The inputs of the expense lines are set in the tabs Time, Material and Expense.')}</Text>}
          <SwitchApp
            testID="pm-project-show-total-cost"
            label={pmT('Show the total cost in the task tree (showTotalCostOnTheGanttChart)')}
            value={!!values.showTotalCostOnTheGanttChart}
            disabled={!costBudgetOn}
            onValueChange={(v) => onChange({ showTotalCostOnTheGanttChart: v })}
            style={styles.switchRow}
          />
          <SwitchApp
            testID="pm-project-show-total-cost-with-vat"
            label={pmT('Show the total cost with VAT as well (showTotalCostWithVATOnTheGanttChart)')}
            value={!!values.showTotalCostWithVATOnTheGanttChart}
            disabled={!costBudgetOn}
            onValueChange={(v) => onChange({ showTotalCostWithVATOnTheGanttChart: v })}
            style={styles.switchRow}
          />
          <Text testID="pm-project-show-total-cost-hint" style={styles.hint}>
            {costBudgetOn
              ? pmT('The Cost column shows the plan of Time + Material + Expense of every task and stage, in the budget currency, on the cost basis: net plus the VAT that is not recoverable (net while all VAT is recoverable). "Cost with VAT" adds all the VAT.')
              : pmT('Needs a cost budget: turn on the expense budget and one of Time, Material or Expense.')}
          </Text>

          <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Fact input')}</Text>
          <SwitchApp
            testID="pm-project-fact-strong-input"
            label={pmT('Strong fact input by task line (factStrongInputByTaskLine)')}
            value={!!values.factStrongInputByTaskLine}
            onValueChange={(v) => onChange({ factStrongInputByTaskLine: v })}
            style={styles.switchRow}
          />
          <Text style={styles.hint}>{pmT('On: a fact document keeps the task lines and users can only update and delete its lines. Off: the facts are free lines, not tied to the task lines. A document keeps the mode it was made in.')}</Text>
        </View>
      )}

      {/* the inputs of the cost lines (only while the expense budget is needed); a hidden switch keeps its value */}
      {active === 'TabForTime' && (
        <View testID="pm-project-input-switches">
          <SwitchApp
            testID="pm-project-time-costs-needed"
            label={pmT('Time input needed (projectTimeCostsNeeded)')}
            value={inputs.projectTimeCostsNeeded}
            onValueChange={(v) => setInput({ projectTimeCostsNeeded: v })}
            style={styles.switchRow}
          />
          {/* the kinds of WORK CENTER a Time line may pick: always shown, editable only while Time input is needed (a switch keeps its value while it is off) */}
          <View testID="pm-project-time-input-switches" style={styles.level1}>
            <SwitchApp
              testID="pm-project-time-of-person-needed"
              label={pmT('Time of person input needed (projectTimeOfPersonNeeded)')}
              value={inputs.projectTimeOfPersonNeeded}
              disabled={!inputs.projectTimeCostsNeeded}
              onValueChange={(v) => setInput({ projectTimeOfPersonNeeded: v })}
              style={styles.switchRow}
            />
            <SwitchApp
              testID="pm-project-time-of-equipment-needed"
              label={pmT('Time of equipment input needed (projectTimeOfEquipmentNeeded)')}
              value={inputs.projectTimeOfEquipmentNeeded}
              disabled={!inputs.projectTimeCostsNeeded}
              onValueChange={(v) => setInput({ projectTimeOfEquipmentNeeded: v })}
              style={styles.switchRow}
            />
            <SwitchApp
              testID="pm-project-time-of-partner-needed"
              label={pmT('Time of partner input needed (projectTimeOfPartnerNeeded)')}
              value={inputs.projectTimeOfPartnerNeeded}
              disabled={!inputs.projectTimeCostsNeeded}
              onValueChange={(v) => setInput({ projectTimeOfPartnerNeeded: v })}
              style={styles.switchRow}
            />
            <Text testID="pm-project-time-input-hint" style={styles.hint}>
              {inputs.projectTimeCostsNeeded
                ? pmT('A Time line picks a work center of the kinds switched on here (Catalogs > Work centers).')
                : pmT('Time input is off: the Time tab of the task lines is not shown. Turn it on to choose the kinds of work center.')}
            </Text>
          </View>
        </View>
      )}

      {active === 'TabForMaterial' && (
        <View testID="pm-project-budgets-material-content">
          <SwitchApp
            testID="pm-project-material-costs-needed"
            label={pmT('Material input needed (projectMaterialCostsNeeded)')}
            value={inputs.projectMaterialCostsNeeded}
            onValueChange={(v) => setInput({ projectMaterialCostsNeeded: v })}
            style={styles.switchRow}
          />
        </View>
      )}

      {active === 'TabForExpense' && (
        <View testID="pm-project-budgets-expense-content">
          <SwitchApp
            testID="pm-project-expense-costs-needed"
            label={pmT('Expense input needed (projectExpenseCostsNeeded)')}
            value={inputs.projectExpenseCostsNeeded}
            onValueChange={(v) => setInput({ projectExpenseCostsNeeded: v })}
            style={styles.switchRow}
          />
        </View>
      )}

      {active === 'TabBusinessUnits' && (
        <View testID="pm-project-budgets-units-content">
          {/* the four centers of the project (kit8/catalog/business_unit): the last source of the business unit of a task line */}
          <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Business units')}</Text>
          {!required && <Text testID="pm-project-centers-optional" style={{ color: themeColors.text, opacity: 0.6, fontSize: 12, marginBottom: 6 }}>{pmT('This project was made before the business units: its centers are optional.')}</Text>}
          {PROJECT_CENTER_FIELDS.map((f) => (
            <BusinessUnitPickerField
              key={f.key}
              testID={`pm-project-${f.key}`}
              label={`${pmT(f.title)} (${f.key})${required ? ' *' : ''}`}
              rows={units.rows}
              value={values[f.key] ?? null}
              allowClear={!required}
              isSelectable={(g) => unitFitsProjectCenter(units.rows, units.cfrRows, f.key, g)}
              reasonWhy={() => pmT(`The ${f.title.toLowerCase()} must be: ${f.must}`)}
              error={required && !values[f.key] ? pmT('Obligatory') : undefined}
              onChange={(guid) => onChange({ [f.key]: guid })}
            />
          ))}
          {!!centersError && <Text testID="pm-project-centers-error" style={{ color: themeColors.error, fontSize: 12, marginBottom: 6 }}>{centersError}</Text>}

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '700', fontSize: 14, marginTop: 16, marginBottom: 8 },
  switchRow: { marginBottom: 10 },
  level1: { marginLeft: 22 },
  subTabsBar: { flexGrow: 0, marginBottom: 10 },
  subTabButton: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 16 },
  hint: { fontSize: 12, opacity: 0.6, marginBottom: 6 },
});
