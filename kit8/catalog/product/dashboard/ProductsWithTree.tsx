// ProductsWithTree - the Products table with the product FOLDERS tree beside it (a tab of ProductDashboardCRUD).
//   tree    productFolderTable: create / rename / duplicate / sql_for_delete / reorder / nest folders (FolderTreeReusable)
//   table   productTable (ReusableTable, all-rows mode): picking a folder shows its products (with subfolders),
//           "Add" inside a folder creates the product in it, drag the ⠿ of a row (or of all selected rows) onto a
//           folder = the product's folder changes (rowParentGUID); drop on "No folder" = no folder
//   layout  uxuiTable.showFoldersTree + foldersTree* (position, width, splitter, heights aligned with the table rows,
//           stacked above the table on a narrow screen) - see ReusableTableUxUi
// Route: /catalog/product/dashboard?tab=productsTree
import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { EditRowModalCardProps, ReusableTableUxUi } from '../../../ui/components/table/reusable/reusableTableTypes';
import { PRODUCT_TABLES, ProductTableKey } from '../productModel';
import ProductItemEditModalCard from '../card/ProductItemEditModalCard';
import type { ProductCatalogData } from '../crud/productCatalogTools';
import type { DashboardTableConfig } from './productDashboardTables';
import { useProductFolderTree } from '../tree/useProductFolderTree';

export interface ProductsWithTreeProps {
  data: ProductCatalogData;
  /** the Products table of buildDashboardTables(): columns + row menu */
  cfg: DashboardTableConfig;
  /** every table of buildDashboardTables(): the Prices / Variants / Properties tabs of the product card reuse their columns */
  tables: Record<ProductTableKey, DashboardTableConfig>;
  onReload?: () => void;
  /** the picked folder (controlled by the dashboard, so it survives opening another table and coming back) */
  selectedFolderId?: string;
  onSelectedFolderChange?: (folderId: string) => void;
  selectRowCheckBoxForm?: 'formRound' | 'formSquare';
  /** calibration of table + tree (uxuiTable.foldersTree*) */
  uxuiTable?: ReusableTableUxUi;
}

export default function ProductsWithTree({ data, cfg, tables, onReload, selectRowCheckBoxForm, uxuiTable, selectedFolderId, onSelectedFolderChange }: ProductsWithTreeProps) {
  const { themeColors: c } = useDesignSystem();
  const { foldersTree } = useProductFolderTree(data, onReload);
  const def = PRODUCT_TABLES.product;
  // the product card of a row (right-click -> Edit). One stable component (no remount, so the open tab survives); it reads the
  // latest data / tables from a ref, and the table re-renders it on every change
  const live = useRef({ data, tables });
  live.current = { data, tables };
  const EditRowModalCard = useMemo(() => function ProductRowCard(p: EditRowModalCardProps) {
    return <ProductItemEditModalCard {...p} data={live.current.data} tables={live.current.tables} />;
  }, []);
  return (
    <View testID="products-with-tree" style={{ gap: 10 }}>
      <View style={styles.head}>
        <IconApp name="account_tree" size={22} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="products-with-tree-title" style={[styles.h2, { color: c.text }]}>Products &amp; folders</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 13 }}>
            Pick a folder to see its products · right-click a product to edit it (Main, Prices, Variants, Properties) · drag the ⠿ of a product (or of all checked products) onto a folder to move it · right-click a folder for its menu
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
        EditRowModalCard={EditRowModalCard}
        selectRowCheckBoxForm={selectRowCheckBoxForm}
        dragAndDropColumns
        resizeColumnWidth
        realtime
        foldersTree={selectedFolderId !== undefined ? { ...foldersTree, selectedFolderId, onSelectedFolderChange } : foldersTree}
        uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 270, ...uxuiTable }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  h2: { fontSize: 18, fontWeight: '800' },
});
