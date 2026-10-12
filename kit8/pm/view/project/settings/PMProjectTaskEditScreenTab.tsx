// PMProjectTaskEditScreenTab - "Finances" tab of the Project settings window (TabFinances, after TabMain): currencies + what the task edit screens
// (the Finances view / the task page) offer to enter.
//   project_table.rowJSON:
//     currencyForBudget / currencyForAccounting / currencyForContract (default currency for contracts)
//       = ISO 4217 codes of the currency catalog (same shape as contract.contractCurrency: "EUR")
//     exchangeRateTypeForAccounting / exchangeRateTypeForBudget = the exchange RATE TYPE (Default | Budget, as D365 FO) used to convert the sums of the
//       task lines into the accounting / the budget currency (task lines, kit8/pm/view/task/finances/taskLineFx.ts)
//     projectRevenueBudgetNeeded / projectExpenseBudgetNeeded = "Budgets" checkboxes; while projectExpenseBudgetNeeded is on the INPUT switches appear
//       (kit8/pm/model/taskInputScope.ts): projectTimeCostsNeeded > projectTimeOfPersonNeeded / projectTimeOfEquipmentNeeded, projectMaterialCostsNeeded,
//       projectExpenseCostsNeeded - they decide which tabs of the task lines are offered and whether a Time line may be an equipment
//     calendarForTaskPlan = the management calendar (managementCalendarTable) whose excluded days divide the timeline of a task plan (Post of the task
//       lines, kit8/pm/view/task/plan); default workingDaysCalendar (Mon-Fri, no holidays)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY } from '../../../../catalog/currency/currencyModel';
import SegmentButtonsApp from '../../../../ui/components/common/SegmentButtonsApp';
import { BUDGET_RATE_TYPE, DEFAULT_RATE_TYPE, RATE_TYPES } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { pmT } from '../../../i18n/pmT';
import { DEFAULT_CALENDAR_FOR_TASK_PLAN, MANAGEMENT_CALENDAR_TABLE, isCalendarFolder } from '../../../../catalog/management/calendar/managementCalendarModel';
import { applyTaskInputPatch, taskInputSwitchesOf, TaskInputSwitches } from '../../../model/taskInputScope';
import BusinessUnitPickerField from '../../../../catalog/business_unit/BusinessUnitPickerField';
import { useBusinessUnitData } from '../../../../catalog/business_unit/useBusinessUnitData';
import { PROJECT_CENTER_FIELDS, projectCentersError, unitFitsProjectCenter } from '../../../../catalog/business_unit/businessUnitModel';

export interface PMProjectTaskEditScreenValues extends Partial<TaskInputSwitches> {
  currencyForBudget?: string | null;
  currencyForAccounting?: string | null;
  currencyForContract?: string | null;
  exchangeRateTypeForAccounting?: string | null;
  exchangeRateTypeForBudget?: string | null;
  projectRevenueBudgetNeeded?: boolean;
  calendarForTaskPlan?: string | null;
  projectCostCenter?: string | null;
  projectRevenueCenter?: string | null;
  projectProfitCenter?: string | null;
  projectInvestmentCenter?: string | null;
  projectBusinessUnitsRequired?: boolean;
}

export const PM_PROJECT_CURRENCY_FIELDS = [
  { key: 'currencyForBudget', label: 'Budget currency (currencyForBudget)' },
  { key: 'currencyForAccounting', label: 'Accounting currency (currencyForAccounting)' },
  { key: 'currencyForContract', label: 'Default currency for contracts (currencyForContract)' },
] as const;

