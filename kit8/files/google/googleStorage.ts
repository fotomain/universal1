// Google Drive as the app sees it: the name, the note under its connection block, no warnings of its own. The Google calls themselves are in the Edge Function
// (supabase/functions/files-drive/googleProvider.ts); the app only needs the words. documentation/FILE_ATTACHMENT_WBS.html (way C).
import type { StorageUi } from '../common/storageTypes';

export const GOOGLE_STORAGE: StorageUi = {
  id: 'googleDrive',
  title: 'Google Drive',
  ownerNote: 'One Google account stores the files of the whole organization; the other people never sign in to Google. Files belong to that account.',
  itemIdOf: (j) => (j?.googleDriveFileId ? String(j.googleDriveFileId) : undefined),
  warnings: () => [],
  // the fixed Google words of the common code stay (an older function answered with them); a Google message is never kept as it is
  ownsMessage: () => false,
};
