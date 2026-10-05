// "Share screenshot" / "Share screenshot + JSON" (app three dots menu, PM windows).
//
//   captureAppScreenshot()            -> PNG of what the user sees, as BASE64 (never written to a public folder)
//   shareScreenshot({ withJSON })     -> share sheet with the PNG (+ the JSON of uxui.currentJSON as a .json file)
//
//   web      html2canvas renders the DOM; canvases that cannot be read back by it (Skia / WebGL: the Gantt
//            chart and the task tree) register a snapshot function here (registerScreenshotCanvas) and are
//            replaced by an <img src="data:image/png;base64,..."> in the cloned document.
//            Sharing: Web Share API with files (phones, Safari, Chrome); otherwise the PNG / JSON are
//            downloaded (Blob + <a download>) and the JSON is also copied to the clipboard.
//   native   react-native-view-shot captureScreen (result: 'base64'). iOS: share sheet with the data URL.
//            Android: the picture is put on the clipboard (expo-clipboard setImageAsync) and the share
//            sheet gets the text (Android's text share sheet cannot carry a base64 picture).

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getUxuiState } from '../redux/storeRef';

export type ShareScreenshotResult = 'shared' | 'downloaded' | 'copied' | 'dismissed' | 'failed';

export interface ScreenshotCanvasSource {
  /** DOM element (web) that contains the canvas */
  element: () => any;
  /** PNG of the canvas as base64 (no "data:" prefix), null when it cannot be read now */
  snapshot: () => string | null | Promise<string | null>;
}

const canvasSources = new Map<string, ScreenshotCanvasSource>();

/** Skia canvases (web): register how to read them back. Returns the unregister function. */
export function registerScreenshotCanvas(id: string, source: ScreenshotCanvasSource): () => void {
  canvasSources.set(id, source);
  return () => {
    if (canvasSources.get(id) === source) canvasSources.delete(id);
  };
}

/** base64 PNG of a Skia canvas ref (useCanvasRef) - sync or async API, whatever this Skia version has. */
export async function skiaCanvasSnapshotBase64(ref: any): Promise<string | null> {
  try {
    const view = ref?.current ?? ref;
    if (!view) return null;
    let image: any = null;
    if (typeof view.makeImageSnapshot === 'function') image = view.makeImageSnapshot();
    if (!image && typeof view.makeImageSnapshotAsync === 'function') image = await view.makeImageSnapshotAsync();
    if (!image || typeof image.encodeToBase64 !== 'function') return null;
    const b64 = image.encodeToBase64();
    return typeof b64 === 'string' && b64.length > 0 ? b64 : null;
  } catch {
    return null;
  }
}

const stripDataPrefix = (s: string) => s.replace(/^data:image\/\w+;base64,/, '');

async function captureWeb(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  // 1. read the registered (Skia) canvases first and mark their elements
  const marks: { el: any; id: string; data: string }[] = [];
  let n = 0;
  for (const [, src] of canvasSources) {
    try {
      const el = src.element();
      if (!el || typeof el.setAttribute !== 'function') continue;
      const data = await src.snapshot();
      if (!data) continue;
      const id = `shot-${++n}`;
      el.setAttribute('data-screenshot-id', id);
      marks.push({ el, id, data: stripDataPrefix(data) });
    } catch {
      // this canvas stays as html2canvas sees it
    }
  }
  try {
    const mod: any = require('html2canvas');
    const html2canvas = mod?.default ?? mod;
    const canvas: HTMLCanvasElement = await html2canvas(document.body, {
      useCORS: true,
      logging: false,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      scale: Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1),
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
      onclone: (doc: Document) => {
        for (const m of marks) {
          const box = doc.querySelector(`[data-screenshot-id="${m.id}"]`) as HTMLElement | null;
          const cv = box?.querySelector('canvas') as HTMLCanvasElement | null;
          if (!box || !cv) continue;
          const img = doc.createElement('img');
          img.src = `data:image/png;base64,${m.data}`;
          const r = (m.el.querySelector?.('canvas') ?? m.el).getBoundingClientRect();
          img.style.width = `${r.width}px`;
          img.style.height = `${r.height}px`;
          img.style.display = 'block';
          cv.parentNode?.replaceChild(img, cv);
        }
      },
    });
    return stripDataPrefix(canvas.toDataURL('image/png'));
  } catch (e) {
    console.warn('captureAppScreenshot (web) failed', e);
    return null;
  } finally {
    for (const m of marks) m.el.removeAttribute?.('data-screenshot-id');
  }
}

