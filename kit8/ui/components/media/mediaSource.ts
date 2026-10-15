// Pure helpers of the media components (no React, no native modules): what a user typed / picked is a media source,
// route parameters of the player routes, the file name / mime type of a recording, mm:ss.

export type MediaKind = 'audio' | 'video';
/** remote = http(s) · local = a file of the device (file://, content://, ...) · stored = a recording of this app · blob = a browser object url */
export type MediaSourceType = 'remote' | 'local' | 'stored' | 'blob' | 'invalid';

export interface ParsedMediaSource {
  type: MediaSourceType;
  uri: string;
  fileName: string;
}

/** a recording made on the web is kept in IndexedDB; the post stores `kit8media://<id>.<ext>` (see mediaFileStore.web.ts) */
export const MEDIA_STORE_SCHEME = 'kit8media://';

/** document picker filter per kind */
export const MEDIA_PICKER_TYPES: Record<MediaKind, string> = { audio: 'audio/*', video: 'video/*' };

const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba', '3gp', 'caf', 'amr'];
const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'ts', 'mpeg', 'mpg'];

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/opus', flac: 'audio/flac', weba: 'audio/webm', '3gp': 'audio/3gpp', caf: 'audio/x-caf', amr: 'audio/amr',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', mpeg: 'video/mpeg', mpg: 'video/mpeg', ts: 'video/mp2t',
};

/** extension in lower case without the dot ('' when none); a query string / hash is ignored */
export function extensionOf(uri?: string | null): string {
  if (!uri) return '';
  const clean = String(uri).split(/[?#]/)[0];
  const last = clean.substring(clean.lastIndexOf('/') + 1);
  const dot = last.lastIndexOf('.');
  return dot > 0 ? last.substring(dot + 1).toLowerCase() : '';
}

export function fileNameOf(uri?: string | null): string {
  if (!uri) return '';
  const clean = String(uri).split(/[?#]/)[0];
  if (/^(blob|data):/i.test(clean)) return '';
  let name = clean.substring(clean.lastIndexOf('/') + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep the raw name
  }
  return name;
}

/** audio | video by the file extension, null when it says nothing (.ts and .webm count as video) */
export function mediaKindFromUri(uri?: string | null): MediaKind | null {
  const ext = extensionOf(uri);
  if (!ext) return null;
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}

export function mimeTypeOf(uri: string | null | undefined, kind: MediaKind): string {
  return MIME_BY_EXT[extensionOf(uri)] || (kind === 'audio' ? 'audio/mp4' : 'video/mp4');
}

/**
 * What the user typed or picked -> a source. Accepts https://..., http://..., file:///..., content://..., an absolute
 * path (/Users/me/a.mp4 -> file:///Users/me/a.mp4), blob:/data: urls and kit8media:// (a stored recording).
 * Quotes around a pasted path are removed. Anything else is `invalid`.
 */
export function parseMediaSource(input?: string | null): ParsedMediaSource {
  let text = (input ?? '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
  if (!text) return { type: 'invalid', uri: '', fileName: '' };
  if (/^https?:\/\/[^\s/]+/i.test(text)) return { type: 'remote', uri: text, fileName: fileNameOf(text) };
  if (text.startsWith(MEDIA_STORE_SCHEME)) return { type: 'stored', uri: text, fileName: text.substring(MEDIA_STORE_SCHEME.length) };
  if (/^(blob|data):/i.test(text)) return { type: 'blob', uri: text, fileName: '' };
  if (/^(file|content|ph|assets-library):\/\//i.test(text)) return { type: 'local', uri: text, fileName: fileNameOf(text) };
  if (text.startsWith('/')) return { type: 'local', uri: `file://${text}`, fileName: fileNameOf(text) };
  return { type: 'invalid', uri: text, fileName: '' };
}

/** one uri or a list -> the clean list of playable uris (empty items removed, order kept) */
export function normalizeQueue(source?: string | string[] | null): string[] {
  const list = Array.isArray(source) ? source : source ? [source] : [];
  return list.map((s) => parseMediaSource(s)).filter((p) => p.type !== 'invalid').map((p) => p.uri);
}

/** route parameter `url`: one uri or a JSON array of uris (segments of one recording) */
export function parseQueueParam(raw?: string | string[] | null): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  const text = value.trim();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return normalizeQueue(parsed.map(String));
    } catch {
      // not JSON: fall through, it is a single uri
    }
  }
  return normalizeQueue(text);
}

/** `autoPlay` route parameter: plays by default; 'false' / '0' / 'no' switch it off */
export function parseAutoPlayParam(raw?: string | string[] | boolean | null): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
}

export interface PlayRouteOptions {
  source?: string | string[];
  autoPlay?: boolean;
  title?: string;
}

/** the route that plays something: /media/play/audio?url=...&autoPlay=true */
export function buildPlayRoute(kind: MediaKind, options: PlayRouteOptions = {}): string {
  const queue = normalizeQueue(options.source);
  const params: string[] = [];
  if (queue.length) params.push(`url=${encodeURIComponent(queue.length === 1 ? queue[0] : JSON.stringify(queue))}`);
  if (options.autoPlay === false) params.push('autoPlay=false');
  if (options.title) params.push(`title=${encodeURIComponent(options.title)}`);
  return `/media/play/${kind}${params.length ? `?${params.join('&')}` : ''}`;
}

/** 83.4 -> '1:23' · 3725 -> '1:02:05' · bad value -> '0:00' */
export function formatDuration(seconds?: number | null): string {
  const total = Number.isFinite(seconds as number) && (seconds as number) > 0 ? Math.floor(seconds as number) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
