// CreateUserFromIDDocumentButton - on the screen "Media post created." of an ID card / passport, before Close: makes the USER of the document.
//   e-mail  = <first given name>.<surname>@<domain of the signed-in user's e-mail>   (idUserEmail.ts)
//   member  = a member of the active organization (organizationMemberTable) + the invitation e-mail (createUserFromIdDocument.ts)
// After it the button reads "User created." and stays off. Only an administrator of the organization may add members: the database says no to anybody else and the text under the button says why.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { ButtonSecondaryApp } from '../../../common';
import { createUserFromIdDocument } from './createUserFromIdDocument';
import { userEmailFromIdDocument } from './idUserEmail';

export interface CreateUserFromIDDocumentButtonProps {
  givenNames: string;
  surname: string;
  width?: number;
  testID?: string;
  /** replaceable for tests */
  create?: typeof createUserFromIdDocument;
}

/** the Supabase client; a screen without the provider (a test) gets null. Loaded when the button is drawn: the data layer is not pulled into the ID reader screens that never show it. */
function useClient(): any {
  try { return (require('../../../../../providers/WithSupabase').useSupabase() as any)?.supabase ?? null; } catch { return null; }
}
/** the ACTIVE organization of the signed-in user (activeUserSlice.selectUserOrganizationGUID; written here so that the slice - redux-persist, AsyncStorage - is not imported) */
const organizationOf = (state: any): string => state?.activeUserState?.userOrganization?.rowGUID || '';

export default function CreateUserFromIDDocumentButton({ givenNames, surname, width, testID = 'create-user-from-id', create = createUserFromIdDocument }: CreateUserFromIDDocumentButtonProps) {
  const theme = useTheme();
  const supabase = useClient();
  const organizationGUID: string = useSelector(organizationOf);
  const activeEmail: string = useSelector((s: any) => s?.activeUserState?.activeUserEmail) || '';
  const email = useMemo(() => userEmailFromIdDocument(givenNames, surname, activeEmail), [givenNames, surname, activeEmail]);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'exists'>('idle');
  const [note, setNote] = useState('');

  const press = async () => {
    if (!email || state === 'busy') return;
    setState('busy');
    setNote('');
    const r = await create({ supabase, organizationGUID, email });
    if (!r.ok) { setState('idle'); setNote(r.error); return; }
    setState(r.status === 'exists' ? 'exists' : 'done');
    if (r.status === 'created' && r.inviteError) setNote(`The invitation e-mail was not sent: ${r.inviteError}`);
  };

  const title = state === 'done' ? 'User created.' : state === 'exists' ? 'User already exists.' : state === 'busy' ? 'Creating the user…' : 'Create user';
  return (
    <View style={styles.box}>
      <ButtonSecondaryApp width={width} icon={state === 'done' || state === 'exists' ? 'check' : 'person_add'} onPress={press} disabled={!email || state !== 'idle'} testID={testID}>{title}</ButtonSecondaryApp>
      {email ? <Text variant="bodySmall" style={[styles.text, { color: theme.colors.onSurfaceVariant }]} testID={`${testID}-email`}>{email}</Text>
        : <Text variant="bodySmall" style={[styles.text, { color: theme.colors.onSurfaceVariant }]} testID={`${testID}-no-email`}>No e-mail can be made: the document has no name, or you are not signed in.</Text>}
      {note ? <Text variant="bodySmall" style={[styles.text, { color: theme.colors.error }]} testID={`${testID}-note`}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 4 },
  text: { textAlign: 'center', maxWidth: 300 },
});
