// The rows of the phone's Media Posts list (MediaPostsNativeList.tsx). Pure: no React, no redux.
// The web list (ListWebCardsComponent) is built from browser tags and cannot run on iOS / Android.
import { formatDuration } from './mediaSource';
import { playableUrisOfPost } from './mediaPost';
import { mediaPostProjectGUID } from './mediaPostProject';
import { dateTimeOverOfPost, MediaDateTimeOver } from './dateTimeOver';

export interface MediaPostRow {
  id: string;
  title: string;
  /** 'video' | 'audio' | '' (a link or text post: nothing to play) */
  kind: 'video' | 'audio' | '';
  /** 'Video · 0:34 · 2026-11-13 10:33' */
  subtitle: string;
  description: string;
  uris: string[];
  /** a recording whose file has no date and time stamp: the player draws it */
  dateTimeOver: MediaDateTimeOver | null;
  orderInList: number;
  /** a FILE row of the Files tab (rowJSON.fileSourceKind: task / project / organization ...): the database refuses a plain DELETE of it, it goes through the files-drive function (also deletes the file in the storage) */
  isFileRow: boolean;
  /** the project the post belongs to, '' = independent of any project (only its owner changes it) */
  projectGUID: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function dayAndTime(iso: unknown): string {
  const d = new Date(String(iso || ''));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** newest first; a row with no id is skipped */
export function mediaPostRows(rows: unknown): MediaPostRow[] {
  if (!Array.isArray(rows)) return [];
  const out: MediaPostRow[] = [];
  for (const item of rows as any[]) {
    const id = String(item?.rowGUID || '');
    if (!id) continue;
    const json = item?.rowJSON || {};
    const kind = json.mediaKind === 'video' || json.mediaKind === 'audio' ? json.mediaKind : '';
    const parts: string[] = [];
    if (kind) parts.push(kind === 'video' ? 'Video' : 'Audio');
    if (kind && Number(json.mediaDurationSec) > 0) parts.push(formatDuration(Number(json.mediaDurationSec)));
    // a post that is not a recording (a shared photo, a link, a note): what it is, and when it was made
    if (!kind) {
      const what = String(json.mediaPostSubTitle || json.dataOriginName || '').trim();
      if (what) parts.push(what);
    }
    const when = dayAndTime(json.mediaRecordedAt || json.mediaCreatedAt || item?.created_at || item?.updated_at);
    if (when) parts.push(when);
    out.push({
      id,
      title: String(json.mediaPostTitle || item?.title || 'Media post'),
      kind,
      subtitle: parts.join(' · '),
      description: String(json.mediaPostDescription || ''),
      uris: kind ? playableUrisOfPost(json) : [],
      dateTimeOver: kind === 'video' ? dateTimeOverOfPost(json) : null,
      orderInList: Number(item?.orderInList) || 0,
      isFileRow: !!json.fileSourceKind,
      projectGUID: mediaPostProjectGUID(item),
    });
  }
  return out.sort((a, b) => b.orderInList - a.orderInList);
}
