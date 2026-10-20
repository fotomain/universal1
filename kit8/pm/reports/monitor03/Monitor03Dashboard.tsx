// Monitor03Dashboard - "Monitor03_ROIHistory": the ROI of the four kinds OVER TIME for one project (documentation/ROI_DOC.html section 7.3, README next to this file).
//   two modes (a toggle):
//     'Business month'      the cumulative curve from the month totals (project_status_month_roi): how the project developed - for every project, history switch or not, also for the past
//     'As seen on a date'   the log of project_status_roi_history as STEP lines: what the project looked like on each day (the plan changes the past of the other curve); available while the project switch
//                           roiHistoryFunctionalityEnabled is ON (history exists only from the day it was switched on) - otherwise the toggle is disabled with the hint
//   the period (startDate · finishDate · the period button): 'Business month' sums the months of the period from its first month; 'As seen' shows the rows of the log whose day is in it
//   below the chart a table of the points (the month / the day, the reason of the row, the cost plan, the cost fact, ROI1-4)
//   the ratios are NOT stored: every point is roiOfMoney() of additive money under the project's CURRENT tax switches (a switch redraws the whole curve)
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import { SegmentButtonsApp } from '../../../ui/components/common/SegmentButtonsApp';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import { pmT } from '../../i18n/pmT';
import { ROI_KINDS, ROI_KIND_TITLE, formatRoi, formatRoiMoney, roiTone } from '../roi/roiModel';
import { RoiHistoryMode, RoiPoint, cumulateMonthRows, filterHistoryRows, pointsOfHistory, pointsOfMonthCurve } from '../roi/roiHistoryModel';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import { roiProjectOptions } from '../roi/roiReportModel';
import { roiTaxOf } from '../roi/roiSettings';
import Monitor03Chart from './Monitor03Chart';
import Monitor03PeriodBar, { EMPTY_MONITOR03_PERIOD, Monitor03Period } from './Monitor03PeriodBar';
import { roiDateErrors } from '../monitor02/Monitor02Filters';
import { useMonitor03Data } from './useMonitor03Data';

export interface Monitor03DashboardProps {
  /** the project to start with (a link from another screen); the select can change it */
  projectGUID?: string | null;
  testID?: string;
}

