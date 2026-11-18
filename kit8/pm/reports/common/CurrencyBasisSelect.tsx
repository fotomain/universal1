// CurrencyBasisSelect - "Currency: Consolidation | Project" (RadioSetApp, horizontal, compact; in the toolbar of a report that adds projects). The choice is the one of useCurrencyBasis.
// With the consolidation basis the VAT basis selector of the report is replaced by the two switches of the organization (Organization edit -> Consolidation): the report says so.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RadioSetApp from '../../../ui/components/RadioSetApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import { CURRENCY_BASES, CURRENCY_BASIS_SHORT, type CurrencyBasis } from './useCurrencyBasis';

export default function CurrencyBasisSelect({ value, onChange, testID = 'currency-basis' }: { value: CurrencyBasis; onChange: (b: CurrencyBasis) => void; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Currency')}</Text>
      <RadioSetApp<CurrencyBasis> testID={`${testID}-radio`} horizontal compact value={value} onChange={onChange} options={CURRENCY_BASES.map((b) => ({ id: b, label: pmT(CURRENCY_BASIS_SHORT[b]) }))} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 } });
