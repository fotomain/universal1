// PMGanttVersionsLegend - floating legend of the Gantt chart while versions are compared:
//   ▬ Project (now)   ▬ Baseline   ▬ Before restore …      (color + version title, ✕ = stop comparing that version)

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../../../components/common/IconApp';
import { PMPalette } from '../../../view/theme';
import { usePMVersionStore } from '../../store/store_version';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttVersionsLegend({ palette, onRemove }: { palette: PMPalette; onRemove?: (versionGUID: string) => void }) {
  const overlays = usePMVersionStore((s) => s.overlays);
  if (!overlays.length) return null;
  return (
    <View style={[styles.wrap, { pointerEvents: 'box-none' }]}>
      <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.border }]} testID="pm-gantt-versions-legend">
        <View style={styles.item}>
          <View style={[styles.swatchTask, { backgroundColor: palette.bar }]} />
          <Text style={[styles.text, { color: palette.text }]} numberOfLines={1}>
            {pmT('Project (now)')}
          </Text>
        </View>
        {overlays.map((o) => (
          <View key={o.versionGUID} style={styles.item} testID={`pm-gantt-versions-legend-${o.versionGUID}`}>
            <View style={[styles.swatch, { backgroundColor: o.color }]} />
            <Text style={[styles.text, { color: palette.text }]} numberOfLines={1}>
              {o.title}
            </Text>
            {onRemove && (
              <Pressable testID={`pm-gantt-versions-legend-remove-${o.versionGUID}`} onPress={() => onRemove(o.versionGUID)} hitSlop={6} accessibilityLabel={`Stop comparing ${o.title}`} style={styles.remove}>
                <IconApp name="close" size={12} color={palette.textMuted} />
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 14, bottom: 14, left: 14, alignItems: 'flex-end' },
  box: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%', opacity: 0.96 },
  item: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginVertical: 2, maxWidth: 220 },
  swatchTask: { width: 18, height: 10, borderRadius: 3, marginRight: 6 },
  swatch: { width: 18, height: 4, borderRadius: 2, marginRight: 6 },
  text: { fontSize: 12, flexShrink: 1 },
  remove: { marginLeft: 4, padding: 2 },
});
