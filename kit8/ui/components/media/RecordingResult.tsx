// Shown after a recording was kept: what was saved, play it (the reusable player in a modal), go to the media posts.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../common';
import MediaPlayerModal from './MediaPlayerModal';
import { playableUrisOfPost, RecordingPost } from './mediaPost';
import { formatDuration, MediaKind } from './mediaSource';

export interface RecordingResultProps {
  kind: MediaKind;
  post: RecordingPost;
  onRecordAgain: () => void;
}

export default function RecordingResult({ kind, post, onRecordAgain }: RecordingResultProps) {
  const theme = useTheme();
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const json = post.rowJSON;
  const parts = Array.isArray(json.mediaSegments) ? json.mediaSegments.length : 1;

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="recording-result">
      <Card.Title title="Recording saved" titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }} />
      <Card.Content>
        <Text variant="titleMedium" testID="recording-result-title">{json.mediaPostTitle}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {formatDuration(json.mediaDurationSec)} · {kind === 'video' ? (json.mediaWithAudio ? 'with sound' : 'without sound') : 'audio'}
          {parts > 1 ? ` · ${parts} parts` : ''}
        </Text>
        <View style={styles.buttons}>
          <ButtonPrimaryApp icon="play_arrow" onPress={() => setPlaying(true)} testID="recording-result-play">
            Play
          </ButtonPrimaryApp>
          <ButtonSecondaryApp icon="list_alt" onPress={() => router.push('/posts/mediapostcrud' as any)} testID="recording-result-posts">
            Media posts
          </ButtonSecondaryApp>
          <ButtonSecondaryApp icon="fiber_manual_record" onPress={onRecordAgain} testID="recording-result-again">
            Record again
          </ButtonSecondaryApp>
        </View>
      </Card.Content>
      <MediaPlayerModal visible={playing} onDismiss={() => setPlaying(false)} kind={kind} source={playableUrisOfPost(json)} title={json.mediaPostTitle} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
});
