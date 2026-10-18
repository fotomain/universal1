// SumExplorerListReusable - "navigate from ANY sum to the SOURCE TRANSACTIONS" (the Google Doc "W1 MONITOR1"): a window that lists the transactions a number is made of.
//
//   <SumExplorerListReusable
//     visible={open} onClose={close} title="Data Analyst · Oct 2026 · task01 · planned" value={24} unit="hour"
//     resetKey={key}                                    // a new key = the lists are read again
//     sources={[{ key: 'planned', title: 'Plan movements', sign: 1, columns, rowKey, fetchPage, onOpen }]}
//   />
//
// * A SOURCE is one list: its columns, how to read a page (fetchPage → rows + the exact count + the exact sum of ALL its rows) and what "Open" does on a row.
//   A plain number has one source; a derived number (rest to contract = planned − contracted, on-hand = received − used) has two, each with its sign and its own subtotal.
// * The window ends with a CHECK LINE: Σ sign × subtotal of the lists against the number that was clicked ("24.00 = 24.00 ✓"). A difference is told, not hidden: a report that
//   is refreshed every few seconds can be a moment behind its sources.
// * The ⋮ menu at the top right (like every window / table): Export and Share of the lists (JSON · CSV · PDF) - ALL rows, the pages not read yet are read first.
// * The component knows nothing about any report: the caller brings the sources.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from './ButtonApp';
import IconApp from './IconApp';
import PMContextMenu from '../../../pm/inner/menu/PMContextMenu';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { buildFileFromExportData, exportTableFile, shareTableFile, tableFileResultMessage } from '../table/reusable/tableExportActions';
import type { TableExportFormat } from '../table/reusable/tableExportActions';
import { buildSumExplorerExportData, readAllRows } from './sumExplorerExport';

export interface SumExplorerColumn<R> {
  key: string;
  title: string;
  width?: number;
  flex?: number;
  align?: 'left' | 'right';
  render: (row: R) => string;
}
export interface SumExplorerPage<R> { rows: R[]; totalCount: number; /** the sum of ALL the rows of the list, not of the page */ sum: number }
export interface SumExplorerSource<R = any> {
  key: string;
  title: string;
  /** +1 (default) or −1: how the subtotal of this list enters the number */
  sign?: 1 | -1;
  columns: SumExplorerColumn<R>[];
  rowKey: (row: R) => string;
  fetchPage: (page: number) => Promise<SumExplorerPage<R>>;
  /** shows the transaction in its own screen */
  onOpen?: (row: R) => void;
  openLabel?: string;
  /** a click / touch on the row itself (not only on the Open button): e.g. the task line of the transaction in a new tab */
  onRowPress?: (row: R) => void;
  emptyText?: string;
}

export interface SumExplorerListReusableProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** the number that was clicked (null/undefined = no check line) */
  value?: number | null;
  unit?: string;
  sources: SumExplorerSource[];
  /** change it to read the lists again (e.g. the key of the cell) */
  resetKey?: string;
  testID?: string;
}

interface SourceState { rows: any[]; totalCount: number; sum: number; page: number; loading: boolean; error: string | null; loaded: boolean }
const EMPTY_STATE: SourceState = { rows: [], totalCount: 0, sum: 0, page: -1, loading: false, error: null, loaded: false };
const TOLERANCE = 0.005;
// the lists have no GUIDs behind them: one PDF
const SUM_EXPORT_FORMATS: { format: TableExportFormat; label: string; icon: string }[] = [
  { format: 'json', label: 'to JSON', icon: 'data_object' },
  { format: 'csv', label: 'to CSV', icon: 'description' },
  { format: 'pdfVisible', label: 'PDF', icon: 'picture_as_pdf' },
];

/** the check line: Σ sign × subtotal against the clicked number (pure, tested) */
export function sumExplorerCheck(listTotal: number, value: number | null | undefined): { ok: boolean; difference: number } | null {
  if (value == null || !Number.isFinite(value)) return null;
  const difference = Math.round((listTotal - value) * 100) / 100;
  return { ok: Math.abs(difference) < TOLERANCE, difference };
}

