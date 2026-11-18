// Keeps a finished recording and makes the media post (mediaPostReusable -> mediaPostTable).
import { useCallback } from 'react';
import { buildRecordingPost, RecordingDateTimeOver, RecordingPost, RecordingSegment } from './mediaPost';
import { persistRecording } from './mediaFileStore';
import type { MediaKind } from './mediaSource';
import { MEDIA_POST_ENTITY, saveRefusalText, useWriteMediaPost } from './useWriteMediaPost';

export { MEDIA_POST_ENTITY, saveRefusalText };

export interface SaveRecordingOptions {
  /** the date and time over the video (video only) */
  dateTimeOver?: RecordingDateTimeOver | null;
}

/** returns `save(segments, title?, options?)`: copies every file out of the cache, creates the post, returns it */
export function useSaveRecording(kind: MediaKind) {
  const write = useWriteMediaPost();
  return useCallback(
    async (segments: RecordingSegment[], title?: string, options?: SaveRecordingOptions): Promise<RecordingPost> => {
      return write<RecordingSegment[]>(
        (c, kept) => buildRecordingPost({ kind, segments: kept, ownerGUID: c.ownerGUID, rowGUID: c.rowGUID, platform: c.platform, title, dateTimeOver: options?.dateTimeOver }),
        'recording',
        async () => {
          const kept: RecordingSegment[] = [];
          for (const segment of segments) kept.push({ ...segment, uri: await persistRecording(segment.uri, kind) });
          return kept;
        },
      );
    },
    [kind, write],
  );
}
