// PMBudgetItemCRUD - the budget items as FOLDERS (level 1, the tree: FolderTreeReusable) and ITEMS (level 2, the rows of the table: ReusableTable)
// of budgetItemTable - the same folder structure as managementGenusTable.
//   costsBudgetFolder     > timeBudgetItem, materialBudgetItem, expenseBudgetItem
//   revenuesBudgetFolder  > revenueBudgetItem
//   paymentsBudgetFolder  > inboundPaymentBudgetItem, outboundPaymentBudgetItem
// The tree has a SECOND level under every folder: the ACTIVITY (Operating / Investing / Financing, IAS 7) of the items - virtual nodes made of the key of the items (budgetItemNodes).
// Every item has an OBLIGATORY managementGenusItem = the rowGUID of a level 2 row of managementGenusTable (timeGenus, ...): the Genus column cannot be empty.
// And an OBLIGATORY key = activity x genus (rowJSON.budgetItemGenericKey, the Activity column: only the activities the genus can have) and a Direction (inbound | outbound, default =
// the direction of the key; a Correction may reverse it). The text columns Web + IFRS, D365 FO and SAP name the item in IFRS (IAS 7), Dynamics 365 FO and SAP (documentation/ACTIVITY_GENUS.html).
// `noCrud` (default FALSE: a budget item catalog is edited): true = read-only - no add / duplicate / delete / reorder, no row menu, no check boxes, cells not
// editable, tree without CRUD and drag. The lock button in the header turns editing on / off.
// Route: /budget/item/list · SQL: kit8/sql/start start1_sql_tables.sql + start2_sql_code.sql PARTs 8 and 32
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
import { BUDGET_ITEM_DIRECTIONS, budgetItemActivityOptions, budgetItemDefaultKey, budgetItemDirectionError, budgetItemKeyDirection, budgetItemKeyError, budgetItemKeyPatch, budgetItemsWithoutKey } from './budgetItemKeyModel';
import { BUDGET_ITEM_TABLE, budgetItemNewRowOfNode, budgetItemFolders, budgetItemGenusError, budgetItemGenusOptions, budgetItemPath, budgetItems, budgetItemsWithoutGenus, isBudgetItemFolder } from './budgetItemModel';
import { useBudgetItemData } from './useBudgetItemData';
import { useBusinessUnitColumn } from '../../business_unit/useBusinessUnitColumn';
import { useBudgetItemTree } from './useBudgetItemTree';

export interface PMBudgetItemCRUDProps {
  /** false (default): full CRUD, true: read-only catalog */
  noCrud?: boolean;
}

