// The Media Posts list for iOS, Android AND the web (route /posts/mediapostcrud, app/posts/mediapostcrud/index.tsx) = a ReusableList of mediaPostReusable posts.
// One list for every platform. (The older web-only list ListWebCardsComponent is built from browser tags and shows the red "View config getter for component div" screen on a phone.)
//   reusableCard  the card of a post (default MediaPostCardDefault = the compact card the list always had). ReusableCardMediaPost has three sizes (the toolbar button
//                 picks cardSmall / cardMedium / cardBig), adapts to the origin of the post and has a local FAB with the actions of the card.
//   toolbar       search, Add (the form CreateListElementForm: origin type, URL, title ... or a person's ID card / passport), card size, Sort and Filter, More
//   double click  on the card of a person's ID card / passport = PersonDocumentDetailsCard (read only: photo, name, every datum)
//   Play          the player of the Play menu (MediaPlayerModal); a file row of the Files tab is deleted by the files function (a plain DELETE removes 0 rows)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { mediaPostOwnerGUID } from '../../../../redux/mediaPostOwner';
import ReusableList from '../../list/reusable/ReusableList';
import CreateListElementForm from '../../list/forms/CreateListElementForm';
import MediaPostCardDefault from '../../list/cards/mediapost/MediaPostCardDefault';
import type { MediaPostCardProps } from '../../list/cards/mediapost/mediaPostCardTypes';
import { CARD_GAP, CardSize, cardItemHeight, DEFAULT_CARD_SIZE, normalizeCardSize } from '../../list/cards/cardSize';
import type { ReusableListItemState } from '../../list/reusable/reusableListTypes';
import type { ReusableTableRow } from '../../table/reusable/reusableTableTypes';
import MediaPlayerModal from '../play/MediaPlayerModal';
import PersonDocumentDetailsCard from '../../list/cards/mediapost/PersonDocumentDetailsCard';
import type { MediaPostRow } from './mediaPostList';
import { MEDIA_POST_COLUMNS } from './mediaPostColumns';
import { deleteFileRow } from '../../../../files/common/filesDriveApi';
import { identificationPath, uploadIdentificationPhotoWithRetry } from '../../../../files/common/identificationPhoto';
import { base64ToBytes } from '../../list/cards/mediapost/personDocumentPdf';
import { bytesToBase64 } from '../nfc/iddocread/crypto/bytes';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { mediaPostProjectGUID, readonlyDeleteMessageOf } from './mediaPostProject';
import { useMediaPostProjects } from './useMediaPostProjects';

export const MEDIA_POSTS_ENTITY = 'mediaPostReusable';
/** ReusableCardMediaPost: 12 px at the sides, half CARD_GAP above / below, corner radius 16 */
const SWIPE_INSET = { x: 12, y: CARD_GAP / 2, radius: 16 };
const CARD_SIZE_KEY = 'mediaPostsCardSize';

export interface MediaPostsNativeListProps {
  /** the card of a post; not set = MediaPostCardDefault (one compact card, no size button) */
  reusableCard?: React.ComponentType<MediaPostCardProps>;
  /** the size shown first when the user has not picked one (default cardSmall) */
  initialCardSize?: CardSize;
  /** scroll to this post (route param scrollToGUID: a post added from a share intent) */
  focusRowGUID?: string;
}

