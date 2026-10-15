import type { RecordingPost } from './mediaPost';

/** props of RecordVideo (iOS / Android: RecordVideo.tsx, web: RecordVideo.web.tsx) */
export interface RecordVideoProps {
  /** the recording stops by itself after this time (default 1 hour) */
  maxDurationSec?: number;
  /** the "Record sound" switch at the start (default on) */
  withAudio?: boolean;
  onSaved?: (post: RecordingPost) => void;
}
