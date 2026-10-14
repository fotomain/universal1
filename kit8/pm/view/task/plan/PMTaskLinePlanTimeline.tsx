// PMTaskLinePlanTimeline - the "Timeline" tab of the Budgets view of a task (TabPlanTimeline, after TabPlanAll): the posted days of ALL the lines,
// one row per calendar day, oldest first: the day, a bar (the budget of the day against the biggest day), the budget, the contract sum and the
// running total of the budget. Read-only, like the table of the other tabs.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { pmT } from '../../../i18n/pmT';
import type { TaskLinePlanTimelineDay } from './taskLinePlanModel';

export interface PMTaskLinePlanTimelineProps {
  days: TaskLinePlanTimelineDay[];
  testID?: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PMTaskLinePlanTimeline({ days, testID = 'task-plan-timeline' }: PMTaskLinePlanTimelineProps) {
  const { themeColors: c } = useDesignSystem();
  if (days.length === 0) {
    return (
      <View testID={`${testID}-empty`} style={[styles.box, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={{ color: c.text }}>{pmT('Nothing posted yet. Choose a budget item on the lines and press Post (Edit).')}</Text>
      </View>
    );
  }
  const max = Math.max(...days.map((d) => Math.abs(d.sumForBudget)), 0);
  return (
    <View testID={testID} style={[styles.box, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.row}>
        <Text style={[styles.day, styles.head, { color: c.text }]}>{pmT('Period')}</Text>
        <View style={styles.barCell} />
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Sum for budget')}</Text>
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Sum for contract')}</Text>
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Sum for accounting')}</Text>
        <Text style={[styles.num, styles.head, { color: c.text }]}>{pmT('Total')}</Text>
      </View>
      {days.map((d) => (
        <View key={d.day} testID={`${testID}-day-${d.day}`} style={styles.row}>
          <Text style={[styles.day, { color: c.text }]}>{d.day}</Text>
          <View style={styles.barCell}>
            <View testID={`${testID}-bar-${d.day}`} style={{ height: 10, borderRadius: 5, backgroundColor: c.primary, width: `${max > 0 ? Math.max(2, (Math.abs(d.sumForBudget) / max) * 100) : 0}%` }} />
          </View>
          <Text style={[styles.num, { color: c.text }]}>{fmt(d.sumForBudget)}</Text>
          <Text style={[styles.num, { color: c.text }]}>{fmt(d.sumForContract)}</Text>
          <Text style={[styles.num, { color: c.text }]}>{fmt(d.sumForAccounting)}</Text>
          <Text style={[styles.num, { color: c.text }]}>{fmt(d.cumulativeBudget)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  head: { fontWeight: '700' },
  day: { width: 90, fontSize: 13 },
  barCell: { flex: 1, minWidth: 60 },
  num: { width: 100, fontSize: 13, textAlign: 'right' },
});
