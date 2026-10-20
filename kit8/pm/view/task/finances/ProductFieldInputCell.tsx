// ProductFieldInputCell - the cells Item number / Search name of a Material / Expense / Revenue line: the field of the product chosen on the line, and an INPUT for a fast choice:
// type (a part of) the number or the name, Enter / leaving the cell = the line gets that product (findProductByField: exactly one product must match). Not found / several: a red
// border and the reason as a tip, the line stays as it was. An empty text changes nothing (the product is cleared with the x of the Product column).
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import type { DefRow } from '../../../../catalog/product/productModel';
import { findProductByField } from '../../../../catalog/product/productFieldsModel';
import { PMTipIcon } from '../../../inner/buttons';
import { pmT } from '../../../i18n/pmT';

export interface ProductFieldInputCellProps {
  testID: string;
  field: 'itemNumber' | 'searchName';
  /** the field of the product now on the line ('' = none) */
  shown: string;
  products: DefRow<any>[];
  /** the product found: its rowGUID */
  onPick: (productGUID: string) => void;
  placeholder?: string;
}

export default function ProductFieldInputCell({ testID, field, shown, products, onPick, placeholder }: ProductFieldInputCellProps) {
  const { themeColors: c } = useDesignSystem();
  const [draft, setDraft] = useState(shown);
  const [problem, setProblem] = useState<string | null>(null);
  // the line got another product (picker, other column): show its field again
  useEffect(() => { setDraft(shown); setProblem(null); }, [shown]);
  const commit = () => {
    const typed = draft.trim();
    if (typed === shown.trim()) { setProblem(null); return; }
    if (!typed) { setDraft(shown); setProblem(null); return; }
    const found = findProductByField(products, field, typed);
    if ('product' in found) { setProblem(null); onPick(found.product.rowGUID); return; }
    setProblem(found.error === 'many' ? pmT('{{count}} products match - type more', { count: found.count }) : pmT('No product with this text'));
  };
  return (
    <View style={styles.wrap}>
      <TextInput
        testID={testID} value={draft} onChangeText={(t) => { setDraft(t); setProblem(null); }} onBlur={commit} onSubmitEditing={commit}
        placeholder={placeholder ?? pmT('Type to find a product')} placeholderTextColor={c.text + '50'} autoCapitalize="none" autoCorrect={false}
        style={[styles.input, { color: c.text }, problem ? { borderColor: c.error, borderWidth: 1 } : null]}
      />
      {problem ? <PMTipIcon tip={problem} testID={`${testID}-problem`} name="warning" size={16} color={c.error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flex: 1, minWidth: 0, height: 32, paddingHorizontal: 6, fontSize: 13, borderRadius: 4, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
});
