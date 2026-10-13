// PMProjectReportsView - the "Reports" view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showReportsView';
// the Skia task tree stays on the left): a summary of the selected project computed from the store.
//
//   toolbar   Reports [Costs | Revenues | Network] ........ Amounts in ...   (GanttRightSideToggle, right after the word "Reports";
//             the main view switch is in the app bar only; Network opens the network view)
//   body      cards: tasks · stages · milestones · progress · start · finish · dependency cycles
//             + the page of the section: Costs (Time + Material + Expense lines) | Revenues (Revenue lines) - the sums of the task lines of the whole project
//               (reportsModel.ts): cards, by genus, by budget item, by task
import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { usePMStore } from '../../store/store_pm';
import { PMPalette } from '../theme';
import { PMCrud } from '../../crud/usePMCrud';
import { PMTipIcon } from '../../inner/buttons';
import { PMToolbar, PMToolbarSpacer } from '../../inner/toolbars/PMToolbarPrimitives';
import GanttRightSideToggle from '../gantt/toolbars/GanttRightSideToggle';
import { PieChartReusable } from '../../../bi/chart/pie';
import { pmT } from '../../i18n/pmT';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { PRODUCT_READ_PARAMS } from '../../../catalog/product/dashboard/useProductCatalogData';
import { BUDGET_ITEM_TABLE } from '../../../catalog/budget/item/budgetItemModel';
import { MANAGEMENT_GENUS_TABLE } from '../../../catalog/management/genus/managementGenusModel';
import { rowTitle } from '../../../catalog/product/crud/productCatalogTools';
import { useProjectTaskLines } from '../task/plan/useProjectTaskLines';
import { fxProjectOf } from '../task/finances/taskLineFx';
import { formatMoney } from '../task/finances/taskLineMoney';
import { buildProjectReport, ReportAmounts, ReportRow } from './reportsModel';
import Monitor01Dashboard from '../../reports/monitor01/Monitor01Dashboard';

export interface PMProjectReportsViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
}

/** below this pane width the pie chart is stacked under its table instead of sitting in the right half */
export const PM_REPORT_SPLIT_MIN_WIDTH = 720;

const dateOf = (ms: number) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : '-');

