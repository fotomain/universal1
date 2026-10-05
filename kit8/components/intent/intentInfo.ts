// Share intent -> uxui.intentInfo (kit8/redux/uxuiSlice.ts). Pure helpers, no native imports,
// so the same code runs on web (tests, the "what to add" window) and on phones.

import type { UxuiIntentFile, UxuiIntentInfo, UxuiIntentPostType } from '../../redux/uxuiSlice';
import { DATA_ORIGIN_TYPE } from '../../types/origin';

/** The parts of expo-share-intent's ShareIntent this app reads. */
export interface SharedContent {
  text?: string | null;
  webUrl?: string | null;
  meta?: { title?: string } | null;
  files?: { path: string; mimeType?: string | null; fileName?: string | null; size?: number | null }[] | null;
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const YOUTUBE_RE = /^https?:\/\/((www|m|music)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;

export const isYoutubeURL = (url: string | null | undefined) => !!url && YOUTUBE_RE.test(url.trim());

const guid = () => {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID() as string;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** Post type by content: YouTube link > other web link > local file > plain text. */
export function detectIntentPostType(url: string | null, files: UxuiIntentFile[]): UxuiIntentPostType {
  if (isYoutubeURL(url)) return 'youtube';
  if (url) return 'webpage';
  if (files.length) return 'file';
  return 'text';
}

/** null = nothing usable was shared. */
export function buildIntentInfo(shared: SharedContent): UxuiIntentInfo | null {
  const text = (shared.text || '').trim();
  const url = (shared.webUrl || '').trim() || text.match(URL_RE)?.[0] || null;
  const files: UxuiIntentFile[] = (shared.files || []).filter((f) => !!f?.path).map((f) => ({ path: f.path, mimeType: f.mimeType ?? null, fileName: f.fileName ?? null, size: f.size ?? null }));
  if (!text && !url && !files.length) return null;
  // the text without the link itself is the best title when the sharing app sent no title
  const rest = url ? text.replace(url, '').trim() : text;
  const title = (shared.meta?.title || '').trim() || rest.split('\n')[0].slice(0, 120) || files[0]?.fileName || (url ? url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 80) : '');
  return {
    intentGUID: guid(),
    intentReceivedAt: new Date().toISOString(),
    intentURL: url || files[0]?.path || null,
    intentMIME: files[0]?.mimeType || (url ? 'text/uri-list' : 'text/plain'),
    intentText: text || null,
    intentTitle: title || null,
    intentFiles: files,
    intentPostType: detectIntentPostType(url, files),
    intentStatus: 'new',
    intentTarget: null,
  };
}

/** What is stored with the created row: rowJSON.intent = { intentURL, intentMIME, ... }. */
export function intentLinkOf(info: UxuiIntentInfo) {
  return {
    intentURL: info.intentURL,
    intentMIME: info.intentMIME,
    intentText: info.intentText,
    intentTitle: info.intentTitle,
    intentFiles: info.intentFiles,
    intentReceivedAt: info.intentReceivedAt,
  };
}

/** Title + notes for a task made from the intent. */
export function intentTitleAndNotes(info: UxuiIntentInfo): { title: string; notes: string } {
  const title = info.intentTitle || info.intentFiles[0]?.fileName || 'Shared item';
  const parts = [info.intentText || '', info.intentURL && !(info.intentText || '').includes(info.intentURL) ? info.intentURL : '', ...info.intentFiles.slice(1).map((f) => f.fileName || f.path)];
  return { title, notes: parts.filter(Boolean).join('\n') };
}

/** mediaPostTable row payload (kit8/redux/SystemMetaData.ts 'mediaPostReusable') of the shared content. */
export function intentMediaPostRow(info: UxuiIntentInfo, postType: UxuiIntentPostType, rowOwnerGUID: string) {
  const { title, notes } = intentTitleAndNotes(info);
  const mime = (info.intentFiles[0]?.mimeType || '').toLowerCase();
  const fileOrigin = mime.includes('pdf')
    ? DATA_ORIGIN_TYPE.pdf
    : mime.includes('word')
      ? DATA_ORIGIN_TYPE.msword
      : mime.includes('excel') || mime.includes('spreadsheet')
        ? DATA_ORIGIN_TYPE.msexcel
        : mime.includes('html')
          ? DATA_ORIGIN_TYPE.html
          : DATA_ORIGIN_TYPE.text;
  const dataOriginName = postType === 'youtube' ? DATA_ORIGIN_TYPE.youtube : postType === 'webpage' ? DATA_ORIGIN_TYPE.webpage : postType === 'file' ? fileOrigin : DATA_ORIGIN_TYPE.text;
  return {
    rowOwnerGUID,
    rowGUID: guid(),
    orderInList: Date.now(),
    rowJSON: {
      mediaPostTitle: title,
      mediaPostSubTitle: postType === 'youtube' ? 'YouTube' : postType === 'webpage' ? 'Web page' : postType === 'file' ? info.intentFiles[0]?.fileName || 'File' : 'Note',
      mediaPostDescription: notes,
      mediaPostOrigin: postType === 'text' ? '' : info.intentURL || '',
      mediaPostMIME: postType === 'youtube' ? 'youtube' : postType === 'file' ? mime || 'application/octet-stream' : postType === 'webpage' ? 'text/html' : 'text/plain',
      mediaPostOriginType: postType === 'file' ? 'file' : postType === 'text' ? 'text' : 'url',
      dataOriginName,
      ...(postType === 'youtube' ? { dataManipulationName: 'YOUTUBE_TO_GOOGLE_DRIVE' } : {}),
      intent: intentLinkOf(info),
    },
  };
}
