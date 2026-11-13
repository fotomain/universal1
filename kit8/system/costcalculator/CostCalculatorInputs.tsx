// CostCalculatorInputs - the left side of the screen: the parameters (the owner's list), the folded "Advanced" group and the folded "Model coefficients".
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { pmT } from '../../pm/i18n/pmT';
import { COEFFICIENT_INFO } from './costCoefficients';
import { COST_FIELD_GROUPS } from './costFields';
import { NumberFieldRow, PlanFieldRow, SwitchFieldRow } from './CostFieldRow';
import type { CostCalculator } from './useCostCalculator';

export function FoldedSection({ title, open, onToggle, testID, children }: { title: string; open: boolean; onToggle: () => void; testID: string; children: React.ReactNode }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View style={styles.group}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.groupHead}>
        <Text style={[styles.groupTitle, { color: c.text }]}>{(open ? '▾ ' : '▸ ') + title}</Text>
      </Pressable>
      {open && children}
    </View>
  );
}

export default function CostCalculatorInputs({ calc }: { calc: CostCalculator }) {
  const { themeColors: c } = useDesignSystem();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const { input, setField } = calc;

  const rows = (group: (typeof COST_FIELD_GROUPS)[number]) =>
    group.fields.map((f) => {
      const id = `cost-field-${f.key}`;
      const label = pmT(f.label);
      const hint = f.hint ? pmT(f.hint) : undefined;
      if (f.kind === 'boolean') return <SwitchFieldRow key={f.key} testID={id} label={label} hint={hint} indent={f.indent} value={input[f.key] as boolean} onChange={(v) => setField(f.key, v as never)} />;
      if (f.kind === 'plan') return <PlanFieldRow key={f.key} testID={id} label={label} value={input.plan} onChange={(v) => setField('plan', v)} />;
      return <NumberFieldRow key={f.key} testID={id} label={label} hint={hint} indent={f.indent} decimal={f.kind === 'decimal'} value={input[f.key] as number} onChange={(n) => setField(f.key, n as never)} />;
    });

  const coefficientGroups = Array.from(new Set(COEFFICIENT_INFO.map((i) => i.group)));

  return (
    <View testID="cost-inputs">
      {COST_FIELD_GROUPS.map((g) =>
        g.folded ? (
          <FoldedSection key={g.id} testID={`cost-toggle-${g.id}`} title={pmT(g.title)} open={!!open[g.id]} onToggle={() => toggle(g.id)}>{rows(g)}</FoldedSection>
        ) : (
          <View key={g.id} style={styles.group}>
            <Text style={[styles.groupTitle, { color: c.text }]}>{pmT(g.title)}</Text>
            {rows(g)}
          </View>
        ),
      )}

      <FoldedSection testID="cost-toggle-coefficients" title={pmT('Model coefficients')} open={!!open.coefficients} onToggle={() => toggle('coefficients')}>
        <Text style={[styles.note, { color: c.text }]}>
          {pmT('M = measured, B = from the benches, A = assumption to calibrate on a real project, S = a rule. A changed value is remembered on this device.')}
        </Text>
        {coefficientGroups.map((group) => (
          <View key={group}>
            <Text style={[styles.subTitle, { color: c.text }]}>{pmT(group)}</Text>
            {COEFFICIENT_INFO.filter((i) => i.group === group).map((i) => (
              <NumberFieldRow key={i.key} testID={`cost-coefficient-${i.key}`} label={`${pmT(i.label)}  [${i.source}]`} unit={i.unit} decimal value={calc.coefficients[i.key]} onChange={(n) => calc.setCoefficient(i.key, n)} />
            ))}
          </View>
        ))}
        <Pressable testID="cost-coefficients-reset" accessibilityRole="button" onPress={calc.resetCoefficients} style={[styles.button, { borderColor: c.border }]}>
          <Text style={{ color: c.text }}>{pmT('Reset the coefficients')}</Text>
        </Pressable>
      </FoldedSection>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 14 },
  groupHead: { paddingVertical: 4 },
  groupTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.75, marginBottom: 4 },
  subTitle: { fontSize: 12, fontWeight: '600', marginTop: 10, opacity: 0.75 },
  note: { fontSize: 12, opacity: 0.65, marginBottom: 6 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
});
