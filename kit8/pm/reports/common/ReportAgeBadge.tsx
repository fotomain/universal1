// ReportAgeBadge - "Live · changed 5 s ago" / "Offline: the last data" / "Auto refresh is off: a snapshot": the status of a live report (the same words as Monitor02).
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';

export interface ReportAgeBadgeProps { autoRefresh: boolean; live: boolean; changedAt: number | null; testID?: string }

export default function ReportAgeBadge({ autoRefresh, live, changedAt, testID = 'report-age' }: ReportAgeBadgeProps) {
  const { themeColors: c } = useDesignSystem();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const age = changedAt ? Math.max(0, Math.round((now - changedAt) / 1000)) : null;
  const stale = autoRefresh && !live;
  return (
    <View testID={testID} style={styles.age}>
      <View style={[styles.dot, { backgroundColor: stale ? c.error : c.primary }]} />
      <Text style={{ color: c.text, fontSize: 12 }}>
        {!autoRefresh ? pmT('Auto refresh is off: a snapshot') : stale ? pmT('Offline: the last data') : pmT('Live')}
        {age != null ? ` · ${pmT('changed {{n}} s ago', { n: age })}` : ''}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  age: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
