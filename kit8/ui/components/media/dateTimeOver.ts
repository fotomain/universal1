// The date and time over a video (documentation/CAMERA_DATE_TIME.html). Pure: no React, no native module.
//   the text of a moment · the place of the stamp for a picture size · the clock time of a second of a recorded part
// ONE rule for the three places that draw the stamp: the preview of the recorder, the canvas of the web recorder (the stamp
// is written into the file) and the player (iOS / Android: the file has no stamp, the player draws it from the saved times).
import type { RecordDateTimeOverPosition } from '../../../redux/recordVideoSettings';

/** the recording stood still: at second `atSec` of the FILE, for `lengthSec` seconds of the clock */
export interface DateTimeOverPause {
  atSec: number;
  lengthSec: number;
}

/** one file of a recording: when it started and where it was paused */
export interface DateTimeOverPart {
  /** ISO date and time of the first frame */
  startedAt: string;
  pauses?: DateTimeOverPause[];
}

/** rowJSON.mediaDateTimeOver of a media post */
export interface MediaDateTimeOver {
  position: RecordDateTimeOverPosition;
  /** true = the stamp is in the picture of the file (web); false = the player draws it from `parts` */
  burnedIn: boolean;
  /** one per file, in the order of the files; only while burnedIn is false */
  parts?: DateTimeOverPart[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** '2026-11-12 14:03:27' - local time of the device, 24 hours */
export function formatDateTimeOver(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export interface DateTimeOverLayout {
  fontSize: number;
  marginX: number;
  marginY: number;
  right: boolean;
  bottom: boolean;
}

/** text height = 4 % of the short side, margin = 3 % of the width and 4 % of the height */
export function dateTimeOverLayout(width: number, height: number, position: RecordDateTimeOverPosition): DateTimeOverLayout {
  const w = width > 0 ? width : 0;
  const h = height > 0 ? height : 0;
  return {
    fontSize: Math.max(10, Math.round(Math.min(w, h) * 0.04)),
    marginX: Math.round(w * 0.03),
    marginY: Math.round(h * 0.04),
    right: position === 'topRight' || position === 'bottomRight',
    bottom: position === 'bottomLeft' || position === 'bottomRight',
  };
}

/** the clock time shown at second `videoSec` of a part: its start + the position + every pause that lies before it */
export function clockTimeAt(part: DateTimeOverPart, videoSec: number): Date | null {
  const start = Date.parse(part?.startedAt);
  if (!Number.isFinite(start)) return null;
  const sec = Number.isFinite(videoSec) && videoSec > 0 ? videoSec : 0;
  let paused = 0;
  for (const p of part.pauses ?? []) if (p && p.atSec <= sec && p.lengthSec > 0) paused += p.lengthSec;
  return new Date(start + Math.round((sec + paused) * 1000));
}

/** the text of the stamp of file number `index` of a post at second `videoSec`; '' = nothing to draw */
export function dateTimeOverTextAt(over: MediaDateTimeOver | null | undefined, index: number, videoSec: number): string {
  if (!over || over.burnedIn) return '';
  const part = over.parts?.[index];
  const at = part ? clockTimeAt(part, videoSec) : null;
  return at ? formatDateTimeOver(at) : '';
}

/** what the player needs of a post row: only a stamp that is NOT in the file and has its times */
export function dateTimeOverOfPost(rowJSON: Record<string, any> | null | undefined): MediaDateTimeOver | null {
  const over = rowJSON?.mediaDateTimeOver;
  if (!over || over.burnedIn !== false || !Array.isArray(over.parts) || !over.parts.length) return null;
  const position: RecordDateTimeOverPosition = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(over.position) ? over.position : 'bottomRight';
  return { position, burnedIn: false, parts: over.parts };
}

/** the same from a route parameter (JSON text); a bad value = no stamp */
export function parseDateTimeOverParam(value: string | string[] | undefined | null): MediaDateTimeOver | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return dateTimeOverOfPost({ mediaDateTimeOver: JSON.parse(raw) });
  } catch {
    return null;
  }
}

/** The clock of ONE recorded file: the recorder tells it start / pause / resume, the post gets `toPart()`. */
export class PartClock {
  private readonly startedMs: number;
  private pausedAtMs: number | null = null;
  private pausedTotalMs = 0;
  private readonly pauses: DateTimeOverPause[] = [];

  constructor(nowMs: number) {
    this.startedMs = nowMs;
  }

  pause(nowMs: number) {
    if (this.pausedAtMs === null) this.pausedAtMs = nowMs;
  }

  resume(nowMs: number) {
    if (this.pausedAtMs === null) return;
    const lengthMs = Math.max(0, nowMs - this.pausedAtMs);
    const round = (ms: number) => Math.round(ms) / 1000;
    this.pauses.push({ atSec: round(this.pausedAtMs - this.startedMs - this.pausedTotalMs), lengthSec: round(lengthMs) });
    this.pausedTotalMs += lengthMs;
    this.pausedAtMs = null;
  }

  toPart(): DateTimeOverPart {
    const part: DateTimeOverPart = { startedAt: new Date(this.startedMs).toISOString() };
    if (this.pauses.length) part.pauses = this.pauses.map((p) => ({ ...p }));
    return part;
  }
}