export default function PMProjectReportsView({ projectGUID, width, height, palette, crud }: PMProjectReportsViewProps) {
  const schedule = usePMStore((s) => s.schedule);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);
  const cycleCount = usePMStore((s) => s.cycleGUIDs.length);
  const page = usePMStore((s) => s.reportsSection);
  const tasksById = usePMStore((s) => s.tasksById);
  const projectJSON = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON);
  const dispatch = useDispatch();
  // the titles of the budget items and of the genus: the same catalogs the Finances view reads
  const [budgetItems, genusRows] = useSelector((s: any) => [s?.[BUDGET_ITEM_TABLE.entity]?.entityDataFromServer, s?.[MANAGEMENT_GENUS_TABLE.entity]?.entityDataFromServer], shallowEqual);
  useEffect(() => {
    for (const entity of [BUDGET_ITEM_TABLE.entity, MANAGEMENT_GENUS_TABLE.entity]) {
      const actions = SystemMetaData[entity]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  }, [dispatch]);
  const { lines, isLoading } = useProjectTaskLines(projectGUID);
  const fx = useMemo(() => fxProjectOf(projectJSON), [projectJSON]);
  const accounting = !!fx.accountingCurrency;
  const report = useMemo(() => buildProjectReport(lines, page === 'revenues' ? 'revenues' : 'costs', accounting), [lines, page, accounting]);
  /** wide enough for a table (50%) with its pie chart beside it; narrower: the pie goes below the table */
  const wide = width >= PM_REPORT_SPLIT_MIN_WIDTH;
  const titleOf = (rows: any, guid: string) => (guid === 'none' ? pmT('No budget item') : rowTitle((Array.isArray(rows) ? rows : []).find((r: any) => r.rowGUID === guid)) || guid);

  const stats = useMemo(() => {
    const rows = Object.values(schedule);
    const leaves = rows.filter((r) => !r.isSummary);
    const done = leaves.filter((r) => r.progress >= 100).length;
    const progress = leaves.length ? Math.round(leaves.reduce((a, r) => a + (r.progress || 0), 0) / leaves.length) : 0;
    return {
      tasks: leaves.length,
      stages: rows.length - leaves.length,
      milestones: rows.filter((r) => r.isMilestone).length,
      done,
      progress,
    };
  }, [schedule]);

  const cards: { id: string; label: string; value: string }[] = [
    { id: 'tasks', label: pmT('Tasks'), value: String(stats.tasks) },
    { id: 'stages', label: pmT('Stages'), value: String(stats.stages) },
    { id: 'milestones', label: pmT('Milestones'), value: String(stats.milestones) },
    { id: 'done', label: pmT('Done'), value: `${stats.done} / ${stats.tasks}` },
    { id: 'progress', label: pmT('Progress'), value: `${stats.progress}%` },
    { id: 'start', label: pmT('Start'), value: dateOf(projectStartMs) },
    { id: 'finish', label: pmT('Finish'), value: dateOf(projectFinishMs) },
    { id: 'cycles', label: pmT('Dependency cycles'), value: String(cycleCount) },
  ];

  // Monitor01 is a page of its own (kit8/pm/reports/monitor01): the same toolbar, the live table below it
  if (page === 'monitor01') {
    return (
      <View style={{ width, height, backgroundColor: palette.background }} testID="pm-reports-view">
        <PMToolbar background={palette.surface} border={palette.border}>
          <PMTipIcon tip={pmT('Reports')} testID="pm-reports-icon" name="assessment" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
          <Text style={[styles.title, { color: palette.text }]} testID="pm-reports-title" numberOfLines={1}>{pmT('Reports')}</Text>
          <GanttRightSideToggle palette={palette} setView={crud.setGanttVsNetworkView} />
        </PMToolbar>
        <Monitor01Dashboard mode="project" projectGUID={projectGUID} testID="pm-monitor01" />
      </View>
    );
  }

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-reports-view">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMTipIcon tip={pmT('Reports')} testID="pm-reports-icon" name="assessment" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
        <Text style={[styles.title, { color: palette.text }]} testID="pm-reports-title" numberOfLines={1}>
          {pmT('Reports')}
        </Text>
        <GanttRightSideToggle palette={palette} setView={crud.setGanttVsNetworkView} />
        <PMToolbarSpacer />
        <Text style={[styles.note, { color: palette.textMuted }]} numberOfLines={1} testID="pm-reports-currency">
          {accounting ? `${pmT('Amounts in')} ${fx.accountingCurrency}` : pmT('Amounts in the currency of each line')}
        </Text>
      </PMToolbar>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          {cards.map((c) => (
            <View key={c.id} testID={`pm-reports-card-${c.id}`} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardLabel, { color: palette.textMuted }]}>{c.label}</Text>
              <Text style={[styles.cardValue, { color: palette.text }]}>{c.value}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.h2, { color: palette.text }]} testID="pm-reports-page-title">{page === 'costs' ? pmT('Costs') : pmT('Revenues')}</Text>
        {isLoading ? (
          <Text style={{ color: palette.textMuted }} testID="pm-reports-loading">{pmT('Loading…')}</Text>
        ) : (
          <>
            <View style={styles.grid}>
              {[
                { id: 'lines', label: pmT('Lines'), value: String(report.totals.count) },
                { id: 'sum', label: pmT('Sum'), value: formatMoney(report.totals.sum) },
                { id: 'vat', label: pmT('VAT'), value: formatMoney(report.totals.vat) },
                { id: 'total', label: pmT('Total with VAT'), value: formatMoney(report.totals.total) },
                ...(page === 'costs' ? [
                  { id: 'persons', label: pmT('Time of persons'), value: formatMoney(report.persons.sum) },
                  { id: 'equipment', label: pmT('Time of equipment'), value: formatMoney(report.equipment.sum) },
                ] : []),
              ].map((c) => (
                <View key={c.id} testID={`pm-report-card-${c.id}`} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.cardLabel, { color: palette.textMuted }]}>{c.label}</Text>
                  <Text style={[styles.cardValue, { color: palette.text }]}>{c.value}</Text>
                </View>
              ))}
            </View>
            {page === 'costs' && <ReportTable testID="pm-report-genus" title={pmT('By kind')} rows={report.byGenus} nameOf={(r) => titleOf(genusRows, r.key)} palette={palette} wide={wide} />}
            <ReportTable testID="pm-report-items" title={pmT('By budget item')} rows={report.byBudgetItem} nameOf={(r) => titleOf(budgetItems, r.key)} palette={palette} wide={wide} />
            <ReportTable testID="pm-report-tasks" title={pmT('By task')} rows={report.byTask} nameOf={(r) => String(tasksById[r.key]?.rowJSON?.name ?? r.key)} palette={palette} wide={wide} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ReportTable({ testID, title, rows, nameOf, palette, wide }: { testID: string; title: string; rows: ReportRow[]; nameOf: (r: ReportRow) => string; palette: PMPalette; wide: boolean }) {
  const cell = (n: number) => formatMoney(n);
  // the pie shows the same rows as the table, by their Total
  const pieData = useMemo(() => rows.map((r) => ({ key: r.key, label: nameOf(r), value: r.total })), [rows, nameOf]);
  return (
    <View testID={`${testID}-block`} style={[styles.split, wide && styles.splitRow]}>
      {/* the table takes 50% of the width (all of it when narrow) */}
      <View testID={testID} style={[styles.table, wide && styles.tableHalf]}>
        <Text style={[styles.h3, { color: palette.text }]}>{title}</Text>
        <View style={[styles.tr, styles.th, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.tdName, styles.thText, { color: palette.textMuted }]}>{pmT('Name')}</Text>
          {[pmT('Lines'), pmT('Sum'), pmT('VAT'), pmT('Total')].map((h) => <Text key={h} style={[styles.tdNum, styles.thText, { color: palette.textMuted }]}>{h}</Text>)}
        </View>
        {rows.length === 0 ? (
          <Text style={{ color: palette.textMuted, padding: 8 }} testID={`${testID}-empty`}>{pmT('No lines')}</Text>
        ) : rows.map((r: ReportAmounts & ReportRow) => (
          <View key={r.key} testID={`${testID}-row-${r.key}`} style={[styles.tr, { borderColor: palette.border }]}>
            <Text numberOfLines={1} style={[styles.tdName, { color: palette.text }]}>{nameOf(r)}</Text>
            <Text style={[styles.tdNum, { color: palette.text }]}>{r.count}</Text>
            <Text style={[styles.tdNum, { color: palette.text }]}>{cell(r.sum)}</Text>
            <Text style={[styles.tdNum, { color: palette.text }]}>{cell(r.vat)}</Text>
            <Text style={[styles.tdNum, { color: palette.text, fontWeight: '700' }]}>{cell(r.total)}</Text>
          </View>
        ))}
      </View>
      {/* the pie chart of the table: the other 50% */}
      {rows.length > 0 && (
        <View testID={`${testID}-pie`} style={[styles.pieBox, wide && styles.pieHalf]}>
          <PieChartReusable testID={`${testID}-chart`} data={pieData} size={180} gapColor={palette.background} textColor={palette.text} mutedColor={palette.textMuted} otherLabel={pmT('Other')} emptyText={pmT('No lines')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, marginHorizontal: 8 },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  h3: { fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  split: { width: '100%' },
  splitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  table: { width: '100%' },
  tableHalf: { width: '50%' },
  pieBox: { width: '100%', alignItems: 'center', paddingTop: 12 },
  pieHalf: { width: '50%', paddingTop: 36 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6, paddingHorizontal: 8 },
  th: { borderTopWidth: StyleSheet.hairlineWidth },
  thText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tdName: { flex: 1, minWidth: 120, fontSize: 13 },
  tdNum: { width: 96, textAlign: 'right', fontSize: 13 },
  title: { fontSize: 13, fontWeight: '600', marginHorizontal: 6, flexShrink: 1 },
  body: { padding: 12, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { minWidth: 140, flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  cardLabel: { fontSize: 12, marginBottom: 4 },
  cardValue: { fontSize: 20, fontWeight: '700' },
});
