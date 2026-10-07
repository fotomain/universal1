// ReusableTable - PDF of a table (A4 landscape, header repeated on every page, "page i / n").
//   buildCanvasTablePdf  web: every page is drawn on a canvas (any alphabet) and stored as a picture
//   buildTextTablePdf    everywhere: real text with the built-in Helvetica font. That font knows only Western
//                        European letters (Windows-1252): other letters lose their diacritics (ā -> a) or become "?"
// buildTablePdf picks the canvas version when the platform has a canvas.
export const PDF_PAGE = { w: 841.89, h: 595.28, margin: 28 };
const FS = 9;
const TITLE_FS = 13;
const ROW_H = 16;
const PAD = 4;
const MAX_COL_W = 260;
const MIN_COL_W = 24;

export type Measure = (text: string, bold: boolean, size: number) => number;
export const approxMeasure: Measure = (t, bold, size) => t.length * size * (bold ? 0.56 : 0.52);

export interface TablePdfLayout { colX: number[]; colW: number[]; pages: string[][][]; tableTop: number }

export function fitPdfText(text: string, width: number, measure: Measure, bold = false, size = FS): string {
  const max = width - 2 * PAD;
  if (measure(text, bold, size) <= max) return text;
  let t = text;
  while (t.length > 0 && measure(t + '…', bold, size) > max) t = t.slice(0, -1);
  return t ? t + '…' : '';
}

/** column widths (natural, shrunk together when the page is too narrow) + the rows of every page */
export function layoutTablePdf(headers: string[], rows: string[][], measure: Measure): TablePdfLayout {
  const avail = PDF_PAGE.w - 2 * PDF_PAGE.margin;
  let colW = headers.map((h, i) => {
    let w = measure(h, true, FS);
    for (const r of rows) w = Math.max(w, measure(r[i] ?? '', false, FS));
    return Math.min(MAX_COL_W, w) + 2 * PAD;
  });
  const total = colW.reduce((a, b) => a + b, 0);
  if (total > avail) colW = colW.map((w) => Math.max(MIN_COL_W, (w * avail) / total));
  const colX: number[] = [];
  colW.reduce((x, w, i) => { colX[i] = x; return x + w; }, PDF_PAGE.margin);
  const tableTop = PDF_PAGE.h - PDF_PAGE.margin - 30;
  const perPage = Math.max(1, Math.floor((tableTop - PDF_PAGE.margin - 14) / ROW_H) - 1);
  const pages: string[][][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  if (pages.length === 0) pages.push([]);
  return { colX, colW, pages, tableTop };
}

// ───────────── tiny PDF writer ─────────────
const latin1 = (s: string) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
class PdfWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;
  private offsets: number[] = [];
  private put(d: string | Uint8Array) { const b = typeof d === 'string' ? latin1(d) : d; this.chunks.push(b); this.length += b.length; }
  constructor() { this.put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'); }
  obj(n: number, dict: string, stream?: string | Uint8Array) {
    this.offsets[n] = this.length;
    if (stream === undefined) { this.put(`${n} 0 obj\n${dict}\nendobj\n`); return; }
    const data = typeof stream === 'string' ? latin1(stream) : stream;
    this.put(`${n} 0 obj\n${dict.replace('>>', `/Length ${data.length} >>`)}\nstream\n`);
    this.put(data);
    this.put('\nendstream\nendobj\n');
  }
  finish(count: number): Uint8Array {
    const xref = this.length;
    let s = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= count; n++) s += `${String(this.offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`;
    this.put(`${s}trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(this.length);
    let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

// ───────────── text PDF (Helvetica, Windows-1252) ─────────────
const CP1252: Record<string, number> = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
/** text -> a PDF string literal in Windows-1252; unknown letters lose their diacritics or become "?" */
export function pdfString(text: string): string {
  let out = '';
  const push = (code: number) => { out += code === 0x28 || code === 0x29 || code === 0x5c ? `\\${String.fromCharCode(code)}` : code < 0x20 || code > 0x7e ? `\\${code.toString(8).padStart(3, '0')}` : String.fromCharCode(code); };
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) push(code);
    else if (CP1252[ch] !== undefined) push(CP1252[ch]);
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      push(base.length === 1 && base.charCodeAt(0) < 0x80 ? base.charCodeAt(0) : 0x3f);
    }
  }
  return `(${out})`;
}

export function buildTextTablePdf(title: string, subtitle: string, headers: string[], rows: string[][]): Uint8Array {
  const L = layoutTablePdf(headers, rows, approxMeasure);
  const { w, h, margin } = PDF_PAGE;
  const right = L.colX[L.colX.length - 1] + L.colW[L.colW.length - 1] || w - margin;
  const pdf = new PdfWriter();
  const n = L.pages.length;
  const kids = L.pages.map((_p, i) => `${5 + 2 * i} 0 R`).join(' ');
  pdf.obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  pdf.obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  pdf.obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pdf.obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const txt = (font: 1 | 2, size: number, x: number, y: number, s: string) => `BT /F${font} ${size} Tf ${n2(x)} ${n2(y)} Td ${pdfString(s)} Tj ET\n`;
  const line = (x1: number, y1: number, x2: number, y2: number, gray: number) => `${gray} G 0.5 w ${n2(x1)} ${n2(y1)} m ${n2(x2)} ${n2(y2)} l S\n`;
  L.pages.forEach((pageRows, p) => {
    let c = txt(2, TITLE_FS, margin, h - margin - TITLE_FS, title);
    c += '0.4 g\n' + txt(1, 8, margin, h - margin - TITLE_FS - 11, subtitle) + '0 g\n';
    let y = L.tableTop;
    headers.forEach((hd, i) => { c += txt(2, FS, L.colX[i] + PAD, y - ROW_H + 5, fitPdfText(hd, L.colW[i], approxMeasure, true)); });
    y -= ROW_H;
    c += line(margin, y, right, y, 0.3);
    for (const r of pageRows) {
      headers.forEach((_hd, i) => { c += txt(1, FS, L.colX[i] + PAD, y - ROW_H + 5, fitPdfText(r[i] ?? '', L.colW[i], approxMeasure)); });
      y -= ROW_H;
      c += line(margin, y, right, y, 0.85);
    }
    c += '0.4 g\n' + txt(1, 8, w - margin - 60, margin - 10, `page ${p + 1} / ${n}`) + '0 g\n';
    pdf.obj(5 + 2 * p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * p} 0 R >>`);
    pdf.obj(6 + 2 * p, '<< >>', c);
  });
  return pdf.finish(4 + 2 * n);
}

