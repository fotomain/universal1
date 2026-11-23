// The screen after "Create media post" of an ID card / passport: a screen of its own (a full screen modal), everything centred, the OWNER PHOTO above the text.
import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../../../common';
import type { IdDocument } from './emrtd';
import { useFaceImage } from './useFaceImage';

export interface IdCardPostCreatedProps {
  photo: IdDocument['photo'];
  ownerName: string;
  documentNumber: string;
  /** what else was done: where the owner photo went, or why it was not saved */
  note?: string;
  onOpenPosts: () => void;
  onClose: () => void;
  testID?: string;
}

export default function IdCardPostCreated({ photo, ownerName, documentNumber, note, onOpenPosts, onClose, testID = 'id-post' }: IdCardPostCreatedProps) {
  const theme = useTheme();
  const face = useFaceImage(photo);
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} testID={`${testID}-screen`}>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
        {!!face.uri && <Image source={{ uri: face.uri }} style={styles.photo} resizeMode="contain" testID={`${testID}-screen-photo`} />}
        <Text variant="headlineSmall" style={[styles.center, { color: theme.colors.primary }]} testID={`${testID}-screen-title`}>Media post created.</Text>
        {!!ownerName && <Text variant="titleLarge" style={styles.center} testID={`${testID}-screen-owner`}>{ownerName}</Text>}
        {!!documentNumber && <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>{documentNumber}</Text>}
        {!!note && <Text variant="bodyMedium" style={[styles.center, { color: theme.colors.onSurfaceVariant }]} testID={`${testID}-screen-note`}>{note}</Text>}
        <View style={styles.buttons}>
          <ButtonPrimaryApp icon="list_alt" onPress={onOpenPosts} testID={`${testID}-screen-open`}>Media posts</ButtonPrimaryApp>
          <ButtonSecondaryApp onPress={onClose} testID={`${testID}-screen-close`}>Close</ButtonSecondaryApp>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  photo: { width: 240, height: 300, alignSelf: 'center', backgroundColor: '#00000010', marginBottom: 8 },
  center: { textAlign: 'center' },
  buttons: { marginTop: 16, alignItems: 'center', gap: 12 },
});
