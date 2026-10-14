// Monitor01Table - the table of the sheet "W1 1-MONITOR01":
//   header   row 1: Plan (Planned, Contracted, Rest to contract, Sum for budget) · Fact (Delivered, Actually used, On-hand)      row 2: Resource role · Month · Task name · Unit · the columns
//            every header text starts with a capital letter, is centered and has the background of the header of ReusableTable (the surfaceVariant of the paper theme)
//   body     Total rows (per unit) · per genus: caption, subtotals (per unit), the rows
//   footer   the TotalsRow (always visible below the rows): sumForBudget and the quantities (per unit)
//   cells    a quantity is a button: it opens the SOURCE TRANSACTIONS (SumExplorerListReusable); the critical cells have a background colour (monitor01Colors.ts)
// A FlatList draws only the rows in view; the rows are plain objects, so a realtime patch re-renders only the rows whose object changed.
import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pmT } from '../../i18n/pmT';
import { cellTone, toneBackground } from './monitor01Colors';
import {
  MONITOR01_HEAD, MONITOR01_MEASURE_TITLE, Monitor01Item, Monitor01Measure, Monitor01Row, Monitor01Sums, Monitor01Totals,
  formatMonitor01Number, monitor01GenusTitle, monthLabel,
} from './monitor01Model';

export interface Monitor01CellPress { measure: Monitor01Measure; item: Monitor01Item; value: number }
export interface Monitor01TableColors { text: string; border: string; surface: string; primary: string; headerBackground: string; isDark: boolean }

export interface Monitor01TableProps {
  items: Monitor01Item[];
  /** the TotalsRow at the bottom (of the rows shown) */
  totals: Monitor01Totals;
  /** the full data set shows the project of every row */
  showProject: boolean;
  unitTitle: (unit: string) => string;
  colors: Monitor01TableColors;
  onCell: (cell: Monitor01CellPress) => void;
  testID?: string;
}

const W = { project: 150, role: 190, month: 86, task: 160, unit: 72, num: 94, budget: 112 };
const ROW_H = 34;

/** the numbers of a row/subtotal in the shape cellTone reads */
const asTone = (s: Monitor01Sums, stale = false) => ({
  qtyPlanned: s.planned, qtyContracted: s.contracted, qtyRestToContract: s.restToContract, qtyDelivered: s.delivered, qtyUsed: s.used, qtyOnHand: s.onHand, hasStalePlan: stale,
});
/** the columns after the dimensions, in the order of the sheet: the Plan group has the money after its quantities */
type Col = { id: Monitor01Measure | 'sumForBudget'; group: 'Plan' | 'Fact' };
const COLS: Col[] = [
  { id: 'planned', group: 'Plan' }, { id: 'contracted', group: 'Plan' }, { id: 'restToContract', group: 'Plan' }, { id: 'sumForBudget', group: 'Plan' },
  { id: 'delivered', group: 'Fact' }, { id: 'used', group: 'Fact' }, { id: 'onHand', group: 'Fact' },
];
const colWidth = (c: Col) => (c.id === 'sumForBudget' ? W.budget : W.num);
const colTitle = (c: Col) => (c.id === 'sumForBudget' ? MONITOR01_HEAD.sumForBudget : MONITOR01_MEASURE_TITLE[c.id]);
const NUMS_WIDTH = COLS.reduce((a, c) => a + colWidth(c), 0);
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sumsOfRow = (r: Monitor01Row): Monitor01Sums => ({ planned: r.qtyPlanned, contracted: r.qtyContracted, restToContract: r.qtyRestToContract, delivered: r.qtyDelivered, used: r.qtyUsed, onHand: r.qtyOnHand });

