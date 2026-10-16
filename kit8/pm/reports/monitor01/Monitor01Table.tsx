// Monitor01Table - the table of the sheet "W1 1-MONITOR01":
//   header   row 1: Plan (Planned, Contracted, Rest to contract, Budget) · Fact (Delivered, Invoiced, Actually used, On-hand)      row 2: Project · Resource role · Month · Task name · Unit · the columns
//            every header text starts with a capital letter, is centered and has the background of the header of ReusableTable (the surfaceVariant of the paper theme)
//   body     Total rows (per unit) · the TREE, one column per level:   Project  ▸  Resource role  ▸  Month (ascending)  ▸  Task name
//            every Project / Resource role / Month line is a SUBTOTAL (one line per unit) with a chevron that collapses everything below it; the Task name lines are the rows of the view
//   footer   the TotalsRow (always visible below the rows): sumForBudget and the quantities (per unit)
//   cells    a quantity is a button: it opens the SOURCE TRANSACTIONS (SumExplorerListReusable); the critical cells have a background colour (monitor01Colors.ts)
//            a DOUBLE click / touch on a Task name opens the task in the dashboard (Finances view: task + tab + line), `onTaskOpen`
// A FlatList draws only the rows in view; the rows are plain objects, so a realtime patch re-renders only the rows whose object changed.
import React, { memo, useCallback, useRef } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pmT } from '../../i18n/pmT';
import IconApp from '../../../ui/components/common/IconApp';
import { cellTone, toneBackground } from './monitor01Colors';
import {
  MONITOR01_HEAD, MONITOR01_MEASURE_TITLE, Monitor01Item, Monitor01Level, Monitor01Measure, Monitor01Row, Monitor01Sums, Monitor01Totals, formatMonitor01Number,
} from './monitor01Model';

export interface Monitor01CellPress { measure: Monitor01Measure; item: Monitor01Item; value: number }
export interface Monitor01TableColors { text: string; border: string; surface: string; primary: string; headerBackground: string; isDark: boolean }

export interface Monitor01TableProps {
  items: Monitor01Item[];
  /** the TotalsRow at the bottom (of the rows shown) */
  totals: Monitor01Totals;
  /** the chevron of a node was pressed (a Project / Resource role / Month line): the screen collapses or expands it */
  onToggle: (nodeKey: string) => void;
  unitTitle: (unit: string) => string;
  colors: Monitor01TableColors;
  onCell: (cell: Monitor01CellPress) => void;
  /** a double click / touch on the Task name of a row: the dashboard at that task (the screen decides how) */
  onTaskOpen?: (row: Monitor01Row) => void;
  testID?: string;
}

/** two presses on the same task within this time are a double click (a touch too: React Native has no onDoubleClick) */
export const MONITOR01_DOUBLE_PRESS_MS = 400;
const W = { project: 150, role: 190, month: 104, task: 160, unit: 72, num: 94, budget: 112 };
const ROW_H = 34;
/** the vertical line between the Plan and Fact groups (thicker than the hairline between the other columns), left edge of the first Fact column (delivered) */
const GROUP_BORDER_W = 2;
/** the column of the label of a node, by its level; the Task name column holds the rows */
const LEVEL_COLUMN: Record<Monitor01Level, 'project' | 'role' | 'month'> = { project: 'project', role: 'role', month: 'month' };

