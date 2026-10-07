// PMProjectFinanceTab - "Finances" tab of the Project settings window (TabFinances, after TabMain).
//   project_table.rowJSON:
//     currencyForBudget / currencyForAccounting / currencyForContract (default currency for contracts)
//       = ISO 4217 codes of the currency catalog (same shape as contract.contractCurrency: "EUR")
//     projectRevenueBudgetNeeded / projectExpenseBudgetNeeded = "Budgets" checkboxes
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY } from '../../../../catalog/currency/currencyModel';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectFinanceValues {
  currencyForBudget?: string | null;
  currencyForAccounting?: string | null;
  currencyForContract?: string | null;
  projectRevenueBudgetNeeded?: boolean;
  projectExpenseBudgetNeeded?: boolean;
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
  projectRevenueBudgetNeeded: !!j?.projectRevenueBudgetNeeded,
  projectExpenseBudgetNeeded: !!j?.projectExpenseBudgetNeeded,
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
