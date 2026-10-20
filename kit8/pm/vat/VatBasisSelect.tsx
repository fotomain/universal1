// VatBasisSelect - "VAT: Cost | Net | With VAT" (RadioSetApp, horizontal, compact; it stands in the toolbar of a report). EVERY report that shows money offers it
// (documentation/VENDOR_INVOICE_DOC.html section 14); the choice is the one of useVatBasis, so all the reports follow it. The default is Cost.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RadioSetApp from '../../ui/components/RadioSetApp';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { pmT } from '../i18n/pmT';
import { VAT_BASES, VAT_BASIS_SHORT, VatBasis } from './vatBasis';

export default function VatBasisSelect({ value, onChange, testID = 'vat-basis' }: { value: VatBasis; onChange: (b: VatBasis) => void; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={{ color: c.text, fontSize: 12 }}>{pmT('VAT')}</Text>
      <RadioSetApp<VatBasis> testID={`${testID}-radio`} horizontal compact value={value} onChange={onChange} options={VAT_BASES.map((b) => ({ id: b, label: pmT(VAT_BASIS_SHORT[b]) }))} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 } });
