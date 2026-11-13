// The Media Posts list for iOS / Android (route /posts/mediapostcrud, app/posts/mediapostcrud/index.native.tsx).
// The web list is built from browser tags (div, span) and shows the red "View config getter for component div" screen on a phone.
// This one is small: the posts of the user, newest first, Play (with the date and time stamp) and Delete (asks first).
import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { mediaPostOwnerGUID } from '../../../redux/mediaPostOwner';
import MediaPlayerModal from './MediaPlayerModal';
import { mediaPostRows, MediaPostRow } from './mediaPostList';
import { deleteFileRow } from '../../../files/common/filesDriveApi';
import { readonlyDeleteMessageOf } from './mediaPostProject';
import { useMediaPostProjects } from './useMediaPostProjects';

export const MEDIA_POSTS_ENTITY = 'mediaPostReusable';

export default function MediaPostsNativeList() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const ownerGUID = useSelector(mediaPostOwnerGUID);
  const serverRows = useSelector((state: any) => state?.[MEDIA_POSTS_ENTITY]?.entityDataFromServer);
  const rows = useMemo(() => mediaPostRows(serverRows), [serverRows]);
  const projects = useMediaPostProjects(serverRows);
  const [playing, setPlaying] = React.useState<MediaPostRow | null>(null);

  // read when the screen is shown (a recording was just saved, or the user comes back)
  useFocusEffect(
    useCallback(() => {
      const actions = (SystemMetaData as any)[MEDIA_POSTS_ENTITY]?.actions;
      if (actions?.readData && ownerGUID) {
        dispatch(actions.readData({ paginationSize: 50, originationCurrentPage: 0, readAllFilter: '', rowOwnerGUID: ownerGUID, rowParentGUID: 'empty' }));
      }
    }, [dispatch, ownerGUID]),
  );

  const remove = (row: MediaPostRow) => {
    Alert.alert('Delete this post?', row.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const actions = (SystemMetaData as any)[MEDIA_POSTS_ENTITY]?.actions;
          if (row.isFileRow) {
            // a file of the Files tab: the table refuses a plain DELETE (no error, 0 rows - the card would only disappear from the screen);
            // the files-drive function deletes the row AND the file in the storage, then the card is taken off the list
            deleteFileRow(row.id).then((r) => {
              if (r.ok) actions?.deleteOneSuccess && dispatch(actions.deleteOneSuccess({ rowGUID: row.id }));
              else Alert.alert('The file was not deleted', readonlyDeleteMessageOf(`${(r as any).code ?? ''} ${r.error}`, projects[row.projectGUID]?.name) ?? r.error);
            });
            return;
          }
          if (actions?.deleteOne) dispatch(actions.deleteOne({ rowGUID: row.id, rowOwnerGUID: ownerGUID }));
        },
      },
    ]);
  };

  return (
    <View style={styles.screen} testID="media-posts-native">
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text style={{ color: theme.colors.onSurfaceVariant }} testID="media-posts-empty">
            No media posts yet. Record a video or audio and it appears here.
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2} testID={`media-post-${item.id}`}>
            <Card.Content style={styles.row}>
              <View style={styles.texts}>
                <Text variant="titleMedium" testID={`media-post-title-${item.id}`}>{item.title}</Text>
                {!!projects[item.projectGUID]?.name && (
                  <Text variant="labelMedium" style={{ color: theme.colors.primary }} testID={`media-post-project-${item.id}`}>
                    {`Project: ${projects[item.projectGUID].name}${projects[item.projectGUID].readonly ? ' (read-only)' : ''}`}
                  </Text>
                )}
                {!!item.subtitle && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.subtitle}</Text>}
                {!!item.description && <Text variant="bodySmall">{item.description}</Text>}
              </View>
              {!!item.uris.length && (
                <IconButton icon="play-circle" size={30} onPress={() => setPlaying(item)} accessibilityLabel="Play" testID={`media-post-play-${item.id}`} />
              )}
              <IconButton icon="delete" onPress={() => remove(item)} accessibilityLabel="Delete" testID={`media-post-delete-${item.id}`} />
            </Card.Content>
          </Card>
        )}
      />
      {playing && (
        <MediaPlayerModal
          visible
          onDismiss={() => setPlaying(null)}
          kind={playing.kind || 'video'}
          source={playing.uris}
          title={playing.title}
          dateTimeOver={playing.dateTimeOver}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  texts: { flex: 1 },
});
