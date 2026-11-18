// Keeps a photo (copy out of the cache) and makes its media post.
import { useCallback } from 'react';
import { persistRecording } from '../common/mediaFileStore';
import { buildPhotoPost } from '../common/notePost';
import type { RecordingPost } from '../common/mediaPost';
import { useWriteMediaPost } from '../common/useWriteMediaPost';
import type { PhotoFilter } from './photoFilters';

export function useSavePhoto() {
  const write = useWriteMediaPost();
  return useCallback(
    (photo: { uri: string; width?: number; height?: number }, filter: PhotoFilter, zoomFactor?: number, title?: string): Promise<RecordingPost> =>
      write<string>(
        (c, kept) => buildPhotoPost({ ...c, uri: kept, width: photo.width, height: photo.height, filterId: filter.id, filterLabel: filter.label, zoomFactor, title }),
        'photo',
        () => persistRecording(photo.uri, 'photo'),
      ),
    [write],
  );
}
