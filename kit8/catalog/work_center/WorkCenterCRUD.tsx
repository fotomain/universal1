// WorkCenterCRUD - the work centers (workCenterTable): a ReusableTable with a tree of FOLDERS = BUSINESS UNITS on the left. A folder is shown only while it holds a work center: it appears with
// the first one entered in it and is hidden again when the last one is removed.
//   Columns: Title · Kind (chosen when the work center is made) · Base (a free catalog item of the kind) · Base variant (a variant of the base) · Work center variant (its own, read only) ·
//            Copy Variant settings (button) · Calendar (the workCenterCalendar) · Business unit (the folder; pick it or drag the row onto a folder) · Active
// "+" opens the New work center window (WorkCenterNewModal): a kind and a free base of that kind are needed before a row exists. "Copy Variant settings" makes the work center's own variant as a
// one-time copy of the base variant; when it has one already the user is asked before it is overwritten.
// SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 35. Route: /catalog/work/center (drawer: Catalogs > Work centers). Design: documentation/WORK_CENTER_WBS.html
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { showSnackbar } from '../../redux/uxuiSlice';
import IconApp from '../../ui/components/common/IconApp';
import ButtonApp from '../../ui/components/common/ButtonApp';
import { ModalAskComponent } from '../../ui/components/common/ModalAskComponent';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../pm/store/store_pm';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../ui/components/tree/folderTreeModel';
import { resourceCalendarOptions, useResourceCalendarColumn } from '../management/calendar/useResourceCalendarColumn';
import { useManagementCalendarData } from '../management/calendar/useManagementCalendarData';
import { copyWorkCenterVariantSettings } from './workCenterApi';
import { useWorkCenterData } from './useWorkCenterData';
import WorkCenterNewModal from './WorkCenterNewModal';
import {
  canCopyVariantSettings, computeWorkCenterRowJSON, WORK_CENTER_CATALOG_OWNER, WORK_CENTER_KINDS, WORK_CENTER_NO_FOLDER, WORK_CENTER_TABLE, workCenterBaseOptions, workCenterBaseVariantOptions,
  workCenterFolderNodes, workCenterHasOwnVariant, workCenterOwnVariantOptions, workCenterUnitOptions,
} from './workCenterModel';
import type { WorkCenterRowJSON } from './workCenterModel';

