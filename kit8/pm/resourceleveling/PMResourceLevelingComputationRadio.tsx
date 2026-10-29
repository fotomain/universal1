// PMResourceLevelingComputationRadio - the radio set "Where is a run calculated?" (resourceLevelingComputationSide) of the section "Resource optimization".
// Both variants are always shown side by side with their pluses and minuses, so the user compares them before choosing; the chosen one is marked. Shown only while the master
// switch resourceLevelingFunctionalityEnabled is on (the tab decides). The texts are in resourceLevelingComputation.ts.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { pmT } from '../i18n/pmT';
import { withAlpha } from '../view/theme';
import { COMPUTATION_ICON, computationInfos } from './resourceLevelingComputation';
import type { ResourceLevelingComputation } from './resourceLevelingSettings';

const PLUS_COLOR = '#16A34A';
const MINUS_COLOR = '#DC2626';

export interface PMResourceLevelingComputationRadioProps {
  value: ResourceLevelingComputation;
  onChange: (next: ResourceLevelingComputation) => void;
  disabled?: boolean;
  testID?: string;
}

export default function PMResourceLevelingComputationRadio({ value, onChange, disabled = false, testID = 'pm-resource-leveling-computation' }: PMResourceLevelingComputationRadioProps) {
  const { themeColors: c } = useDesignSystem();
  const title = pmT('Where is a run calculated? (resourceLevelingComputationSide)');
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.set}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <View style={styles.cards}>
        {computationInfos().map((info) => {
          const selected = info.value === value;
          return (
            <Pressable
              key={info.value}
              testID={`${testID}-${info.value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              aria-checked={selected}
              accessibilityLabel={`${info.title}. ${info.summary}`}
              disabled={disabled}
              onPress={() => onChange(info.value)}
              style={({ pressed }) => [styles.card, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? withAlpha(c.primary, 0.08) : 'transparent', opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
            >
              <View style={styles.head}>
                <IconApp name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={selected ? c.primary : c.text} />
                <IconApp name={COMPUTATION_ICON[info.value]} size={20} color={selected ? c.primary : c.text} />
                <Text testID={`${testID}-${info.value}-title`} style={{ color: selected ? c.primary : c.text, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>{info.title}</Text>
              </View>
              <Text style={[styles.summary, { color: c.text }]}>{info.summary}</Text>

              <Text style={[styles.group, { color: PLUS_COLOR }]}>{pmT('Pluses')}</Text>
              {info.plus.map((t, i) => (
                <View key={`p${i}`} testID={`${testID}-${info.value}-plus-${i}`} style={styles.item}>
                  <Text accessibilityElementsHidden style={[styles.mark, { color: PLUS_COLOR }]}>+</Text>
                  <Text style={[styles.itemText, { color: c.text }]}>{t}</Text>
                </View>
              ))}
              <Text style={[styles.group, { color: MINUS_COLOR }]}>{pmT('Minuses')}</Text>
              {info.minus.map((t, i) => (
                <View key={`m${i}`} testID={`${testID}-${info.value}-minus-${i}`} style={styles.item}>
                  <Text accessibilityElementsHidden style={[styles.mark, { color: MINUS_COLOR }]}>−</Text>
                  <Text style={[styles.itemText, { color: c.text }]}>{t}</Text>
                </View>
              ))}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  set: { marginTop: 10, marginBottom: 6 },
  title: { fontWeight: '600', marginBottom: 6 },
  // two cards side by side on a wide window, one under the other on a narrow one
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: 280, minWidth: 260, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  summary: { fontSize: 12.5, opacity: 0.8, marginBottom: 6 },
  group: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  item: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  mark: { width: 14, textAlign: 'center', fontWeight: '800', fontSize: 15, lineHeight: 18 },
  itemText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
});
