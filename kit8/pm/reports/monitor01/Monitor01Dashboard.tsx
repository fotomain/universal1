// Monitor01Dashboard - the report "Roles Requirements" of the sheet "W1 1-MONITOR01" (documentation/MONITOR01_WBS.html): per resource role, month and task
// planned · contracted · rest to contract · delivered · actually used · on-hand, live (monitor01_view is refreshed by pg_cron every MONITOR01_REFRESH_INTERVAL seconds and listened to by Realtime).
//
//   mode 'project'     a part of the project board: the toggle Reports → Monitor01 (one project; no Project filter)
//   mode 'standalone'  separately: the route /pm/reports/monitor01 from the hamburger menu → Reports → Monitor01 — the FULL data set of the user, with the Project filter
//   tabs Time · Material · Expense · All          filters startDate · finishDate (DateInputApp) · Project · Task · Resource (TextInputApp + Clear)
//   the table is a TREE Project → Resource role → Month (ascending) → Task name: every Project / Role / Month line is a subtotal and collapses what is below it (Expand all / Collapse all in the toolbar)
//   a click on any number (a cell, a subtotal, a total) opens SumExplorerListReusable: the source transactions of that sum.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme as usePaperTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import IconApp from '../../../ui/components/common/IconApp';
import SumExplorerListReusable from '../../../ui/components/common/SumExplorerListReusable';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { PRODUCT_READ_PARAMS } from '../../../catalog/product/dashboard/useProductCatalogData';
import { PRODUCT_TABLES } from '../../../catalog/product/productModel';
import { rowTitle } from '../../../catalog/product/crud/productCatalogTools';
import { colorToHex } from '../../../ui/components/table/reusable/tableRows';
import { pmT } from '../../i18n/pmT';
import { TASK_LINE_PLAN_ROUTE } from '../../view/task/plan/taskLinePlanModel';
import { useOpenFactInput } from '../../fact/useOpenFactInput';
import Monitor01FiltersBar from './Monitor01Filters';
import Monitor01Table, { Monitor01CellPress } from './Monitor01Table';
import Monitor01Toolbar from './Monitor01Toolbar';
import { MONITOR01_POLL_INTERVAL_MS, MONITOR01_REFRESH_INTERVAL } from './monitor01Constants';
import { refreshMonitor01Now } from './monitor01Api';
import {
  EMPTY_MONITOR01_FILTERS, MONITOR01_MEASURE_TITLE, Monitor01Row, MONITOR01_TABS, Monitor01Filters, Monitor01Item, Monitor01Tab, buildMonitor01Items, drillFilterOfNode, drillFilterOfRow, drillFilterOfRows,
  filterMonitor01Rows, monitor01NodeKeys, monitor01Totals, monthLabel, rowsOfTab,
} from './monitor01Model';
import { buildMonitor01Sources } from './monitor01SumSources';
import { useMonitor01Rows } from './useMonitor01Rows';

export interface Monitor01DashboardProps {
  mode: 'project' | 'standalone';
  /** project mode: the project (the rows of one project only) */
  projectGUID?: string | null;
  testID?: string;
}

interface Drill { key: string; title: string; subtitle: string; value: number; unit: string; measure: CellMeasure; filter: Record<string, any> }
type CellMeasure = Monitor01CellPress['measure'];

/** 'unit_hour' → 'hour' when the unit catalog has not arrived */
const fallbackUnit = (u: string) => u.replace(/^unit_/, '');

