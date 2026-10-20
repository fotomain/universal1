// ManagementActivityGenusCRUD - the activity genus (managementActivityGenusTable, 3 rows: operating / investing / financing) and the allowed budget item keys
// (budgetItemGenericKeyTable, 14 rows: activity x management genus, with the default direction). BOTH ARE READ ONLY: the activities and the keys are constants of the app
// (the rule is the SQL function kit8_budget_item_key_matrix); a budget item chooses its key in the Budget items screen.
//   Table 1  Activity genus      Activity · Code · Web + IFRS (IAS 7) · D365 FO · SAP · Keys · Budget items
//   Table 2  Budget item keys    Key · Code · Activity · Management genus · Direction · D365 FO · SAP · Budget items
// Route: /catalog/management/activity_genus/list · SQL: kit8/sql/start start1_sql_tables.sql + start2_sql_code.sql PART 32 · Design: documentation/ACTIVITY_GENUS.html
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { BUDGET_ITEM_DIRECTIONS, BUDGET_ITEM_KEY_MATRIX, BUDGET_ITEM_KEY_TABLE } from '../../budget/item/budgetItemKeyModel';
import { MANAGEMENT_ACTIVITY_GENUS_CODES, MANAGEMENT_ACTIVITY_GENUS_TABLE, managementActivityGenusShortTitle } from './managementActivityGenusModel';
import { useManagementActivityGenusData } from './useManagementActivityGenusData';

const READ_ONLY = { crudPanelEnabled: false, selectionEnabled: false, contextMenuEnabled: false } as const;

export default function ManagementActivityGenusCRUD() {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const { activityRows, keyRows, itemsPerActivity, itemsPerKey, error, reload } = useManagementActivityGenusData(true);
  const activity = MANAGEMENT_ACTIVITY_GENUS_TABLE;
  const key = BUDGET_ITEM_KEY_TABLE;

  const codeCell = (testID: string) => (row: any) => (
    <Text numberOfLines={1} testID={`${testID}-${row.rowGUID}`} style={{ color: c.text, opacity: 0.75, fontSize: 13 }}>{row.rowGUID}</Text>
  );
  const countCell = (testID: string, count: (row: any) => number) => (row: any) => (
    <Text testID={`${testID}-${row.rowGUID}`} style={{ color: c.text, fontSize: 13, textAlign: 'center' }}>{count(row)}</Text>
  );

  const activityColumns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: 'Activity', type: 'text', width: 180, editable: false },
    { key: 'code', title: 'Code', type: 'custom', width: 170, editable: false, renderCell: codeCell('activity-genus-code'), searchText: (row) => String((row as any).rowGUID ?? '') },
    { key: 'description', title: 'Description', type: 'text', width: 380, editable: false },
    { key: 'webIfrsName', title: 'Web + IFRS', type: 'text', width: 340, editable: false },
    { key: 'd365foName', title: 'D365 FO', type: 'text', width: 300, editable: false },
    { key: 'sapName', title: 'SAP', type: 'text', width: 300, editable: false },
    { key: 'keys', title: 'Keys', type: 'custom', width: 70, editable: false, align: 'center',
      renderCell: countCell('activity-genus-keys', (row) => BUDGET_ITEM_KEY_MATRIX.filter((k) => k.activity === row.rowGUID).length) },
    { key: 'items', title: 'Budget items', type: 'custom', width: 110, editable: false, align: 'center',
      renderCell: countCell('activity-genus-items', (row) => itemsPerActivity[row.rowGUID] ?? 0) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [c.text, itemsPerActivity]);

  const keyColumns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: 'Key', type: 'text', width: 220, editable: false },
    { key: 'code', title: 'Code', type: 'custom', width: 260, editable: false, renderCell: codeCell('budget-item-key-code'), searchText: (row) => String((row as any).rowGUID ?? '') },
    { key: 'activityGenus', title: 'Activity', type: 'select', width: 130, editable: false,
      options: MANAGEMENT_ACTIVITY_GENUS_CODES.map((a) => ({ value: a, label: managementActivityGenusShortTitle(activityRows.find((r) => r.rowGUID === a)) || a })) },
    { key: 'managementGenusItem', title: 'Management genus', type: 'text', width: 190, editable: false },
    { key: 'directionDefault', title: 'Direction', type: 'select', width: 110, editable: false, options: BUDGET_ITEM_DIRECTIONS },
    { key: 'd365foName', title: 'D365 FO', type: 'text', width: 300, editable: false },
    { key: 'sapName', title: 'SAP', type: 'text', width: 300, editable: false },
    { key: 'items', title: 'Budget items', type: 'custom', width: 110, editable: false, align: 'center',
      renderCell: countCell('budget-item-key-items', (row) => itemsPerKey[row.rowGUID] ?? 0) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [c.text, activityRows, itemsPerKey]);

  const ready = activityRows.length > 0 && keyRows.length > 0;

  return (
    <View testID="activity-genus-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="swap_vert" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Activity genus</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {activity.purpose} · {activityRows.length} activities · {keyRows.length} keys · read-only
          </Text>
        </View>
        <PMIconButton tipScope="app" testID="activity-genus-reload" icon="refresh" title="Read the activity genus again" color={c.text} onPress={reload} />
      </View>
      {(error || !ready) && (
        <View testID="activity-genus-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {error ? `The activity genus could not be read (${error}). ` : 'The activity genus tables are empty. '}
            Run start1_sql_tables.sql, start2_sql_code.sql and start4_sql_insert_missing.sql (kit8/sql/start, PART 32) in the Supabase SQL editor and sign in.
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h2, { color: c.text }]}>Activities of the cash flow statement</Text>
        <ReusableTable
          testID="activity-genus-table"
          entityName={activity.entity}
          crudListTitle="Activity genus"
          itemLabel={activity.itemLabel}
          listOwnerGUID={activity.catalogOwner as string}
          listParentGUID="empty"
          visualColumns={activityColumns}
          defaultRowJSON={activity.emptyRowJSON}
          {...READ_ONLY}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        />
        <Text style={[styles.h2, { color: c.text, marginTop: 18 }]}>Budget item keys = activity × management genus</Text>
        <ReusableTable
          testID="budget-item-key-table"
          entityName={key.entity}
          crudListTitle="Budget item keys"
          itemLabel={key.itemLabel}
          listOwnerGUID={key.catalogOwner as string}
          listParentGUID="empty"
          visualColumns={keyColumns}
          defaultRowJSON={key.emptyRowJSON}
          {...READ_ONLY}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  h2: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  setup: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 16, paddingBottom: 12, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
});
