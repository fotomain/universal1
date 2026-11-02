// Monitor01FieldsTab - Settings → Fields of the Monitor01 report: the list of the NUMERIC (float) fields of the table with a check box near each. Only the checked fields are in the report;
// all of them are checked by default (the unchecked ones are the report's `hiddenFields`, monitor01Fields.ts).
//   ReusableTable in LOCAL ROWS mode (the rows are the fields, held by the screen) with the FOLDERS TREE = the groups of the header (Plan · Fact · Vendor Invoice · Customer Invoice):
//   pick a folder = only its fields; search, sort and filters of the columns as in every table.
//   Select all / Clear all  check / uncheck every field of the PICKED folder (all fields while "All" is picked), in one step
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../../ui/components/tree/folderTreeModel';
import { pmT } from '../../i18n/pmT';
import {
  MONITOR01_FIELDS, MONITOR01_FIELD_GROUPS, Monitor01FieldGroup, Monitor01FieldId, monitor01SetFieldsChecked, normalizeHiddenFields,
} from './monitor01Fields';

export interface Monitor01FieldsTabProps {
  /** the UNCHECKED fields */
  hiddenFields: readonly Monitor01FieldId[];
  onChange: (hiddenFields: Monitor01FieldId[]) => void;
  testID?: string;
}

/** the id of the folder of a group */
export const monitor01GroupFolderId = (g: Monitor01FieldGroup) => `monitor01-group-${g}`;

export default function Monitor01FieldsTab({ hiddenFields, onChange, testID = 'monitor01-fields' }: Monitor01FieldsTabProps) {
  const { themeColors: c } = useDesignSystem();
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const hidden = useMemo(() => new Set<string>(hiddenFields), [hiddenFields]);

  // the folders = the groups; the rows = the fields (rowParentGUID = the folder)
  const nodes = useMemo(() => MONITOR01_FIELD_GROUPS.map((g, i) => ({ id: monitor01GroupFolderId(g), parentId: null, title: pmT(g), order: (i + 1) * 1000 })), []);
  const rows = useMemo<ReusableTableRow[]>(() => MONITOR01_FIELDS.map((f, i) => ({
    rowGUID: f.id,
    rowParentGUID: monitor01GroupFolderId(f.group),
    orderInList: i + 1,
    rowJSON: { checked: !hidden.has(f.id), title: pmT(f.title), groupTitle: pmT(f.group), kindTitle: pmT(f.kind === 'amount' ? 'Amount of money' : 'Quantity') },
  })), [hidden]);
  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'checked', title: pmT('In the report'), type: 'boolean', width: 120, align: 'center' },
    { key: 'title', title: pmT('Field'), type: 'text', editable: false, width: 200 },
    { key: 'groupTitle', title: pmT('Group'), type: 'text', editable: false, width: 160 },
    { key: 'kindTitle', title: pmT('Type'), type: 'text', editable: false, width: 160 },
  ], []);

  // a check box in the table → the new list of the unchecked fields
  const onRows = useCallback((next: ReusableTableRow[]) => {
    onChange(normalizeHiddenFields(next.filter((r) => r.rowJSON?.checked === false).map((r) => r.rowGUID)));
  }, [onChange]);

  // the fields Select all / Clear all work on: the picked folder, or every field
  const scope = useMemo(() => MONITOR01_FIELDS.filter((f) => folder === TREE_ALL_ID || monitor01GroupFolderId(f.group) === folder).map((f) => f.id), [folder]);
  const setScope = useCallback((checked: boolean) => onChange(monitor01SetFieldsChecked(hiddenFields, scope, checked)), [hiddenFields, scope, onChange]);
  const shown = MONITOR01_FIELDS.length - hiddenFields.length;
  const scopeAllChecked = scope.every((id) => !hidden.has(id));
  const scopeNoneChecked = scope.every((id) => hidden.has(id));

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.bar}>
        <ButtonApp testID={`${testID}-select-all`} title={pmT('Select all')} icon="select_all" variant="outlined" size="small" disabled={scopeAllChecked} onPress={() => setScope(true)} />
        <ButtonApp testID={`${testID}-clear-all`} title={pmT('Clear all')} icon="deselect" variant="outlined" size="small" disabled={scopeNoneChecked} onPress={() => setScope(false)} />
        <Text testID={`${testID}-count`} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('{{n}} of {{total}} fields are in the report', { n: shown, total: MONITOR01_FIELDS.length })}</Text>
      </View>
      {shown === 0 && <Text testID={`${testID}-none`} style={{ color: c.error, fontSize: 12, paddingHorizontal: 12, paddingBottom: 6 }}>{pmT('No field is checked: the report shows no numbers. Check at least one field.')}</Text>}
      <ReusableTable
        testID={`${testID}-table`}
        entityName="monitor01Fields"
        crudListTitle={pmT('Fields')}
        itemLabel={pmT('Field')}
        localRows={rows}
        onLocalRowsChange={onRows}
        visualColumns={columns}
        selectionEnabled={false}
        crudPanelEnabled={false}
        addEnabled={false}
        reorderEnabled={false}
        contextMenuEnabled={false}
        uxuiTable={{ showFoldersTree: true, foldersTreeWidth: 200, foldersTreeCollapsible: true }}
        foldersTree={{ nodes, selectedFolderId: folder, onSelectedFolderChange: setFolder, tree: { readOnly: true, title: pmT('Groups'), allLabel: pmT('All fields'), noneLabel: pmT('No group') } }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 8 },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
});