// ───────────── canvas PDF (web): the same layout drawn as pictures, any alphabet ─────────────
export function buildCanvasTablePdf(title: string, subtitle: string, headers: string[], rows: string[][]): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;
  const g = ctx;
  const S = 2;
  const { w, h, margin } = PDF_PAGE;
  const font = (bold: boolean, size: number) => `${bold ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`;
  const measure: Measure = (t, bold, size) => { g.font = font(bold, size); return g.measureText(t).width; };
  const L = layoutTablePdf(headers, rows, measure);
  const right = L.colX[L.colX.length - 1] + L.colW[L.colW.length - 1] || w - margin;
  const n = L.pages.length;
  const pdf = new PdfWriter();
  pdf.obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  pdf.obj(2, `<< /Type /Pages /Kids [${L.pages.map((_p, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`);
  // canvas y grows downwards: PDF y -> h - y
  const txt = (bold: boolean, size: number, x: number, y: number, s: string, color = '#000') => { g.font = font(bold, size); g.fillStyle = color; g.fillText(s, x, h - y); };
  const line = (y: number, color: string) => { g.strokeStyle = color; g.lineWidth = 0.5; g.beginPath(); g.moveTo(margin, h - y); g.lineTo(right, h - y); g.stroke(); };
  for (let p = 0; p < n; p++) {
    canvas!.width = Math.round(w * S);
    canvas!.height = Math.round(h * S);
    g.setTransform(S, 0, 0, S, 0, 0);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.textBaseline = 'alphabetic';
    txt(true, TITLE_FS, margin, h - margin - TITLE_FS, title);
    txt(false, 8, margin, h - margin - TITLE_FS - 11, subtitle, '#666');
    let y = L.tableTop;
    headers.forEach((hd, i) => txt(true, FS, L.colX[i] + PAD, y - ROW_H + 5, fitPdfText(hd, L.colW[i], measure, true)));
    y -= ROW_H;
    line(y, '#4d4d4d');
    for (const r of L.pages[p]) {
      headers.forEach((_hd, i) => txt(false, FS, L.colX[i] + PAD, y - ROW_H + 5, fitPdfText(r[i] ?? '', L.colW[i], measure)));
      y -= ROW_H;
      line(y, '#d9d9d9');
    }
    txt(false, 8, w - margin - 60, margin - 10, `page ${p + 1} / ${n}`, '#666');
    const b64 = canvas!.toDataURL('image/jpeg', 0.92).split(',')[1] || '';
    const bin = atob(b64);
    const jpeg = latin1(bin);
    if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
    pdf.obj(3 + 3 * p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${5 + 3 * p} 0 R >> >> /Contents ${4 + 3 * p} 0 R >>`);
    pdf.obj(4 + 3 * p, '<< >>', `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`);
    pdf.obj(5 + 3 * p, `<< /Type /XObject /Subtype /Image /Width ${canvas!.width} /Height ${canvas!.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>`, jpeg);
  }
  return pdf.finish(2 + 3 * n);
}

export function buildTablePdf(title: string, subtitle: string, headers: string[], rows: string[][]): Uint8Array {
  let pictures: Uint8Array | null = null;
  try { pictures = buildCanvasTablePdf(title, subtitle, headers, rows); } catch { pictures = null; }
  return pictures ?? buildTextTablePdf(title, subtitle, headers, rows);
}