export default function WorkCenterCRUD({ testID = 'work-center' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const def = WORK_CENTER_TABLE;
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const [adding, setAdding] = useState(false);
  const [askOverwrite, setAskOverwrite] = useState<string | null>(null);
  const { data, loaded, error, reload } = useWorkCenterData(true);
  const calendarColumn = useResourceCalendarColumn();
  const { rows: calendarRows } = useManagementCalendarData(true);

  // the folders = the business units that hold a work center (a unit with none is not shown); a picked folder that vanished (its last work center was removed) goes back to "All"
  const nodes = useMemo(() => workCenterFolderNodes(data.businessUnit, data.workCenter), [data.businessUnit, data.workCenter]);
  useEffect(() => {
    if (folder !== TREE_ALL_ID && loaded && !nodes.some((n) => n.id === folder)) setFolder(TREE_ALL_ID);
  }, [folder, nodes, loaded]);
  const foldersTree = useMemo(() => ({ nodes, folderTarget: 'rowParentGUID' as const, noFolderValue: WORK_CENTER_NO_FOLDER, tree: { readOnly: true } }), [nodes]);
  const unitOptions = useMemo(() => workCenterUnitOptions(data.businessUnit), [data.businessUnit]);
  const calendarOptions = useMemo(() => resourceCalendarOptions(calendarRows), [calendarRows]);
  const computeRowJSON = useMemo(() => computeWorkCenterRowJSON(data.variant), [data.variant]);
  const newRowDefaults = useMemo(() => () => ({
    rowOwnerGUID: WORK_CENTER_CATALOG_OWNER,
    rowParentGUID: data.businessUnit.some((u) => u.rowGUID === folder) ? folder : WORK_CENTER_NO_FOLDER,
    rowJSON: {},
  }), [data.businessUnit, folder]);

  const say = useCallback((message: string) => { dispatch(showSnackbar({ message })); }, [dispatch]);
  const copyVariant = useCallback(async (guid: string, overwrite: boolean) => {
    try {
      await copyWorkCenterVariantSettings(guid, overwrite);
      say('The variant settings are copied to the work center.');
    } catch (e: any) {
      say(String(e?.message || e));
    }
  }, [say]);
  /** the button: a work center that has a variant is asked first (the copy replaces it) */
  const onCopyVariant = useCallback((guid: string) => {
    if (workCenterHasOwnVariant(data.variant, guid)) setAskOverwrite(guid);
    else void copyVariant(guid, false);
  }, [data.variant, copyVariant]);

  const createWorkCenter = useCallback((rowParentGUID: string, rowJSON: WorkCenterRowJSON) => {
    setAdding(false);
    const actions = SystemMetaData[def.entity]?.actions;
    if (!actions?.createOne) return;
    dispatch(actions.createOne({ rowGUID: Crypto.randomUUID(), rowOwnerGUID: WORK_CENTER_CATALOG_OWNER, rowParentGUID, orderInList: Date.now(), rowJSON }));
  }, [dispatch, def.entity]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: 'Title', type: 'text', field: 'workCenterTitle', width: 220, placeholder: 'Work center' },
    // the kind is chosen when the work center is made: a base belongs to ONE kind, so it does not change in the table
    { key: 'kind', title: 'Kind', type: 'select', field: 'workCenterKind', width: 120, editable: false, options: WORK_CENTER_KINDS.map((k) => ({ value: k.value, label: k.label })) },
    {
      key: 'base', title: 'Base', type: 'select', field: 'workCenterBase', width: 240, allowEmpty: false, placeholder: 'Select base…',
      options: (row) => workCenterBaseOptions(data, row.rowJSON?.workCenterKind, row.rowGUID),
    },
    {
      key: 'baseVariant', title: 'Base variant', type: 'select', field: 'workCenterBaseVariant', width: 220, allowEmpty: true, placeholder: 'None',
      options: (row) => workCenterBaseVariantOptions(data.variant, row.rowJSON?.workCenterBase),
    },
    {
      key: 'variant', title: 'Work center variant', type: 'select', field: 'workCenterVariant', width: 220, editable: false, placeholder: 'None',
      options: (row) => workCenterOwnVariantOptions(data.variant, row.rowGUID),
    },
    {
      key: 'copyVariant', title: 'Variant settings', type: 'custom', width: 190, editable: false,
      renderCell: (row) => (
        <ButtonApp
          testID={`${testID}-copy-variant-${row.rowGUID}`}
          title="Copy Variant settings"
          variant="outlined"
          size="small"
          disabled={!canCopyVariantSettings(row)}
          onPress={() => onCopyVariant(row.rowGUID)}
        />
      ),
      searchText: () => '',
    },
    { ...calendarColumn, title: 'Calendar' },
    { key: 'businessUnit', title: 'Business unit', type: 'select', target: 'rowParentGUID', width: 260, allowEmpty: false, placeholder: 'Select business unit…', options: unitOptions },
    { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
  ], [data, calendarColumn, unitOptions, onCopyVariant, testID]);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="precision_manufacturing" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Work centers</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{def.purpose} · {data.workCenter.length} work centers</Text>
        </View>
        <PMIconButton tipScope="app" testID={`${testID}-reload`} icon="refresh" title="Read the work centers again" color={c.text} onPress={reload} />
      </View>
      {!!error && (
        <View testID={`${testID}-setup`} style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>The work centers could not be read ({error}). Run kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql (PART 35) in the Supabase SQL editor and sign in.</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName={def.entity}
          crudListTitle="Work centers"
          itemLabel={def.itemLabel}
          listOwnerGUID={WORK_CENTER_CATALOG_OWNER}
          listParentGUID="*"
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          newRowDefaults={newRowDefaults}
          computeRowJSON={computeRowJSON}
          // a work center cannot be made empty (a kind and a base are needed): "+" opens the New work center window
          onAdd={() => setAdding(true)}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          emptyText={loaded ? 'No work centers yet. Press "+" to add one.' : 'Loading…'}
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 250 }}
          extraMenuItems={(row, close) => [{
            testID: `${testID}-menu-copy-variant`, label: 'Copy Variant settings', icon: 'content_copy', disabled: !canCopyVariantSettings(row),
            onPress: () => { close(); onCopyVariant(row.rowGUID); },
          } as any]}
        />
      </ScrollView>
      <WorkCenterNewModal
        testID={`${testID}-new`}
        visible={adding}
        data={data}
        initialUnit={data.businessUnit.some((u) => u.rowGUID === folder) ? folder : null}
        calendarOptions={calendarOptions}
        onCancel={() => setAdding(false)}
        onCreate={createWorkCenter}
      />
      <ModalAskComponent
        testID={`${testID}-overwrite`}
        visible={!!askOverwrite}
        modalTopBar="Overwrite the work center variant?"
        modalBody="This work center has a variant already. Copy Variant settings replaces it with a new copy of the base variant."
        confirmLabel="Overwrite"
        onCancel={() => setAskOverwrite(null)}
        onConfirm={() => { const guid = askOverwrite; setAskOverwrite(null); if (guid) void copyVariant(guid, true); }}
      />
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
