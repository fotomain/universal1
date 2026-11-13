// CostCalculatorScreen - "System settings -> Cost calculator" (route /system/costcalculator, app/system/costcalculator.tsx).
// The administrator types how big his work is and the screen answers with the Supabase cloud bill: total, virtual machine, the numbers behind them.
// Spec: documentation/PRICE_PLAN_CALCULATOR.html. README next to this file. Only the administrator of the organization opens it (spec Q3).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { usePermissions } from '../../permissions/usePermissions';
import { pmT } from '../../pm/i18n/pmT';
import { COST_EXAMPLES } from './costModel';
import CostCalculatorInputs from './CostCalculatorInputs';
import CostCalculatorResults from './CostCalculatorResults';
import { useCostCalculator } from './useCostCalculator';

export default function CostCalculatorScreen({ testID = 'cost-calculator' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const perm = usePermissions();
  const calc = useCostCalculator();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  if (!perm.isAdmin) {
    return (
      <View testID={`${testID}-denied`} style={[styles.screen, { backgroundColor: c.background, padding: 20 }]}>
        <Text style={{ color: c.text, fontSize: 15 }}>{pmT('Only the administrator of the organization can open the cost calculator.')}</Text>
      </View>
    );
  }

  return (
    <ScrollView testID={testID} style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: c.text }]}>{pmT('Cost calculator')}</Text>
      <Text style={[styles.lead, { color: c.text }]}>{pmT('What the application costs to own per month: the Supabase cloud bill for the size of your work.')}</Text>

      <View style={styles.chips}>
        {COST_EXAMPLES.map((e) => (
          <Pressable key={e.id} testID={`cost-example-${e.id}`} accessibilityRole="button" onPress={() => calc.loadExample(e.id)} style={[styles.chip, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 13 }}>{pmT(e.title)}</Text>
          </Pressable>
        ))}
        <Pressable testID="cost-reset" accessibilityRole="button" onPress={calc.reset} style={[styles.chip, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Reset')}</Text>
        </Pressable>
      </View>

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={wide ? styles.left : undefined}><CostCalculatorInputs calc={calc} /></View>
        <View style={wide ? styles.right : { marginTop: 18 }}><CostCalculatorResults calc={calc} /></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 /* room for the main FAB under the last card */ },
  title: { fontSize: 26, fontWeight: '700' },
  lead: { fontSize: 14, opacity: 0.75, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  columns: { marginTop: 4 },
  columnsWide: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  left: { flex: 1, minWidth: 320 },
  right: { flex: 1, minWidth: 320 },
});
