// OrganizationTextsCRUD - "System settings -> Application texts" (route /catalog/organization/texts): the administrator replaces a menu title, a column header or a title for the WHOLE
// organization in the app language. A ReusableTable (local rows) of the delivered texts with the cell "Organization text": type a text to replace it, clear the cell (or type the delivered
// text) = Reset to delivered. Column headers have no delivered list: the "Add" bar takes "<table>.<column>" (the dev menu of a table shows the table name).
// The change is seen after a reload of the app (phase 1). SQL: PART 48. Only the administrator edits (the database refuses everybody else).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../../redux/activeUserSlice';
import i18n from '../../../i18n/i18n';
import { PM_KEYS } from '../../../pm/i18n/locales/keys';
import { pmLanguage, pmT } from '../../../pm/i18n/pmT';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import { TextInputApp } from '../../../ui/components/common';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { permissionRefusalText } from '../../../permissions/permissionText';
import { usePermissions } from '../../../permissions/usePermissions';
import { flattenBundle, newTextRowOf, ORGANIZATION_TEXT_TABLE, textScreenRows, textWrites, TEXT_KINDS, type TextRow, type TextScreenRow, type TextWrite } from './organizationTextsModel';

export default function OrganizationTextsCRUD({ testID = 'organization-texts' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const perm = usePermissions();
  const language = pmLanguage();
  const [own, setOwn] = useState<TextRow[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [addKind, setAddKind] = useState<string>('column');
  const [addKey, setAddKey] = useState('');
  const [addText, setAddText] = useState('');

  const bundle = useMemo(() => flattenBundle((i18n as any).getResourceBundle?.(language, 'translation') ?? (i18n as any).getResourceBundle?.('en', 'translation') ?? {}), [language]);
  const screenRows = useMemo<TextScreenRow[]>(() => textScreenRows(PM_KEYS, bundle, own), [bundle, own]);
  const canEdit = perm.canUi('permissionEditTexts', 'U') && (!perm.ready || perm.isAdmin);

  const load = useCallback(async () => {
    if (!organizationGUID) return;
    try {
      const res: any = await (supabase as any).from(ORGANIZATION_TEXT_TABLE).select('rowGUID,rowParentGUID,rowJSON').eq('rowOwnerGUID', organizationGUID).eq('rowParentGUID', language).range(0, 4999);
      if (res.error) throw res.error;
      setOwn(res.data || []);
    } catch (e: any) {
      setMessage({ kind: 'error', text: permissionRefusalText(e) || e?.message || String(e) });
    }
  }, [supabase, organizationGUID, language]);
  useEffect(() => { void load(); }, [load]);

  const apply = useCallback(async (writes: TextWrite[]) => {
    if (!writes.length) return;
    try {
      for (const w of writes) {
        let res: any;
        if (w.kind === 'insert') res = await (supabase as any).from(ORGANIZATION_TEXT_TABLE).insert({ rowOwnerGUID: organizationGUID, rowParentGUID: language, rowJSON: { textKind: w.textKind, textKey: w.key, text: w.text } });
        else if (w.kind === 'update') res = await (supabase as any).from(ORGANIZATION_TEXT_TABLE).update({ rowJSON: { text: w.text } }).eq('rowGUID', w.guid);
        else res = await (supabase as any).from(ORGANIZATION_TEXT_TABLE).delete().eq('rowGUID', w.guid);
        if (res?.error) throw res.error;
      }
      setMessage({ kind: 'ok', text: pmT('Saved') + ' · ' + pmT('The change is seen after you reload the app.') });
    } catch (e: any) {
      setMessage({ kind: 'error', text: permissionRefusalText(e) || e?.message || String(e) });
    }
    await load();
  }, [supabase, organizationGUID, language, load]);

  const rows = useMemo<ReusableTableRow[]>(() => screenRows.map((r) => ({ rowGUID: r.id, rowParentGUID: 'empty', orderInList: 0, rowJSON: { kind: r.kind, key: r.key, delivered: r.delivered, text: r.text } })) as ReusableTableRow[], [screenRows]);
  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'kind', title: pmT('Kind'), type: 'text', editable: false, width: 90 },
    { key: 'key', title: pmT('Key'), type: 'text', editable: false, width: 280 },
    { key: 'delivered', title: pmT('Delivered text'), type: 'text', editable: false, width: 280 },
    { key: 'text', title: pmT('Organization text'), type: 'text', editable: canEdit, width: 300 },
  ], [canEdit]);

  const add = () => {
    const r = newTextRowOf(addKind, addKey, addText);
    if (!r.ok) { setMessage({ kind: 'error', text: pmT('Enter the kind, the key and the text. A column key looks like table.column.') }); return; }
    void apply([r.row]).then(() => { setAddKey(''); setAddText(''); });
  };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="translate" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>{pmT('Application texts')}</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('Replace a menu title, a column header or a title for your whole organization. Language: {{n}}.', { n: language })} · {own.length}</Text>
        </View>
      </View>
      {!canEdit && (
        <View testID={`${testID}-readonly`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
          <IconApp name="info" size={18} color={c.text} />
          <Text style={{ color: c.text, flex: 1 }}>{pmT('Only the administrator of the organization edits the texts.')}</Text>
        </View>
      )}
      {canEdit && (
        <View testID={`${testID}-add`} style={[styles.add, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ width: 130 }}>
            <SelectItemFromListApp testID={`${testID}-add-kind`} items={TEXT_KINDS.map((k) => ({ value: k, label: k }))} value={addKind} onSelect={setAddKind} />
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextInputApp testID={`${testID}-add-key`} label={pmT('Key')} value={addKey} placeholder="project_task_table.taskDescription" autoCapitalize="none" onChangeText={setAddKey} />
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextInputApp testID={`${testID}-add-text`} label={pmT('Organization text')} value={addText} onChangeText={setAddText} />
          </View>
          <ButtonApp testID={`${testID}-add-button`} title={pmT('Save')} icon="add" size="small" onPress={add} />
        </View>
      )}
      {!!message && (
        <View testID={`${testID}-message`} style={[styles.note, { borderColor: (message.kind === 'error' ? c.error : c.primary) + '66' }]}>
          <IconApp name={message.kind === 'error' ? 'error' : 'check_circle'} size={18} color={message.kind === 'error' ? c.error : c.primary} />
          <Text style={{ color: c.text, flex: 1 }}>{message.text}</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName="organizationTexts"
          crudListTitle={pmT('Application texts')}
          itemLabel={pmT('Text')}
          localRows={rows}
          onLocalRowsChange={(next) => { void apply(textWrites(screenRows, next.map((r) => ({ id: r.rowGUID, text: String(r.rowJSON?.text ?? '') })))); }}
          visualColumns={columns}
          selectionEnabled={false}
          crudPanelEnabled={false}
          addEnabled={false}
          reorderEnabled={false}
          contextMenuEnabled={false}
          resizeColumnWidth
          emptyText={pmT('Loading…')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  add: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
});
