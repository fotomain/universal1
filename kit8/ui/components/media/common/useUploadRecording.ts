// After a recording / a photo was kept and its post written: uploads its files to the file storage (Google Drive / OneDrive, kit8root/media/<video|audio|photo>)
// IN THE BACKGROUND, then writes the address into the post (`googleDriveURLToFile`, `mediaDriveFiles`, `mediaDriveState`). A failure never loses the recording: the post keeps
// the file of the device and says `mediaDriveState: failed` + the reason. The user sees one message at the end.
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { recordingDriveFailed, recordingDriveUploaded, recordingPath, uploadRecordingFiles, type RecordingFolder } from '../../../../files/common/recordingUpload';
import { readRecordingBlob } from './recordingBlob';
import { extensionOf, mimeTypeOf, type MediaKind } from './mediaSource';
import { MEDIA_POST_ENTITY, useClient } from './useWriteMediaPost';
import type { RecordingPost } from './mediaPost';

const FALLBACK_MIME: Record<RecordingFolder, string> = { video: 'video/mp4', audio: 'audio/mp4', photo: 'image/jpeg' };

/** `upload(post, uris)`: uploads in the background and returns the post row as it is after (the same row when nothing changed); never throws */
export function useUploadRecordingToDrive() {
  const dispatch = useDispatch();
  const client = useClient();
  return useCallback(
    async (post: RecordingPost, folder: MediaKind | 'photo', uris: string[]): Promise<RecordingPost> => {
      if (!client || !uris.length) return post; // a screen / test without the Supabase provider
      const say = (message: string) => dispatch(showSnackbar({ message }));
      const files = uris.map((uri) => ({ uri, ext: extensionOf(uri) || (folder === 'photo' ? 'jpg' : folder === 'audio' ? 'm4a' : 'mp4'), fallbackMime: folder === 'photo' ? FALLBACK_MIME.photo : mimeTypeOf(uri, folder === 'audio' ? 'audio' : 'video') }));
      const result = await uploadRecordingFiles(post.rowGUID, files, { readBlob: (u) => readRecordingBlob(u) });
      const rowJSON = result.ok ? recordingDriveUploaded(post.rowJSON, result.refs) : recordingDriveFailed(post.rowJSON, result.error);
      const { data, error } = await client.from('mediaPostTable').update({ rowJSON }).eq('rowGUID', post.rowGUID).select().maybeSingle();
      if (error) {
        say(`The ${folder} was saved on this device, but the post could not be updated: ${error.message || error}`);
        return post;
      }
      const actions = (SystemMetaData as any)[MEDIA_POST_ENTITY]?.actions;
      if (data && actions?.updateOneSuccess) dispatch(actions.updateOneSuccess({ lastUpdatedData: data, updateSuccessful: 1 }));
      say(result.ok ? `Saved to the file storage: ${recordingPath(folder as RecordingFolder)}/${post.rowGUID}` : `The ${folder} was saved on this device but NOT uploaded to the file storage: ${result.error}`);
      return { ...post, rowJSON };
    },
    [client, dispatch],
  );
}
