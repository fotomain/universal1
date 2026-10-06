// Project Dashboard -> PDF: the task tree + Gantt chart exactly as the user sees them on the screen.
//
//   1. screenshot of the app (kit8/lib/shareScreenshot: html2canvas + the Skia canvases on web, view-shot on native)
//   2. cropped to the dashboard pictures (the rectangle PMGanttSurface registers here: tree | splitter | chart,
//      without the two toolbars) and encoded as JPEG - with Skia, the same code on web / iOS / Android
//      The main FAB is hidden while the picture is taken (captureAppScreenshot({ hideFab })).
//   3. a header is drawn above the pictures: the PROJECT NAME and its start - finish dates
//      (web: 2D canvas with the system fonts = any alphabet; iOS / Android: Skia with the system font)
//   4. one A4 page (orientation of the picture) - pdfDocument.ts - downloaded / shared (downloadBinaryFile.ts)

import { Dimensions, Platform } from 'react-native';
import { captureAppScreenshot } from '../../../../lib/shareScreenshot';
import { buildPicturePdf, cropRectInPixels, dashboardPdfFileName, pdfHeaderLines, PMPdfHeader, PMRect, PM_PDF_HEADER_HEIGHT } from './pdfDocument';
import { downloadBinaryFile, PMBinaryDownloadResult } from './downloadBinaryFile';
import { usePMStore } from '../../../store/store_pm';
import { DAY_MS } from '../../../model/constants';
import { formatPlanDate } from '../../../model/types';
import { formatDateISO } from '../../../view/project/scheduling';
import { pmT } from '../../../i18n/pmT';

/** JPEG quality of the picture inside the PDF (0-100) */
export const PM_PDF_JPEG_QUALITY = 95;

type TargetMeasure = () => Promise<PMRect | null>;
let target: TargetMeasure | null = null;

/** PMGanttSurface: how to measure the pictures (window coordinates). Returns the unregister function. */
export function registerDashboardPdfTarget(measure: TargetMeasure): () => void {
  target = measure;
  return () => {
    if (target === measure) target = null;
  };
}

/** measureInWindow of a view as a promise (null when it is not on the screen) */
export function measureViewInWindow(node: any): Promise<PMRect | null> {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    node.measureInWindow((x: number, y: number, width: number, height: number) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

const SYSTEM_FONTS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Draws the header (project name + dates) into the top `height` pixels of the Skia canvas. k = pixels per layout px. */
function drawPdfHeader(canvas: any, header: PMPdfHeader, width: number, height: number, k: number) {
  const { Skia, matchFont } = require('@shopify/react-native-skia');
  const { title, subtitle } = pdfHeaderLines(header);
  const pad = Math.round(12 * k);
  const titleSize = Math.round(18 * k);
  const subSize = Math.round(12 * k);
  const titleY = subtitle ? height * 0.36 : height * 0.5;
  const subY = height * 0.76;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // CanvasKit has no system fonts (and the bundled font is Latin only): the browser draws the text
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111111';
    ctx.font = `700 ${titleSize}px ${SYSTEM_FONTS}`;
    ctx.fillText(fitText(title, width - 2 * pad, (t) => ctx.measureText(t).width), pad, titleY);
    if (subtitle) {
      ctx.fillStyle = '#444444';
      ctx.font = `400 ${subSize}px ${SYSTEM_FONTS}`;
      ctx.fillText(fitText(subtitle, width - 2 * pad, (t) => ctx.measureText(t).width), pad, subY);
    }
    const picture = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(cv.toDataURL('image/png').replace(/^data:image\/\w+;base64,/, '')));
    if (picture) canvas.drawImage(picture, 0, 0);
    return;
  }
  const family = Platform.select({ ios: 'Helvetica', default: 'sans-serif' }) as string;
  const titleFont = matchFont({ fontFamily: family, fontSize: titleSize, fontWeight: 'bold' });
  const subFont = matchFont({ fontFamily: family, fontSize: subSize });
  const widthOf = (font: any) => (t: string) => {
    try {
      return font.measureText(t).width;
    } catch {
      return t.length * font.getSize() * 0.6;
    }
  };
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color('#111111'));
  canvas.drawText(fitText(title, width - 2 * pad, widthOf(titleFont)), pad, titleY + titleSize * 0.35, paint, titleFont);
  if (subtitle) {
    paint.setColor(Skia.Color('#444444'));
    canvas.drawText(fitText(subtitle, width - 2 * pad, widthOf(subFont)), pad, subY + subSize * 0.35, paint, subFont);
  }
}

