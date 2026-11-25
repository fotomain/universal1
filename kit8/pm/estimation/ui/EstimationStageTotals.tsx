// EstimationStageTotals - what the right pane shows instead of the estimate when a STAGE (a row that is no task) is picked in the task tree: the totals of the tasks below it.
// One line per row below the stage in tree order (a task = the total of its estimate, a sub stage = the sum of its tasks), then the total of the stage. Read only.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import { BASIS_TO_SUM_KEY, type EstimationCurrencyBasis } from '../model/estimationModel';
import type { StageTotalRow, StageTotals } from '../model/estimationTaskModel';

const fmt = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM_W = 104;

export interface EstimationStageTotalsProps {
  totals: StageTotals;
  basis: EstimationCurrencyBasis;
  /** code of the currency of the shown basis */
  currency: string;
  /** a name for a row that has none */
  emptyTitle?: string;
}

export default function EstimationStageTotals({ totals, basis, currency, emptyTitle }: EstimationStageTotalsProps) {
  const { themeColors: c } = useDesignSystem();
  const sumKey = BASIS_TO_SUM_KEY[basis];
  const cells = (r: StageTotalRow, bold?: boolean) => {
    const st = { color: c.text, width: NUM_W, textAlign: 'right' as const, fontSize: 13, fontWeight: bold ? ('700' as const) : ('400' as const) };
    return (
      <>
        <Text style={[st, { width: 64 }]}>{r.positions}</Text>
        <Text style={st}>{fmt(r.cost.direct)}</Text>
        <Text style={st}>{fmt(r.cost.overheads)}</Text>
        <Text style={st}>{fmt(r.cost.profit)}</Text>
        <Text style={st}>{fmt(r.cost.base)}</Text>
        <Text style={st}>{fmt(r.cost.current)}</Text>
        <Text style={[st, { color: c.primary, fontWeight: '700' }]}>{fmt(r.sums[sumKey])}</Text>
      </>
    );
  };
  const head = { color: c.text, opacity: 0.7, width: NUM_W, textAlign: 'right' as const, fontSize: 12, fontWeight: '700' as const };
  return (
    <View testID="estimation-stage-totals" style={{ flex: 1 }}>
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingBottom: 6 }}>{pmT('A stage carries no estimate: these are the totals of the tasks below it.')}</Text>
      <ScrollView horizontal>
        <View>
          <View style={[styles.row, { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
            <Text style={[head, { width: 280, textAlign: 'left' }]}>{pmT('Task')}</Text>
            <Text style={[head, { width: 64 }]}>{pmT('Positions')}</Text>
            <Text style={head}>{pmT('Direct costs')}</Text>
            <Text style={head}>{pmT('Overheads')}</Text>
            <Text style={head}>{pmT('Profit')}</Text>
            <Text style={head}>{pmT('Total, base prices')}</Text>
            <Text style={head}>{pmT('Total, current prices')}</Text>
            <Text style={head}>{currency || pmT('In the view currency')}</Text>
          </View>
          <ScrollView style={{ flexGrow: 0 }}>
            {totals.rows.map((r) => (
              <View key={r.guid} testID={`estimation-stage-row-${r.guid}`} style={[styles.row, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text numberOfLines={1} style={{ color: c.text, width: 280, fontSize: 13, paddingLeft: r.depth * 16, fontWeight: r.kind === 'task' ? '400' : '700' }}>{r.title || emptyTitle || '-'}</Text>
                {cells(r)}
              </View>
            ))}
          </ScrollView>
          <View testID="estimation-stage-total" style={[styles.row, { borderTopColor: c.border, borderTopWidth: 1, backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, width: 280, fontSize: 13, fontWeight: '800' }}>{pmT('Total')}</Text>
            {cells(totals.total, true)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 6 },
});
