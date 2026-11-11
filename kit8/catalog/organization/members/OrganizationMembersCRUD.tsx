// OrganizationMembersCRUD - "Catalogs -> Organization members": who is a member of the active organization (organizationMemberTable), a ReusableTable.
//   The administrator invites an e-mail (the "Invite" row above the table: the member row is saved, then the invitation e-mail is sent by the Supabase function organization-invite),
//   marks other members as administrators, switches "Person at first login", removes a member, and creates the person of a member from the row menu.
//   A member who is no administrator sees his own row only, read only. The rules (nobody deletes himself, the organization keeps an administrator ...) are in the database.
//   SQL: PART 45 of kit8/sql/start. Route: /catalog/organization/members
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../../redux/activeUserSlice';
import IconApp from '../../../ui/components/common/IconApp';
import { ButtonPrimaryApp, SwitchApp, TextInputApp } from '../../../ui/components/common';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import { pmT } from '../../../pm/i18n/pmT';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import {
  canSendInvitation, formatMemberDate, inviteRowOf, isAdministratorIn, isValidMemberEmail, memberEmail, memberStatusLabel, memberStatusOf, membersOfOrganization,
  ORGANIZATION_MEMBER_TABLE,
} from './organizationMemberModel';
import { sendInvitation } from './inviteMember';
import AssignmentsEditor from '../../../permissions/AssignmentsEditor';
import { CREATE_PROJECT_PROFILES } from '../../../permissions/permissionModel';
import { useOrganizationMembers } from './useOrganizationMembers';

