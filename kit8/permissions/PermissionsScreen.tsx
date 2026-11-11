// PermissionsScreen - "System settings -> Permissions" (route /user/permissions): two tabs.
//   My permissions  the profiles the signed-in user holds in the selected project and the letters (C R U D) they give per table and per screen (perm_my_matrix) - for support: "why can I not press Post?"
//   Matrix          the administrator edits the matrix of the ORGANIZATION: a changed cell is the organization's own row of project_permission_profile_crud_table (the delivered rows stay);
//                   setting a cell back to the delivered letters removes the own row. Everybody else cannot open it (the database refuses the write anyway).
// SQL: PART 46 of kit8/sql/start; README next to this file.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { useSupabase } from '../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../redux/activeUserSlice';
import IconApp from '../ui/components/common/IconApp';
import ScrollableTabBar from '../ui/components/tabs/ScrollableTabBar';
import ReusableTable from '../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../ui/components/table/reusable/reusableTableTypes';
import { usePMStore } from '../pm/store/store_pm';
import { pmT } from '../pm/i18n/pmT';
import { PROFILE_TITLES } from './permissionModel';
import { permissionRefusalText } from './permissionText';
import { usePermissions } from './usePermissions';
import { MATRIX_PROFILES, MATRIX_SETS, matrixRowsOf, matrixWrites, type CrudRow, type MatrixRow } from './permissionMatrixModel';

const CRUD_TABLE = 'project_permission_profile_crud_table';
type Tab = 'mine' | 'matrix';

function MyPermissions({ testID }: { testID: string }) {
  const { themeColors: c } = useDesignSystem();
  const projectGUID: string | null = usePMStore((s: any) => s.selectedProjectGUID) ?? null;
  const projectName: string = usePMStore((s: any) => (s.selectedProjectGUID ? s.projectsById?.[s.selectedProjectGUID]?.rowJSON?.name : '')) || '';
  const perm = usePermissions(projectGUID);
  const rows = useMemo<ReusableTableRow[]>(() => {
    const crud = Object.entries(perm.matrix.crud).map(([k, v]) => ({ rowGUID: `t:${k}`, rowParentGUID: 'empty', orderInList: 0, rowJSON: { kind: pmT('Table'), name: k, letters: v } }));
    const ux = Object.entries(perm.matrix.uxui).map(([k, v]) => ({ rowGUID: `u:${k}`, rowParentGUID: 'empty', orderInList: 0, rowJSON: { kind: pmT('Screen'), name: k, letters: v } }));
    return [...crud, ...ux].sort((a, b) => String(a.rowJSON.kind).localeCompare(String(b.rowJSON.kind)) || String(a.rowJSON.name).localeCompare(String(b.rowJSON.name))) as ReusableTableRow[];
  }, [perm.matrix]);
  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'kind', title: pmT('Kind'), type: 'text', editable: false, width: 100 },
    { key: 'name', title: pmT('Name'), type: 'text', editable: false, width: 340 },
    { key: 'letters', title: pmT('Letters'), type: 'text', editable: false, width: 120 },
  ], []);
  return (
    <View testID={testID} style={{ flex: 1 }}>
      <View style={styles.chips}>
        <Text style={{ color: c.text, fontWeight: '700' }}>{projectName ? pmT('Project: {{n}}', { n: projectName }) : pmT('No project selected: the profiles you hold anywhere')}</Text>
        {!perm.ready && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6 }}>{pmT('Loading…')}</Text>}
        <View style={styles.chipRow}>
          {perm.profiles.length === 0 && perm.ready ? <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('No profile: you can read what everybody reads.')}</Text> : null}
          {perm.profiles.map((p) => (
            <View key={p} testID={`${testID}-profile-${p}`} style={[styles.chip, { borderColor: c.primary, backgroundColor: c.primary + '14' }]}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{pmT(PROFILE_TITLES[p] ?? p)}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('May create projects')}: {perm.canCreateProject ? pmT('yes') : pmT('no')}</Text>
      </View>
      <ReusableTable
        testID={`${testID}-table`}
        entityName="permissionsMine"
        crudListTitle={pmT('My permissions')}
        itemLabel={pmT('Row')}
        localRows={rows}
        visualColumns={columns}
        selectionEnabled={false}
        crudPanelEnabled={false}
        addEnabled={false}
        reorderEnabled={false}
        contextMenuEnabled={false}
        readOnly
      />
    </View>
  );
}