/** Cuts the text with … until it fits `maxWidth`. */
export function fitText(text: string, maxWidth: number, widthOf: (t: string) => number): string {
  if (widthOf(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && widthOf(`${t}…`) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** PNG screenshot (base64) -> JPEG bytes of the dashboard rectangle, with the header (when given) above it. */
export function cropScreenshotToJpeg(pngBase64: string, rect: PMRect, windowWidth: number, header?: PMPdfHeader | null): { jpeg: Uint8Array; width: number; height: number } {
  // required here, not imported: on web Skia modules must not be evaluated before CanvasKit is loaded
  const { Skia, ImageFormat } = require('@shopify/react-native-skia');
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(pngBase64));
  if (!image) throw new Error(pmT('the screenshot could not be read'));
  const crop = cropRectInPixels(rect, windowWidth, image.width(), image.height());
  if (!crop) throw new Error(pmT('the task tree / Gantt chart is not on the screen'));
  const k = image.width() / Math.max(1, windowWidth);
  const headerH = header ? Math.round(PM_PDF_HEADER_HEIGHT * k) : 0;
  const surface = Skia.Surface.Make(crop.width, crop.height + headerH);
  if (!surface) throw new Error(pmT('the picture is too large'));
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#ffffff'));
  if (header && headerH > 0) {
    try {
      drawPdfHeader(canvas, header, crop.width, headerH, k);
    } catch (e) {
      console.warn('PDF export: the header could not be drawn', e);
    }
  }
  canvas.drawImageRect(image, Skia.XYWHRect(crop.x, crop.y, crop.width, crop.height), Skia.XYWHRect(0, headerH, crop.width, crop.height), Skia.Paint());
  surface.flush();
  const jpeg: Uint8Array = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, PM_PDF_JPEG_QUALITY);
  if (!jpeg || !jpeg.length) throw new Error(pmT('the picture could not be encoded'));
  return { jpeg, width: crop.width, height: crop.height + headerH };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Exports what the dashboard shows now. `header` = project name + dates drawn above the pictures (a plain string
 * = the name only). Throws an Error with a message for the user when it cannot.
 */
export async function exportDashboardToPdf(header?: PMPdfHeader | string | null, opts: { delayMs?: number } = {}): Promise<PMBinaryDownloadResult> {
  const head: PMPdfHeader | null = typeof header === 'string' ? { projectName: header } : header ?? null;
  if (!target) throw new Error(pmT('PDF export: open the task tree / Gantt chart first'));
  // menus, tips and the pressed state of the button fade out before the picture is taken
  await wait(opts.delayMs ?? 180);
  const rect = await target();
  if (!rect) throw new Error(pmT('PDF export: the task tree / Gantt chart is not on the screen'));
  const png = await captureAppScreenshot({ hideFab: true });
  if (!png) throw new Error(pmT('PDF export: the screen could not be captured'));
  let picture;
  try {
    picture = cropScreenshotToJpeg(png, rect, Dimensions.get('window').width, head);
  } catch (e: any) {
    throw new Error(`${pmT('PDF export')}: ${e?.message || e}`);
  }
  return downloadBinaryFile(dashboardPdfFileName(head?.projectName), buildPicturePdf(picture));
}

/** The header of the project that is open on the dashboard (name, start, finish - from the store). */
export function dashboardPdfHeaderOf(projectGUID: string | null | undefined): PMPdfHeader | null {
  const s = usePMStore.getState();
  const project = projectGUID ? s.projectsById[projectGUID] : undefined;
  if (!project) return null;
  const loaded = s.loadedProjectGUID === projectGUID;
  const fmt = project.rowJSON?.planDateInputFormat;
  const show = (ms: number) => (fmt === 'DD.MM.YYYY' || fmt === 'MM/DD/YYYY' || fmt === 'DD/MM/YYYY' ? formatPlanDate(ms, fmt) : formatDateISO(ms));
  return {
    projectName: project.rowJSON?.name || '',
    start: loaded ? show(s.projectStartMs) : undefined,
    // the store's finish is exclusive: the last day of the project is the day before
    finish: loaded ? show(Math.max(s.projectStartMs, s.projectFinishMs - DAY_MS)) : undefined,
    startLabel: pmT('Start'),
    finishLabel: pmT('Finish'),
  };
}

/** "Export to PDF" of a project: the dashboard as shown now, with the project's header. */
export function exportProjectDashboardToPdf(projectGUID: string | null | undefined, opts: { delayMs?: number } = {}) {
  return exportDashboardToPdf(dashboardPdfHeaderOf(projectGUID), opts);
}