const Cell = memo(function Cell({ measure, sums, stale, bold, item, colors, testID, onCell }: {
  measure: Monitor01Measure; sums: Monitor01Sums; stale: boolean; bold: boolean; item: Monitor01Item; colors: Monitor01TableColors; testID: string; onCell: (c: Monitor01CellPress) => void;
}) {
  const value = sums[measure];
  const bg = toneBackground(cellTone(measure, asTone(sums, stale)), colors.isDark);
  // fact columns without data stay blank (as in the sheet); on-hand shows its 0
  const text = formatMonitor01Number(value, measure === 'delivered' || measure === 'used');
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${MONITOR01_MEASURE_TITLE[measure]} ${text || '0'}`}
      onPress={() => onCell({ measure, item, value })}
      style={[styles.cell, { width: W.num, backgroundColor: bg, borderLeftColor: colors.border }]}
    >
      <Text style={{ color: colors.text, fontWeight: bold ? '800' : '400', fontSize: 13, textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}>{text}</Text>
    </Pressable>
  );
});

function Monitor01TableImpl({ items, totals, showProject, unitTitle, colors, onCell, testID = 'monitor01-table' }: Monitor01TableProps) {
  const dimsWidth = (showProject ? W.project : 0) + W.role + W.month + W.task + W.unit;
  const width = dimsWidth + NUMS_WIDTH;
  const text = (extra?: object) => [{ color: colors.text, fontSize: 13 }, extra];

  const renderItem = useCallback(({ item }: { item: Monitor01Item }) => {
    const bold = item.kind !== 'row';
    const sums = item.kind === 'row' ? sumsOfRow(item.row) : item.kind === 'group' ? null : item.sums;
    const budget = item.kind === 'row' ? item.row.sumForBudget : item.kind === 'group' ? null : item.sumForBudget;
    const bg = item.kind === 'row' ? undefined : item.kind === 'group' ? colors.headerBackground : colors.surface;
    const label = item.kind === 'total' ? pmT('Total') : item.kind === 'group' ? pmT(monitor01GenusTitle(item.genus)) : item.kind === 'subtotal' ? `${pmT('Subtotal')} ${pmT(monitor01GenusTitle(item.genus))}` : item.row.resourceRoleName || pmT('(no role)');
    const unit = item.kind === 'row' ? item.row.measureUnit : item.kind === 'group' ? '' : item.unit;
    return (
      <View testID={`${testID}-item-${item.key}`} style={[styles.row, { height: ROW_H, borderBottomColor: colors.border, backgroundColor: bg }]}>
        {showProject && <Text numberOfLines={1} style={[text(), { width: W.project, paddingHorizontal: 8 }]}>{item.kind === 'row' ? item.row.projectName : ''}</Text>}
        <Text numberOfLines={1} style={[text({ fontWeight: bold ? '800' : '400' }), { width: W.role, paddingHorizontal: 8 }]}>{label}</Text>
        <Text numberOfLines={1} style={[text(), { width: W.month, paddingHorizontal: 8 }]}>{item.kind === 'row' ? monthLabel(item.row.periodMonth) : ''}</Text>
        <Text numberOfLines={1} style={[text(), { width: W.task, paddingHorizontal: 8 }]}>{item.kind === 'row' ? item.row.taskName : ''}</Text>
        <Text numberOfLines={1} style={[text({ opacity: 0.8 }), { width: W.unit, paddingHorizontal: 8 }]}>{unit ? unitTitle(unit) : ''}</Text>
        {COLS.map((c) => {
          if (!sums) return <View key={c.id} style={{ width: colWidth(c) }} />;
          if (c.id === 'sumForBudget') {
            return <Text key={c.id} testID={`${testID}-budget-${item.key}`} style={[text({ fontWeight: bold ? '800' : '400' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{budget ? money(budget) : ''}</Text>;
          }
          return <Cell key={c.id} measure={c.id} sums={sums} stale={item.kind === 'row' && item.row.hasStalePlan} bold={bold} item={item} colors={colors} testID={`${testID}-cell-${item.key}-${c.id}`} onCell={onCell} />;
        })}
      </View>
    );
  }, [colors, onCell, showProject, testID, unitTitle]);

  // the header: the background of the header of ReusableTable, every text centered
  const headBg = colors.headerBackground;
  const head = (w: number, title: string, id?: string) => (
    <View key={title} style={{ width: w, paddingHorizontal: 8, justifyContent: 'center' }}>
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
            <View key={g} testID={`${testID}-group-${g}`} style={{ width: COLS.filter((c) => c.group === g).reduce((a, c) => a + colWidth(c), 0), alignItems: 'center' }}>
              <Text style={text({ fontWeight: '800', textAlign: 'center' })}>{pmT(g)}</Text>
            </View>
          ))}
        </View>
        {/* header row 2: the columns */}
        <View testID={`${testID}-head`} style={[styles.row, { height: 30, backgroundColor: headBg, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          {showProject && head(W.project, MONITOR01_HEAD.project, `${testID}-head-project`)}
          {head(W.role, MONITOR01_HEAD.role, `${testID}-head-role`)}
          {head(W.month, MONITOR01_HEAD.month, `${testID}-head-month`)}
          {head(W.task, MONITOR01_HEAD.task, `${testID}-head-task`)}
          {head(W.unit, MONITOR01_HEAD.unit, `${testID}-head-unit`)}
          {COLS.map((c) => head(colWidth(c), colTitle(c), `${testID}-head-${c.id}`))}
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
                : <Text key={c.id} testID={`${testID}-totals-${t.unit || 'none'}-${c.id}`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.num, borderLeftColor: colors.border }]}>{formatMonitor01Number(t.sums[c.id], c.id === 'delivered' || c.id === 'used')}</Text>)}
            </View>
          ))}
          {several && (
            <View testID={`${testID}-totals-all`} style={[styles.row, { height: ROW_H - 4, borderBottomWidth: 0 }]}>
              <View style={{ width: dimsWidth, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={text({ fontWeight: '800' })}>{pmT('Totals of all units')}</Text></View>
              {COLS.map((c) => c.id === 'sumForBudget'
                ? <Text key={c.id} testID={`${testID}-totals-all-budget`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{money(totals.sumForBudget)}</Text>
                : <View key={c.id} style={{ width: W.num }} />)}
            </View>
          )}
          {totals.qty.length === 0 && (
            <View testID={`${testID}-totals-none`} style={[styles.row, { height: ROW_H - 4, borderBottomWidth: 0 }]}>
              <View style={{ width: dimsWidth, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={text({ fontWeight: '800' })}>{pmT('Totals')}</Text></View>
              {COLS.map((c) => (c.id === 'sumForBudget'
                ? <Text key={c.id} testID={`${testID}-totals-none-budget`} style={[text({ fontWeight: '800' }), styles.moneyCell, { width: W.budget, borderLeftColor: colors.border }]}>{money(0)}</Text>
                : <View key={c.id} style={{ width: W.num }} />))}
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
  cell: { height: '100%', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
  moneyCell: { textAlign: 'right', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
});
