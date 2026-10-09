// ManagementGenusDashboardCRUD - the management genus as FOLDERS (level 1, the tree: FolderTreeReusable) and ITEMS (level 2, the rows of the
// table: ReusableTable) of managementGenusTable.
//   costsGenus     > timeGenus, materialGenus, expenseGenus
//   revenuesGenus  > revenueGenus
//   paymentsGenus  > inboundPaymentGenus, outboundPaymentGenus
// `noCrud` (default TRUE): the catalog is read-only - no add / duplicate / sql_for_delete / reorder, no row menu, no check boxes, cells not editable,
// tree without CRUD and drag. The lock button in the header (or noCrud={false}) turns editing on.
// Route: /catalog/management/genus/list · SQL: kit8/sql/init/create_management_genus_table.sql
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../../ui/components/tree/folderTreeModel';
import { isManagementGenusFolder, MANAGEMENT_GENUS_TABLE, managementGenusFolders, managementGenusItems, managementGenusPath } from './managementGenusModel';
import { useManagementGenusData } from './useManagementGenusData';
import { useManagementGenusTree } from './useManagementGenusTree';

export interface ManagementGenusDashboardCRUDProps {
  /** true (default): read-only catalog, false: full CRUD */
  noCrud?: boolean;
}

export default function ManagementGenusDashboardCRUD({ noCrud: noCrudProp = true }: ManagementGenusDashboardCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const [noCrud, setNoCrud] = useState(noCrudProp);
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const { rows, roleTypes, loaded, error, reload } = useManagementGenusData(true);
  const { foldersTree } = useManagementGenusTree(rows, !noCrud, reload);
  const def = MANAGEMENT_GENUS_TABLE;

  const folders = useMemo(() => managementGenusFolders(rows), [rows]);
  const items = useMemo(() => managementGenusItems(rows), [rows]);
  // the table lists the items only; the folders are the tree
  const itemsOnly = useMemo(() => (row: ReusableTableRow) => !isManagementGenusFolder(row as any), []);
  // a plain catalog: every row has the catalog owner; a new item goes into the picked folder (or the first one) - a row without folder would be a folder
  const newRowDefaults = useMemo(() => () => ({
    rowOwnerGUID: def.catalogOwner as string,
    rowParentGUID: folders.some((f) => f.rowGUID === folder) ? folder : folders[0]?.rowGUID,
    rowJSON: {},
  }), [def.catalogOwner, folders, folder]);

  const columns = useMemo<VisualColumn[]>(() => {
    const perGenus = new Map<string, number>();
    for (const t of roleTypes) { const g = t.rowJSON?.managementGenus; if (g) perGenus.set(g, (perGenus.get(g) ?? 0) + 1); }
    const folderOptions = folders.map((f) => ({ value: f.rowGUID, label: managementGenusPath(rows, f.rowGUID) }));
    const cols: VisualColumn[] = [
      { key: 'n', title: '#', type: 'rowNumber' },
      { key: 'title', title: 'Genus', type: 'text', width: 200 },
      { key: 'code', title: 'Code', type: 'custom', width: 190, editable: false, renderCell: (row) => <Text numberOfLines={1} testID={`genus-code-${row.rowGUID}`} style={{ color: c.text, opacity: 0.75, fontSize: 13 }}>{row.rowGUID}</Text>, searchText: (row) => row.rowGUID },
      { key: 'parent', title: 'Folder', type: 'select', target: 'rowParentGUID', width: 200, allowEmpty: false, placeholder: 'Choose folder…', options: folderOptions },
      { key: 'description', title: 'Description', type: 'text', width: 380 },
      { key: 'roleTypes', title: 'Role types', type: 'custom', width: 100, editable: false, renderCell: (row) => <Text testID={`genus-role-types-${row.rowGUID}`} style={{ color: c.text, opacity: 0.75, fontSize: 13 }}>{String(perGenus.get(row.rowGUID) ?? 0)}</Text>, searchText: (row) => String(perGenus.get(row.rowGUID) ?? 0) },
    ];
    // read-only: every cell shows, none is edited
    return noCrud ? cols.map((col) => ({ ...col, editable: false })) : cols;
  }, [rows, folders, roleTypes, noCrud, c.text]);

  return (
    <View testID="genus-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="hub" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Management genus</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {def.purpose} · {folders.length} folders · {items.length} genus · {noCrud ? 'read-only' : 'editing is on'}
          </Text>
        </View>
        <PMIconButton tipScope="app" testID="genus-edit-toggle" icon={noCrud ? 'lock' : 'lock_open'} title={noCrud ? 'Read-only: press to allow editing' : 'Editing is on: press to lock'} color={noCrud ? c.text : c.primary} onPress={() => setNoCrud((v) => !v)} />
        <PMIconButton tipScope="app" testID="genus-reload" icon="refresh" title="Read the management genus again" color={c.text} onPress={reload} />
      </View>
      {(error || (loaded && rows.length === 0)) && (
        <View testID="genus-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {error ? `The management genus could not be read (${error}). ` : 'The management genus table is empty. '}
            Run kit8/sql/init/create_management_genus_table.sql in the Supabase SQL editor and sign in.
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID="genus-table"
          entityName={def.entity}
          crudListTitle="Management genus"
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          rowFilter={itemsOnly}
          newRowDefaults={newRowDefaults}
          crudPanelEnabled={!noCrud}
          selectionEnabled={!noCrud}
          contextMenuEnabled={!noCrud}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 270 }}
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
