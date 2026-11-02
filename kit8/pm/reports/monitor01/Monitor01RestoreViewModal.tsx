// Monitor01RestoreViewModal - View → Restore View: the LIST of the Views of the report (a ReusableTable in local rows mode):
//   Title · For other users enabled · Owner · Saved · Restore / Delete
//   the list holds the Views of the user and the Views of the users of his organization that were saved with "For other users enabled"
//   "For other users enabled" is a check box: the owner switches it right in the list (report_view_share); for a View of a colleague it only shows
//   Restore      applies the View to the report and closes the window;   Delete (own Views only) asks once more: the second press deletes
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { PMIconButton } from '../../inner/buttons';
import { pmT } from '../../i18n/pmT';
import { ReportViewRow, deleteReportView, listReportViews, shareReportView } from './monitor01ReportViews';

export interface Monitor01RestoreViewModalProps {
  visible: boolean;
  onClose: () => void;
  reportGUID: string;
  /** Restore was pressed: apply the View to the report (the window closes itself) */
  onRestore: (view: ReportViewRow) => void;
  testID?: string;
}

const savedText = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toLocaleString() : ''; };

export default function Monitor01RestoreViewModal({ visible, onClose, reportGUID, onRestore, testID = 'monitor01-restore-view' }: Monitor01RestoreViewModalProps) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  // the client is read when a call is made - a new client object (a re-render of the provider) must not reload the list
  const client = useRef(supabase);
  client.current = supabase;
  const dispatch = useDispatch();
  const [views, setViews] = useState<ReportViewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setViews(await listReportViews(client.current, reportGUID)); } catch (e: any) { setError(e?.message || String(e)); }
    setLoading(false);
  }, [reportGUID]);
  useEffect(() => { if (visible) { setConfirmDelete(null); void load(); } }, [visible, load]);

  const toggleShare = useCallback(async (v: ReportViewRow) => {
    const next = !v.forOtherUsersEnabled;
    setViews((cur) => cur.map((x) => (x.viewGUID === v.viewGUID ? { ...x, forOtherUsersEnabled: next } : x)));   // at once; the database answer corrects it
    try { await shareReportView(client.current, v.viewGUID, next); } catch (e: any) {
      setViews((cur) => cur.map((x) => (x.viewGUID === v.viewGUID ? { ...x, forOtherUsersEnabled: !next } : x)));
      dispatch(showSnackbar({ message: e?.message || String(e) }));
    }
  }, [dispatch]);
  const remove = useCallback(async (v: ReportViewRow) => {
    setConfirmDelete(null);
    try {
      await deleteReportView(client.current, v.viewGUID);
      setViews((cur) => cur.filter((x) => x.viewGUID !== v.viewGUID));
      dispatch(showSnackbar({ message: pmT('View "{{title}}" deleted', { title: v.viewTitle }) }));
    } catch (e: any) { dispatch(showSnackbar({ message: e?.message || String(e) })); }
  }, [dispatch]);
  const restore = useCallback((v: ReportViewRow) => { onRestore(v); onClose(); }, [onRestore, onClose]);

  const byGUID = useMemo(() => new Map(views.map((v) => [v.viewGUID, v] as const)), [views]);
  const rows = useMemo<ReusableTableRow[]>(() => views.map((v, i) => ({
    rowGUID: v.viewGUID, orderInList: i + 1,
    rowJSON: { viewTitle: v.viewTitle, forOtherUsersEnabled: v.forOtherUsersEnabled, ownerName: v.isMine ? `${v.ownerName} (${pmT('you')})` : v.ownerName, savedAt: savedText(v.updatedAt) },
  })), [views]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'viewTitle', title: pmT('ReportViewTitle'), type: 'text', editable: false, width: 220 },
    {
      key: 'forOtherUsersEnabled', title: pmT('For other users enabled'), type: 'custom', width: 170, align: 'center',
      searchText: (row) => (row.rowJSON?.forOtherUsersEnabled ? 'yes' : 'no'),
      renderCell: (row) => {
        const v = byGUID.get(row.rowGUID);
        if (!v) return null;
        const on = v.forOtherUsersEnabled;
        return (
          <Pressable testID={`${testID}-for-others-${v.viewGUID}`} accessibilityRole="checkbox" aria-checked={on} disabled={!v.isMine} onPress={() => { void toggleShare(v); }} hitSlop={6}
            style={styles.checkCell}>
            <View style={[styles.box, { borderColor: on ? c.primary : `${c.text}80`, backgroundColor: on ? c.primary : 'transparent', opacity: v.isMine ? 1 : 0.6 }]}>
              {on ? <Text style={styles.tick}>✓</Text> : null}
            </View>
          </Pressable>
        );
      },
    },
    { key: 'ownerName', title: pmT('Owner'), type: 'text', editable: false, width: 160 },
    { key: 'savedAt', title: pmT('Saved'), type: 'text', editable: false, width: 160 },
    {
      key: 'actions', title: '', type: 'custom', width: 190,
      renderCell: (row) => {
        const v = byGUID.get(row.rowGUID);
        if (!v) return null;
        const asking = confirmDelete === v.viewGUID;
        return (
          <View style={styles.actionsCell}>
            <ButtonApp testID={`${testID}-restore-${v.viewGUID}`} title={pmT('Restore')} icon="restore" variant="outlined" size="small" onPress={() => restore(v)} />
            {v.isMine && (asking
              ? <ButtonApp testID={`${testID}-delete-confirm-${v.viewGUID}`} title={pmT('Delete?')} variant="contained" size="small" danger onPress={() => { void remove(v); }} />
              : <PMIconButton testID={`${testID}-delete-${v.viewGUID}`} icon="delete" title={pmT('Delete View')} color={c.error} onPress={() => setConfirmDelete(v.viewGUID)} />)}
          </View>
        );
      },
    },
  ], [byGUID, confirmDelete, c, restore, remove, toggleShare, testID]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{pmT('Restore View')}</Text>
            <PMIconButton testID={`${testID}-close`} icon="close" title={pmT('Close')} color={c.text} onPress={onClose} />
          </View>
          {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, marginBottom: 6 }}>{error}</Text>}
          {loading && views.length === 0 && <Text testID={`${testID}-loading`} style={{ color: c.text, opacity: 0.6, padding: 8 }}>{pmT('Loading…')}</Text>}
          <View style={{ height: 380 }}>
            <ReusableTable
              testID={`${testID}-table`}
              entityName="reportViews"
              crudListTitle={pmT('Views')}
              itemLabel={pmT('View')}
              localRows={rows}
              onLocalRowsChange={() => {}}
              visualColumns={columns}
              selectionEnabled={false}
              crudPanelEnabled={false}
              addEnabled={false}
              reorderEnabled={false}
              contextMenuEnabled={false}
              emptyText={loading ? pmT('Loading…') : pmT('No saved Views yet. Use View → Save View.')}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 940, maxHeight: '92%', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  checkCell: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 14 },
  actionsCell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
});