function MatrixEditor({ testID }: { testID: string }) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const perm = usePermissions();
  const [raw, setRaw] = useState<CrudRow[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const matrix = useMemo<MatrixRow[]>(() => matrixRowsOf(raw, organizationGUID), [raw, organizationGUID]);

  const load = useCallback(async () => {
    try {
      const res: any = await (supabase as any).from(CRUD_TABLE).select('rowGUID,rowOwnerGUID,rowParentGUID,rowJSON').range(0, 4999);
      if (res.error) throw res.error;
      setRaw(res.data || []);
    } catch (e: any) {
      setMessage({ kind: 'error', text: permissionRefusalText(e) || e?.message || String(e) });
    }
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo<ReusableTableRow[]>(() => matrix.map((m) => ({
    rowGUID: m.table, rowParentGUID: 'empty', orderInList: 0,
    rowJSON: { table: m.table, overridden: m.overridden ? String(m.overridden) : '', ...Object.fromEntries(MATRIX_PROFILES.map((p) => [p, m.cells[p]?.set ?? ''])) },
  })) as ReusableTableRow[], [matrix]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'table', title: pmT('Table'), type: 'text', editable: false, width: 300 },
    { key: 'overridden', title: pmT('Own rows'), type: 'text', editable: false, width: 90 },
    ...MATRIX_PROFILES.map((p) => ({ key: p, title: pmT(PROFILE_TITLES[p]), type: 'select' as const, width: 130, allowEmpty: false, options: MATRIX_SETS.map((s) => ({ value: s, label: s })) })),
  ] as VisualColumn[], []);

  const onRows = useCallback(async (next: ReusableTableRow[]) => {
    const after: Record<string, Record<string, string>> = {};
    for (const r of next) after[r.rowGUID] = Object.fromEntries(MATRIX_PROFILES.map((p) => [p, String(r.rowJSON?.[p] ?? '')]));
    const writes = matrixWrites(matrix, after);
    if (!writes.length) return;
    try {
      for (const w of writes) {
        let res: any;
        if (w.kind === 'insert') res = await (supabase as any).from(CRUD_TABLE).insert({ rowOwnerGUID: organizationGUID, rowParentGUID: w.profile, rowJSON: { permissionTable: w.table, permissionSet: w.set } });
        else if (w.kind === 'update') res = await (supabase as any).from(CRUD_TABLE).update({ rowJSON: { permissionSet: w.set } }).eq('rowGUID', w.guid);
        else res = await (supabase as any).from(CRUD_TABLE).delete().eq('rowGUID', w.guid);
        if (res?.error) throw res.error;
      }
      setMessage({ kind: 'ok', text: pmT('Saved') });
    } catch (e: any) {
      setMessage({ kind: 'error', text: permissionRefusalText(e) || e?.message || String(e) });
    }
    await load();
  }, [matrix, supabase, organizationGUID, load]);

  if (!perm.canUi('permissionMatrixEditor', 'R') || (perm.ready && !perm.isAdmin)) {
    return <Text testID={`${testID}-denied`} style={{ color: c.text, padding: 16 }}>{pmT('Only the administrator of the organization edits the matrix.')}</Text>;
  }
  return (
    <View testID={testID} style={{ flex: 1 }}>
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12, padding: 12 }}>{pmT('A changed cell is a row of YOUR organization; setting it back to the delivered letters removes it. The database is the law: the matrix decides RLS, the RPCs and the lock triggers.')}</Text>
      {!!message && (
        <View testID={`${testID}-message`} style={[styles.note, { borderColor: (message.kind === 'error' ? c.error : c.primary) + '66' }]}>
          <IconApp name={message.kind === 'error' ? 'error' : 'check_circle'} size={18} color={message.kind === 'error' ? c.error : c.primary} />
          <Text style={{ color: c.text, flex: 1 }}>{message.text}</Text>
        </View>
      )}
      <ReusableTable
        testID={`${testID}-table`}
        entityName="permissionsMatrix"
        crudListTitle={pmT('Matrix')}
        itemLabel={pmT('Table')}
        localRows={rows}
        onLocalRowsChange={(next) => { void onRows(next); }}
        visualColumns={columns}
        selectionEnabled={false}
        crudPanelEnabled={false}
        addEnabled={false}
        reorderEnabled={false}
        contextMenuEnabled={false}
        resizeColumnWidth
      />
    </View>
  );
}

export default function PermissionsScreen({ testID = 'permissions' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const [tab, setTab] = useState<Tab>('mine');
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'mine', label: pmT('My permissions'), icon: 'verified_user' },
    { id: 'matrix', label: pmT('Matrix'), icon: 'grid_on' },
  ];
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="admin_panel_settings" size={24} color={c.primary} />
        <Text style={[styles.h1, { color: c.text }]}>{pmT('Permissions')}</Text>
      </View>
      <ScrollableTabBar testID={`${testID}-tabs`} style={[styles.tabs, { borderColor: c.border }]}>
        {tabs.map((t) => (
          <Pressable key={t.id} testID={`${testID}-tab-${t.id}`} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}>
            <IconApp name={t.icon} size={16} color={tab === t.id ? c.primary : c.text} />
            <Text style={{ color: tab === t.id ? c.primary : c.text, fontWeight: '600' }}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollableTabBar>
      <ScrollView horizontal={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        {tab === 'mine' ? <MyPermissions testID={`${testID}-mine`} /> : <MatrixEditor testID={`${testID}-matrix`} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  chips: { padding: 12, gap: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', margin: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
});
