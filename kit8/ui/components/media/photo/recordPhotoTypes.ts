import type { RecordingPost } from '../common/mediaPost';

/** props of RecordPhoto (iOS / Android: RecordPhoto.tsx, web: RecordPhoto.web.tsx) */
export interface RecordPhotoProps {
  onSaved?: (post: RecordingPost) => void;
}
