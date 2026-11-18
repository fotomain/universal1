// "Create a media post with this result?" - the offer the scan screens (QR / barcode, NFC) make after a result. A guest is told to sign in.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ButtonPrimaryApp, ButtonSecondaryApp, showErrorModal } from '../../common';
import { useIsSignedIn } from './useWriteMediaPost';

export interface ResultPostOfferProps {
  /** makes the post and resolves when the database took it; throws on a refusal */
  onCreate: () => Promise<unknown>;
  /** the words after "Create media post" for the test ids */
  testID?: string;
}

export default function ResultPostOffer({ onCreate, testID = 'result-post' }: ResultPostOfferProps) {
  const theme = useTheme();
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const create = async () => {
    setState('saving');
    try {
      await onCreate();
      setState('saved');
    } catch (e) {
      showErrorModal(e, 'Create media post');
      setState('idle');
    }
  };

  if (state === 'saved') {
    return (
      <View style={styles.row} testID={`${testID}-saved`}>
        <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>Media post created.</Text>
        <ButtonSecondaryApp icon="list_alt" onPress={() => router.push('/posts/mediapostcrud' as any)} testID={`${testID}-open`}>
          Media posts
        </ButtonSecondaryApp>
      </View>
    );
  }
  if (!signedIn) {
    return (
      <View style={styles.row}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID={`${testID}-guest`}>Sign in to keep this result as a media post.</Text>
        <ButtonSecondaryApp onPress={() => router.push('/user/signin' as any)} testID={`${testID}-signin`}>
          Sign in
        </ButtonSecondaryApp>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <ButtonPrimaryApp icon="post_add" onPress={create} loading={state === 'saving'} disabled={state === 'saving'} testID={`${testID}-create`}>
        Create media post
      </ButtonPrimaryApp>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 },
});
