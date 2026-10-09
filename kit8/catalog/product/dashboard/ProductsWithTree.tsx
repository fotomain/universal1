// ProductsWithTree - the Products table with the product FOLDERS tree beside it (a tab of ProductDashboard).
//   tree    productFolderTable: create / rename / duplicate / delete / reorder / nest folders (FolderTreeReusable)
//   table   productTable (ReusableTable, all-rows mode): picking a folder shows its products (with subfolders),
//           "Add" inside a folder creates the product in it, drag the ⠿ of a row (or of all selected rows) onto a
//           folder = the product's folder changes (rowParentGUID); drop on "No folder" = no folder
//   layout  uxuiTable.showFoldersTree + foldersTree* (position, width, splitter, heights aligned with the table rows,
//           stacked above the table on a narrow screen) - see ReusableTableUxUi
// Route: /catalog/product/dashboard?tab=productsTree
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableUxUi } from '../../../ui/components/table/reusable/reusableTableTypes';
import { PRODUCT_TABLES } from '../productModel';
import type { ProductCatalogData } from '../crud/productCatalogTools';
import type { DashboardTableConfig } from './productDashboardTables';
import { useProductFolderTree } from '../tree/useProductFolderTree';

export interface ProductsWithTreeProps {
  data: ProductCatalogData;
  /** the Products table of buildDashboardTables(): columns + row menu */
  cfg: DashboardTableConfig;
  onReload?: () => void;
  selectRowCheckBoxForm?: 'formRound' | 'formSquare';
  /** calibration of table + tree (uxuiTable.foldersTree*) */
  uxuiTable?: ReusableTableUxUi;
}

export default function ProductsWithTree({ data, cfg, onReload, selectRowCheckBoxForm, uxuiTable }: ProductsWithTreeProps) {
  const { themeColors: c } = useDesignSystem();
  const { foldersTree } = useProductFolderTree(data, onReload);
  const def = PRODUCT_TABLES.product;
  return (
    <View testID="products-with-tree" style={{ gap: 10 }}>
      <View style={styles.head}>
        <IconApp name="account_tree" size={22} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="products-with-tree-title" style={[styles.h2, { color: c.text }]}>Products &amp; folders</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 13 }}>
            Pick a folder to see its products · drag the ⠿ of a product (or of all checked products) onto a folder to move it · right-click a folder for its menu
          </Text>
        </View>
      </View>
      <ReusableTable
        testID="products-tree-table"
        entityName={def.entity}
        crudListTitle={cfg.title}
        itemLabel={def.itemLabel}
        listOwnerGUID={REUSABLE_TABLE_ALL}
        listParentGUID={REUSABLE_TABLE_ALL}
        visualColumns={cfg.columns}
        defaultRowJSON={def.emptyRowJSON}
        extraMenuItems={cfg.extraMenuItems}
        selectRowCheckBoxForm={selectRowCheckBoxForm}
        dragAndDropColumns
        resizeColumnWidth
        realtime
        foldersTree={foldersTree}
        uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 270, ...uxuiTable }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  h2: { fontSize: 18, fontWeight: '800' },
});
