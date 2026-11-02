// Monitor01SaveViewModal - View → Save View: the window that saves the CURRENT settings of the report (the checked fields, the date filters, the tab ...) as a named View.
//   ReportViewTitle        obligatory; the same title of the same user REPLACES that View (the window says so before, and the button says "Replace")
//   For other users enabled  the users of the same organization see the View in Restore View and can restore it (they cannot change it)
// The View is kept by report_view_save (project_report_settings, kit8/sql/start PART 43).
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import { pmT } from '../../i18n/pmT';
import { REPORT_VIEW_TITLE_MAX, ReportViewRow, cleanReportViewTitle, listReportViews, ownViewWithTitle, saveReportView } from './monitor01ReportViews';
import type { Monitor01ReportSettings } from './monitor01Fields';

export interface Monitor01SaveViewModalProps {
  visible: boolean;
  onClose: () => void;
  reportGUID: string;
  /** the settings of the report NOW (read when Save is pressed) */
  getSettings: () => Monitor01ReportSettings;
  /** the title the window starts with (the View that was restored or saved last) */
  suggestTitle?: string;
  /** the View was saved */
  onSaved?: (title: string, viewGUID: string) => void;
  testID?: string;
}

export default function Monitor01SaveViewModal({ visible, onClose, reportGUID, getSettings, suggestTitle = '', onSaved, testID = 'monitor01-save-view' }: Monitor01SaveViewModalProps) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  // the client is read when a call is made - a new client object (a re-render of the provider) must not reload the window
  const client = useRef(supabase);
  client.current = supabase;
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [forOthers, setForOthers] = useState(false);
  const [views, setViews] = useState<ReportViewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // opening: the title of the last View, the switch of that View (or off), and the Views of the user - to know what a Save would replace
  useEffect(() => {
    if (!visible) return;
    setTitle(suggestTitle);
    setError(null);
    setSaving(false);
    let alive = true;
    listReportViews(client.current, reportGUID).then((list) => {
      if (!alive) return;
      setViews(list);
      const own = ownViewWithTitle(list, suggestTitle);
      setForOthers(own ? own.forOtherUsersEnabled : false);
    }).catch(() => { if (alive) setViews([]); });
    return () => { alive = false; };
  }, [visible, suggestTitle, reportGUID]);

  const clean = cleanReportViewTitle(title);
  const replaces = !!clean && !!ownViewWithTitle(views, clean);
  const save = async () => {
    if (!clean || saving) return;
    setSaving(true);
    setError(null);
    try {
      const guid = await saveReportView(client.current, reportGUID, clean, getSettings(), forOthers);
      dispatch(showSnackbar({ message: pmT('View "{{title}}" saved', { title: clean }) }));
      onSaved?.(clean, guid);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
      setSaving(false);
    }
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{pmT('Save View')}</Text>
            <PMIconButton testID={`${testID}-close`} icon="close" title={pmT('Close')} color={c.text} onPress={onClose} />
          </View>
          <Text style={{ color: c.text, opacity: 0.7, fontSize: 12, marginBottom: 10 }}>{pmT('Saves the checked fields, the date filters and the other settings of the report now.')}</Text>
          <TextInputApp testID={`${testID}-title`} label={pmT('ReportViewTitle')} value={title} onChangeText={setTitle} maxLength={REPORT_VIEW_TITLE_MAX} autoFocus onSubmitEditing={() => { void save(); }} />
          {replaces && <Text testID={`${testID}-replace`} style={{ color: c.primary, fontSize: 12, marginTop: 4 }}>{pmT('You have a View with this title: Save replaces it.')}</Text>}
          <View style={styles.switchRow}>
            <SwitchApp testID={`${testID}-for-others`} value={forOthers} onValueChange={setForOthers} />
            <Text style={{ color: c.text, fontSize: 14 }}>{pmT('For other users enabled')}</Text>
          </View>
          <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('The users of your organization can restore this View, but not change it.')}</Text>
          {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, marginTop: 8 }}>{error}</Text>}
          <View style={styles.actions}>
            <PMDialogButton testID={`${testID}-cancel`} kind="secondary" title="Cancel" color={c.text} onPress={onClose} />
            <PMDialogButton testID={`${testID}-save`} kind="primary" title={replaces ? 'Replace' : 'Save'} disabled={!clean || saving} loading={saving} onPress={() => { void save(); }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 460, borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
});