export default function OrganizationMembersCRUD({ testID = 'organization-members' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const myEmail: string = useSelector((s: any) => s?.activeUserState?.activeUserEmail) || '';
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const def = ORGANIZATION_MEMBER_TABLE;
  const { rows, loaded, error, reload } = useOrganizationMembers(true);
  const mine = useMemo(() => membersOfOrganization(rows, organizationGUID), [rows, organizationGUID]);
  const isAdmin = useMemo(() => isAdministratorIn(rows, organizationGUID, myEmail), [rows, organizationGUID, myEmail]);

  const [email, setEmail] = useState('');
  const [createPerson, setCreatePerson] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const invite = useCallback(async () => {
    if (!isValidMemberEmail(email)) { setMessage({ kind: 'error', text: pmT('Enter an e-mail like name@company.com') }); return; }
    setBusy(true);
    try {
      const { data, error: e } = await (supabase as any).from(def.table).insert(inviteRowOf(organizationGUID, email, createPerson)).select('rowGUID,rowParentGUID').single();
      if (e) throw e;
      setEmail('');
      reload();
      if (data?.rowParentGUID === 'empty') {
        const sent = await sendInvitation(supabase, data.rowGUID);
        setMessage(sent.ok ? { kind: 'ok', text: pmT('Invited') } : { kind: 'error', text: sent.error });
      } else {
        setMessage({ kind: 'ok', text: pmT('Active') });
      }
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  }, [email, createPerson, supabase, def.table, organizationGUID, reload]);

  const rowAction = useCallback(async (run: () => Promise<{ error?: any } | any>, okText: string) => {
    try {
      const res: any = await run();
      if (res?.error) throw res.error;
      if (res?.ok === false) throw new Error(res.error);
      setMessage({ kind: 'ok', text: okText });
      reload();
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || String(e) });
    }
  }, [reload]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'email', title: pmT('E-mail'), type: 'text', field: 'userEmailForInvitation', editable: false, width: 320 },
    { key: 'status', title: pmT('Status'), type: 'text', field: 'memberStatus', editable: false, width: 120, fromStored: (v: any) => pmT(memberStatusLabel(v === 'active' ? 'active' : 'invited')) },
    { key: 'admin', title: pmT('Administrator'), type: 'boolean', field: 'organizationAdministrator', width: 140, editable: isAdmin },
    { key: 'person', title: pmT('Person at first login'), type: 'boolean', field: 'autoCreatePerson', width: 190, editable: isAdmin },
    { key: 'invitedAt', title: pmT('Invited at'), type: 'text', field: 'invitedAt', editable: false, width: 160, fromStored: (v: any) => formatMemberDate(v) },
    { key: 'registeredAt', title: pmT('First session'), type: 'text', field: 'registeredAt', editable: false, width: 160, fromStored: (v: any) => formatMemberDate(v) },
  ], [isAdmin]);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="group" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>{pmT('Organization members')}</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{def.purpose} · {mine.length}</Text>
        </View>
        <PMIconButton tipScope="app" testID={`${testID}-reload`} icon="refresh" title="Read the members again" color={c.text} onPress={reload} />
      </View>

      {isAdmin ? (
        <View testID={`${testID}-invite`} style={[styles.invite, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <TextInputApp testID={`${testID}-invite-email`} label={pmT('E-mail to invite')} value={email} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} />
          </View>
          <SwitchApp testID={`${testID}-invite-person`} label={pmT('Make a person at the first login')} value={createPerson} onValueChange={setCreatePerson} />
          <ButtonPrimaryApp testID={`${testID}-invite-button`} title={pmT('Invite')} onPress={invite} disabled={busy} />
        </View>
      ) : loaded ? (
        <View testID={`${testID}-readonly`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
          <IconApp name="info" size={18} color={c.text} />
          <Text style={{ color: c.text, flex: 1 }}>{pmT('Only the administrator of the organization can add or change members.')}</Text>
        </View>
      ) : null}
      {!!message && (
        <View testID={`${testID}-message`} style={[styles.note, { borderColor: (message.kind === 'error' ? c.error : c.primary) + '66', backgroundColor: (message.kind === 'error' ? c.error : c.primary) + '0f' }]}>
          <IconApp name={message.kind === 'error' ? 'error' : 'check_circle'} size={18} color={message.kind === 'error' ? c.error : c.primary} />
          <Text style={{ color: c.text, flex: 1 }}>{message.text}</Text>
        </View>
      )}
      {!!error && (
        <View testID={`${testID}-setup`} style={[styles.note, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>The members could not be read ({error}). Run kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql (PART 45) in the Supabase SQL editor and sign in.</Text>
        </View>
      )}

      {isAdmin && !!organizationGUID && (
        <View testID={`${testID}-create-projects`} style={[styles.invite, { borderColor: c.border, backgroundColor: c.surface, flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text style={{ color: c.text, fontWeight: '700' }}>{pmT('May create projects')}</Text>
          <AssignmentsEditor testID={`${testID}-create-projects-editor`} ownerGUID={organizationGUID} organizationGUID={organizationGUID} profiles={CREATE_PROJECT_PROFILES}
            hint={pmT('Project manager or curator given for the whole organization: this member may create projects. The administrator always may.')} />
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName={def.entity}
          crudListTitle={pmT('Organization members')}
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          rowFilter={(row: any) => row.rowOwnerGUID === organizationGUID}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          addEnabled={false}
          resizeColumnWidth
          realtime
          emptyText={loaded ? pmT('No members yet.') : pmT('Loading…')}
          extraMenuItems={(row: any, close: () => void) => isAdmin ? [
            { testID: `${testID}-person-${row.rowGUID}`, label: pmT('Create person'), icon: 'person_add',
              onPress: () => { close(); void rowAction(() => (supabase as any).rpc('organization_member_create_person', { p_member: row.rowGUID }), `${pmT('Create person')}: ${memberEmail(row)}`); } },
            ...(canSendInvitation(row) ? [{ testID: `${testID}-resend-${row.rowGUID}`, label: pmT('Send invitation again'), icon: 'forward_to_inbox',
              onPress: () => { close(); void rowAction(() => sendInvitation(supabase, row.rowGUID), `${pmT('Invited')}: ${memberEmail(row)}`); } }] : []),
          ] : []}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  invite: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 16, paddingBottom: 12, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
});
