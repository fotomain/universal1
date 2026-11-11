// AssignmentsEditor - who holds which permission profile (project_permission_profile_user_table, SQL PART 46). Used twice:
//   * Project settings -> Members:  ownerGUID = the project, the profiles a project manager / administrator may give by hand (ASSIGNABLE_PROFILES)
//   * Organization members -> "May create projects":  ownerGUID = the organization, only permissionProjectManager / permissionProjectCurator (CREATE_PROJECT_PROFILES)
// The database decides who may write (RLS + the guard trigger): a refusal is shown in words. The list is read with the user's own rights.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { useSupabase } from '../providers/WithSupabase';
import ButtonApp from '../ui/components/common/ButtonApp';
import IconApp from '../ui/components/common/IconApp';
import SelectItemFromListApp from '../ui/components/common/SelectItemFromListApp';
import { pmT } from '../pm/i18n/pmT';
import { PROFILE_TITLES } from './permissionModel';
import { permissionRefusalText } from './permissionText';

export const ASSIGNMENT_TABLE = 'project_permission_profile_user_table';
const MEMBER_TABLE = 'organizationMemberTable';

export interface AssignmentRow {
  rowGUID: string;
  userGUID: string;
  profile: string;
  automatic: boolean;
}

/** the rows of the assignment table as the list shows them (pure) */
export function assignmentRowsOf(raw: any[] | null | undefined): AssignmentRow[] {
  return (raw || [])
    .filter((r) => !!r)
    .map((r) => ({ rowGUID: String(r.rowGUID), userGUID: String(r.rowParentGUID), profile: String(r.rowJSON?.permissionProfileGUID ?? ''), automatic: r.rowJSON?.permissionAutomatic === true }))
    .filter((r) => r.profile)
    .sort((a, b) => a.userGUID.localeCompare(b.userGUID) || a.profile.localeCompare(b.profile));
}

/** the active members that have a user (an invited member has none yet), as { userGUID: e-mail } */
export function memberEmailsOf(raw: any[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw || []) {
    if (m?.rowJSON?.memberStatus === 'active' && m.rowParentGUID && m.rowParentGUID !== 'empty') out[String(m.rowParentGUID)] = String(m.rowJSON?.userEmailForInvitation || m.rowParentGUID);
  }
  return out;
}

export interface AssignmentsEditorProps {
  ownerGUID: string;
  organizationGUID: string;
  profiles: readonly string[];
  /** false: the list only shows (the database refuses a write anyway) */
  canEdit?: boolean;
  hint?: string;
  testID?: string;
}

export default function AssignmentsEditor({ ownerGUID, organizationGUID, profiles, canEdit = true, hint, testID = 'permission-assignments' }: AssignmentsEditorProps) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [user, setUser] = useState<string | null>(null);
  const [profile, setProfile] = useState<string>(profiles[0]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ownerGUID) return;
    try {
      const a: any = await (supabase as any).from(ASSIGNMENT_TABLE).select('rowGUID,rowParentGUID,rowJSON').eq('rowOwnerGUID', ownerGUID);
      if (a.error) throw a.error;
      setRows(assignmentRowsOf(a.data));
      if (organizationGUID) {
        const m: any = await (supabase as any).from(MEMBER_TABLE).select('rowParentGUID,rowJSON').eq('rowOwnerGUID', organizationGUID);
        if (!m.error) setEmails(memberEmailsOf(m.data));
      }
    } catch (e: any) {
      setMessage({ kind: 'error', text: permissionRefusalText(e) || e?.message || String(e) });
    }
  }, [supabase, ownerGUID, organizationGUID]);

  useEffect(() => { void load(); }, [load]);

  const userItems = useMemo(() => Object.entries(emails).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)), [emails]);
  const profileItems = useMemo(() => profiles.map((p) => ({ value: p, label: pmT(PROFILE_TITLES[p] ?? p) })), [profiles]);

  const run = useCallback(async (job: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      const res = await job();
      if (res?.error) throw res.error;
      setMessage({ kind: 'ok', text: ok });
      await load();
    } catch (e: any) {
      setMessage({ kind: 'error', text: permissionRefusalText(e) || e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  }, [load]);

  const add = () => {
    if (!user || !profile) { setMessage({ kind: 'error', text: pmT('Pick a member and a profile.') }); return; }
    void run(() => (supabase as any).from(ASSIGNMENT_TABLE).insert({ rowOwnerGUID: ownerGUID, rowParentGUID: user, rowJSON: { permissionProfileGUID: profile } }), pmT('Saved'));
  };
  const remove = (r: AssignmentRow) => run(() => (supabase as any).from(ASSIGNMENT_TABLE).delete().eq('rowGUID', r.rowGUID), pmT('Removed'));

  return (
    <View testID={testID} style={styles.root}>
      {!!hint && <Text style={[styles.hint, { color: c.text }]}>{hint}</Text>}
      {canEdit && (
        <View testID={`${testID}-add`} style={[styles.add, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ minWidth: 220, flex: 1 }}>
            <SelectItemFromListApp testID={`${testID}-user`} items={userItems} value={user} onSelect={setUser} placeholder={pmT('Member')} />
          </View>
          <View style={{ minWidth: 200, flex: 1 }}>
            <SelectItemFromListApp testID={`${testID}-profile`} items={profileItems} value={profile} onSelect={setProfile} placeholder={pmT('Profile')} />
          </View>
          <ButtonApp testID={`${testID}-add-button`} title={pmT('Give')} icon="add" size="small" disabled={busy} onPress={add} />
        </View>
      )}
      {!!message && (
        <View testID={`${testID}-message`} style={[styles.note, { borderColor: (message.kind === 'error' ? c.error : c.primary) + '66' }]}>
          <IconApp name={message.kind === 'error' ? 'error' : 'check_circle'} size={18} color={message.kind === 'error' ? c.error : c.primary} />
          <Text style={{ color: c.text, flex: 1 }}>{message.text}</Text>
        </View>
      )}
      {rows.length === 0 ? (
        <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6, paddingVertical: 8 }}>{pmT('Nobody has a profile here yet.')}</Text>
      ) : rows.map((r) => (
        <View key={r.rowGUID} testID={`${testID}-row-${r.rowGUID}`} style={[styles.row, { borderColor: c.border }]}>
          <IconApp name="person" size={18} color={c.text} />
          <Text style={{ color: c.text, flex: 2 }} numberOfLines={1}>{emails[r.userGUID] ?? r.userGUID}</Text>
          <Text style={{ color: c.text, flex: 2, fontWeight: '600' }} numberOfLines={1}>{pmT(PROFILE_TITLES[r.profile] ?? r.profile)}{r.automatic ? ` · ${pmT('automatic')}` : ''}</Text>
          {canEdit && <ButtonApp testID={`${testID}-remove-${r.rowGUID}`} title={pmT('Remove')} icon="delete" variant="text" danger size="small" disabled={busy} onPress={() => { void remove(r); }} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 8, gap: 8 },
  hint: { fontSize: 12, opacity: 0.7 },
  add: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderWidth: 1, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});
