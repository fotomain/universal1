// Recordings (audio / video) are for SIGNED-IN users only: a recording becomes a post of the user's account and its files belong to the storage of the user's
// organization (organizationTable.rowJSON.organizationFilesStorageProvider: Google Drive | Microsoft OneDrive, set in Organization edit -> Files).
// A guest sees this card instead of the recorder: Sign in, or Sign in and then set up the file storage. Mounted by app/media/record/{audio,video}.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../common';

/** where the user lands after the sign in to connect the storage: the organization list (edit -> tab Files) */
export const FILE_STORAGE_SETUP_ROUTE = '/catalog/organization';

export interface RecordingSignInGateProps {
  /** the route of the recorder: the sign in comes back to it */
  returnTo: string;
  kind: 'audio' | 'video';
  children: React.ReactNode;
}

export default function RecordingSignInGate({ returnTo, kind, children }: RecordingSignInGateProps) {
  const signedIn = useSelector(selectIsLoggedIn);
  const router = useRouter();
  const theme = useTheme();
  if (signedIn) return <>{children}</>;
  const signIn = (back: string) => router.push({ pathname: '/user/signin', params: { returnTo: back } } as any);
  return (
    <ScrollView contentContainerStyle={styles.content} testID="recording-signin-gate">
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.body}>
          <Text variant="titleLarge" testID="recording-signin-title">Sign in to record {kind === 'video' ? 'video' : 'audio'}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Recordings are kept in your account and in the file storage of your organization (Google Drive or Microsoft OneDrive), so only signed-in users can make them.
          </Text>
          <View style={styles.buttons}>
            <ButtonPrimaryApp testID="recording-signin-button" onPress={() => signIn(returnTo)}>Sign in</ButtonPrimaryApp>
            <ButtonSecondaryApp testID="recording-signin-storage-button" onPress={() => signIn(FILE_STORAGE_SETUP_ROUTE)}>Sign in and connect the file storage</ButtonSecondaryApp>
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