export default function SumExplorerListReusable({ visible, onClose, title, subtitle, value, unit, sources, resetKey, testID = 'sum-explorer' }: SumExplorerListReusableProps) {
  const { themeColors: c } = useDesignSystem();
  const [state, setState] = useState<Record<string, SourceState>>({});
  const titleRef = useRef(title);
  titleRef.current = title;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const stateRef = useRef(state);
  stateRef.current = state;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastPress = useRef({ x: 0, y: 0 });

  /** the lists as they are now, ALL rows -> a file (export = download, share = the share sheet of the platform) */
  const runExport = useCallback(async (format: TableExportFormat, share: boolean) => {
    try {
      const rows: Record<string, any[]> = {};
      for (const s of sourcesRef.current) {
        const st = stateRef.current[s.key] ?? EMPTY_STATE;
        rows[s.key] = await readAllRows(s, st.rows, st.loaded ? st.totalCount : Number.POSITIVE_INFINITY, st.page);
      }
      const file = buildFileFromExportData(format, buildSumExplorerExportData(titleRef.current, sourcesRef.current, rows));
      const result = share ? await shareTableFile(file, titleRef.current) : await exportTableFile(file);
      setNotice(tableFileResultMessage(result, file.fileName));
    } catch (e: any) {
      setNotice(`${share ? 'Share' : 'Export'} failed: ${e?.message || e}`);
    }
  }, []);

  const readPage = useCallback(async (key: string, page: number) => {
    const source = sourcesRef.current.find((s) => s.key === key);
    if (!source) return;
    setState((s) => ({ ...s, [key]: { ...(s[key] ?? EMPTY_STATE), loading: true, error: null } }));
    try {
      const result = await source.fetchPage(page);
      setState((s) => {
        const old = s[key] ?? EMPTY_STATE;
        return { ...s, [key]: { rows: page === 0 ? result.rows : [...old.rows, ...result.rows], totalCount: result.totalCount, sum: result.sum, page, loading: false, error: null, loaded: true } };
      });
    } catch (e: any) {
      setState((s) => ({ ...s, [key]: { ...(s[key] ?? EMPTY_STATE), loading: false, error: e?.message || String(e) } }));
    }
  }, []);

  // opened (or a new key): read the first page of every list
  useEffect(() => {
    if (!visible) return;
    setState({});
    setNotice(null);
    setMenu(null);
    for (const s of sourcesRef.current) void readPage(s.key, 0);
  }, [visible, resetKey, readPage]);

  const allLoaded = sources.length > 0 && sources.every((s) => state[s.key]?.loaded);
  const listTotal = useMemo(() => sources.reduce((acc, s) => acc + (s.sign ?? 1) * (state[s.key]?.sum ?? 0), 0), [sources, state]);
  const check = allLoaded ? sumExplorerCheck(listTotal, value) : null;
  const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`}>
        <Pressable style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => undefined} testID={testID}>
          <View style={styles.head}>
            <IconApp name="account_tree" size={20} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text testID={`${testID}-title`} numberOfLines={2} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
              {!!subtitle && <Text numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{subtitle}</Text>}
            </View>
            {value != null && <Text testID={`${testID}-value`} style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{fmt(value)}{unit ? ` ${unit}` : ''}</Text>}
            <ButtonApp testID={`${testID}-close`} title="Close" variant="text" size="small" onPress={onClose} />
            <View onStartShouldSetResponderCapture={(e: any) => { lastPress.current = { x: e?.nativeEvent?.pageX ?? 0, y: e?.nativeEvent?.pageY ?? 0 }; return false; }}>
              <PMIconButton tipScope="app" testID={`${testID}-more`} icon="more_vert" title="Export, share" color={c.text}
                onPress={() => setMenu({ x: lastPress.current.x, y: lastPress.current.y })} />
            </View>
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {sources.map((source) => {
              const st = state[source.key] ?? EMPTY_STATE;
              return (
                <View key={source.key} testID={`${testID}-source-${source.key}`} style={[styles.source, { borderColor: c.border }]}>
                  <View style={styles.sourceHead}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 13, flex: 1 }}>{(source.sign ?? 1) < 0 ? '− ' : ''}{source.title}</Text>
                    {st.loaded && <Text testID={`${testID}-subtotal-${source.key}`} style={{ color: c.text, fontSize: 12, opacity: 0.8 }}>{st.totalCount} · {fmt(st.sum)}{unit ? ` ${unit}` : ''}</Text>}
                  </View>
                  {!!st.error && <Text testID={`${testID}-error-${source.key}`} style={{ color: c.error, fontSize: 12, padding: 6 }}>{st.error}</Text>}
                  {st.loaded && st.rows.length === 0 && <Text testID={`${testID}-empty-${source.key}`} style={{ color: c.text, opacity: 0.6, fontSize: 12, padding: 8 }}>{source.emptyText ?? 'No source transactions.'}</Text>}
                  {st.rows.length > 0 && (
                    <View style={[styles.row, styles.headRow, { borderBottomColor: c.border }]}>
                      {source.columns.map((col) => (
                        <Text key={col.key} style={[styles.cell, styles.headCell, { color: c.text }, col.align === 'right' && styles.right, col.width ? { width: col.width } : { flex: col.flex ?? 1 }]}>{col.title}</Text>
                      ))}
                      {!!source.onOpen && <View style={{ width: 64 }} />}
                    </View>
                  )}
                  {st.rows.map((row) => (
                    <Pressable key={source.rowKey(row)} testID={`${testID}-row-${source.rowKey(row)}`} accessibilityRole={source.onRowPress ? 'link' : undefined} disabled={!source.onRowPress}
                      onPress={source.onRowPress ? () => source.onRowPress!(row) : undefined} style={[styles.row, { borderBottomColor: c.border }]}>
                      {source.columns.map((col) => (
                        <Text key={col.key} numberOfLines={1} style={[styles.cell, { color: c.text }, col.align === 'right' && styles.right, col.width ? { width: col.width } : { flex: col.flex ?? 1 }]}>{col.render(row)}</Text>
                      ))}
                      {!!source.onOpen && (
                        <Pressable testID={`${testID}-open-${source.rowKey(row)}`} accessibilityRole="button" onPress={() => source.onOpen!(row)} style={{ width: 64, alignItems: 'center' }}>
                          <Text style={{ color: c.primary, fontSize: 12, fontWeight: '600' }}>{source.openLabel ?? 'Open'}</Text>
                        </Pressable>
                      )}
                    </Pressable>
                  ))}
                  {st.loaded && st.rows.length < st.totalCount && (
                    <ButtonApp testID={`${testID}-more-${source.key}`} title={`Load more (${st.rows.length} of ${st.totalCount})`} variant="text" size="small" loading={st.loading} onPress={() => { void readPage(source.key, st.page + 1); }} />
                  )}
                  {st.loading && !st.loaded && <Text style={{ color: c.text, opacity: 0.6, fontSize: 12, padding: 8 }}>Loading…</Text>}
                </View>
              );
            })}
          </ScrollView>

          {!!notice && <Text testID={`${testID}-notice`} style={{ color: c.text, fontSize: 12, opacity: 0.8 }}>{notice}</Text>}
          {check && (
            <View testID={`${testID}-check`} style={[styles.check, { borderColor: check.ok ? c.primary : c.error }]}>
              <IconApp name={check.ok ? 'check_circle' : 'warning'} size={16} color={check.ok ? c.primary : c.error} />
              <Text style={{ color: c.text, fontSize: 12, flex: 1 }}>
                {check.ok
                  ? `List total ${fmt(listTotal)} = ${fmt(value as number)} ✓`
                  : `List total ${fmt(listTotal)} differs from ${fmt(value as number)} by ${fmt(check.difference)}: the report is refreshed every few seconds and was a moment behind its sources.`}
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>
      {menu && (
        <PMContextMenu testID={`${testID}-more-menu`} x={menu.x} y={menu.y} onClose={() => setMenu(null)}
          items={[
            { testID: `${testID}-more-export`, label: 'Export', icon: 'download', onPress: () => {},
              submenu: SUM_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-more-export-${f.format}`, label: f.label, icon: f.icon, onPress: () => { setMenu(null); void runExport(f.format, false); } })) },
            { testID: `${testID}-more-share`, label: 'Share', icon: 'share', onPress: () => {},
              submenu: SUM_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-more-share-${f.format}`, label: f.label, icon: f.icon, onPress: () => { setMenu(null); void runExport(f.format, true); } })) },
          ]} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 860, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  source: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, marginTop: 8, overflow: 'hidden' },
  sourceHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  headRow: { paddingVertical: 4 },
  cell: { fontSize: 12, paddingHorizontal: 8 },
  headCell: { fontWeight: '700' },
  right: { textAlign: 'right' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 8 },
});
