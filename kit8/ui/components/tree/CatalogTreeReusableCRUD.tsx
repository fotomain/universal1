// CatalogTreeReusableCRUD - the screen of a catalog that is ONE tree in ONE table (any depth): every row is a node. The tree (FolderTreeReusable, ALL rows as
// nodes) stands beside a ReusableTable of the rows of the picked node and of everything below it ("All" = every row); a new row goes UNDER the picked node
// ("All" / no node = a root). The caller gives the table def, the rows and its extra columns (e.g. the CFR of a business unit); this component does the rest:
// header (title, counts, lock, reload), the "setup" hint, the tree CRUD binding (useCatalogTree), the table.
//   <CatalogTreeReusableCRUD def={BUSINESS_UNIT_TABLE} data={useBusinessUnitData()} nodes={...} columns={...} title="Business units" testID="business-unit" />
// Differs from the two-level catalogs (PMBudgetItemCRUD: folders = tree, items = table rows): here a node IS a row, so the tree shows every row.
// `noCrud` (default FALSE): true = read-only - no add / duplicate / delete / reorder, no row menu, no check boxes, cells not editable, tree without CRUD and drag.
// The lock button in the header turns editing on / off.
// The picker of the same tree (a modal, `selectFromTree`): CatalogTreePicker.tsx.
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../common/IconApp';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../table/reusable/reusableTableTypes';
import type { VisualColumn } from '../table/reusable/reusableTableTypes';
import type { DefRow, ProductTableDef } from '../../../catalog/product/productModel';
import { TREE_ALL_ID } from './folderTreeModel';
import type { FolderTreeNode } from './folderTreeModel';
import { useCatalogTree } from './useCatalogTree';

export interface CatalogTreeReusableCRUDProps {
  def: ProductTableDef;
  /** the rows from redux (read + realtime) and the state of the read */
  data: { rows: DefRow<any>[]; loaded: boolean; error: string; reload: () => void };
  /** every row as a tree node */
  nodes: FolderTreeNode[];
  /** the columns of the table: `noCrud` is true when the table is read-only (the component also makes every cell non-editable then) */
  columns: (ctx: { rows: DefRow<any>[]; noCrud: boolean }) => VisualColumn[];
  title: string;
  icon?: string;
  testID: string;
  /** the label of the "All" row of the tree */
  allLabel?: string;
  /** rowJSON key of the node title (default 'title') */
  titleField?: string;
  /** rowJSON of a new row besides what the def gives and the title */
  newRowJSON?: () => Record<string, any>;
  /** what to do when the table is empty / unreadable (the SQL to run) */
  setupHint?: string;
  /** extra banners under the header (warnings of the screen) */
  banners?: React.ReactNode;
  /** false (default): full CRUD, true: read-only catalog */
  noCrud?: boolean;
  deleteHint?: string;
}

export default function CatalogTreeReusableCRUD({
  def, data, nodes, columns, title, icon = 'account_tree', testID, allLabel, titleField = 'title', newRowJSON, setupHint, banners, noCrud: noCrudProp = false, deleteHint,
}: CatalogTreeReusableCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const [noCrud, setNoCrud] = useState(noCrudProp);
  const [node, setNode] = useState<string>(TREE_ALL_ID);
  const { rows, loaded, error, reload } = data;
  const { foldersTree } = useCatalogTree(!noCrud, { def, nodes, rows, title, allLabel: allLabel ?? `All ${title.toLowerCase()}`, titleField, newRowJSON, deleteHint, onRefresh: reload });
  const roots = useMemo(() => rows.filter((r) => !r.rowParentGUID || r.rowParentGUID === 'empty').length, [rows]);

  // a new row goes under the picked node (a root when nothing / "All" is picked)
  const newRowDefaults = useMemo(() => () => {
    const parent = rows.some((r) => r.rowGUID === node) ? node : 'empty';
    return { rowOwnerGUID: def.catalogOwner as string, rowParentGUID: parent, rowJSON: newRowJSON ? newRowJSON() : {} };
  }, [def.catalogOwner, rows, node, newRowJSON]);

  const visualColumns = useMemo<VisualColumn[]>(() => {
    const cols = columns({ rows, noCrud });
    return noCrud ? cols.map((col) => ({ ...col, editable: false })) : cols;
  }, [columns, rows, noCrud]);

  return (
    <View testID={`${testID}-dashboard`} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name={icon} size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>{title}</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {def.purpose} · {rows.length} {rows.length === 1 ? 'row' : 'rows'} · {roots} top level · {noCrud ? 'read-only' : 'editing is on'}
          </Text>
        </View>
        <PMIconButton tipScope="app" testID={`${testID}-edit-toggle`} icon={noCrud ? 'lock' : 'lock_open'} title={noCrud ? 'Read-only: press to allow editing' : 'Editing is on: press to lock'} color={noCrud ? c.text : c.primary} onPress={() => setNoCrud((v) => !v)} />
        <PMIconButton tipScope="app" testID={`${testID}-reload`} icon="refresh" title="Read the rows again" color={c.text} onPress={reload} />
      </View>
      {(error || (loaded && rows.length === 0)) && (
        <View testID={`${testID}-setup`} style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {error ? `The rows could not be read (${error}). ` : 'The table is empty. '}
            {setupHint ?? ''}
          </Text>
        </View>
      )}
      {banners}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName={def.entity}
          crudListTitle={title}
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={visualColumns}
          defaultRowJSON={def.emptyRowJSON}
          newRowDefaults={newRowDefaults}
          crudPanelEnabled={!noCrud}
          selectionEnabled={!noCrud}
          contextMenuEnabled={!noCrud}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          foldersTree={{ ...foldersTree, selectedFolderId: node, onSelectedFolderChange: setNode }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 300 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  setup: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 16, paddingBottom: 12, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
});
