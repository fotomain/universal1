// ProjectEstimationTable - the SUMMARY of the estimation project per budget item (Project settings -> Estimation).
//   One row per budget item: the task lines of project2 added up (net, VAT, lines), and - for a saved project - what the project holds now and the difference, so the user sees what
//   "Fill" will change before pressing it. A ReusableTable in LOCAL ROWS mode (rows made here, no Supabase table, no redux entity), read only. Under it: cost, revenue, profit and ROI1.
//   The numbers come from SQL project_estimation_summary (the SAVED snapshot of the lines in the budget currency of each project; a line with no sum counts 0 and is counted in the warning).
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import ReusableTable from '../../../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../../ui/components/table/reusable/reusableTableTypes';
import ActivityIndicatorCircleApp from '../../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { useBudgetItemData } from '../../../../catalog/budget/item/useBudgetItemData';
import { translatedTitle, useCatalogTranslationVersion } from '../../../../catalog/translation/catalogTranslationStore';
import { pmT } from '../../../i18n/pmT';
import { estimationCurrencyDiffers, estimationFooter, estimationRows, type EstimationSummary, type EstimationTableRow, type EstimationTotals } from './estimationModel';

export interface ProjectEstimationTableProps {
  summary: EstimationSummary | null;
  loading?: boolean;
  /** the estimation could not be read: the text of the error */
  error?: string | null;
  /** units of the budget currency of the filled project for 1 unit of the estimation's (null = none); only used while the two currencies differ */
  rate?: number | null;
  /** the budget currency of a project that is not saved yet */
  targetCurrency?: string | null;
  testID?: string;
}

export const formatEstimationAmount = (n: number | null | undefined): string =>
  n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ');
export const formatEstimationRoi = (n: number | null): string => (n == null ? '-' : `${(n * 100).toFixed(2)} %`);

/** the title of a budget item: translated title, else the catalog title, else the id (the rows of the catalog are read by useBudgetItemData) */
export function budgetItemTitleOf(guid: string | null, rows: readonly { rowGUID: string; rowJSON?: any }[]): string {
  if (!guid) return pmT('(no budget item)');
  const row = rows.find((r) => r.rowGUID === guid);
  return translatedTitle(guid) || String(row?.rowJSON?.title ?? '').trim() || guid;
}