async function captureNative(): Promise<string | null> {
  try {
    const { captureScreen } = require('react-native-view-shot');
    const b64: string = await captureScreen({ format: 'png', quality: 0.9, result: 'base64' });
    return b64 ? stripDataPrefix(b64) : null;
  } catch (e) {
    console.warn('captureAppScreenshot (native) failed', e);
    return null;
  }
}

/** PNG screenshot of the app as base64 (no "data:" prefix); null when it could not be taken. */
export function captureAppScreenshot(): Promise<string | null> {
  return Platform.OS === 'web' ? captureWeb() : captureNative();
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const safeName = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'data';

/** The JSON text "Share screenshot + JSON" sends: uxui.currentJSON (or the `json` given). */
export function currentJSONText(json?: any): { text: string; fileName: string; title: string } | null {
  const cur = json !== undefined ? { kind: 'data', title: '', json } : getUxuiState()?.currentJSON;
  if (!cur || cur.json === undefined || cur.json === null) return null;
  let text: string;
  try {
    text = JSON.stringify(cur.json, null, 2);
  } catch {
    return null;
  }
  const title = cur.title || cur.kind || 'data';
  return { text, fileName: `${safeName(cur.kind || 'data')}_${safeName(title)}_${stamp()}.json`, title };
}

export interface ShareScreenshotOptions {
  /** also share the JSON of uxui.currentJSON */
  withJSON?: boolean;
  /** JSON to share instead of uxui.currentJSON */
  json?: any;
  title?: string;
}

/**
 * Takes the screenshot and shares it (with the current JSON when asked). Call it AFTER the menu that
 * started it has closed (the three dots menu waits for its fade-out).
 */
export async function shareScreenshot(opts: ShareScreenshotOptions = {}): Promise<ShareScreenshotResult> {
  const b64 = await captureAppScreenshot();
  const json = opts.withJSON ? currentJSONText(opts.json) : null;
  const title = opts.title || (json ? `Screenshot + JSON: ${json.title}` : 'Screenshot');
  const pngName = `screenshot_${stamp()}.png`;
  if (!b64 && !json) return 'failed';
  try {
    if (Platform.OS === 'web') {
      const files: File[] = [];
      if (b64) files.push(new File([base64ToBlob(b64, 'image/png')], pngName, { type: 'image/png' }));
      // text/plain: browsers refuse application/json files in the Web Share API
      if (json) files.push(new File([json.text], json.fileName.replace(/\.json$/, '.json.txt'), { type: 'text/plain' }));
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share && nav?.canShare && files.length && nav.canShare({ files })) {
        try {
          await nav.share({ files, title, text: title });
          return 'shared';
        } catch (e: any) {
          if (e?.name === 'AbortError') return 'dismissed';
          // no user activation any more / not allowed here -> download below
        }
      }
      if (b64) downloadBlob(base64ToBlob(b64, 'image/png'), pngName);
      if (json) {
        downloadBlob(new Blob([json.text], { type: 'application/json;charset=utf-8' }), json.fileName);
        try {
          await Clipboard.setStringAsync(json.text);
        } catch {
          // clipboard not available: the file was downloaded
        }
      }
      return 'downloaded';
    }
    if (Platform.OS === 'ios') {
      const res = await Share.share(
        b64 ? { title, message: json ? json.text : undefined, url: `data:image/png;base64,${b64}` } : { title, message: json!.text }
      );
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    }
    // Android: picture -> clipboard, text -> share sheet
    let copied = false;
    if (b64) {
      try {
        await (Clipboard as any).setImageAsync(b64);
        copied = true;
      } catch {
        copied = false;
      }
    }
    const message = json ? json.text : copied ? 'The screenshot is on the clipboard - paste it into the chat / mail.' : title;
    const res = await Share.share({ title, message }, { dialogTitle: title });
    if (res.action === Share.dismissedAction) return copied ? 'copied' : 'dismissed';
    return 'shared';
  } catch (e) {
    console.warn('shareScreenshot failed', e);
    return 'failed';
  }
}

export function shareScreenshotResultText(r: ShareScreenshotResult, withJSON: boolean): string {
  switch (r) {
    case 'shared':
      return withJSON ? 'Screenshot + JSON shared' : 'Screenshot shared';
    case 'downloaded':
      return withJSON ? 'Screenshot + JSON downloaded (the JSON is also on the clipboard)' : 'Screenshot downloaded';
    case 'copied':
      return 'Screenshot copied to the clipboard';
    case 'dismissed':
      return 'Sharing cancelled';
    default:
      return 'Could not take the screenshot';
  }
}
