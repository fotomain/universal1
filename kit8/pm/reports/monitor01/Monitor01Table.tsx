// Monitor01Table - the table of the sheet "W1 1-MONITOR01":
//   header   row 1: [ROW DESCRIPTION] · Plan (planned, contracted, rest to contract) · Fact (delivered, actually used, on-hand)      row 2: resource role · month · task.name · unit · the six measures
//   body     Total rows (per unit) · per genus: caption, subtotals (per unit), the rows            column A names the kind of every row
//   cells    a number is a button: it opens the SOURCE TRANSACTIONS (SumExplorerListReusable); the critical cells have a background colour (monitor01Colors.ts)
// A FlatList draws only the rows in view; the rows are plain objects, so a realtime patch re-renders only the rows whose object changed.
import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pmT } from '../../i18n/pmT';
import { cellTone, toneBackground } from './monitor01Colors';
import {
  MONITOR01_MEASURES, MONITOR01_MEASURE_GROUP, MONITOR01_MEASURE_TITLE, Monitor01Item, Monitor01Measure, Monitor01Row, Monitor01Sums,
  formatMonitor01Number, monitor01GenusTitle, monitor01RowDescription, monthLabel,
} from './monitor01Model';

export interface Monitor01CellPress { measure: Monitor01Measure; item: Monitor01Item; value: number }
export interface Monitor01TableColors { text: string; border: string; surface: string; primary: string; headerBackground: string; isDark: boolean }

export interface Monitor01TableProps {
  items: Monitor01Item[];
  /** the full data set shows the project of every row */
  showProject: boolean;
  /** the column A of the sheet (row descriptions) is hidden on a narrow window */
  showDescription: boolean;
  unitTitle: (unit: string) => string;
  colors: Monitor01TableColors;
  onCell: (cell: Monitor01CellPress) => void;
  testID?: string;
}

const W = { desc: 124, project: 150, role: 190, month: 86, task: 160, unit: 72, num: 94 };
const ROW_H = 34;

/** the numbers of a row/subtotal in the shape cellTone reads */
const asTone = (s: Monitor01Sums, stale = false) => ({
  qtyPlanned: s.planned, qtyContracted: s.contracted, qtyRestToContract: s.restToContract, qtyDelivered: s.delivered, qtyUsed: s.used, qtyOnHand: s.onHand, hasStalePlan: stale,
});
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