export default function Monitor01Dashboard({ mode, projectGUID, testID = 'monitor01' }: Monitor01DashboardProps) {
  const { themeColors: c, isDark } = useDesignSystem();
  const { supabase } = useSupabase();
  const router = useRouter();
  const openFactInput = useOpenFactInput();
  const dispatch = useDispatch();
  const paperTheme = usePaperTheme();
  const scopeProject = mode === 'project' ? (projectGUID || null) : null;
  // Auto refresh (the Monitor01Toolbar): ON = the rows follow Realtime and the safety net under it; OFF = a snapshot (no polling either), which Refresh replaces
  const [autoRefresh, setAutoRefresh] = useState(true);
  const data = useMonitor01Rows(scopeProject, { poll: autoRefresh });

  const [tab, setTab] = useState<Monitor01Tab>('all');
  const [filters, setFilters] = useState<Monitor01Filters>(EMPTY_MONITOR01_FILTERS);
  const [drill, setDrill] = useState<Drill | null>(null);

  // the filters cut the rows in memory, so they work in both modes of Auto refresh
  const [snapshot, setSnapshot] = useState<Monitor01Row[] | null>(null);
  const [refreshSince, setRefreshSince] = useState<number | null>(null);
  const changeAuto = useCallback((on: boolean) => { setAutoRefresh(on); setSnapshot(on ? null : data.rows); setRefreshSince(null); }, [data.rows]);
  // Refresh: the database recomputes the user's tasks NOW (works without pg_cron), then the rows are read again; its error is shown
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshNow = useCallback(async () => {
    setRefreshError(null);
    setRefreshSince(data.changedAt ?? 0);
    try {
      await refreshMonitor01Now(supabase, scopeProject);
    } catch (e: any) {
      setRefreshError(e?.message || String(e));
    }
    data.reload();
  }, [data, supabase, scopeProject]);
  const refresh = useCallback(() => { void refreshNow(); }, [refreshNow]);
  // the first look at an EMPTY report: nothing may be waiting for a worker that does not run - the plan data is computed now
  const firstLook = useRef(false);
  useEffect(() => {
    if (firstLook.current || data.isLoading || data.rows.length > 0 || data.error) return;
    firstLook.current = true;
    void refreshNow();
  }, [data.isLoading, data.rows.length, data.error, refreshNow]);
  useEffect(() => {
    if (refreshSince === null || (data.changedAt ?? 0) <= refreshSince) return;
    setRefreshSince(null);
    if (!autoRefresh) setSnapshot(data.rows);
  }, [data.changedAt, data.rows, refreshSince, autoRefresh]);
  const sourceRows = autoRefresh ? data.rows : (snapshot ?? data.rows);

  // the unit titles (the measure unit catalog); until it arrives the key without "unit_" is shown
  const units: any[] = useSelector((s: any) => s?.[PRODUCT_TABLES.measureUnit.entity]?.entityDataFromServer) || [];
  useEffect(() => {
    const actions = SystemMetaData[PRODUCT_TABLES.measureUnit.entity]?.actions;
    if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
  }, [dispatch]);
  const unitTitle = useCallback((u: string) => { const row = units.find((r) => r.rowGUID === u); return row ? rowTitle(row) : fallbackUnit(u); }, [units]);

  const filtered = useMemo(() => filterMonitor01Rows(sourceRows, filters), [sourceRows, filters]);
  const shown = useMemo(() => rowsOfTab(filtered, tab), [filtered, tab]);
  // the nodes of the tree that are collapsed (everything is open at the start); it is kept while the rows change, so a realtime event does not open or close anything
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleNode = useCallback((nodeKey: string) => setCollapsed((cur) => { const next = new Set(cur); if (!next.delete(nodeKey)) next.add(nodeKey); return next; }), []);
  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => setCollapsed(monitor01NodeKeys(shown)), [shown]);
  const items = useMemo(() => buildMonitor01Items(shown, collapsed), [shown, collapsed]);
  const totals = useMemo(() => monitor01Totals(shown), [shown]);
  const counts = useMemo(() => Object.fromEntries(MONITOR01_TABS.map((t) => [t.id, rowsOfTab(filtered, t.id).length])) as Record<Monitor01Tab, number>, [filtered]);

  // the data age: re-drawn every second
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const age = data.changedAt ? Math.max(0, Math.round((now - data.changedAt) / 1000)) : null;
  // live = Realtime is open; polling = Realtime is not, but the stamp is answered (changes still arrive within a few seconds)
  const polling = !data.live && !!data.checkedAt && now - data.checkedAt < MONITOR01_POLL_INTERVAL_MS * 3;
  const stale = !data.live && !polling;

  const openPlan = useCallback((taskGUID: string) => {
    setDrill(null);
    router.push({ pathname: TASK_LINE_PLAN_ROUTE, params: { taskGUID, ...(scopeProject ? { projectGUID: scopeProject } : {}) } } as any);
  }, [router, scopeProject]);

  const onCell = useCallback((cell: Monitor01CellPress) => {
    const item: Monitor01Item = cell.item;
    const scope = { projectGUID: scopeProject, filters };
    let filter: Record<string, any>; let what: string; let unit = '';
    if (item.kind === 'row') {
      filter = drillFilterOfRow(item.row);
      what = `${item.row.resourceRoleName || pmT('(no role)')} · ${monthLabel(item.row.periodMonth)} · ${item.row.taskName}`;
      unit = item.row.measureUnit;
    } else if (item.kind === 'node') {
      filter = drillFilterOfNode(item, scope);
      // the path of the node: Project · Resource role · Month
      const first = item.rows[0];
      const path = [first.projectName, ...(item.level !== 'project' ? [first.resourceRoleName || pmT('(no role)')] : []), ...(item.level === 'month' ? [monthLabel(first.periodMonth)] : [])];
      what = `${pmT('Subtotal')} ${path.join(' · ')}`;
      unit = item.unit;
    } else if (item.kind === 'total') {
      filter = drillFilterOfRows(item.rows, scope, { unit: item.unit });
      what = pmT('Total');
      unit = item.unit;
    } else return;
    setDrill({ key: `${item.key}|${cell.measure}|${Date.now()}`, title: `${what} · ${pmT(MONITOR01_MEASURE_TITLE[cell.measure])}`, subtitle: item.kind === 'row' ? item.row.projectName : '', value: cell.value, unit: unit ? unitTitle(unit) : '', measure: cell.measure, filter });
  }, [filters, scopeProject, unitTitle]);

  const sources = useMemo(() => (drill ? buildMonitor01Sources(supabase, drill.measure, drill.filter, { openPlan, openFactDocument: (documentGUID, taskGUID) => { setDrill(null); openFactInput({ taskGUID, documentGUID, projectGUID: scopeProject ?? undefined }); } }) : []), [drill, supabase, openPlan, openFactInput, scopeProject]);

  // the header (and the TotalsRow) have the background of the header of ReusableTable: the surfaceVariant of the paper theme
  const headerBackground = colorToHex((paperTheme?.colors as any)?.surfaceVariant || (isDark ? '#49454f' : '#e7e0ec'));
  const colors = useMemo(() => ({ text: c.text, border: c.border, surface: c.surface, primary: c.primary, headerBackground, isDark }), [c, isDark, headerBackground]);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="monitoring" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Monitor01')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('Roles requirements')}</Text>
        <Monitor01Toolbar testID={`${testID}-toolbar`} autoRefresh={autoRefresh} onAutoRefreshChange={changeAuto} onRefresh={refresh} onExpandAll={expandAll} onCollapseAll={collapseAll} busy={refreshSince !== null} />
        <View style={{ flex: 1 }} />
        <View testID={`${testID}-age`} style={styles.age}>
          <View style={[styles.dot, { backgroundColor: stale ? c.error : c.primary }]} />
          <Text style={{ color: c.text, fontSize: 12 }}>
            {stale ? pmT('Offline: the last data') : !autoRefresh ? pmT('Auto refresh is off: a snapshot') : polling ? pmT('Live: checked every {{n}} s', { n: MONITOR01_POLL_INTERVAL_MS / 1000 }) : pmT('Live')}
            {age != null ? ` · ${pmT('changed {{n}} s ago', { n: age })}` : ''}
            {` · ${pmT('refresh {{n}} s', { n: MONITOR01_REFRESH_INTERVAL })}`}
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        <Monitor01FiltersBar testID={`${testID}-filters`} value={filters} onChange={setFilters} showProject={mode === 'standalone'} />
      </View>

      <View accessibilityRole="tablist" testID={`${testID}-tabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {MONITOR01_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable key={t.id} accessibilityRole="tab" aria-selected={active} testID={`${testID}-tab-${t.id}`} onPress={() => setTab(t.id)} style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
              <IconApp name={t.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(t.title)}</Text>
              {!!counts[t.id] && <Text testID={`${testID}-tab-${t.id}-count`} style={{ color: c.text, opacity: 0.55, fontSize: 11 }}>{counts[t.id]}</Text>}
            </Pressable>
          );
        })}
      </View>

      {!!data.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{data.error}</Text>}
      {!!refreshError && <Text testID={`${testID}-refresh-error`} style={{ color: c.error, padding: 10 }}>{pmT('Refresh failed')}: {refreshError}</Text>}
      {data.isLoading && data.rows.length === 0 && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Loading…')}</Text>}

      <View style={{ flex: 1 }}>
        <Monitor01Table items={items} totals={totals} onToggle={toggleNode} unitTitle={unitTitle} colors={colors} onCell={onCell} testID={`${testID}-table`} />
      </View>

      <SumExplorerListReusable
        testID={`${testID}-sum`}
        visible={!!drill}
        onClose={() => setDrill(null)}
        title={drill?.title ?? ''}
        subtitle={drill?.subtitle}
        value={drill?.value ?? null}
        unit={drill?.unit}
        resetKey={drill?.key}
        sources={sources}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  age: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  filters: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 14, borderBottomWidth: 2 },
});
