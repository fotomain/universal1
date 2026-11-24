// ReusableCardMediaPost - the card of a media post in three sizes (cardSmall, cardMedium, cardBig), for ReusableList (`renderItem`) on iOS, Android and the web.
// It adapts to the ORIGIN of the post (mediaPostCardModel): a recording (video / audio, Play opens the player of the Play menu), a photo, a YouTube video (its thumbnail, Open link),
// a web page / PDF / Word / Excel / HTML / text, a person's ID card or passport (the portrait + the data). The local FAB of the card holds the actions of THIS card.
//   cardSmall   as the list always was: a small picture, the title, the line of the post, one line of the description
//   cardMedium  twice the height: a bigger picture, more text
//   cardBig     a wide picture on top (the play button over it), the whole title, the description, the origin and the project at the bottom
import React, { useMemo } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { mediaPostRows, MediaPostRow } from '../../../media/common/mediaPostList';
import CardLocalFab from '../CardLocalFab';
import { CARD_GAP, cardInnerHeight, CardSize } from '../cardSize';
import { DESCRIPTION_LINES, mediaPostCardPicture, mediaPostFabActions, mediaPostOriginKind, ORIGIN_ICON, ORIGIN_NAME, PICTURE_WIDTH, pictureResizeMode } from './mediaPostCardModel';
import type { MediaPostCardProps } from './mediaPostCardTypes';
import { isPersonDocumentRow } from './personDocumentModel';
import { useDoubleTapOpen } from './useDoubleTapOpen';

const BIG_PICTURE_HEIGHT = 180;

function Picture({ post, size, onPlay, testID }: { post: MediaPostRow; size: CardSize; onPlay?: () => void; testID: string }) {
  const theme = useTheme();
  const uri = mediaPostCardPicture(post);
  const kind = mediaPostOriginKind(post);
  const big = size === 'cardBig';
  const box = big ? { width: '100%' as const, height: BIG_PICTURE_HEIGHT } : { width: PICTURE_WIDTH[size], height: size === 'cardSmall' ? 72 : '100%' as const };
  return (
    <View style={[styles.picture, box, { backgroundColor: theme.colors.surfaceVariant }, !big && styles.pictureRounded]} testID={`${testID}-picture`}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={pictureResizeMode(post)} testID={`media-post-image-${post.id}`} />
        : <MaterialCommunityIcons name={ORIGIN_ICON[kind] as any} size={big ? 64 : size === 'cardMedium' ? 48 : 32} color={theme.colors.onSurfaceVariant} />}
      {onPlay ? (
        <Pressable style={styles.playWrap} onPress={onPlay} accessibilityLabel="Play" testID={`media-post-play-${post.id}`}>
          <View style={[styles.play, big && styles.playBig]}><MaterialCommunityIcons name="play" size={big ? 40 : 22} color="#fff" /></View>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ReusableCardMediaPost({ row, cardSize, state, post: given, project, onPlay, onOpenDetails, testID = 'media-post' }: MediaPostCardProps) {
  const theme = useTheme();
  const post = useMemo(() => given ?? mediaPostRows([row])[0], [given, row]);
  // a person's ID card / passport: a double click / double touch opens its read only details
  const onCardPress = useDoubleTapOpen(!!onOpenDetails && isPersonDocumentRow(row), () => onOpenDetails?.(row));
  if (!post) return null;
  const kind = mediaPostOriginKind(post);
  const playable = post.uris.length > 0;
  const big = cardSize === 'cardBig';
  const small = cardSize === 'cardSmall';
  const lines = DESCRIPTION_LINES[cardSize];
  const a = state.actions;
  const play = () => { state.actions.markUsed?.(post.id); onPlay(post); };
  const openLink = () => { Linking.openURL(post.originUrl).catch(() => undefined); };
  const actions = mediaPostFabActions(post, { canAdd: state.canAdd, canDelete: state.canDelete, canOpen: state.canOpen, canEdit: state.canEdit, playable, hasLink: !!post.originUrl }, {
    play, openLink, edit: () => a.edit(post.id), createBefore: () => a.createBefore(post.id), createAfter: () => a.createAfter(post.id), duplicate: () => a.duplicate(post.id),
    moveUp: () => a.moveUp(post.id), moveDown: () => a.moveDown(post.id), remove: () => a.remove(post.id),
  }, theme.colors.error);
  const fab = actions.length > 0 ? <CardLocalFab id={post.id} actions={actions} size={small ? 'small' : 'medium'} testID={`media-post-fab-${post.id}`} /> : null;
  const projectLine = project?.name ? (
    <Text variant="labelMedium" numberOfLines={1} style={{ color: theme.colors.primary }} testID={`media-post-project-${post.id}`}>{`Project: ${project.name}${project.readonly ? ' (read-only)' : ''}`}</Text>
  ) : null;
  const texts = (
    <>
      <Text variant={big ? 'titleLarge' : 'titleMedium'} numberOfLines={big || cardSize === 'cardMedium' ? 2 : 1} testID={`media-post-title-${post.id}`}>{post.title}</Text>
      {projectLine}
      {post.subtitle ? <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }} testID={`media-post-subtitle-${post.id}`}>{post.subtitle}</Text> : null}
      {post.description ? <Text variant="bodySmall" numberOfLines={lines} style={styles.description} testID={`media-post-description-${post.id}`}>{post.description}</Text> : null}
    </>
  );
  const badge = <Text variant="labelSmall" style={[styles.badge, { color: theme.colors.primary, borderColor: theme.colors.primary }]} testID={`media-post-origin-${post.id}`}>{ORIGIN_NAME[kind]}</Text>;

  return (
    <View style={[styles.outer, { height: cardInnerHeight(cardSize) + CARD_GAP }]}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2} testID={`${testID}-${post.id}`}>
        <Pressable style={styles.shell} onPress={() => { state.actions.markUsed?.(post.id); onCardPress(); }} testID={`${testID}-${post.id}-press`}>
          {state.grip ? <View style={styles.grip}>{state.grip}</View> : null}
          {big ? (
            <View style={styles.bigColumn}>
              <Picture post={post} size={cardSize} onPlay={playable ? play : undefined} testID={`${testID}-${post.id}`} />
              <View style={styles.bigBody}>{texts}</View>
              <View style={styles.bigFooter}>{badge}<View style={styles.fill} />{fab}</View>
            </View>
          ) : (
            <View style={styles.rowContent}>
              <Picture post={post} size={cardSize} onPlay={playable ? play : undefined} testID={`${testID}-${post.id}`} />
              <View style={styles.texts}>
                {texts}
                {!small ? <View style={styles.mediumFooter}>{badge}</View> : null}
              </View>
              {fab ? <View style={small ? styles.fabSmall : styles.fabMedium}>{fab}</View> : null}
            </View>
          )}
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 12, paddingVertical: CARD_GAP / 2 },
  card: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  shell: { flex: 1, flexDirection: 'row' },
  grip: { justifyContent: 'center', zIndex: 5 },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10, minWidth: 0 },
  texts: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' },
  description: { marginTop: 2 },
  picture: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pictureRounded: { borderRadius: 10 },
  playWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  play: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  playBig: { width: 64, height: 64, borderRadius: 32 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  mediumFooter: { marginTop: 4 },
  fabSmall: { alignSelf: 'center' },
  fabMedium: { alignSelf: 'flex-end' },
  bigColumn: { flex: 1, minWidth: 0 },
  bigBody: { flex: 1, paddingHorizontal: 12, paddingTop: 8, minHeight: 0, overflow: 'hidden' },
  bigFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 },
  fill: { flex: 1 },
});
