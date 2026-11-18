// Monitor08Table - the table of Monitor08 Consolidation: a line per project (and month), the six columns of MONITOR08_COLUMNS, the footer. Plain Views (a handful of lines), a horizontal scroll
// on a narrow window. The footer is the sum of the lines - or the words "not added" when the lines are in different currencies (project currency basis).
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { pmT } from '../../i18n/pmT';
import { formatReportMoney } from '../common/reportFormat';
import { MONITOR08_COLUMNS, type Monitor08Footer, type Monitor08Line } from './monitor08Model';

export interface Monitor08TableColors { text: string; border: string; surface: string; primary: string; headerBackground: string }
const NAME_WIDTH = 190;
const MONTH_WIDTH = 90;
const CELL_WIDTH = 120;

export default function Monitor08Table({ lines, footer, colors, byMonth, testID = 'monitor08-table' }: { lines: Monitor08Line[]; footer: Monitor08Footer; colors: Monitor08TableColors; byMonth: boolean; testID?: string }) {
  const cell = (text: string, width: number, extra?: object) => <Text style={[styles.cell, { width, color: colors.text }, extra]} numberOfLines={1}>{text}</Text>;
  return (
    <ScrollView horizontal testID={testID} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ minWidth: '100%' }}>
        <View style={[styles.row, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
          {cell(pmT('Project'), NAME_WIDTH, styles.head)}
          {byMonth && cell(pmT('Month'), MONTH_WIDTH, styles.head)}
          {cell(pmT('Currency'), 70, styles.head)}
          {MONITOR08_COLUMNS.map((c) => <React.Fragment key={c.id}>{cell(pmT(c.title), CELL_WIDTH, [styles.head, styles.num])}</React.Fragment>)}
        </View>
        <ScrollView>
          {lines.map((l) => (
            <View key={l.key} testID={`${testID}-row-${l.projectGUID}`} style={[styles.row, { borderBottomColor: colors.border }]}>
              {cell(l.projectName, NAME_WIDTH)}
              {byMonth && cell((l.month || '').slice(0, 7), MONTH_WIDTH)}
              {cell(l.currency, 70)}
              {MONITOR08_COLUMNS.map((c) => <React.Fragment key={c.id}>{cell(formatReportMoney(l.amounts[c.id]), CELL_WIDTH, styles.num)}</React.Fragment>)}
            </View>
          ))}
          {lines.length === 0 && <Text testID={`${testID}-empty`} style={{ color: colors.text, opacity: 0.6, padding: 12 }}>{pmT('No movements in the period.')}</Text>}
        </ScrollView>
        <View testID={`${testID}-footer`} style={[styles.row, { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          {cell(pmT('Total'), NAME_WIDTH, styles.head)}
          {byMonth && cell('', MONTH_WIDTH)}
          {cell(footer.currency ?? '', 70, styles.head)}
          {footer.amounts
            ? MONITOR08_COLUMNS.map((c) => <React.Fragment key={c.id}>{cell(formatReportMoney(footer.amounts![c.id]), CELL_WIDTH, [styles.head, styles.num])}</React.Fragment>)
            : <Text testID={`${testID}-mixed`} style={[styles.cell, { color: colors.text, flex: 1, minWidth: CELL_WIDTH * 3 }]}>{pmT('Not added: the projects are in different currencies ({{list}}). Use the consolidation currency.', { list: footer.mixed.join(', ') })}</Text>}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 },
  head: { fontWeight: '700' },
  num: { textAlign: 'right' },
});
