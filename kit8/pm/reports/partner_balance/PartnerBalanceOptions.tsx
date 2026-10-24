// PartnerBalanceOptions - the second bar of Monitor07: the flags showSumForContract / showSumForAccounting / showSumForBudget, "Hide settled", and the sort (by partner name | Budget sum End |
// Contract finish date, ascending / descending). The choices are remembered per user and per report by the dashboard (useStoredChoice).
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import { pmT } from '../../i18n/pmT';
import { DEFAULT_SORT, ReportFlags, ReportSort, SORT_OPTIONS, SUM_KINDS, SortBy, defaultDirOf, setFlag } from './partnerBalanceModel';

export interface PartnerBalanceOptionsProps {
  flags: ReportFlags;
  onFlagsChange: (next: ReportFlags) => void;
  sort: ReportSort;
  onSortChange: (next: ReportSort) => void;
  testID?: string;
}

export default function PartnerBalanceOptions({ flags, onFlagsChange, sort, onSortChange, testID = 'partner-balance-options' }: PartnerBalanceOptionsProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
      {SUM_KINDS.map((k) => (
        <View key={k.flag} style={styles.sw}>
          <Text style={{ color: c.text, fontSize: 12 }}>{pmT(k.flag)}</Text>
          <SwitchApp testID={`${testID}-${k.flag}`} value={flags[k.flag]} onValueChange={(on: boolean) => onFlagsChange(setFlag(flags, k.flag, on))} />
        </View>
      ))}
      <View style={styles.sw}>
        <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Hide settled')}</Text>
        <SwitchApp testID={`${testID}-hideSettled`} value={flags.hideSettled} onValueChange={(on: boolean) => onFlagsChange(setFlag(flags, 'hideSettled', on))} />
      </View>
      <View style={styles.sw}>
        <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Sort by')}</Text>
        <SegmentButtonsApp<SortBy> testID={`${testID}-sortBy`} compact value={sort.sortBy} onValueChange={(by) => onSortChange({ sortBy: by, sortDir: by === sort.sortBy ? sort.sortDir : defaultDirOf(by) })}
          buttons={SORT_OPTIONS.map((o) => ({ value: o.value, label: pmT(o.label), testID: `${testID}-sort-${o.value}` }))} />
        <ButtonApp testID={`${testID}-sortDir`} variant="text" size="small" icon={sort.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'} title={sort.sortDir === 'asc' ? pmT('Ascending') : pmT('Descending')}
          onPress={() => onSortChange({ ...(sort ?? DEFAULT_SORT), sortDir: sort.sortDir === 'asc' ? 'desc' : 'asc' })} />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  sw: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
