// Keeps a finished recording and makes the media post (mediaPostReusable -> mediaPostTable).
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { buildRecordingPost, RecordingPost, RecordingSegment } from './mediaPost';
import { persistRecording } from './mediaFileStore';
import type { MediaKind } from './mediaSource';

export const MEDIA_POST_ENTITY = 'mediaPostReusable';

/** returns `save(segments, title?)`: copies every file out of the cache, creates the post, returns it */
export function useSaveRecording(kind: MediaKind) {
  const dispatch = useDispatch();
  const ownerGUID = useSelector((state: any) => state?.activeUserState?.activeUserGUID || '');

  return useCallback(
    async (segments: RecordingSegment[], title?: string): Promise<RecordingPost> => {
      const actions = (SystemMetaData as any)[MEDIA_POST_ENTITY]?.actions;
      if (!actions?.createOne) throw new Error('The media post list is not ready. Try again in a moment.');
      const kept: RecordingSegment[] = [];
      for (const segment of segments) kept.push({ ...segment, uri: await persistRecording(segment.uri, kind) });
      const post = buildRecordingPost({ kind, segments: kept, ownerGUID, rowGUID: Crypto.randomUUID(), platform: Platform.OS, title });
      dispatch(actions.createOne(post));
      return post;
    },
    [dispatch, kind, ownerGUID],
  );
}
