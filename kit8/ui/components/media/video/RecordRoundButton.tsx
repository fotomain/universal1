// The round red "start recording" button of the video recorders (phone + web): a circle with the record dot, no text.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

export const RECORD_BUTTON_SIZE = 52;

type Props = { onPress: () => void; color: string; disabled?: boolean; loading?: boolean; testID?: string };

export default function RecordRoundButton({ onPress, color, disabled, loading, testID }: Props) {
  const off = !!disabled || !!loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Record"
      accessibilityState={{ disabled: off }}
      aria-disabled={off || undefined}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      <View style={styles.inner}>
        {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <View testID={testID ? `${testID}-icon` : undefined} style={styles.dot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: RECORD_BUTTON_SIZE, height: RECORD_BUTTON_SIZE, borderRadius: RECORD_BUTTON_SIZE / 2, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff' },
  inner: { alignItems: 'center', justifyContent: 'center' },
});
