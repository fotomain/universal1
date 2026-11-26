// Writes ONE media post row (mediaPostReusable -> mediaPostTable) for a signed-in user. Shared by the recordings (useSaveRecording),
// the photos and the results of the QR / barcode and NFC scans: the owner of the row is the GUID the database itself knows the user by.
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { mediaPostOwnerGUID } from '../../../../redux/mediaPostOwner';
import { selectIsLoggedIn } from '../../../../redux/activeUserSlice';
import { useSupabase } from '../../../../providers/WithSupabase';
import { readDatabaseUserGUID } from '../../../../auth/user/userTableLogin';
import type { RecordingPost } from './mediaPost';

export const MEDIA_POST_ENTITY = 'mediaPostReusable';
const MEDIA_POST_TABLE = 'mediaPostTable';

/** the Supabase client, or null in a screen / test without the provider (the post then goes through the saga as before) */
export function useClient(): any {
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

export interface PostBuildContext {
  ownerGUID: string;
  rowGUID: string;
  /** 'web' | 'ios' | 'android' */
  platform: string;
}

/**
 * `write(build, what?, prepare?)`: checks the sign in and the post list FIRST, then runs `prepare()` (e.g. keeps the files: nothing is kept for a post
 * that cannot be made), asks the owner of this moment, builds the row with `build(context, prepared)`, writes it and returns it.
 * `what` = the words of the error "Sign in to save a <what>."
 */
export function useWriteMediaPost() {
  const dispatch = useDispatch();
  // the FULL user GUID: the database refuses a post owned by the 32 character activeUserGUID (kit8/redux/mediaPostOwner.ts)
  const stateOwnerGUID = useSelector(mediaPostOwnerGUID);
  const signedIn = useSelector(selectIsLoggedIn);
  const client = useClient();

  const write = useCallback(
    async <T = undefined>(build: (context: PostBuildContext, prepared: T) => RecordingPost, what = 'recording', prepare?: () => Promise<T>): Promise<RecordingPost> => {
      // media posts are for signed-in users only (the recorder screens are behind RecordingSignInGate; this is the second lock)
      if (!signedIn) throw new Error(`Sign in to save a ${what}.`);
      const actions = (SystemMetaData as any)[MEDIA_POST_ENTITY]?.actions;
      if (!actions?.createOne) throw new Error('The media post list is not ready. Try again in a moment.');
      const prepared = (prepare ? await prepare() : undefined) as T;
      // The owner the row policy compares with is app_user_guid() of THIS moment: asked now, so a value kept from an earlier
      // login (a page open since before an update, another account in the same browser) cannot make the insert fail.
      const databaseGUID = client ? await readDatabaseUserGUID(client) : '';
      const ownerGUID = databaseGUID || stateOwnerGUID;
      const post = build({ ownerGUID, rowGUID: Crypto.randomUUID(), platform: Platform.OS }, prepared);
      if (!client) {
        dispatch(actions.createOne(post));
        return post;
      }
      // With a client the row is written HERE and awaited: the screen says "saved" only after the database took it
      // (through the saga the screen said saved while a snackbar said refused).
      const { data, error } = await client.from(MEDIA_POST_TABLE).insert(post).select();
      if (error) throw new Error(saveRefusalText(error, ownerGUID, databaseGUID));
      const row = (data && data[0]) || post;
      if (actions.createOneSuccess) dispatch(actions.createOneSuccess({ createdData: row, ...row }));
      return post;
    },
    [client, dispatch, signedIn, stateOwnerGUID],
  );
  return write;
}

export const useIsSignedIn = (): boolean => useSelector(selectIsLoggedIn) as boolean;
