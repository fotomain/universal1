// PMTaskLinePlanTotal - the "Total" tab of the Budgets view of a task (TabPlanTotal, after TabPlanTimeline): the posted plan summed per genus of the lines
// (Time, Material, Expenses) and the Total of all of them: the number of lines, of posted days, the sum for budget / contract / accounting.
// Read-only. The sums are the posted days (task_line_plan), not the lines: a line changed after posting shows its last posted sums until it is posted again.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { pmT } from '../../../i18n/pmT';
import { TASK_LINE_GENUS } from '../finances/taskLineModel';
import type { TaskLinePlanGenusTotal } from './taskLinePlanModel';

export interface PMTaskLinePlanTotalProps {
  totals: TaskLinePlanGenusTotal[];
  testID?: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const genusTitle = (g: string | null) => (g === null ? pmT('Total') : pmT(TASK_LINE_GENUS.find((x) => x.genus === g)?.title ?? g));

export default function PMTaskLinePlanTotal({ totals, testID = 'task-plan-total' }: PMTaskLinePlanTotalProps) {
  const { themeColors: c } = useDesignSystem();
  if (totals.length === 0) {
    return (
      <View testID={`${testID}-empty`} style={[styles.box, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={{ color: c.text }}>{pmT('Nothing posted yet. Choose a budget item on the lines and press Post (Edit).')}</Text>
      </View>
    );
  }
  return (
    <View testID={testID} style={[styles.box, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.row}>
        <Text style={[styles.name, styles.head, { color: c.text }]}>{pmT('Genus')}</Text>
        <Text style={[styles.cnt, styles.head, { color: c.text }]}>{pmT('Lines')}</Text>
        <Text style={[styles.cnt, styles.head, { color: c.text }]}>{pmT('days')}</Text>
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Sum for budget')}</Text>
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Sum for contract')}</Text>
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Sum for accounting')}</Text>
      </View>
      {totals.map((t) => {
        const isTotal = t.genus === null;
        const weight = isTotal ? ('700' as const) : ('400' as const);
        return (
          <View key={t.genus ?? 'total'} testID={`${testID}-${t.genus ?? 'total'}`} style={[styles.row, isTotal ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 6 } : null]}>
            <Text style={[styles.name, { color: c.text, fontWeight: weight }]}>{genusTitle(t.genus)}</Text>
            <Text style={[styles.cnt, { color: c.text, fontWeight: weight }]}>{String(t.lines)}</Text>
            <Text style={[styles.cnt, { color: c.text, fontWeight: weight }]}>{String(t.days)}</Text>
            <Text style={[styles.num, { color: c.text, fontWeight: weight }]}>{fmt(t.sumForBudget)}</Text>
            <Text style={[styles.num, { color: c.text, fontWeight: weight }]}>{fmt(t.sumForContract)}</Text>
            <Text style={[styles.num, { color: c.text, fontWeight: weight }]}>{fmt(t.sumForAccounting)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  head: { fontWeight: '700' },
  name: { flex: 1, minWidth: 90, fontSize: 13 },
  cnt: { width: 56, fontSize: 13, textAlign: 'right' },
  num: { width: 110, fontSize: 13, textAlign: 'right' },
});
