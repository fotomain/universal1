// The player in a modal window: opens, loads the source and starts to play. Closing it unmounts the player (the sound stops).
//   <MediaPlayerModal visible={open} onDismiss={() => setOpen(false)} kind="video" source={post.mediaPostOrigin} />
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import MediaPlayer, { MediaPlayerProps } from './MediaPlayer';

export interface MediaPlayerModalProps extends Omit<MediaPlayerProps, 'testID'> {
  visible: boolean;
  onDismiss: () => void;
}

export default function MediaPlayerModal({ visible, onDismiss, showSourceInput = false, ...player }: MediaPlayerModalProps) {
  const theme = useTheme();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss} testID="media-player-modal">
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close player" testID="media-player-modal-backdrop" />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <IconButton icon="close" onPress={onDismiss} style={styles.close} accessibilityLabel="Close" testID="media-player-modal-close" />
          <MediaPlayer {...player} showSourceInput={showSourceInput} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 680, borderRadius: 20, paddingTop: 4, paddingBottom: 8 },
  close: { alignSelf: 'flex-end', marginBottom: -8, zIndex: 2 },
});
