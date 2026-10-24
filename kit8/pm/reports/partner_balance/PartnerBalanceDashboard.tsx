// PartnerBalanceDashboard - Monitor07CustomerBalance / Monitor07VendorBalance: ONE screen for both, the only difference is the role (documentation/PARTNER_BALANCE.html, README next to this file).
//   bar 1   title · Refresh · Auto refresh (Realtime on partner_balance_ledger) · the age badge
//   bar 2   dateFrom · dateTo · Project · Task · Partner · Contract · (Legal entity) · Sum bigger than · Sum smaller than      (ReportFilterBar, descriptors)
//   bar 3   showSumForContract / Accounting / Budget · Hide settled · Sort by (partner name | Budget sum End | Contract finish date) ascending / descending
//   table   Partner -> Contract -> Task; the numbers of the database are in the display sign (customer: + = they owe us; vendor: + = we owe them); a press on a number lists the rows behind it
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme as usePaperTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import IconApp from '../../../ui/components/common/IconApp';
import { colorToHex } from '../../../ui/components/table/reusable/tableRows';
import { pmT } from '../../i18n/pmT';
import Monitor01Toolbar from '../monitor01/Monitor01Toolbar';
import ReportAgeBadge from '../common/ReportAgeBadge';
import ReportFilterBar from '../common/ReportFilterBar';
import { reportFilterErrors } from '../common/reportFilterModel';
import { useReportData } from '../common/useReportData';
import { useStoredChoice } from '../common/useStoredChoice';
import {
  BalanceMovementsParams, PARTNER_BALANCE_LEDGER_TABLE, fetchPartnerBalanceFilterItems, fetchPartnerBalanceReport,
} from './partnerBalanceApi';
import {
  BalanceNode, BalanceRole, BalanceRow, DEFAULT_FLAGS, DEFAULT_SORT, EMPTY_FILTER_ITEMS, SUM_KINDS, SumKindId, SumPart, balanceFilterDescriptors, balanceFiltersToRpc, balanceFooter, buildBalanceTree,
  buildTaskNodes, defaultFilterValues, flattenBalance, isReportFlags, isReportSort, shownKinds,
} from './partnerBalanceModel';
import PartnerBalanceMovementsModal from './PartnerBalanceMovementsModal';
import PartnerBalanceOptions from './PartnerBalanceOptions';
import PartnerBalanceTable from './PartnerBalanceTable';

export interface PartnerBalanceDashboardProps { role: BalanceRole; testID?: string }

export const ROLE_TITLE: Record<BalanceRole, { screen: string; name: string; sign: string }> = {
  customer: { screen: 'Monitor07CustomerBalance', name: 'Customer balance', sign: 'Positive: the customer owes us. Amounts with VAT.' },
  vendor: { screen: 'Monitor07VendorBalance', name: 'Vendor balance', sign: 'Positive: we owe the vendor. Amounts with VAT.' },
};

