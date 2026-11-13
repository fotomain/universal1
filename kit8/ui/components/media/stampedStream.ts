// Web only (used by RecordVideo.web.tsx): writes the date and time INTO the recorded picture.
//   camera stream -> <video> (the preview) -> hidden <canvas> (every frame + the text) -> canvas.captureStream() + the
//   microphone track of the camera stream -> MediaRecorder
// The canvas has the size of the camera picture. The text is drawn on the unmirrored picture (the preview is mirrored by CSS only).
// A frame is drawn when the video has a new one (requestVideoFrameCallback); a timer draws when the browser has no such
// callback or stops calling it (a hidden tab), so the clock of the stamp never stands still for long.
import type { RecordDateTimeOverPosition } from '../../../redux/recordVideoSettings';
import { dateTimeOverLayout, formatDateTimeOver } from './dateTimeOver';

export const STAMPED_STREAM_FPS = 30;
/** the timer draws when no frame came for this long */
export const STAMPED_STREAM_WATCHDOG_MS = 400;

export interface StampedStream {
  stream: MediaStream;
  /** stops the drawing and the canvas track (the camera stream is left alone) */
  stop: () => void;
}

/** draws the text of `date` in the corner of a canvas of the given size */
export function drawDateTimeOver(ctx: CanvasRenderingContext2D, width: number, height: number, position: RecordDateTimeOverPosition, date: Date) {
  const l = dateTimeOverLayout(width, height, position);
  ctx.save();
  ctx.font = `600 ${l.fontSize}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = l.right ? 'right' : 'left';
  ctx.textBaseline = l.bottom ? 'bottom' : 'top';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = Math.max(2, Math.round(l.fontSize / 5));
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#fff';
  ctx.fillText(formatDateTimeOver(date), l.right ? width - l.marginX : l.marginX, l.bottom ? height - l.marginY : l.marginY);
  ctx.restore();
}

export function createStampedStream(video: HTMLVideoElement, source: MediaStream, position: RecordDateTimeOverPosition, now: () => Date = () => new Date()): StampedStream {
  const settings = source.getVideoTracks?.()[0]?.getSettings?.() ?? {};
  const width = Math.round(settings.width || video.videoWidth || 1280);
  const height = Math.round(settings.height || video.videoHeight || 720);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof (canvas as any).captureStream !== 'function') throw new Error('This browser cannot write the date and time into the video.');

  let stopped = false;
  let lastDraw = 0;
  const draw = () => {
    if (stopped) return;
    lastDraw = Date.now();
    try {
      ctx.drawImage(video, 0, 0, width, height);
    } catch {
      // the video has no frame yet
    }
    drawDateTimeOver(ctx, width, height, position, now());
  };

  const v = video as any;
  const hasFrameCallback = typeof v.requestVideoFrameCallback === 'function';
  const onFrame = () => {
    if (stopped) return;
    draw();
    v.requestVideoFrameCallback(onFrame);
  };
  draw();
  if (hasFrameCallback) v.requestVideoFrameCallback(onFrame);
  const timer = setInterval(
    () => {
      if (!hasFrameCallback || Date.now() - lastDraw >= STAMPED_STREAM_WATCHDOG_MS) draw();
    },
    hasFrameCallback ? STAMPED_STREAM_WATCHDOG_MS / 2 : Math.round(1000 / STAMPED_STREAM_FPS),
  );

  const stream: MediaStream = (canvas as any).captureStream(STAMPED_STREAM_FPS);
  // the SAME microphone track: the sound switch ("Sound on" / "Sound off") (track.enabled) keeps working
  source.getAudioTracks().forEach((t) => stream.addTrack(t));

  return {
    stream,
    stop: () => {
      stopped = true;
      clearInterval(timer);
      stream.getVideoTracks?.().forEach((t) => t.stop());
    },
  };
}