export default function ProjectEstimationTable({ summary, loading = false, error = null, rate = null, targetCurrency = null, testID = 'pm-project-estimation-table' }: ProjectEstimationTableProps) {
  const { themeColors: c } = useDesignSystem();
  const budgetItems = useBudgetItemData(true);
  useCatalogTranslationVersion(); // the titles follow the interface language

  const sourceCurrency = summary?.source.currencyForBudget ?? '';
  const ownCurrency = summary?.target?.currencyForBudget ?? targetCurrency ?? '';
  const differ = estimationCurrencyDiffers(sourceCurrency, ownCurrency);
  const hasProject = !!summary?.target;

  const model = useMemo<EstimationTableRow[]>(() => (summary ? estimationRows(summary, rate, targetCurrency) : []), [summary, rate, targetCurrency]);
  const footer = useMemo(() => estimationFooter(model), [model]);

  const rows = useMemo<ReusableTableRow[]>(() => model.map((r, i) => ({
    rowGUID: r.rowGUID,
    rowParentGUID: 'empty',
    orderInList: i + 1,
    rowJSON: {
      title: budgetItemTitleOf(r.budgetItemGUID, budgetItems.rows),
      kindTitle: r.kind === 'revenue' ? pmT('Revenue') : pmT('Cost'),
      lines: r.lines,
      estimate: r.estimate,
      vat: r.vat,
      converted: r.converted,
      projectNow: r.projectNow,
      difference: r.difference,
    },
  })), [model, budgetItems.rows]);

  const columns = useMemo<VisualColumn[]>(() => {
    const cols: VisualColumn[] = [
      { key: 'title', title: pmT('Budget item'), type: 'text', editable: false, width: 220 },
      { key: 'kindTitle', title: pmT('Kind'), type: 'text', editable: false, width: 90 },
      { key: 'lines', title: pmT('Lines'), type: 'integer', editable: false, stepper: false, total: false, width: 70, align: 'right' },
      { key: 'estimate', title: `${pmT('Estimate')}${sourceCurrency ? ` (${sourceCurrency})` : ''}`, type: 'number', editable: false, stepper: false, total: false, width: 140, align: 'right' },
      { key: 'vat', title: pmT('VAT'), type: 'number', editable: false, stepper: false, total: false, width: 110, align: 'right' },
    ];
    if (differ) cols.push({ key: 'converted', title: `${pmT('Estimate')} (${ownCurrency})`, type: 'number', editable: false, stepper: false, total: false, width: 150, align: 'right' });
    if (hasProject) {
      cols.push({ key: 'projectNow', title: `${pmT('Project now')}${ownCurrency ? ` (${ownCurrency})` : ''}`, type: 'number', editable: false, stepper: false, total: false, width: 150, align: 'right' });
      cols.push({ key: 'difference', title: pmT('Estimate - now'), type: 'number', editable: false, stepper: false, total: false, width: 140, align: 'right' });
    }
    return cols;
  }, [sourceCurrency, ownCurrency, differ, hasProject]);

  if (loading) return <View style={styles.center} testID={`${testID}-loading`}><ActivityIndicatorCircleApp size="small" color={c.primary} /></View>;
  if (error) return <Text testID={`${testID}-error`} style={[styles.error, { color: c.error }]}>{error}</Text>;
  if (!summary) return null;
  if (summary.source.lines === 0) return <Text testID={`${testID}-empty`} style={[styles.hint, { color: c.text }]}>{pmT('The estimation has no task lines.')}</Text>;

  const source = summary.source;
  return (
    <View testID={testID} style={styles.root}>
      {source.linesWithoutSum > 0 && (
        <Text testID={`${testID}-warn-sum`} style={[styles.warn, { color: c.error }]}>{pmT('{{n}} lines have no budget sum (no budget currency or no exchange rate): they count as 0.', { n: source.linesWithoutSum })}</Text>
      )}
      {source.linesWithoutItem > 0 && (
        <Text testID={`${testID}-warn-item`} style={[styles.warn, { color: c.error }]}>{pmT('{{n}} lines have no budget item.', { n: source.linesWithoutItem })}</Text>
      )}
      {differ && (
        <Text testID={`${testID}-warn-currency`} style={[styles.hint, { color: c.text }]}>
          {rate == null
            ? pmT('The budget currency of the estimation is {{from}}, of this project {{to}}: there is no exchange rate for today.', { from: sourceCurrency, to: ownCurrency })
            : pmT('The budget currency of the estimation is {{from}}, of this project {{to}}: the converted column uses the rate of today and is only a guide.', { from: sourceCurrency, to: ownCurrency })}
        </Text>
      )}
      <ReusableTable
        testID={`${testID}-grid`}
        entityName="projectEstimationSummary"
        crudListTitle={pmT('Estimation')}
        itemLabel={pmT('Budget item')}
        localRows={rows}
        onLocalRowsChange={() => {}}
        visualColumns={columns}
        readOnly
        selectionEnabled={false}
        crudPanelEnabled={false}
        addEnabled={false}
        deleteEnabled={false}
        reorderEnabled={false}
        contextMenuEnabled={false}
      />
      <View style={styles.totals} testID={`${testID}-totals`}>
        <TotalsLine testID={`${testID}-total-estimate`} title={`${pmT('Estimate')}${sourceCurrency ? ` (${sourceCurrency})` : ''}`} t={footer.estimate} color={c.text} />
        {footer.converted && <TotalsLine testID={`${testID}-total-converted`} title={`${pmT('Estimate')} (${ownCurrency})`} t={footer.converted} color={c.text} />}
        {footer.now && <TotalsLine testID={`${testID}-total-now`} title={`${pmT('Project now')}${ownCurrency ? ` (${ownCurrency})` : ''}`} t={footer.now} color={c.text} />}
      </View>
    </View>
  );
}

function TotalsLine({ title, t, color, testID }: { title: string; t: EstimationTotals; color: string; testID: string }) {
  return (
    <View style={styles.totalLine} testID={testID}>
      <Text style={[styles.totalTitle, { color }]}>{title}</Text>
      <Text style={[styles.totalText, { color }]} testID={`${testID}-text`}>
        {`${pmT('Cost')} ${formatEstimationAmount(t.cost)}  ·  ${pmT('Revenue')} ${formatEstimationAmount(t.revenue)}  ·  ${pmT('Profit')} ${formatEstimationAmount(t.profit)}  ·  ROI1 ${formatEstimationRoi(t.roi)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 4 },
  center: { padding: 16, alignItems: 'center' },
  error: { fontSize: 13, marginVertical: 8 },
  hint: { fontSize: 12, opacity: 0.75, marginVertical: 6 },
  warn: { fontSize: 12, marginVertical: 3 },
  totals: { marginTop: 8, gap: 4 },
  totalLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' },
  totalTitle: { fontSize: 12, fontWeight: '700' },
  totalText: { fontSize: 12 },
});
