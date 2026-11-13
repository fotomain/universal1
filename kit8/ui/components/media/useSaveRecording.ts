// Keeps a finished recording and makes the media post (mediaPostReusable -> mediaPostTable).
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { mediaPostOwnerGUID } from '../../../redux/mediaPostOwner';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { useSupabase } from '../../../providers/WithSupabase';
import { readDatabaseUserGUID } from '../../../auth/user/userTableLogin';
import { buildRecordingPost, RecordingDateTimeOver, RecordingPost, RecordingSegment } from './mediaPost';
import { persistRecording } from './mediaFileStore';
import type { MediaKind } from './mediaSource';

export const MEDIA_POST_ENTITY = 'mediaPostReusable';
const MEDIA_POST_TABLE = 'mediaPostTable';

/** the Supabase client, or null in a screen / test without the provider (the post then goes through the saga as before) */
function useClient(): any {
  try {
    return (useSupabase() as any)?.supabase ?? null;
  } catch {
    return null;
  }
}

/** a refused insert in words; a permission refusal names the two GUIDs that did not match, so the cause can be seen */
export function saveRefusalText(error: any, ownerGUID: string, databaseGUID: string): string {
  const message = String(error?.message || error || 'unknown error');
  if (error?.code === '42501' || /row-level security/i.test(message)) {
    return `Post was not saved: the database refused it (no permission). Owner of the post: ${ownerGUID || 'none'}; the database knows you as: ${databaseGUID || 'unknown'}. Sign out, sign in and try again.`;
  }
  return `Post was not saved: ${message}`;
}

export interface SaveRecordingOptions {
  /** the date and time over the video (video only) */
  dateTimeOver?: RecordingDateTimeOver | null;
}

/** returns `save(segments, title?, options?)`: copies every file out of the cache, creates the post, returns it */
export function useSaveRecording(kind: MediaKind) {
  const dispatch = useDispatch();
  // the FULL user GUID: the database refuses a post owned by the 32 character activeUserGUID (kit8/redux/mediaPostOwner.ts)
  const stateOwnerGUID = useSelector(mediaPostOwnerGUID);
  const signedIn = useSelector(selectIsLoggedIn);
  const client = useClient();

  return useCallback(
    async (segments: RecordingSegment[], title?: string, options?: SaveRecordingOptions): Promise<RecordingPost> => {
      // recordings are for signed-in users only (the recorder screens are behind RecordingSignInGate; this is the second lock)
      if (!signedIn) throw new Error('Sign in to save a recording.');
      const actions = (SystemMetaData as any)[MEDIA_POST_ENTITY]?.actions;
      if (!actions?.createOne) throw new Error('The media post list is not ready. Try again in a moment.');
      const kept: RecordingSegment[] = [];
      for (const segment of segments) kept.push({ ...segment, uri: await persistRecording(segment.uri, kind) });
      // The owner the row policy compares with is app_user_guid() of THIS moment: asked now, so a value kept from an earlier
      // login (a page open since before an update, another account in the same browser) cannot make the insert fail.
      const databaseGUID = client ? await readDatabaseUserGUID(client) : '';
      const ownerGUID = databaseGUID || stateOwnerGUID;
      const post = buildRecordingPost({ kind, segments: kept, ownerGUID, rowGUID: Crypto.randomUUID(), platform: Platform.OS, title, dateTimeOver: options?.dateTimeOver });
      if (!client) {
        dispatch(actions.createOne(post));
        return post;
      }
      // With a client the row is written HERE and awaited: the recorder says "Recording saved" only after the database took it
      // (through the saga the screen said saved while a snackbar said refused).
      const { data, error } = await client.from(MEDIA_POST_TABLE).insert(post).select();
      if (error) throw new Error(saveRefusalText(error, ownerGUID, databaseGUID));
      const row = (data && data[0]) || post;
      if (actions.createOneSuccess) dispatch(actions.createOneSuccess({ createdData: row, ...row }));
      return post;
    },
    [client, dispatch, kind, signedIn, stateOwnerGUID],
  );
}
