// The media post (mediaPostReusable / mediaPostTable) that a finished recording becomes. Pure: no redux, no native module.
import { extensionOf, MediaKind, mimeTypeOf } from './mediaSource';

/** one file of a recording. A video recorded on a phone is cut where the user switches the sound on / off (see RecordVideo.tsx) */
export interface RecordingSegment {
  uri: string;
  durationSec: number;
  hasAudio: boolean;
}

export interface BuildRecordingPostInput {
  kind: MediaKind;
  segments: RecordingSegment[];
  ownerGUID: string;
  rowGUID: string;
  /** 'web' | 'ios' | 'android' */
  platform: string;
  now?: Date;
  title?: string;
}

export interface RecordingPost {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: Record<string, any>;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'Video 2026-10-15 14:03' */
export function defaultRecordingTitle(kind: MediaKind, now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${kind === 'audio' ? 'Audio' : 'Video'} ${date}`;
}

/** the row to hand to `SystemMetaData.mediaPostReusable.actions.createOne` */
export function buildRecordingPost(input: BuildRecordingPostInput): RecordingPost {
  const { kind, segments, ownerGUID, rowGUID, platform } = input;
  if (!segments.length) throw new Error('A recording needs at least one file.');
  const now = input.now ?? new Date();
  const first = segments[0];
  const durationSec = Math.round(segments.reduce((sum, s) => sum + (s.durationSec || 0), 0) * 10) / 10;
  const rowJSON: Record<string, any> = {
    mediaPostTitle: input.title?.trim() || defaultRecordingTitle(kind, now),
    mediaPostSubTitle: `${platform} recording`,
    mediaPostDescription: '',
    mediaPostOrigin: first.uri,
    mediaPostMIME: mimeTypeOf(first.uri, kind),
    mediaPostOriginType: 'file',
    dataOriginName: 'recorder',
    mediaKind: kind,
    mediaDurationSec: durationSec,
    mediaWithAudio: kind === 'audio' ? true : segments.some((s) => s.hasAudio),
    mediaPlatform: platform,
    mediaFileExtension: extensionOf(first.uri),
    mediaCreatedAt: now.toISOString(),
  };
  // several files = one recording played one after the other; mediaPostOrigin is the first one
  if (segments.length > 1) rowJSON.mediaSegments = segments.map((s) => ({ uri: s.uri, durationSec: s.durationSec, hasAudio: s.hasAudio }));
  return { rowGUID, rowOwnerGUID: ownerGUID || 'anon', rowParentGUID: 'empty', orderInList: now.getTime(), rowJSON };
}

/** the uris to play for a post row (all segments, else the origin) */
export function playableUrisOfPost(rowJSON: Record<string, any> | undefined | null): string[] {
  if (!rowJSON) return [];
  const segments = Array.isArray(rowJSON.mediaSegments) ? rowJSON.mediaSegments.map((s: any) => s?.uri).filter(Boolean) : [];
  if (segments.length) return segments;
  return rowJSON.mediaPostOrigin ? [String(rowJSON.mediaPostOrigin)] : [];
}