function Monitor01TableImpl({ items, showProject, showDescription, unitTitle, colors, onCell, testID = 'monitor01-table' }: Monitor01TableProps) {
  const width = (showDescription ? W.desc : 0) + (showProject ? W.project : 0) + W.role + W.month + W.task + W.unit + W.num * MONITOR01_MEASURES.length;
  const text = (extra?: object) => [{ color: colors.text, fontSize: 13 }, extra];

  const renderItem = useCallback(({ item }: { item: Monitor01Item }) => {
    const bold = item.kind !== 'row';
    const sums = item.kind === 'row' ? sumsOfRow(item.row) : item.kind === 'group' ? null : item.sums;
    const bg = item.kind === 'row' ? undefined : item.kind === 'group' ? colors.headerBackground : colors.surface;
    const label = item.kind === 'total' ? pmT('Total') : item.kind === 'group' ? pmT(monitor01GenusTitle(item.genus)) : item.kind === 'subtotal' ? `${pmT('Subtotal')} ${pmT(monitor01GenusTitle(item.genus))}` : item.row.resourceRoleName || pmT('(no role)');
    const unit = item.kind === 'row' ? item.row.measureUnit : item.kind === 'group' ? '' : item.unit;
    return (
      <View testID={`${testID}-item-${item.key}`} style={[styles.row, { height: ROW_H, borderBottomColor: colors.border, backgroundColor: bg }]}>
        {showDescription && <Text numberOfLines={1} style={[text({ opacity: 0.6, fontSize: 11 }), { width: W.desc, paddingHorizontal: 8 }]}>{pmT(monitor01RowDescription(item))}</Text>}
        {showProject && <Text numberOfLines={1} style={[text(), { width: W.project, paddingHorizontal: 8 }]}>{item.kind === 'row' ? item.row.projectName : ''}</Text>}
        <Text numberOfLines={1} style={[text({ fontWeight: bold ? '800' : '400' }), { width: W.role, paddingHorizontal: 8 }]}>{label}</Text>
        <Text numberOfLines={1} style={[text(), { width: W.month, paddingHorizontal: 8 }]}>{item.kind === 'row' ? monthLabel(item.row.periodMonth) : ''}</Text>
        <Text numberOfLines={1} style={[text(), { width: W.task, paddingHorizontal: 8 }]}>{item.kind === 'row' ? item.row.taskName : ''}</Text>
        <Text numberOfLines={1} style={[text({ opacity: 0.8 }), { width: W.unit, paddingHorizontal: 8 }]}>{unit ? unitTitle(unit) : ''}</Text>
        {sums
          ? MONITOR01_MEASURES.map((m) => (
              <Cell key={m} measure={m} sums={sums} stale={item.kind === 'row' && item.row.hasStalePlan} bold={bold} item={item} colors={colors} testID={`${testID}-cell-${item.key}-${m}`} onCell={onCell} />
            ))
          : <View style={{ width: W.num * MONITOR01_MEASURES.length }} />}
      </View>
    );
  }, [colors, onCell, showDescription, showProject, testID, unitTitle]);

  const headBg = colors.headerBackground;
  return (
    <ScrollView horizontal testID={testID} showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: width }}>
      <View style={{ width, flex: 1 }}>
        {/* header row 1: the groups */}
        <View style={[styles.row, { height: 28, backgroundColor: headBg, borderBottomColor: colors.border }]}>
          {showDescription && <Text style={[text({ fontWeight: '700', fontSize: 11 }), { width: W.desc, paddingHorizontal: 8 }]}>{pmT('requirements dimensions')}</Text>}
          <View style={{ width: (showProject ? W.project : 0) + W.role + W.month + W.task + W.unit }} />
          {(['Plan', 'Fact'] as const).map((g) => (
            <View key={g} testID={`${testID}-group-${g}`} style={{ width: W.num * MONITOR01_MEASURES.filter((m) => MONITOR01_MEASURE_GROUP[m] === g).length, alignItems: 'center' }}>
              <Text style={text({ fontWeight: '800' })}>{pmT(g)}</Text>
            </View>
          ))}
        </View>
        {/* header row 2: the columns */}
        <View style={[styles.row, { height: 30, backgroundColor: headBg, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          {showDescription && <Text style={[text({ fontWeight: '700', fontSize: 11 }), { width: W.desc, paddingHorizontal: 8 }]}>{pmT('ROW DESCRIPTION')}</Text>}
          {showProject && <Text style={[text({ fontWeight: '700' }), { width: W.project, paddingHorizontal: 8 }]}>{pmT('project')}</Text>}
          <Text style={[text({ fontWeight: '700' }), { width: W.role, paddingHorizontal: 8 }]}>{pmT('resource role')}</Text>
          <Text style={[text({ fontWeight: '700' }), { width: W.month, paddingHorizontal: 8 }]}>{pmT('month')}</Text>
          <Text style={[text({ fontWeight: '700' }), { width: W.task, paddingHorizontal: 8 }]}>{pmT('task.name')}</Text>
          <Text style={[text({ fontWeight: '700' }), { width: W.unit, paddingHorizontal: 8 }]}>{pmT('unit')}</Text>
          {MONITOR01_MEASURES.map((m) => (
            <Text key={m} testID={`${testID}-head-${m}`} style={[text({ fontWeight: '700' }), { width: W.num, paddingHorizontal: 8, textAlign: 'right' }]}>{pmT(MONITOR01_MEASURE_TITLE[m])}</Text>
          ))}
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
      </View>
    </ScrollView>
  );
}

export default memo(Monitor01TableImpl);
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { height: '100%', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
});
