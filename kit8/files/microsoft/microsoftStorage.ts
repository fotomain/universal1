// Microsoft OneDrive as the app sees it (documentation/FILE_WITH_OneDrive_WBS.html): the name, the note about the whole-drive permission, and the warning about the client secret of the
// Entra app (it expires: the function keeps the date as the secret MICROSOFT_CLIENT_SECRET_EXPIRES and puts it into the status). The Microsoft Graph calls are in the Edge Function
// (supabase/functions/files-drive/oneDriveProvider.ts).
import type { StorageStatusFacts, StorageUi, StorageWarning } from '../common/storageTypes';

/** the warning starts this many days before the date */
export const SECRET_WARNING_DAYS = 30;

/** days from today (UTC) to a YYYY-MM-DD date; NaN for a text that is no date */
export const daysUntil = (iso: string | null | undefined, today = new Date()): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return NaN;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000);
};

/** the secret warning of a status: none while the date is far or unknown, "expires in N days" within SECRET_WARNING_DAYS, "expired on" after it */
export function secretWarnings(status: StorageStatusFacts | null | undefined, today = new Date()): StorageWarning[] {
  const date = status?.secretExpires || '';
  const days = daysUntil(date, today);
  if (!Number.isFinite(days) || days > SECRET_WARNING_DAYS) return [];
  return days < 0
    ? [{ id: 'secretExpiry', text: 'The Microsoft client secret expired on {{date}}: create a new one and set it again.', params: { date } }]
    : [{ id: 'secretExpiry', text: 'The Microsoft client secret expires in {{n}} days ({{date}}): create a new one before that.', params: { n: days, date } }];
}

export const MICROSOFT_STORAGE: StorageUi = {
  id: 'oneDrive',
  title: 'Microsoft OneDrive',
  ownerNote: 'One Microsoft account stores the files of the whole organization; the other people never sign in to Microsoft. The application may read and write the files of that account (Microsoft has no narrower permission) but uses only the folder kit8root. Use a dedicated account that keeps its OneDrive licence.',
  itemIdOf: (j) => (j?.oneDriveItemId ? String(j.oneDriveItemId) : undefined),
  warnings: secretWarnings,
  ownsMessage: (message) => /^Microsoft OneDrive/.test(message),
};