/** rowJSON -> the finance / input fields of the settings draft (a switch never saved reads as its default, taskInputSwitchesOf) */
export const taskEditScreenValuesOf = (j: PMProjectTaskEditScreenValues | undefined | null): Required<PMProjectTaskEditScreenValues> => ({
  currencyForBudget: j?.currencyForBudget || null,
  currencyForAccounting: j?.currencyForAccounting || null,
  currencyForContract: j?.currencyForContract || null,
  exchangeRateTypeForAccounting: j?.exchangeRateTypeForAccounting || DEFAULT_RATE_TYPE,
  exchangeRateTypeForBudget: j?.exchangeRateTypeForBudget || BUDGET_RATE_TYPE,
  projectRevenueBudgetNeeded: !!j?.projectRevenueBudgetNeeded,
  ...taskInputSwitchesOf(j),
  calendarForTaskPlan: j?.calendarForTaskPlan || DEFAULT_CALENDAR_FOR_TASK_PLAN,
  projectCostCenter: j?.projectCostCenter || null,
  projectRevenueCenter: j?.projectRevenueCenter || null,
  projectProfitCenter: j?.projectProfitCenter || null,
  projectInvestmentCenter: j?.projectInvestmentCenter || null,
  projectBusinessUnitsRequired: !!j?.projectBusinessUnitsRequired,
});

export default function PMProjectTaskEditScreenTab({
  values,
  onChange,
}: {
  values: PMProjectTaskEditScreenValues;
  onChange: (patch: PMProjectTaskEditScreenValues) => void;
}) {
  const { themeColors } = useDesignSystem();
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const codeOf = (r: any) => String(r?.rowJSON?.currencyCode || '').toUpperCase();
  const inputs = taskInputSwitchesOf(values);
  const units = useBusinessUnitData(true);
  const required = !!values.projectBusinessUnitsRequired;
  const centersError = projectCentersError(values, units.rows, units.cfrRows, units.loaded);
  /** one switch of the input tree: the rules of applyTaskInputPatch (Time needs a kind) decide the whole patch */
  const setInput = (patch: Partial<TaskInputSwitches>) => onChange(applyTaskInputPatch(inputs, patch));

  return (
    <View testID="pm-project-tab-finances-content">
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
      {/* the inputs of the cost lines: only while the expense budget is needed; a hidden switch keeps its value */}
      {inputs.projectExpenseBudgetNeeded && (
        <View testID="pm-project-input-switches" style={styles.level1}>
          <SwitchApp
            testID="pm-project-time-costs-needed"
            label={pmT('Time input needed (projectTimeCostsNeeded)')}
            value={inputs.projectTimeCostsNeeded}
            onValueChange={(v) => setInput({ projectTimeCostsNeeded: v })}
            style={styles.switchRow}
          />
          {inputs.projectTimeCostsNeeded && (
            <View testID="pm-project-time-input-switches" style={styles.level1}>
              <SwitchApp
                testID="pm-project-time-of-person-needed"
                label={pmT('Time of person input needed (projectTimeOfPersonNeeded)')}
                value={inputs.projectTimeOfPersonNeeded}
                onValueChange={(v) => setInput({ projectTimeOfPersonNeeded: v })}
                style={styles.switchRow}
              />
              <SwitchApp
                testID="pm-project-time-of-equipment-needed"
                label={pmT('Time of equipment input needed (projectTimeOfEquipmentNeeded)')}
                value={inputs.projectTimeOfEquipmentNeeded}
                onValueChange={(v) => setInput({ projectTimeOfEquipmentNeeded: v })}
                style={styles.switchRow}
              />
            </View>
          )}
          <SwitchApp
            testID="pm-project-material-costs-needed"
            label={pmT('Material input needed (projectMaterialCostsNeeded)')}
            value={inputs.projectMaterialCostsNeeded}
            onValueChange={(v) => setInput({ projectMaterialCostsNeeded: v })}
            style={styles.switchRow}
          />
          <SwitchApp
            testID="pm-project-expense-costs-needed"
            label={pmT('Expense input needed (projectExpenseCostsNeeded)')}
            value={inputs.projectExpenseCostsNeeded}
            onValueChange={(v) => setInput({ projectExpenseCostsNeeded: v })}
            style={styles.switchRow}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '700', fontSize: 14, marginTop: 16, marginBottom: 8 },
  switchRow: { marginBottom: 10 },
  level1: { marginLeft: 22 },
});
