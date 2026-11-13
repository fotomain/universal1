// CostFieldRow - the rows of the parameter lists: a number (typed, with the arrows), a switch, the plan choice. A number keeps what is being typed; it is handed to the model
// only when it is a number >= 0, and the typed text is replaced by the model's value only when the two differ (a percent over 100 comes back as 100).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import NumberInputApp from '../../ui/components/common/NumberInputApp';
import { pmT } from '../../pm/i18n/pmT';
import type { SupabasePlan } from './costModel';

interface RowFrameProps { label: string; hint?: string; indent?: boolean; right: React.ReactNode; testID: string }

function RowFrame({ label, hint, indent, right, testID }: RowFrameProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={[styles.row, indent && styles.indent]}>
      <View style={styles.labelBox}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {!!hint && <Text style={[styles.hint, { color: c.text }]}>{hint}</Text>}
      </View>
      <View style={styles.controlBox}>{right}</View>
    </View>
  );
}

export function NumberFieldRow({ label, hint, indent, value, onChange, decimal, unit, testID }: { label: string; hint?: string; indent?: boolean; value: number; onChange: (n: number) => void; decimal?: boolean; unit?: string; testID: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    const n = parseFloat(text);
    if (text !== '' && n !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const typed = (t: string) => {
    setText(t);
    const n = parseFloat(t);
    if (!isNaN(n) && n >= 0) onChange(n);
  };
  return (
    <RowFrame
      testID={`${testID}-row`}
      label={label}
      hint={hint}
      indent={indent}
      right={<NumberInputApp testID={testID} compact min={0} value={text} onChangeText={typed} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} helperText={unit} style={{ width: 150 }} />}
    />
  );
}

export function SwitchFieldRow({ label, hint, indent, value, onChange, testID }: { label: string; hint?: string; indent?: boolean; value: boolean; onChange: (v: boolean) => void; testID: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <RowFrame
      testID={`${testID}-row`}
      label={label}
      hint={hint}
      indent={indent}
      right={
        <Pressable testID={testID} accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={[styles.track, { backgroundColor: value ? c.primary : c.border }]}>
          <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
        </Pressable>
      }
    />
  );
}

export function PlanFieldRow({ label, value, onChange, testID }: { label: string; value: SupabasePlan; onChange: (v: SupabasePlan) => void; testID: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <RowFrame
      testID={`${testID}-row`}
      label={label}
      right={
        <View style={styles.plans}>
          {(['pro', 'team'] as const).map((p) => (
            <Pressable key={p} testID={`${testID}-${p}`} accessibilityRole="button" accessibilityState={{ selected: value === p }} onPress={() => onChange(p)}
              style={[styles.planChip, { borderColor: value === p ? c.primary : c.border, backgroundColor: value === p ? c.primary : 'transparent' }]}>
              <Text style={{ color: value === p ? '#ffffff' : c.text, fontWeight: '600' }}>{p === 'pro' ? pmT('Pro') : pmT('Team')}</Text>
            </Pressable>
          ))}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  indent: { paddingLeft: 18 },
  labelBox: { flex: 1, minWidth: 0 },
  controlBox: { alignItems: 'flex-end' },
  label: { fontSize: 14 },
  hint: { fontSize: 11.5, opacity: 0.6, marginTop: 1 },
  track: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 3 },
  thumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff' },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
  plans: { flexDirection: 'row', gap: 8 },
  planChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
});
