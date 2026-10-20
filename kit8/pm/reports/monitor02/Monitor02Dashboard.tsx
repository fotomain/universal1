// Monitor02Dashboard - "Monitor02_ROINow": the ROI of the four kinds, as the data stands NOW (documentation/ROI_DOC.html section 7.2, README next to this file).
//   the projects: mine with the project switch roiForTasksFunctionalityEnabled ON - a project with it OFF is not here (the switch is in Project settings → ROI)
//   the lines: one per project (the month totals of the period), under it one per task (roi_task_lines); the footer adds the project lines
//   the bar: startDate · finishDate · the period button · Project · Task; Refresh (computes now, works without pg_cron) · Auto refresh (Realtime on the month totals) · a badge with the age of the data
//   the ratios are NOT stored: every line is roiOfMoney() of additive money (kit8/pm/reports/roi); a double click on a task opens it in the dashboard
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme as usePaperTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import IconApp from '../../../ui/components/common/IconApp';
import { colorToHex } from '../../../ui/components/table/reusable/tableRows';
import { pmT } from '../../i18n/pmT';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import { refreshMonitor01Now } from '../monitor01/monitor01Api';
import Monitor01Toolbar from '../monitor01/Monitor01Toolbar';
import { openDashboardLink } from '../../view/project/dashboardDeepLink';
import { EMPTY_ROI_FILTERS, RoiReportFilters, RoiReportLine, buildRoiNowLines, roiFooterOf, roiProjectOptions, roiTaskOptions } from '../roi/roiReportModel';
import Monitor02FiltersBar, { roiDateErrors } from './Monitor02Filters';
import Monitor02Table from './Monitor02Table';
import { useMonitor02Data } from './useMonitor02Data';

export interface Monitor02DashboardProps { testID?: string }

export default function Monitor02Dashboard({ testID = 'monitor02' }: Monitor02DashboardProps) {
  const { themeColors: c, isDark } = useDesignSystem();
  const { supabase } = useSupabase();
  const router = useRouter();
  const paperTheme = usePaperTheme();
  const [filters, setFilters] = useState<RoiReportFilters>(EMPTY_ROI_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState(true);
  // an unreadable date is a red field, not a filter
  const errors = roiDateErrors(filters);
  const from = errors.startDate ? null : parseDayInput(filters.startDate);
  const to = errors.finishDate ? null : parseDayInput(filters.finishDate);
  const data = useMonitor02Data({ from, to }, { live: autoRefresh });

  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Refresh: the database recomputes my tasks NOW (the pg_cron worker does the same every 2 s; this works without it), then the lines are read again
  const refresh = useCallback(async () => {
    setBusy(true);
    setRefreshError(null);
    try { await refreshMonitor01Now(supabase, null); } catch (e: any) { setRefreshError(e?.message || String(e)); }
    data.reload();
    setBusy(false);
  }, [supabase, data]);

  const lines = useMemo(
    () => buildRoiNowLines(data.projects, data.months, data.tasks, { from, to, projectGUID: filters.projectGUID, taskGUID: filters.taskGUID }),
    [data.projects, data.months, data.tasks, from, to, filters.projectGUID, filters.taskGUID],
  );
  const footer = useMemo(() => roiFooterOf(lines), [lines]);
  const projectItems = useMemo(() => roiProjectOptions(data.projects), [data.projects]);
  const taskItems = useMemo(() => roiTaskOptions(data.tasks, filters.projectGUID || undefined), [data.tasks, filters.projectGUID]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const age = data.changedAt ? Math.max(0, Math.round((now - data.changedAt) / 1000)) : null;
  const stale = autoRefresh && !data.live;

  const openTask = useCallback((line: RoiReportLine) => {
    if (!line.taskGUID) return;
    openDashboardLink({ projectGUID: line.projectGUID, taskGUID: line.taskGUID }, router);
  }, [router]);

  const headerBackground = colorToHex((paperTheme?.colors as any)?.surfaceVariant || (isDark ? '#49454f' : '#e7e0ec'));
  const colors = useMemo(() => ({ text: c.text, border: c.border, surface: c.surface, primary: c.primary, headerBackground, positive: isDark ? '#4ade80' : '#16a34a', negative: isDark ? '#f87171' : '#dc2626' }), [c, isDark, headerBackground]);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="trending_up" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Monitor02')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('ROI now')}</Text>
        <Monitor01Toolbar testID={`${testID}-toolbar`} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} onRefresh={() => { void refresh(); }} busy={busy} />
        <View style={{ flex: 1 }} />
        <View testID={`${testID}-age`} style={styles.age}>
          <View style={[styles.dot, { backgroundColor: stale ? c.error : c.primary }]} />
          <Text style={{ color: c.text, fontSize: 12 }}>
            {!autoRefresh ? pmT('Auto refresh is off: a snapshot') : stale ? pmT('Offline: the last data') : pmT('Live')}
            {age != null ? ` · ${pmT('changed {{n}} s ago', { n: age })}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.filters}>
        <Monitor02FiltersBar testID={`${testID}-filters`} value={filters} onChange={setFilters} projectItems={projectItems} taskItems={taskItems} />
      </View>
      {!!data.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{data.error}</Text>}
      {!!refreshError && <Text testID={`${testID}-refresh-error`} style={{ color: c.error, padding: 10 }}>{pmT('Refresh failed')}: {refreshError}</Text>}
      {data.isLoading && data.projects.length === 0 && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Loading…')}</Text>}
      <View style={{ flex: 1 }}>
        <Monitor02Table testID={`${testID}-table`} lines={lines} footer={footer} colors={colors} onTaskOpen={openTask} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  age: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  filters: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
});