const dayBefore = (iso: string): string => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export default function PartnerBalanceDashboard({ role, testID = `monitor07-${role}` }: PartnerBalanceDashboardProps) {
  const { themeColors: c, isDark } = useDesignSystem();
  const { supabase } = useSupabase();
  const router = useRouter();
  const paperTheme = usePaperTheme();
  const [values, setValues] = useState(() => defaultFilterValues());
  const [flags, setFlags] = useStoredChoice(`partnerBalance.${role}.flags`, DEFAULT_FLAGS, isReportFlags);
  const [sort, setSort] = useStoredChoice(`partnerBalance.${role}.sort`, DEFAULT_SORT, isReportSort);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const kinds = useMemo(() => shownKinds(flags), [flags]);
  const query = useMemo(() => balanceFiltersToRpc(values, flags), [values, flags]);
  const queryKey = JSON.stringify([role, query, sort]);

  const report = useReportData<BalanceRow[]>({
    load: (client) => fetchPartnerBalanceReport(client, { role, from: query.from, to: query.to, filters: query.filters, sort }),
    deps: [queryKey], realtimeTable: PARTNER_BALANCE_LEDGER_TABLE, watch: autoRefresh, initial: [], enabled: !query.invalid,
  });
  const items = useReportData({
    load: (client) => fetchPartnerBalanceFilterItems(client, role, values.projectFilter || null, values.partnerFilter || null),
    deps: [role, values.projectFilter, values.partnerFilter], watch: false, initial: EMPTY_FILTER_ITEMS,
  });

  const tree = useMemo(() => buildBalanceTree(report.data), [report.data]);
  const footer = useMemo(() => balanceFooter(report.data, kinds), [report.data, kinds]);
  const kindCurrency = useMemo(() => {
    const out: Partial<Record<SumKindId, string>> = {};
    for (const k of kinds) { const cur = new Set(report.data.map((r) => String(r[k.currencyKey] ?? '')).filter(Boolean)); out[k.id] = cur.size === 1 ? [...cur][0] : ''; }
    return out;
  }, [report.data, kinds]);

  // the tasks of an opened contract: read when it is opened and again when the report is read again
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [taskNodes, setTaskNodes] = useState<Record<string, BalanceNode[]>>({});
  const [loadingKeys, setLoadingKeys] = useState<ReadonlySet<string>>(new Set());
  const [taskError, setTaskError] = useState<string | null>(null);
  const loadTasks = useCallback(async (node: BalanceNode) => {
    setLoadingKeys((s) => new Set(s).add(node.key));
    try {
      const filters: Record<string, unknown> = { ...query.filters, partnerFilter: node.partner, partnerContractFilter: node.contract === '' ? 'none' : node.contract };
      delete filters.sumBiggerThan; delete filters.sumSmallerThan; delete filters.hideSettled;
      const rows = await fetchPartnerBalanceReport(supabase, { role, from: query.from, to: query.to, filters, sort, group: 'task' });
      setTaskNodes((m) => ({ ...m, [node.key]: buildTaskNodes(node, rows) }));
      setTaskError(null);
    } catch (e: any) {
      setTaskError(e?.message || String(e));
    } finally {
      setLoadingKeys((s) => { const n = new Set(s); n.delete(node.key); return n; });
    }
  }, [supabase, role, query, sort]);
  const treeRef = useRef(tree);
  treeRef.current = tree;
  useEffect(() => {
    setTaskNodes({});
    for (const p of treeRef.current) for (const ct of p.children) if (expanded.has(ct.key)) void loadTasks(ct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.changedAt]);

  const toggle = useCallback((node: BalanceNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.key)) next.delete(node.key); else next.add(node.key);
      return next;
    });
    if (node.level === 'contract' && !expanded.has(node.key) && !taskNodes[node.key]) void loadTasks(node);
  }, [expanded, taskNodes, loadTasks]);
  const lines = useMemo(() => flattenBalance(tree, expanded, taskNodes), [tree, expanded, taskNodes]);

  // the rows behind a number
  const [drill, setDrill] = useState<{ params: BalanceMovementsParams; kind: SumKindId; title: string } | null>(null);
  const openCell = useCallback((node: BalanceNode, kind: SumKindId, part: SumPart) => {
    const partner = tree.find((p) => p.partner === node.partner);
    const period = part === 'Begin' ? { from: null, to: query.from ? dayBefore(query.from) : null } : part === 'End' ? { from: null, to: query.to } : { from: query.from, to: query.to };
    setDrill({
      params: { role, partner: node.partner, contract: node.contract, project: node.project, task: node.task, ...period },
      kind, title: [partner?.label, node.label].filter(Boolean).join(' / '),
    });
  }, [role, tree, query.from, query.to]);
  const openDocument = useCallback((route: string, documentGUID: string) => {
    setDrill(null);
    router.push({ pathname: route, params: { documentGUID } } as any);
  }, [router]);

  const descriptors = useMemo(() => balanceFilterDescriptors(items.data, values), [items.data, values]);
  const errors = reportFilterErrors(descriptors, values);
  const hasErrors = Object.values(errors).some(Boolean);
  const headerBackground = colorToHex((paperTheme?.colors as any)?.surfaceVariant || (isDark ? '#49454f' : '#e7e0ec'));
  const colors = useMemo(() => ({ text: c.text, border: c.border, surface: c.surface, primary: c.primary, headerBackground, negative: isDark ? '#f87171' : '#dc2626' }), [c, isDark, headerBackground]);
  const title = ROLE_TITLE[role];

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name={role === 'customer' ? 'account_balance' : 'account_balance_wallet'} size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT(title.screen)}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT(title.name)}</Text>
        <Monitor01Toolbar testID={`${testID}-toolbar`} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} onRefresh={() => { report.reload(); items.reload(); }} busy={report.isLoading} />
        <View style={{ flex: 1 }} />
        <ReportAgeBadge testID={`${testID}-age`} autoRefresh={autoRefresh} live={report.live} changedAt={report.changedAt} />
      </View>
      <Text testID={`${testID}-sign`} style={{ color: c.text, opacity: 0.65, fontSize: 12, paddingHorizontal: 12, paddingTop: 6 }}>{pmT(title.sign)}</Text>
      <View style={styles.filters}>
        <ReportFilterBar testID={`${testID}-filters`} descriptors={descriptors} value={values} onChange={setValues} />
        <PartnerBalanceOptions testID={`${testID}-options`} flags={flags} onFlagsChange={setFlags} sort={sort} onSortChange={setSort} />
      </View>
      {query.invalid && <Text testID={`${testID}-range-error`} style={{ color: c.error, paddingHorizontal: 12 }}>{pmT('dateFrom is after dateTo')}</Text>}
      {hasErrors && !query.invalid && <Text testID={`${testID}-input-error`} style={{ color: c.error, paddingHorizontal: 12 }}>{pmT('A date or an amount cannot be read: that filter is not applied.')}</Text>}
      {!!report.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{report.error}</Text>}
      {!!taskError && <Text testID={`${testID}-task-error`} style={{ color: c.error, padding: 10 }}>{taskError}</Text>}
      {report.isLoading && report.data.length === 0 && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Loading…')}</Text>}
      <View style={{ flex: 1 }}>
        <PartnerBalanceTable testID={`${testID}-table`} lines={lines} footer={footer} kinds={kinds} expanded={expanded} loadingKeys={loadingKeys} colors={colors}
          onToggle={toggle} onCellPress={openCell} kindCurrency={kindCurrency} />
      </View>
      <PartnerBalanceMovementsModal testID={`${testID}-movements`} params={drill?.params ?? null} kind={drill?.kind ?? 'contract'} title={drill?.title ?? ''} onClose={() => setDrill(null)} onOpenDocument={openDocument} />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 4 },
});
