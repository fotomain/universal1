// PMProjectFinanceTab - "Finances" tab of the Project settings window (TabFinances, after TabMain).
//   project_table.rowJSON:
//     currencyForBudget / currencyForAccounting / currencyForContract (default currency for contracts)
//       = ISO 4217 codes of the currency catalog (same shape as contract.contractCurrency: "EUR")
//     exchangeRateTypeForAccounting / exchangeRateTypeForBudget = the exchange RATE TYPE (Default | Budget, as D365 FO) used to convert the sums of the
//       task lines into the accounting / the budget currency (task lines, kit8/pm/view/task/finances/taskLineFx.ts)
//     projectRevenueBudgetNeeded / projectExpenseBudgetNeeded = "Budgets" checkboxes
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

export interface PMProjectFinanceValues {
  currencyForBudget?: string | null;
  currencyForAccounting?: string | null;
  currencyForContract?: string | null;
  exchangeRateTypeForAccounting?: string | null;
  exchangeRateTypeForBudget?: string | null;
  projectRevenueBudgetNeeded?: boolean;
  projectExpenseBudgetNeeded?: boolean;
  calendarForTaskPlan?: string | null;
}

export const PM_PROJECT_CURRENCY_FIELDS = [
  { key: 'currencyForBudget', label: 'Budget currency (currencyForBudget)' },
  { key: 'currencyForAccounting', label: 'Accounting currency (currencyForAccounting)' },
  { key: 'currencyForContract', label: 'Default currency for contracts (currencyForContract)' },
] as const;

/** rowJSON -> the finance fields of the settings draft */
export const financeValuesOf = (j: PMProjectFinanceValues | undefined | null): Required<PMProjectFinanceValues> => ({
  currencyForBudget: j?.currencyForBudget || null,
  currencyForAccounting: j?.currencyForAccounting || null,
  currencyForContract: j?.currencyForContract || null,
  exchangeRateTypeForAccounting: j?.exchangeRateTypeForAccounting || DEFAULT_RATE_TYPE,
  exchangeRateTypeForBudget: j?.exchangeRateTypeForBudget || BUDGET_RATE_TYPE,
  projectRevenueBudgetNeeded: !!j?.projectRevenueBudgetNeeded,
  projectExpenseBudgetNeeded: !!j?.projectExpenseBudgetNeeded,
  calendarForTaskPlan: j?.calendarForTaskPlan || DEFAULT_CALENDAR_FOR_TASK_PLAN,
});

export default function PMProjectFinanceTab({
  values,
  onChange,
}: {
  values: PMProjectFinanceValues;
  onChange: (patch: PMProjectFinanceValues) => void;
}) {
  const { themeColors } = useDesignSystem();
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const codeOf = (r: any) => String(r?.rowJSON?.currencyCode || '').toUpperCase();

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
        value={!!values.projectExpenseBudgetNeeded}
        onValueChange={(v) => onChange({ projectExpenseBudgetNeeded: v })}
        style={styles.switchRow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '700', fontSize: 14, marginTop: 16, marginBottom: 8 },
  switchRow: { marginBottom: 10 },
});
