// Recordings (audio / video / photo) AND scans (QR / barcode, NFC, ID card / passport) are for SIGNED-IN users only: a recording becomes a post of the user's account and its files belong to the storage of the user's
// organization (organizationTable.rowJSON.organizationFilesStorageProvider: Google Drive | Microsoft OneDrive, set in Organization edit -> Files).
// A guest sees this card instead of the recorder / the scanner: Sign in, or (recordings) Sign in and then set up the file storage. Mounted by app/media/record/{audio,video,photo}, app/media/scan, app/media/nfc/{index,identification,iddocread}.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../../../../redux/activeUserSlice';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../../common';

/** where the user lands after the sign in to connect the storage: the organization list (edit -> tab Files) */
export const FILE_STORAGE_SETUP_ROUTE = '/catalog/organization';

export type RecordingGateKind = 'audio' | 'video' | 'photo' | 'scan' | 'nfc' | 'identification' | 'idcard';

const RECORD_KINDS: RecordingGateKind[] = ['audio', 'video', 'photo'];

/** the title of the card for a kind */
export function signInGateTitle(kind: RecordingGateKind): string {
  switch (kind) {
    case 'photo': return 'Sign in to take photos';
    case 'video': return 'Sign in to record video';
    case 'audio': return 'Sign in to record audio';
    case 'scan': return 'Sign in to scan codes';
    case 'nfc': return 'Sign in to read NFC tags';
    case 'identification': return 'Sign in to identify with an ID card or passport';
    case 'idcard': return 'Sign in to read an ID card or passport';
  }
}

const RECORD_TEXT = 'Recordings and photos are kept in your account and in the file storage of your organization (Google Drive or Microsoft OneDrive), so only signed-in users can make them.';
const SCAN_TEXT = 'Scanning is only for signed-in users: the result belongs to your account, so please sign in first.';

export interface RecordingSignInGateProps {
  /** the route of the recorder: the sign in comes back to it */
  returnTo: string;
  kind: RecordingGateKind;
  children: React.ReactNode;
}

export default function RecordingSignInGate({ returnTo, kind, children }: RecordingSignInGateProps) {
  const signedIn = useSelector(selectIsLoggedIn);
  const router = useRouter();
  const theme = useTheme();
  if (signedIn) return <>{children}</>;
  const isRecord = RECORD_KINDS.includes(kind);
  const signIn = (back: string) => router.push({ pathname: '/user/signin', params: { returnTo: back } } as any);
  return (
    <ScrollView contentContainerStyle={styles.content} testID="recording-signin-gate">
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.body}>
          <Text variant="titleLarge" testID="recording-signin-title">{signInGateTitle(kind)}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {isRecord ? RECORD_TEXT : SCAN_TEXT}
          </Text>
          <View style={styles.buttons}>
            <ButtonPrimaryApp testID="recording-signin-button" onPress={() => signIn(returnTo)}>Sign in</ButtonPrimaryApp>
            {isRecord && <ButtonSecondaryApp testID="recording-signin-storage-button" onPress={() => signIn(FILE_STORAGE_SETUP_ROUTE)}>Sign in and connect the file storage</ButtonSecondaryApp>}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  card: { borderRadius: 16 },
  body: { gap: 12 },
  buttons: { gap: 8 },
});
