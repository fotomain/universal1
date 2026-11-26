// Keeps a photo (copy out of the cache) and makes its media post; the file goes to the file storage in the background (kit8root/media/photo).
import { useCallback } from 'react';
import { persistRecording } from '../common/mediaFileStore';
import { buildPhotoPost } from '../common/notePost';
import type { RecordingPost } from '../common/mediaPost';
import { useUploadRecordingToDrive } from '../common/useUploadRecording';
import { useWriteMediaPost } from '../common/useWriteMediaPost';
import type { PhotoFilter } from './photoFilters';

export function useSavePhoto() {
  const write = useWriteMediaPost();
  const upload = useUploadRecordingToDrive();
  return useCallback(
    async (photo: { uri: string; width?: number; height?: number }, filter: PhotoFilter, zoomFactor?: number, title?: string): Promise<RecordingPost> => {
      let keptUri = '';
      const post = await write<string>(
        (c, kept) => buildPhotoPost({ ...c, uri: kept, width: photo.width, height: photo.height, filterId: filter.id, filterLabel: filter.label, zoomFactor, title }),
        'photo',
        async () => {
          keptUri = await persistRecording(photo.uri, 'photo');
          return keptUri;
        },
      );
      void upload(post, 'photo', [keptUri]).catch(() => undefined);
      return post;
    },
    [upload, write],
  );
}