export default function Monitor03Dashboard({ projectGUID: initialProject = null, testID = 'monitor03' }: Monitor03DashboardProps) {
  const { themeColors: c, isDark } = useDesignSystem();
  const [projectGUID, setProjectGUID] = useState<string | null>(initialProject);
  const [mode, setMode] = useState<RoiHistoryMode>('month');
  const [period, setPeriod] = useState<Monitor03Period>(EMPTY_MONITOR03_PERIOD);
  // an unreadable date is a red field, not a period
  const dateErrors = roiDateErrors(period);
  const from = dateErrors.startDate ? null : parseDayInput(period.startDate);
  const to = dateErrors.finishDate ? null : parseDayInput(period.finishDate);
  const data = useMonitor03Data(projectGUID);
  // the first project with numbers when nothing is picked
  useEffect(() => {
    if (!projectGUID && data.projects.length > 0) setProjectGUID(data.projects[0].projectGUID);
  }, [projectGUID, data.projects]);
  const tax = useMemo(() => data.selected?.tax ?? { includeSaleVat: false, includePurchaseVat: false }, [data.selected]);
  const historyOn = !!data.selected?.history;
  // a project without history switched on has only the business-month curve
  useEffect(() => { if (mode === 'seen' && data.selected && !historyOn) setMode('month'); }, [mode, historyOn, data.selected]);
  const points: RoiPoint[] = useMemo(
    () => (mode === 'seen' ? pointsOfHistory(filterHistoryRows(data.history, { from, to }), tax) : pointsOfMonthCurve(cumulateMonthRows(data.months, { from, to }, true), tax)),
    [mode, data.history, data.months, tax, from, to],
  );
  const projectItems = useMemo(() => roiProjectOptions(data.projects), [data.projects]);
  const colors = { text: c.text, grid: c.border, positive: isDark ? '#4ade80' : '#16a34a', negative: isDark ? '#f87171' : '#dc2626' };
  const roiColor = (v: number | null) => (roiTone(v) === 'positive' ? colors.positive : roiTone(v) === 'negative' ? colors.negative : colors.text);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="show_chart" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Monitor03')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('ROI history')}</Text>
        <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh')} icon="refresh" variant="text" size="small" onPress={data.reload} />
        <View style={{ flex: 1 }} />
        <View style={styles.age}>
          <View style={[styles.dot, { backgroundColor: data.live ? c.primary : c.error }]} />
          <Text style={{ color: c.text, fontSize: 12 }}>{data.live ? pmT('Live') : pmT('Offline: the last data')}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={{ width: 260 }}>
          <SelectItemFromListApp testID={`${testID}-project`} items={projectItems} value={projectGUID || ''} onSelect={(v: string) => setProjectGUID(v || null)} placeholder={pmT('Project')} searchPlaceholder={pmT('Project')} fieldHeight={42} fieldRadius={4} />
        </View>
        <SegmentButtonsApp<RoiHistoryMode>
          testID={`${testID}-mode`}
          value={mode}
          onValueChange={setMode}
          compact
          buttons={[
            { value: 'month', label: pmT('Business month'), testID: `${testID}-mode-month` },
            { value: 'seen', label: pmT('As seen on a date'), disabled: !historyOn, testID: `${testID}-mode-seen` },
          ]}
        />
      </View>
      <View style={styles.periodRow}>
        <Monitor03PeriodBar testID={`${testID}-filters`} value={period} onChange={setPeriod} />
      </View>
      {!!data.selected && !historyOn && (
        <Text testID={`${testID}-hint`} style={{ color: c.text, opacity: 0.65, fontSize: 12, paddingHorizontal: 12 }}>
          {pmT('"As seen on a date" needs the ROI history: Project settings → ROI → ROI history. The business-month curve is always available.')}
        </Text>
      )}
      {!!data.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{data.error}</Text>}
      {data.isLoading && data.projects.length === 0 && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Loading…')}</Text>}
      {!data.isLoading && data.projects.length === 0 && <Text testID={`${testID}-no-projects`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('No project has ROI numbers yet. Post the plan of a task.')}</Text>}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Monitor03Chart testID={`${testID}-chart`} points={points} step={mode === 'seen'} color={colors.text} gridColor={colors.grid} />
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 11, paddingHorizontal: 12, paddingTop: 4 }}>
          {mode === 'seen'
            ? pmT('Step lines: the value of a day stays until the next row of the log. Taxes: Project settings → ROI.')
            : pmT('Cumulative from the first month of the period. ROI2 and ROI3 divide a part of the revenue by the whole plan cost: early in a project they are negative by construction. Taxes: Project settings → ROI.')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View testID={`${testID}-table`} style={{ minWidth: 760, paddingTop: 8 }}>
            <View style={[styles.row, { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
              <Text style={[styles.head, { width: 110, color: c.text }]}>{mode === 'seen' ? pmT('Day') : pmT('Month')}</Text>
              <Text style={[styles.head, { width: 210, color: c.text }]}>{pmT('Reason')}</Text>
              <Text style={[styles.head, styles.num, { width: 100, color: c.text }]}>{pmT('Cost plan')}</Text>
              <Text style={[styles.head, styles.num, { width: 100, color: c.text }]}>{pmT('Cost fact')}</Text>
              {ROI_KINDS.map((k) => <Text key={k} style={[styles.head, styles.num, { width: 80, color: c.text }]}>{ROI_KIND_TITLE[k]}</Text>)}
            </View>
            {points.map((p) => (
              <View key={p.x} testID={`${testID}-row-${p.x}`} style={[styles.row, { borderBottomColor: c.border }]}>
                <Text style={[styles.cell, { width: 110, color: c.text }]}>{p.x}</Text>
                <Text numberOfLines={1} style={[styles.cell, { width: 210, color: c.text, opacity: 0.75 }]}>{p.reason}</Text>
                <Text style={[styles.cell, styles.num, { width: 100, color: c.text }]}>{formatRoiMoney(p.line.planCost)}</Text>
                <Text style={[styles.cell, styles.num, { width: 100, color: c.text }]}>{formatRoiMoney(p.line.factCost)}</Text>
                {ROI_KINDS.map((k) => <Text key={k} testID={`${testID}-row-${p.x}-${k}`} style={[styles.cell, styles.num, { width: 80, color: roiColor(p.line[k]), fontWeight: '700', opacity: roiTone(p.line[k]) === 'none' ? 0.5 : 1 }]}>{formatRoi(p.line[k])}</Text>)}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  age: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  periodRow: { paddingHorizontal: 12, paddingBottom: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 30, paddingHorizontal: 12 },
  head: { fontWeight: '700', fontSize: 12, paddingVertical: 4 },
  cell: { fontSize: 13, paddingVertical: 4 },
  num: { textAlign: 'right' },
});
