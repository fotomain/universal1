// DistributionTypeCRUD - the distributions as GROUPS (level 1, the tree: FolderTreeReusable) and DISTRIBUTIONS (level 2, the rows of the table:
// ReusableTable) of distributionGenericTable.
//   simpleDistributionGroup  > frontLoaded, backLoaded, uniform
//   curvesDistributionGroup  > normal, logarithmicFront, logarithmicBack, epidemic
//   customDistributionGroup  > manual
// `noCrud` (default TRUE, as the management genus): the catalog is read-only - no add / duplicate / sql_for_delete / reorder, no row menu, no check boxes,
// cells not editable, tree without CRUD and drag. The lock button in the header (or noCrud={false}) turns editing on.
// Route: /catalog/distribution/list · SQL: kit8/sql/init/create_distribution_generic_table.sql
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../pm/store/store_pm';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../ui/components/tree/folderTreeModel';
import { DISTRIBUTION_TABLE, distributionGroups, distributionItems, distributionParamsText, distributionPath, isDistributionGroup } from './distributionModel';
import { useDistributionData } from './useDistributionData';
import { useDistributionTree } from './useDistributionTree';

export interface DistributionTypeCRUDProps {
  /** true (default): read-only catalog, false: full CRUD */
  noCrud?: boolean;
}

export default function DistributionTypeCRUD({ noCrud: noCrudProp = true }: DistributionTypeCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const [noCrud, setNoCrud] = useState(noCrudProp);
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const { rows, loaded, error, reload } = useDistributionData(true);
  const { foldersTree } = useDistributionTree(rows, !noCrud, reload);
  const def = DISTRIBUTION_TABLE;

  const groups = useMemo(() => distributionGroups(rows), [rows]);
  const items = useMemo(() => distributionItems(rows), [rows]);
  // the table lists the distributions only; the groups are the tree
  const itemsOnly = useMemo(() => (row: ReusableTableRow) => !isDistributionGroup(row as any), []);
  // a plain catalog: every row has the catalog owner; a new distribution goes into the picked group (or the first one) - a row without group would be a group
  const newRowDefaults = useMemo(() => () => ({
    rowOwnerGUID: def.catalogOwner as string,
    rowParentGUID: groups.some((g) => g.rowGUID === folder) ? folder : groups[0]?.rowGUID,
    rowJSON: {},
  }), [def.catalogOwner, groups, folder]);

  const columns = useMemo<VisualColumn[]>(() => {
    const groupOptions = groups.map((g) => ({ value: g.rowGUID, label: distributionPath(rows, g.rowGUID) }));
    const dim = { color: c.text, opacity: 0.75, fontSize: 13 };
    const cols: VisualColumn[] = [
      { key: 'n', title: '#', type: 'rowNumber' },
      { key: 'title', title: 'Distribution', type: 'text', width: 220 },
      { key: 'code', title: 'Code', type: 'custom', width: 230, editable: false, renderCell: (row) => <Text numberOfLines={1} testID={`distribution-code-${row.rowGUID}`} style={dim}>{row.rowGUID}</Text>, searchText: (row) => row.rowGUID },
      { key: 'parent', title: 'Group', type: 'select', target: 'rowParentGUID', width: 150, allowEmpty: false, placeholder: 'Choose group…', options: groupOptions },
      { key: 'shape', title: 'Shape (share of the total per day)', type: 'text', width: 380 },
      { key: 'params', title: 'Parameters', type: 'custom', width: 220, editable: false, renderCell: (row) => <Text numberOfLines={1} testID={`distribution-params-${row.rowGUID}`} style={dim}>{distributionParamsText(row.rowJSON)}</Text>, searchText: (row) => distributionParamsText(row.rowJSON) },
      { key: 'editable', title: 'Editable', type: 'custom', width: 90, editable: false, renderCell: (row) => <Text testID={`distribution-editable-${row.rowGUID}`} style={dim}>{row.rowJSON?.editable ? 'Yes' : 'No'}</Text>, searchText: (row) => (row.rowJSON?.editable ? 'Yes' : 'No') },
      { key: 'description', title: 'Description', type: 'text', width: 380 },
    ];
    // read-only: every cell shows, none is edited
    return noCrud ? cols.map((col) => ({ ...col, editable: false })) : cols;
  }, [rows, groups, noCrud, c.text]);

  return (
    <View testID="distribution-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="stacked_line_chart" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Distribution</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {def.purpose} · {groups.length} groups · {items.length} distributions · {noCrud ? 'read-only' : 'editing is on'}
          </Text>
        </View>
        <PMIconButton tipScope="app" testID="distribution-edit-toggle" icon={noCrud ? 'lock' : 'lock_open'} title={noCrud ? 'Read-only: press to allow editing' : 'Editing is on: press to lock'} color={noCrud ? c.text : c.primary} onPress={() => setNoCrud((v) => !v)} />
        <PMIconButton tipScope="app" testID="distribution-reload" icon="refresh" title="Read the distributions again" color={c.text} onPress={reload} />
      </View>
      {(error || (loaded && rows.length === 0)) && (
        <View testID="distribution-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {error ? `The distributions could not be read (${error}). ` : 'The distribution table is empty. '}
            Run kit8/sql/init/create_distribution_generic_table.sql in the Supabase SQL editor and sign in.
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID="distribution-table"
          entityName={def.entity}
          crudListTitle="Distributions"
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