export default function PMBudgetItemCRUD({ noCrud: noCrudProp = false }: PMBudgetItemCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const [noCrud, setNoCrud] = useState(noCrudProp);
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const { rows, genusRows, activityRows, loaded, error, reload } = useBudgetItemData(true);
  const def = BUDGET_ITEM_TABLE;
  const businessUnitColumn = useBusinessUnitColumn();

  const folders = useMemo(() => budgetItemFolders(rows), [rows]);
  const items = useMemo(() => budgetItems(rows), [rows]);
  const genusOptions = useMemo(() => budgetItemGenusOptions(genusRows), [genusRows]);
  // the tree: the folders (level 1) and the activity of the items under each (level 2)
  const { foldersTree } = useBudgetItemTree(rows, !noCrud, reload, activityRows, genusOptions);
  const withoutGenus = useMemo(() => budgetItemsWithoutGenus(rows, genusRows), [rows, genusRows]);
  const withoutKey = useMemo(() => budgetItemsWithoutKey(items), [items]);
  // the table lists the items only; the folders are the tree
  const itemsOnly = useMemo(() => (row: ReusableTableRow) => !isBudgetItemFolder(row as any), []);
  // a new item goes into the picked folder (or the first one) - a row without folder would be a folder - and gets a genus (obligatory): the genus of
  // the items already in that folder, else the first genus
  const newRowDefaults = useMemo(() => () => {
    // an activity node picked: that folder, that activity (the table also does this through the tree; this keeps "+" right when the tree is hidden)
    const node = budgetItemNewRowOfNode(rows, genusOptions, folder);
    if (node) return { rowOwnerGUID: def.catalogOwner as string, ...node };
    const parent = folders.some((f) => f.rowGUID === folder) ? folder : folders[0]?.rowGUID;
    const sibling = items.find((r) => r.rowParentGUID === parent && r.rowJSON?.managementGenusItem);
    const managementGenusItem = sibling?.rowJSON?.managementGenusItem ?? genusOptions[0]?.value ?? null;
    const budgetItemGenericKey = budgetItemDefaultKey(managementGenusItem);
    return { rowOwnerGUID: def.catalogOwner as string, rowParentGUID: parent, rowJSON: { managementGenusItem, budgetItemGenericKey, direction: budgetItemKeyDirection(budgetItemGenericKey) } };
  }, [def.catalogOwner, folders, items, folder, genusOptions, rows]);

  const columns = useMemo<VisualColumn[]>(() => {
    const folderOptions = folders.map((f) => ({ value: f.rowGUID, label: budgetItemPath(rows, f.rowGUID) }));
    const cols: VisualColumn[] = [
      { key: 'n', title: '#', type: 'rowNumber' },
      { key: 'title', title: 'Budget item', type: 'text', width: 220 },
      { key: 'code', title: 'Code', type: 'custom', width: 200, editable: false, renderCell: (row) => <Text numberOfLines={1} testID={`budget-item-code-${row.rowGUID}`} style={{ color: c.text, opacity: 0.75, fontSize: 13 }}>{row.rowGUID}</Text>, searchText: (row) => row.rowGUID },
      { key: 'parent', title: 'Folder', type: 'select', target: 'rowParentGUID', width: 180, allowEmpty: false, placeholder: 'Choose folder…', options: folderOptions },
      { key: 'managementGenusItem', title: 'Management genus', type: 'select', width: 200, allowEmpty: false, placeholder: 'Choose genus…', options: genusOptions, validate: (value) => budgetItemGenusError(value, genusRows) },
      // the activity = the key activity x genus (obligatory): only the activities the genus of the row can have
      { key: 'budgetItemGenericKey', title: 'Activity', type: 'select', width: 140, allowEmpty: false, placeholder: 'Choose activity…',
        options: (row) => budgetItemActivityOptions(row.rowJSON?.managementGenusItem, activityRows),
        validate: (value, row) => budgetItemKeyError(value, row.rowJSON?.managementGenusItem) },
      { key: 'direction', title: 'Direction', type: 'select', width: 120, allowEmpty: false, placeholder: 'Choose direction…', options: BUDGET_ITEM_DIRECTIONS,
        validate: (value, row) => budgetItemDirectionError(value, row.rowJSON?.budgetItemGenericKey, row.rowJSON?.isCorrection) },
      { key: 'isCorrection', title: 'Correction', type: 'boolean', width: 90 },
      // the default business unit of a line budgeted as this item (rowJSON.businessUnitAssigned)
      businessUnitColumn,
      { key: 'description', title: 'Description', type: 'text', width: 380 },
      // how the item is named in IFRS (IAS 7), Dynamics 365 Finance and Operations and SAP
      { key: 'webIfrsName', title: 'Web + IFRS', type: 'text', width: 320 },
      { key: 'd365foName', title: 'D365 FO', type: 'text', width: 300 },
      { key: 'sapName', title: 'SAP', type: 'text', width: 300 },
      { key: 'isPolicyItem', title: 'Policy', type: 'boolean', width: 80 },
    ];
    // read-only: every cell shows, none is edited
    return noCrud ? cols.map((col) => ({ ...col, editable: false })) : cols;
  }, [rows, folders, genusOptions, genusRows, activityRows, noCrud, c.text, businessUnitColumn]);

  return (
    <View testID="budget-item-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="request_quote" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Budget items</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {def.purpose} · {folders.length} folders · {items.length} budget items · {noCrud ? 'read-only' : 'editing is on'}
          </Text>
        </View>
        <PMIconButton tipScope="app" testID="budget-item-edit-toggle" icon={noCrud ? 'lock' : 'lock_open'} title={noCrud ? 'Read-only: press to allow editing' : 'Editing is on: press to lock'} color={noCrud ? c.text : c.primary} onPress={() => setNoCrud((v) => !v)} />
        <PMIconButton tipScope="app" testID="budget-item-reload" icon="refresh" title="Read the budget items again" color={c.text} onPress={reload} />
      </View>
      {(error || (loaded && rows.length === 0)) && (
        <View testID="budget-item-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {error ? `The budget items could not be read (${error}). ` : 'The budget item table is empty. '}
            Run start1_sql_tables.sql, start2_sql_code.sql and start4_sql_insert_missing.sql (kit8/sql/start) in the Supabase SQL editor and sign in.
          </Text>
        </View>
      )}
      {withoutKey.length > 0 && (
        <View testID="budget-item-no-key" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="warning" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {withoutKey.length} budget item{withoutKey.length === 1 ? '' : 's'} without a valid activity or direction: {withoutKey.slice(0, 5).map((r) => r.rowJSON?.title || r.rowGUID).join(', ')}{withoutKey.length > 5 ? ' …' : ''}
            {' '}(run start2_sql_code.sql, PART 32, to give old items the operating activity)
          </Text>
        </View>
      )}
      {withoutGenus.length > 0 && (
        <View testID="budget-item-no-genus" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="warning" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {withoutGenus.length} budget item{withoutGenus.length === 1 ? '' : 's'} without a valid management genus: {withoutGenus.slice(0, 5).map((r) => r.rowJSON?.title || r.rowGUID).join(', ')}{withoutGenus.length > 5 ? ' …' : ''}
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID="budget-item-table"
          entityName={def.entity}
          crudListTitle="Budget items"
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          rowFilter={itemsOnly}
          newRowDefaults={newRowDefaults}
          computeRowJSON={budgetItemKeyPatch}
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
