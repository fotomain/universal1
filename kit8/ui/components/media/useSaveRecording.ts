// Keeps a finished recording and makes the media post (mediaPostReusable -> mediaPostTable).
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { mediaPostOwnerGUID } from '../../../redux/mediaPostOwner';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { buildRecordingPost, RecordingDateTimeOver, RecordingPost, RecordingSegment } from './mediaPost';
import { persistRecording } from './mediaFileStore';
import type { MediaKind } from './mediaSource';

export const MEDIA_POST_ENTITY = 'mediaPostReusable';

export interface SaveRecordingOptions {
  /** the date and time over the video (video only) */
  dateTimeOver?: RecordingDateTimeOver | null;
}

/** returns `save(segments, title?, options?)`: copies every file out of the cache, creates the post, returns it */
export function useSaveRecording(kind: MediaKind) {
  const dispatch = useDispatch();
  // the FULL user GUID: the database refuses a post owned by the 32 character activeUserGUID (kit8/redux/mediaPostOwner.ts)
  const ownerGUID = useSelector(mediaPostOwnerGUID);
  const signedIn = useSelector(selectIsLoggedIn);

  return useCallback(
    async (segments: RecordingSegment[], title?: string, options?: SaveRecordingOptions): Promise<RecordingPost> => {
      // recordings are for signed-in users only (the recorder screens are behind RecordingSignInGate; this is the second lock)
      if (!signedIn) throw new Error('Sign in to save a recording.');
      const actions = (SystemMetaData as any)[MEDIA_POST_ENTITY]?.actions;
      if (!actions?.createOne) throw new Error('The media post list is not ready. Try again in a moment.');
      const kept: RecordingSegment[] = [];
      for (const segment of segments) kept.push({ ...segment, uri: await persistRecording(segment.uri, kind) });
      const post = buildRecordingPost({ kind, segments: kept, ownerGUID, rowGUID: Crypto.randomUUID(), platform: Platform.OS, title, dateTimeOver: options?.dateTimeOver });
      dispatch(actions.createOne(post));
      return post;
    },
    [dispatch, kind, ownerGUID, signedIn],
  );
}
