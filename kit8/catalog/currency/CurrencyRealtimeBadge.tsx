// "Live" / "Connecting…" / "Offline" chip: state of the Supabase Realtime channel of the catalog.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';

const LABEL = { idle: 'Offline', subscribing: 'Connecting…', subscribed: 'Live', error: 'Offline - retrying' } as const;

export default function CurrencyRealtimeBadge({ status }: { status: keyof typeof LABEL }) {
  const { themeColors: c } = useDesignSystem();
  const color = status === 'subscribed' ? '#16a34a' : status === 'error' ? c.error : c.text;
  return (
    <View style={[styles.badge, { borderColor: color }]} testID="currency-realtime" accessibilityLabel={`Auto refresh: ${LABEL[status]}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: 12, fontWeight: '600' }} testID="currency-realtime-label">
        {LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
