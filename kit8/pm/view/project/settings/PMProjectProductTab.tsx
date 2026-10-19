// PMProjectProductTab - "Product" tab of the Project settings window (TabProduct, after TabCustomer; also a tab of Organization edit -> Projects -> Settings): the optional fields of a Product
// (kit8/catalog/product/productFieldsModel.ts). project_table.rowJSON, ALL FALSE while never saved:
//   itemNumberFunctionalityEnabled                  the Product has the field ItemNumber: column of the Product list (CRUD, sort, filter), field of the card, found by the search
//   itemNumberFunctionalityVisibleInProjects        ... and the product windows of the project show it too (needs the switch above)
//   searchNameFunctionalityEnabled / ...VisibleInProjects   the same for the field SearchName
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { productValuesOf, type ProductFieldValues } from '../../../../catalog/product/productFieldsModel';
import { pmT } from '../../../i18n/pmT';

export type PMProjectProductValues = ProductFieldValues;
export { productValuesOf };

export default function PMProjectProductTab({ values, onChange }: { values: PMProjectProductValues; onChange: (patch: PMProjectProductValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = productValuesOf(values);
  return (
    <View testID="pm-project-tab-product-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Item number')}</Text>
      <SwitchApp
        testID="pm-project-item-number-enabled"
        label={pmT('Item number functionality (itemNumberFunctionalityEnabled)')}
        value={v.itemNumberFunctionalityEnabled}
        onValueChange={(on) => onChange({ itemNumberFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <SwitchApp
        testID="pm-project-item-number-visible"
        label={pmT('Visible in projects (itemNumberFunctionalityVisibleInProjects)')}
        value={v.itemNumberFunctionalityVisibleInProjects}
        disabled={!v.itemNumberFunctionalityEnabled}
        onValueChange={(on) => onChange({ itemNumberFunctionalityVisibleInProjects: on })}
        style={[styles.switchRow, styles.sub]}
      />
      <Text style={styles.hint}>{pmT('On: a product has an Item number (Product list: edit, sort, filter; the product search finds it). Visible in projects: the windows that choose a product in the project show it.')}</Text>

      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Search name')}</Text>
      <SwitchApp
        testID="pm-project-search-name-enabled"
        label={pmT('Search name functionality (searchNameFunctionalityEnabled)')}
        value={v.searchNameFunctionalityEnabled}
        onValueChange={(on) => onChange({ searchNameFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <SwitchApp
        testID="pm-project-search-name-visible"
        label={pmT('Visible in projects (searchNameFunctionalityVisibleInProjects)')}
        value={v.searchNameFunctionalityVisibleInProjects}
        disabled={!v.searchNameFunctionalityEnabled}
        onValueChange={(on) => onChange({ searchNameFunctionalityVisibleInProjects: on })}
        style={[styles.switchRow, styles.sub]}
      />
      <Text style={styles.hint}>{pmT('On: a product has a Search name, a name only for finding it (Product list: edit, sort, filter; the product search finds it). Visible in projects: the windows that choose a product in the project show it.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  sub: { marginLeft: 24 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
