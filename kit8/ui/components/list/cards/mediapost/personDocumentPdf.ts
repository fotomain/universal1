// The PDF of a person's ID card / passport (Export / Share -> PDF of PersonDocumentDetailsCard): ONE document page (A4 portrait) with the OWNER PHOTO,
// the name, the document and EVERY datum; more pages when the data is long. Pure: no React, no native module; the JPEG of the post is put into the PDF as it is (DCTDecode).
// Text = the built-in Helvetica font (Windows-1252, like the table PDF): letters outside it lose their marks (ā -> a). A PNG photo is not embedded (the post stores JPEG).
import { approxMeasure, fitPdfText, n2, PdfWriter, pdfString } from '../../../table/reusable/tablePdf';
import type { PersonDocumentDetails } from './personDocumentModel';

const PAGE = { w: 595.28, h: 841.89, margin: 40 };
const LABEL_W = 150;
const LINE_H = 13;

export interface JpegInfo { bytes: Uint8Array; width: number; height: number; components: number }

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]), b = B64.indexOf(clean[i + 1]), c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1, d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0 && o < out.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && o < out.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, o);
}

/** the JPEG of `data:image/jpeg;base64,...` with its size (from the start-of-frame marker); null for anything else or a broken file */
export function jpegOfDataUri(uri: string): JpegInfo | null {
  const m = /^data:image\/jpe?g;base64,(.*)$/is.exec(uri || '');
  if (!m) return null;
  const b = base64ToBytes(m[1]);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    // SOF0..SOF15 except DHT (c4), JPG (c8), DAC (cc)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (b[i + 5] << 8) | b[i + 6];
      const width = (b[i + 7] << 8) | b[i + 8];
      const components = b[i + 9];
      return width > 0 && height > 0 && [1, 3, 4].includes(components) ? { bytes: b, width, height, components } : null;
    }
    i += 2 + len;
  }
  return null;
}

/** words of `text` in lines no wider than `width` (an over long word is cut) */
export function wrapPdfText(text: string, width: number, size = 10): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    let w = word;
    while (approxMeasure(w, false, size) > width) { const cut = Math.max(1, Math.floor(width / (size * 0.52))); if (line) { out.push(line); line = ''; } out.push(w.slice(0, cut)); w = w.slice(cut); }
    const next = line ? `${line} ${w}` : w;
    if (approxMeasure(next, false, size) <= width) line = next; else { if (line) out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

export function buildPersonDocumentPdf(d: PersonDocumentDetails): Uint8Array {
  const { w, h, margin } = PAGE;
  const jpeg = jpegOfDataUri(d.photoUri);
  const txt = (bold: boolean, size: number, x: number, y: number, s: string) => `BT /F${bold ? 2 : 1} ${size} Tf ${n2(x)} ${n2(y)} Td ${pdfString(s)} Tj ET\n`;
  const rule = (y: number) => `0.85 G 0.5 w ${n2(margin)} ${n2(y)} m ${n2(w - margin)} ${n2(y)} l S\n`;
  const pages: string[] = [];
  let c = '';
  let y = h - margin;

  // first page: the photo at the left, name and document at the right of it
  const photoW = 120;
  const photoH = jpeg ? (photoW * jpeg.height) / jpeg.width : 0;
  const textX = jpeg ? margin + photoW + 20 : margin;
  if (jpeg) c += `q ${n2(photoW)} 0 0 ${n2(photoH)} ${n2(margin)} ${n2(y - photoH)} cm /Im0 Do Q\n`;
  let ty = y - 18;
  for (const l of wrapPdfText(d.name || '-', w - margin - textX, 16)) { c += txt(true, 16, textX, ty, l); ty -= 20; }
  c += txt(false, 11, textX, ty, `${d.kind}${d.number ? ` · No. ${d.number}` : ''}`); ty -= 16;
  if (d.created) { c += '0.4 g\n' + txt(false, 8, textX, ty, `Post made ${d.created}`) + '0 g\n'; ty -= 12; }
  y = Math.min(y - photoH, ty) - 18;

  const valueX = margin + LABEL_W;
  for (const f of d.fields) {
    const lines = wrapPdfText(f.value, w - margin - valueX, 10);
    const need = lines.length * LINE_H + 6;
    if (y - need < margin + 20) { pages.push(c); c = ''; y = h - margin; }
    c += '0.4 g\n' + txt(true, 8, margin, y - 10, fitPdfText(f.label, LABEL_W, approxMeasure, true, 8)) + '0 g\n';
    lines.forEach((l, i) => { c += txt(false, 10, valueX, y - 10 - i * LINE_H, l); });
    y -= need;
    c += rule(y + 2);
  }
  pages.push(c);

  const n = pages.length;
  const pdf = new PdfWriter();
  const imageObj = 5;
  const first = jpeg ? 6 : 5;
  pdf.obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  pdf.obj(2, `<< /Type /Pages /Kids [${pages.map((_p, i) => `${first + 2 * i} 0 R`).join(' ')}] /Count ${n} >>`);
  pdf.obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pdf.obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  if (jpeg) pdf.obj(imageObj, `<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /${jpeg.components === 1 ? 'DeviceGray' : jpeg.components === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 ${jpeg.components === 4 ? '/Decode [1 0 1 0 1 0 1 0] ' : ''}/Filter /DCTDecode >>`, jpeg.bytes);
  pages.forEach((content, i) => {
    const page = first + 2 * i;
    const res = `<< /Font << /F1 3 0 R /F2 4 0 R >>${jpeg && i === 0 ? ` /XObject << /Im0 ${imageObj} 0 R >>` : ''} >>`;
    pdf.obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources ${res} /Contents ${page + 1} 0 R >>`);
    pdf.obj(page + 1, '<< >>', content + `0.4 g\n${txt(false, 8, w - margin - 60, margin - 14, `page ${i + 1} / ${n}`)}0 g\n`);
  });
  return pdf.finish(first - 1 + 2 * n);
}

