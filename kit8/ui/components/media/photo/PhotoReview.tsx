// After the shot: the photo, the looks (changed as often as you like - always from the ORIGINAL file), Save as a media post, Retake.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ButtonPrimaryApp, ButtonSecondaryApp, showErrorModal } from '../../common';
import type { RecordingPost } from '../common/mediaPost';
import PhotoFilterStrip from './PhotoFilterStrip';
import { filterById, isBlackAndWhite } from './photoFilters';
import { useSavePhoto } from './useSavePhoto';

export interface ShotPhoto {
  /** the file the camera made (or the canvas of the browser) */
  uri: string;
  width: number;
  height: number;
  /** the zoom factor it was shot at (1 = main lens) */
  zoomFactor: number;
}

export interface PhotoReviewProps {
  shot: ShotPhoto;
  /** the look chosen before the shot */
  initialFilterId: string;
  /** applyPhotoFilter of the platform */
  apply: (uri: string, filterId: string) => Promise<{ uri: string; width: number; height: number }>;
  onRetake: () => void;
  onSaved?: (post: RecordingPost) => void;
}

export default function PhotoReview({ shot, initialFilterId, apply, onRetake, onSaved }: PhotoReviewProps) {
  const theme = useTheme();
  const router = useRouter();
  const save = useSavePhoto();
  const [filterId, setFilterId] = useState(initialFilterId);
  const [shown, setShown] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<RecordingPost | null>(null);
  /** the newest request wins (a slow look must not replace a newer one) */
  const request = useRef(0);

  useEffect(() => {
    const mine = ++request.current;
    setBusy(true);
    apply(shot.uri, filterId)
      .then((r) => {
        if (mine === request.current) setShown(r);
      })
      .catch((e) => {
        if (mine !== request.current) return;
        showErrorModal(e, 'Photo look');
        setFilterId('original');
      })
      .finally(() => {
        if (mine === request.current) setBusy(false);
      });
  }, [apply, shot.uri, filterId]);

  const doSave = async () => {
    if (!shown) return;
    setSaving(true);
    try {
      const saved = await save(shown, filterById(filterId), shot.zoomFactor);
      setPost(saved);
      onSaved?.(saved);
    } catch (e) {
      showErrorModal(e, 'Save photo');
    } finally {
      setSaving(false);
    }
  };

  const ratio = shown && shown.height > 0 ? shown.width / shown.height : shot.width && shot.height ? shot.width / shot.height : 4 / 3;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="photo-review">
        <Card.Content style={styles.content}>
          <View style={[styles.frame, { aspectRatio: Math.min(Math.max(ratio, 0.5), 2) }]}>
            {shown && <Image source={{ uri: shown.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" testID="photo-review-image" />}
            {busy && (
              <View style={[StyleSheet.absoluteFill, styles.busy]} pointerEvents="none" testID="photo-review-busy">
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
          {post ? (
            <View style={styles.after} testID="photo-review-saved">
              <Text variant="titleMedium" style={{ color: theme.colors.primary }}>Photo saved</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{post.rowJSON.mediaPostTitle}{isBlackAndWhite(filterId) ? ' · black and white' : ''}</Text>
              <View style={styles.buttons}>
                <ButtonPrimaryApp icon="photo_camera" onPress={onRetake} testID="photo-review-again">
                  Take another
                </ButtonPrimaryApp>
                <ButtonSecondaryApp icon="list_alt" onPress={() => router.push('/posts/mediapostcrud' as any)} testID="photo-review-posts">
                  Media posts
                </ButtonSecondaryApp>
              </View>
            </View>
          ) : (
            <>
              <PhotoFilterStrip value={filterId} onChange={setFilterId} disabled={saving} />
              <View style={styles.buttons}>
                <ButtonPrimaryApp icon="check" onPress={doSave} loading={saving} disabled={busy || saving || !shown} testID="photo-review-save">
                  Save
                </ButtonPrimaryApp>
                <ButtonSecondaryApp icon="refresh" onPress={onRetake} disabled={saving} testID="photo-review-retake">
                  Retake
                </ButtonSecondaryApp>
              </View>
            </>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { paddingTop: 16, gap: 8 },
  frame: { width: '100%', maxHeight: 520, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  busy: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  after: { gap: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