/** the numbers of a row/subtotal in the shape cellTone reads */
const asTone = (s: Monitor01Sums, stale = false) => ({
  qtyPlanned: s.planned, qtyContracted: s.contracted, qtyRestToContract: s.restToContract, qtyDelivered: s.delivered, qtyInvoiced: s.invoiced, qtyUsed: s.used, qtyOnHand: s.onHand, hasStalePlan: stale,
});
/** the columns after the dimensions, in the order of the sheet: the Plan group has the money after its quantities */
type Col = { id: Monitor01Measure | 'sumForBudget'; group: 'Plan' | 'Fact' };
const COLS: Col[] = [
  { id: 'planned', group: 'Plan' }, { id: 'contracted', group: 'Plan' }, { id: 'restToContract', group: 'Plan' }, { id: 'sumForBudget', group: 'Plan' },
  { id: 'delivered', group: 'Fact' }, { id: 'invoiced', group: 'Fact' }, { id: 'used', group: 'Fact' }, { id: 'onHand', group: 'Fact' },
];
const colWidth = (c: Col) => (c.id === 'sumForBudget' ? W.budget : W.num);
const colTitle = (c: Col) => (c.id === 'sumForBudget' ? MONITOR01_HEAD.sumForBudget : MONITOR01_MEASURE_TITLE[c.id]);
const NUMS_WIDTH = COLS.reduce((a, c) => a + colWidth(c), 0);
/** money with 2 decimals; 0 shows nothing */
const money = (n: number) => (n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

const sumsOfRow = (r: Monitor01Row): Monitor01Sums => ({ planned: r.qtyPlanned, contracted: r.qtyContracted, restToContract: r.qtyRestToContract, delivered: r.qtyDelivered, invoiced: r.qtyInvoiced, used: r.qtyUsed, onHand: r.qtyOnHand });

const Cell = memo(function Cell({ measure, sums, stale, bold, item, colors, testID, onCell, groupBorder }: {
  measure: Monitor01Measure; sums: Monitor01Sums; stale: boolean; bold: boolean; item: Monitor01Item; colors: Monitor01TableColors; testID: string; onCell: (c: Monitor01CellPress) => void;
  /** the left edge of this cell is the Plan | Fact divider (thicker) */
  groupBorder?: boolean;
}) {
  const value = sums[measure];
  const bg = toneBackground(cellTone(measure, asTone(sums, stale)), colors.isDark);
  // a cell that is 0 shows nothing (every column, every line)
  const text = formatMonitor01Number(value, true);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${MONITOR01_MEASURE_TITLE[measure]} ${text || '0'}`}
      onPress={() => onCell({ measure, item, value })}
      style={[styles.cell, { width: W.num, backgroundColor: bg, borderLeftColor: colors.border }, groupBorder ? { borderLeftWidth: GROUP_BORDER_W, borderLeftColor: colors.text } : null]}
    >
      <Text style={{ color: colors.text, fontWeight: bold ? '800' : '400', fontSize: 13, textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}>{text}</Text>
    </Pressable>
  );
});

function Monitor01TableImpl({ items, totals, onToggle, unitTitle, colors, onCell, onTaskOpen, testID = 'monitor01-table' }: Monitor01TableProps) {
  const lastPress = useRef<{ key: string; at: number } | null>(null);
  const pressTask = useCallback((key: string, row: Monitor01Row) => {
    const now = Date.now();
    const last = lastPress.current;
    if (last && last.key === key && now - last.at <= MONITOR01_DOUBLE_PRESS_MS) { lastPress.current = null; onTaskOpen?.(row); return; }
    lastPress.current = { key, at: now };
  }, [onTaskOpen]);
  const dimsWidth = W.project + W.role + W.month + W.task + W.unit;
  const width = dimsWidth + NUMS_WIDTH;
  const text = (extra?: object) => [{ color: colors.text, fontSize: 13 }, extra];

  const renderItem = useCallback(({ item }: { item: Monitor01Item }) => {
    const bold = item.kind !== 'row';
    const sums = item.kind === 'row' ? sumsOfRow(item.row) : item.sums;
    const budget = item.kind === 'row' ? item.row.sumForBudget : item.sumForBudget;
    const bg = item.kind === 'row' ? undefined : item.kind === 'total' ? colors.surface : item.level === 'project' ? colors.headerBackground : colors.surface;
    const unit = item.kind === 'row' ? item.row.measureUnit : item.unit;
    // the label of a line is in the column of its level: Project · Resource role · Month · Task name (a Total line has its caption in the first column)
    const nodeLabel = (level: Monitor01Level) => {
      if (item.kind !== 'node' || LEVEL_COLUMN[item.level] !== level) return null;
      // the chevron and the label only on the first line of a node; the lines of its other units are plain subtotals
      if (!item.first) return null;
      const label = item.level === 'role' ? item.label || pmT('(no role)') : item.label;
      return (
        <Pressable
          testID={`${testID}-toggle-${item.nodeKey}`}
          accessibilityRole="button"
          aria-expanded={item.expanded}
          accessibilityLabel={`${item.expanded ? pmT('Collapse') : pmT('Expand')} ${label}`}
          onPress={() => onToggle(item.nodeKey)}
          style={styles.nodeLabel}
        >
          <IconApp name={item.expanded ? 'expand_more' : 'chevron_right'} size={18} color={colors.text} />
          <Text numberOfLines={1} style={[text({ fontWeight: '800' }), { flexShrink: 1 }]}>{label}</Text>
        </Pressable>
      );
    };
    const cellOf = (level: Monitor01Level, w: number) => (
      <View style={{ width: w, paddingHorizontal: 4, justifyContent: 'center' }}>{nodeLabel(level)}</View>
    );
    return (
      <View testID={`${testID}-item-${item.key}`} style={[styles.row, { height: ROW_H, borderBottomColor: colors.border, backgroundColor: bg }]}>
        {item.kind === 'total'
          ? <Text numberOfLines={1} style={[text({ fontWeight: '800' }), { width: W.project, paddingHorizontal: 8 }]}>{pmT('Total')}</Text>
          : cellOf('project', W.project)}
        {cellOf('role', W.role)}
        {cellOf('month', W.month)}
        {item.kind === 'row' && onTaskOpen
          ? (
            <Pressable testID={`${testID}-task-${item.key}`} accessibilityRole="link" accessibilityLabel={`${pmT('Open task')} ${item.row.taskName}`} onPress={() => pressTask(item.key, item.row)} style={{ width: W.task, paddingHorizontal: 8, height: '100%', justifyContent: 'center' }}>
              <Text numberOfLines={1} style={text()}>{item.row.taskName}</Text>
            </Pressable>
          )
          : <Text numberOfLines={1} style={[text(), { width: W.task, paddingHorizontal: 8 }]}>{item.kind === 'row' ? item.row.taskName : ''}</Text>}
        <Text numberOfLines={1} style={[text({ opacity: 0.8 }), { width: W.unit, paddingHorizontal: 8 }]}>{unit ? unitTitle(unit) : ''}</Text>
        {COLS.map((c) => {
          if (c.id === 'sumForBudget') {
            return <Text key={c.id} testID={`${testID}-budget-${item.key}`} style={[text({ fontWeight: bold ? '800' : '400' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{money(budget)}</Text>;
          }
          return <Cell key={c.id} measure={c.id} sums={sums} stale={item.kind === 'row' && item.row.hasStalePlan} bold={bold} item={item} colors={colors} testID={`${testID}-cell-${item.key}-${c.id}`} onCell={onCell} groupBorder={c.id === 'delivered'} />;
        })}
      </View>
    );
  }, [colors, onCell, onToggle, onTaskOpen, pressTask, testID, unitTitle]);

  // the header: the background of the header of ReusableTable, every text centered
  const headBg = colors.headerBackground;
  const head = (w: number, title: string, id?: string, groupBorder?: boolean) => (
    <View key={title} style={[{ width: w, paddingHorizontal: 8, justifyContent: 'center' }, groupBorder ? { borderLeftWidth: GROUP_BORDER_W, borderLeftColor: colors.text } : null]}>
      <Text testID={id} numberOfLines={1} style={text({ fontWeight: '700', textAlign: 'center' })}>{pmT(title)}</Text>
    </View>
  );
  const groupTitles = ['Plan', 'Fact'] as const;

  // the TotalsRow: one line per unit (quantities are never added across units), the money in the same line; several units add one line with the money of all of them
  const several = totals.qty.length > 1;
  return (
    <ScrollView horizontal testID={testID} showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: width }}>
      <View style={{ width, flex: 1 }}>
        {/* header row 1: the groups */}
        <View style={[styles.row, { height: 28, backgroundColor: headBg, borderBottomColor: colors.border }]}>
          <View style={{ width: dimsWidth }} />
          {groupTitles.map((g) => (
            <View key={g} testID={`${testID}-group-${g}`} style={[{ width: COLS.filter((c) => c.group === g).reduce((a, c) => a + colWidth(c), 0), alignItems: 'center' }, g === 'Fact' ? { borderLeftWidth: GROUP_BORDER_W, borderLeftColor: colors.text } : null]}>
              <Text style={text({ fontWeight: '800', textAlign: 'center' })}>{pmT(g)}</Text>
            </View>
          ))}
        </View>
        {/* header row 2: the columns */}
        <View testID={`${testID}-head`} style={[styles.row, { height: 30, backgroundColor: headBg, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          {head(W.project, MONITOR01_HEAD.project, `${testID}-head-project`)}
          {head(W.role, MONITOR01_HEAD.role, `${testID}-head-role`)}
          {head(W.month, MONITOR01_HEAD.month, `${testID}-head-month`)}
          {head(W.task, MONITOR01_HEAD.task, `${testID}-head-task`)}
          {head(W.unit, MONITOR01_HEAD.unit, `${testID}-head-unit`)}
          {COLS.map((c) => head(colWidth(c), colTitle(c), `${testID}-head-${c.id}`, c.id === 'delivered'))}
        </View>
        <FlatList
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={renderItem}
          initialNumToRender={30}
          windowSize={9}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          ListEmptyComponent={<Text testID={`${testID}-empty`} style={{ color: colors.text, opacity: 0.6, padding: 16 }}>{pmT('No rows. Post the plan of a task (Finances → Post) and the numbers appear here within a few seconds.')}</Text>}
        />
        {/* the TotalsRow */}
        <View testID={`${testID}-totals`} style={{ backgroundColor: headBg, borderTopColor: colors.border, borderTopWidth: 1 }}>
          {totals.qty.map((t, i) => (
            <View key={t.unit} testID={`${testID}-totals-${t.unit || 'none'}`} style={[styles.row, { height: ROW_H - 4, borderBottomWidth: 0 }]}>
              <View style={{ width: dimsWidth - W.unit, justifyContent: 'center', paddingHorizontal: 8 }}>
                {i === 0 && <Text style={text({ fontWeight: '800' })}>{pmT('Totals')}</Text>}
              </View>
              <Text numberOfLines={1} style={[text({ opacity: 0.8, fontWeight: '700' }), { width: W.unit, paddingHorizontal: 8 }]}>{t.unit ? unitTitle(t.unit) : ''}</Text>
              {COLS.map((c) => c.id === 'sumForBudget'
                ? <Text key={c.id} testID={`${testID}-totals-${t.unit || 'none'}-budget`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{money(t.sumForBudget)}</Text>
                : <Text key={c.id} testID={`${testID}-totals-${t.unit || 'none'}-${c.id}`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.num, borderLeftColor: colors.border }, c.id === 'delivered' ? { borderLeftWidth: GROUP_BORDER_W, borderLeftColor: colors.text } : null]}>{formatMonitor01Number(t.sums[c.id], true)}</Text>)}
            </View>
          ))}
          {several && (
            <View testID={`${testID}-totals-all`} style={[styles.row, { height: ROW_H - 4, borderBottomWidth: 0 }]}>
              <View style={{ width: dimsWidth, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={text({ fontWeight: '800' })}>{pmT('Totals of all units')}</Text></View>
              {COLS.map((c) => c.id === 'sumForBudget'
                ? <Text key={c.id} testID={`${testID}-totals-all-budget`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{money(totals.sumForBudget)}</Text>
                : <View key={c.id} style={[{ width: W.num }, c.id === 'delivered' ? { borderLeftWidth: GROUP_BORDER_W, borderLeftColor: colors.text } : null]} />)}
            </View>
          )}
          {totals.qty.length === 0 && (
            <View testID={`${testID}-totals-none`} style={[styles.row, { height: ROW_H - 4, borderBottomWidth: 0 }]}>
              <View style={{ width: dimsWidth, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={text({ fontWeight: '800' })}>{pmT('Totals')}</Text></View>
              {COLS.map((c) => (c.id === 'sumForBudget'
                ? <Text key={c.id} testID={`${testID}-totals-none-budget`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{money(0)}</Text>
                : <View key={c.id} style={[{ width: W.num }, c.id === 'delivered' ? { borderLeftWidth: GROUP_BORDER_W, borderLeftColor: colors.text } : null]} />))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

export default memo(Monitor01TableImpl);
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  nodeLabel: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  cell: { height: '100%', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
  moneyCell: { textAlign: 'right', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
});
