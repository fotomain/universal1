// Shown instead of the Gantt bar while tap-to-link mode is active.

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttLinkModeHint({ sourceName, palette, onCancel }: { sourceName: string; palette: PMPalette; onCancel: () => void }) {
  return (
    <>
      <Text numberOfLines={1} style={[styles.hint, { color: palette.primary }]}>
        Tap the task that must wait for “{sourceName}”
      </Text>
      <PMIconButton testID="pm-gantt-link-cancel" icon="close" label={pmT('Cancel')} color={palette.text} onPress={onCancel} />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { flex: 1, fontSize: 13, fontWeight: '600', marginHorizontal: 8 },
});