export default function MediaPostsNativeList({ reusableCard, initialCardSize = DEFAULT_CARD_SIZE, focusRowGUID }: MediaPostsNativeListProps) {
  const dispatch = useDispatch();
  const ownerGUID = useSelector(mediaPostOwnerGUID);
  const serverRows = useSelector((state: any) => state?.[MEDIA_POSTS_ENTITY]?.entityDataFromServer);
  const projects = useMediaPostProjects(serverRows);
  const [playing, setPlaying] = useState<MediaPostRow | null>(null);
  /** the ID card / passport whose read only details are open */
  const [details, setDetails] = useState<ReusableTableRow | null>(null);
  const Card = reusableCard ?? MediaPostCardDefault;
  const sized = !!reusableCard;

  // the size the user picked is kept on this device
  const [cardSize, setCardSize] = useState<CardSize>(normalizeCardSize(initialCardSize));
  useEffect(() => {
    if (!sized) return;
    AsyncStorage.getItem(CARD_SIZE_KEY).then((v) => { if (v) setCardSize(normalizeCardSize(v)); }).catch(() => undefined);
  }, [sized]);
  const changeCardSize = useCallback((size: CardSize) => {
    setCardSize(size);
    AsyncStorage.setItem(CARD_SIZE_KEY, size).catch(() => undefined);
  }, []);
  const itemHeight = cardItemHeight(sized ? cardSize : 'cardSmall');

  const renderItem = useCallback((row: ReusableTableRow, state: ReusableListItemState) => (
    <Card row={row} cardSize={sized ? cardSize : 'cardSmall'} state={state} project={projects[mediaPostProjectGUID(row)]} onPlay={setPlaying} onOpenDetails={setDetails} />
  ), [Card, sized, cardSize, projects]);

  // a file row of the Files tab: the table refuses a plain DELETE (no error, 0 rows - the card would only disappear from the screen);
  // the files-drive function deletes the row AND the file in the storage, then the card is taken off the list. The other rows are deleted by the list.
  const onDeleteRows = useCallback((ids: string[], rows: ReusableTableRow[]) => {
    const fileRows = rows.filter((r) => !!r.rowJSON?.fileSourceKind);
    const actions = (SystemMetaData as any)[MEDIA_POSTS_ENTITY]?.actions;
    fileRows.forEach((row) => {
      deleteFileRow(row.rowGUID).then((r) => {
        if (r.ok) actions?.deleteOneSuccess && dispatch(actions.deleteOneSuccess({ rowGUID: row.rowGUID }));
        else Alert.alert('The file was not deleted', readonlyDeleteMessageOf(`${(r as any).code ?? ''} ${r.error}`, projects[mediaPostProjectGUID(row)]?.name) ?? r.error);
      });
    });
    const fileIds = new Set(fileRows.map((r) => r.rowGUID));
    return ids.filter((id) => !fileIds.has(id));
  }, [dispatch, projects]);

  // swipe right = Archive (rowJSON.rowIsArchived): the table refuses every UPDATE of a file row (Files tab, chat), so those cards can only be deleted
  const canArchiveRow = useCallback((row: ReusableTableRow) => !row.rowJSON?.fileSourceKind, []);

  // a person document made with the Add form: its owner photo also goes to the file storage (identification/idcard | passport/<post guid>), as the reader's post does
  const onElementCreated = useCallback((guid: string, _rowJSON: Record<string, any>, extras?: Record<string, any>) => {
    const p = extras?.idPhoto;
    if (!p?.base64) return;
    uploadIdentificationPhotoWithRetry(guid, { mime: p.mime, bytes: base64ToBytes(p.base64) }, bytesToBase64).then((r) => {
      dispatch(showSnackbar({ message: r.ok ? `Owner photo saved to the file storage: ${identificationPath(p.folder)}/${guid}` : `The owner photo was NOT saved to the file storage: ${r.error}` }));
    });
  }, [dispatch]);

  return (
    <View style={styles.screen} testID="media-posts-native">
      <ReusableList
        testID="media-posts"
        reusableListGUID="mediaPosts.list"
        entityName={MEDIA_POSTS_ENTITY}
        itemLabel="Post"
        listOwnerGUID={ownerGUID}
        listParentGUID="empty"
        visualColumns={MEDIA_POST_COLUMNS}
        orderDirection="desc"
        itemHeight={itemHeight}
        renderItem={renderItem}
        renderItemDeps={projects}
        CreateElementForm={CreateListElementForm}
        onElementCreated={onElementCreated}
        cardSize={sized ? cardSize : undefined}
        onCardSizeChange={sized ? changeCardSize : undefined}
        onDeleteRows={onDeleteRows}
        swipeActions
        cardFab={false}
        swipeInset={SWIPE_INSET}
        canArchiveRow={canArchiveRow}
        refreshOnFocus
        focusRowGUID={focusRowGUID}
        emptyText="No media posts yet. Record a video or audio, take a photo or scan a code and it appears here."
      />
      {details ? <PersonDocumentDetailsCard row={details} onClose={() => setDetails(null)} testID="person-document" /> : null}
      {playing && (
        <MediaPlayerModal
          visible
          onDismiss={() => setPlaying(null)}
          kind={playing.kind || 'video'}
          source={playing.uris}
          title={playing.title}
          dateTimeOver={playing.dateTimeOver}
          driveFiles={playing.driveFiles}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
