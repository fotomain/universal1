// The card the Media Posts list had before the sizes existed (MediaPostsNativeList used it as it was): one compact card with the picture, the texts, Play and Delete.
// It is the card of the list while no `reusableCard` is given. It has one size (cardSmall); Delete asks first (the list's own question).
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';
import { mediaPostRows } from '../../../media/common/mediaPostList';
import { CARD_GAP, cardInnerHeight } from '../cardSize';
import type { MediaPostCardProps } from './mediaPostCardTypes';
import { isPersonDocumentRow } from './personDocumentModel';
import { useDoubleTapOpen } from './useDoubleTapOpen';

export default function MediaPostCardDefault({ row, post: given, project, onPlay, onOpenDetails, state }: MediaPostCardProps) {
  const theme = useTheme();
  const item = useMemo(() => given ?? mediaPostRows([row])[0], [given, row]);
  const onCardPress = useDoubleTapOpen(!!onOpenDetails && isPersonDocumentRow(row), () => onOpenDetails?.(row));
  if (!item) return null;
  return (
    <View style={styles.outer}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2} testID={`media-post-${item.id}`}>
        <Pressable onPress={() => { state.actions.markUsed?.(item.id); onCardPress(); }} testID={`media-post-press-${item.id}`}>
        <Card.Content style={styles.row}>
          {!!item.imageUri && <Image source={{ uri: item.imageUri }} style={item.isIdCard ? styles.thumbId : styles.thumb} resizeMode={item.isIdCard ? 'contain' : 'cover'} testID={`media-post-image-${item.id}`} />}
          <View style={styles.texts}>
            <Text variant="titleMedium" numberOfLines={1} testID={`media-post-title-${item.id}`}>{item.title}</Text>
            {!!project?.name && (
              <Text variant="labelMedium" numberOfLines={1} style={{ color: theme.colors.primary }} testID={`media-post-project-${item.id}`}>
                {`Project: ${project.name}${project.readonly ? ' (read-only)' : ''}`}
              </Text>
            )}
            {!!item.subtitle && <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>{item.subtitle}</Text>}
            {!!item.description && <Text variant="bodySmall" numberOfLines={2}>{item.description}</Text>}
          </View>
          {!!item.uris.length && <IconButton icon="play-circle" size={30} onPress={() => onPlay(item)} accessibilityLabel="Play" testID={`media-post-play-${item.id}`} />}
          {state.canDelete ? <IconButton icon="delete" onPress={() => state.actions.remove(item.id)} accessibilityLabel="Delete" testID={`media-post-delete-${item.id}`} /> : null}
        </Card.Content>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { height: cardInnerHeight('cardSmall') + CARD_GAP, paddingHorizontal: 12, paddingVertical: CARD_GAP / 2 },
  card: { flex: 1, borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  texts: { flex: 1, minWidth: 0 },
  /** the owner photo of an ID card / passport: a portrait */
  thumbId: { width: 54, height: 70, borderRadius: 6, marginRight: 12, backgroundColor: '#00000010' },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: '#00000020' },
});
