// Minimal PDF writer (pure, no dependencies): ONE page with ONE JPEG picture (DCTDecode), fitted into the page.
// Used by the Project Dashboard "Export to PDF" (the picture = a header with the project name and dates +
// what the user sees: task tree + Gantt chart).

export interface PMPdfPicture {
  /** JPEG file bytes (baseline, RGB) */
  jpeg: Uint8Array;
  /** picture size in pixels */
  width: number;
  height: number;
}

export interface PMPdfPageLayout {
  pageWidth: number;
  pageHeight: number;
  /** where the picture is drawn (PDF points, origin = bottom-left) */
  x: number;
  y: number;
  drawWidth: number;
  drawHeight: number;
}

/** A4 in PDF points (1/72 inch) */
export const PM_PDF_A4 = { short: 595.28, long: 841.89 };
export const PM_PDF_MARGIN = 20;

/** A4 page in the orientation of the picture; the picture keeps its proportions, fills the page width / height
 *  inside the margins, centered horizontally and placed at the top. */
export function pdfPageLayoutFor(width: number, height: number, margin = PM_PDF_MARGIN): PMPdfPageLayout {
  const landscape = width >= height;
  const pageWidth = landscape ? PM_PDF_A4.long : PM_PDF_A4.short;
  const pageHeight = landscape ? PM_PDF_A4.short : PM_PDF_A4.long;
  const maxW = pageWidth - 2 * margin;
  const maxH = pageHeight - 2 * margin;
  const k = Math.min(maxW / Math.max(1, width), maxH / Math.max(1, height));
  const drawWidth = width * k;
  const drawHeight = height * k;
  return { pageWidth, pageHeight, x: (pageWidth - drawWidth) / 2, y: pageHeight - margin - drawHeight, drawWidth, drawHeight };
}

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** The PDF file bytes. */
export function buildPicturePdf(picture: PMPdfPicture, layout: PMPdfPageLayout = pdfPageLayoutFor(picture.width, picture.height)): Uint8Array {
  const { jpeg, width, height } = picture;
  if (!jpeg || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('PDF export: the picture is not a JPEG');
  if (!(width > 0) || !(height > 0)) throw new Error('PDF export: the picture is empty');
  const content = `q ${n2(layout.drawWidth)} 0 0 ${n2(layout.drawHeight)} ${n2(layout.x)} ${n2(layout.y)} cm /Im0 Do Q`;
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === 'string' ? ascii(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (id: number, body: string) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };
  // binary marker line: tells readers / transfer tools the file is binary
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(layout.pageWidth)} ${n2(layout.pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(width)} /Height ${Math.round(height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = length;
  let table = 'xref\n0 6\n0000000000 65535 f \n';
  for (let id = 1; id <= 5; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(`${table}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < bytes.length ? B64[c & 63] : '=');
    if (s.length > 8192) {
      chunks.push(s);
      s = '';
    }
  }
  chunks.push(s);
  return chunks.join('');
}

/** "Project_name_2026-10-06-09-23-00.pdf" */
export function dashboardPdfFileName(projectName: string | null | undefined, now = new Date()): string {
  const safe = (projectName || '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'project';
  return `${safe}_${now.toISOString().replace(/[:T]/g, '-').slice(0, 19)}.pdf`;
}

/** Header drawn above the pictures: project name + start / finish dates (already formatted). */
export interface PMPdfHeader {
  projectName: string;
  start?: string;
  finish?: string;
  /** translated "Start" / "Finish" */
  startLabel?: string;
  finishLabel?: string;
}

/** header height in layout px (scaled to the screenshot's pixels) */
export const PM_PDF_HEADER_HEIGHT = 56;

/** The two lines of the header: "Project name" and "Start: 2026-10-06   ·   Finish: 2026-12-18". */
export function pdfHeaderLines(h: PMPdfHeader): { title: string; subtitle: string } {
  const parts: string[] = [];
  if (h.start) parts.push(`${h.startLabel || 'Start'}: ${h.start}`);
  if (h.finish) parts.push(`${h.finishLabel || 'Finish'}: ${h.finish}`);
  return { title: (h.projectName || '').trim() || 'Project', subtitle: parts.join('   ·   ') };
}

export interface PMRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The dashboard rectangle (layout px, window coordinates) in screenshot pixels, clipped to the screenshot. */
export function cropRectInPixels(rect: PMRect, windowWidth: number, imageWidth: number, imageHeight: number): PMRect | null {
  const k = imageWidth / Math.max(1, windowWidth);
  const x = Math.max(0, Math.round(rect.x * k));
  const y = Math.max(0, Math.round(rect.y * k));
  const right = Math.min(imageWidth, Math.round((rect.x + rect.width) * k));
  const bottom = Math.min(imageHeight, Math.round((rect.y + rect.height) * k));
  if (right - x < 2 || bottom - y < 2) return null;
  return { x, y, width: right - x, height: bottom - y };
}
