// Monitor01Toolbar - right after "Monitor01  Roles requirements" in the bar of the report:
//   Refresh button    reads the data again from the database (and, while auto refresh is off, shows it)
//   Auto refresh      a switch (on by default): ON = the numbers follow the realtime events of monitor01_view (every filter keeps working: the filters cut the rows in memory);
//                     OFF = the table stays as it is (a snapshot) until Refresh is pressed
//   Expand all / Collapse all   the tree Project → Resource role → Month → Task name: open every node / close every node (the Project lines with their subtotals stay)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import { pmT } from '../../i18n/pmT';

export interface Monitor01ToolbarProps {
  autoRefresh: boolean;
  onAutoRefreshChange: (on: boolean) => void;
  onRefresh: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  /** a refresh is running */
  busy?: boolean;
  testID?: string;
}

export default function Monitor01Toolbar({ autoRefresh, onAutoRefreshChange, onRefresh, onExpandAll, onCollapseAll, busy = false, testID = 'monitor01-toolbar' }: Monitor01ToolbarProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={styles.row}>
      <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh')} icon="refresh" variant="text" size="small" loading={busy} onPress={onRefresh} />
      <View style={styles.auto}>
        <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Auto refresh')}</Text>
        <SwitchApp testID={`${testID}-auto`} value={autoRefresh} onValueChange={onAutoRefreshChange} />
      </View>
      {!!onExpandAll && <ButtonApp testID={`${testID}-expand`} title={pmT('Expand all')} icon="unfold_more" variant="text" size="small" onPress={onExpandAll} />}
      {!!onCollapseAll && <ButtonApp testID={`${testID}-collapse`} title={pmT('Collapse all')} icon="unfold_less" variant="text" size="small" onPress={onCollapseAll} />}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 12 },
  auto: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
