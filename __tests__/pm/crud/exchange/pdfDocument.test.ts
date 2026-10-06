import { buildPicturePdf, bytesToBase64, cropRectInPixels, dashboardPdfFileName, pdfPageLayoutFor, PM_PDF_A4, PM_PDF_MARGIN } from '../../../../kit8/pm/crud/exchange/pdf/pdfDocument';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const text = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');

describe('pdfDocument', () => {
  it('page: A4 in the orientation of the picture, picture fitted with its proportions', () => {
    const l = pdfPageLayoutFor(1600, 800);
    expect(l.pageWidth).toBe(PM_PDF_A4.long);
    expect(l.drawWidth).toBeCloseTo(PM_PDF_A4.long - 2 * PM_PDF_MARGIN);
    expect(l.drawWidth / l.drawHeight).toBeCloseTo(2);
    expect(l.y + l.drawHeight).toBeCloseTo(l.pageHeight - PM_PDF_MARGIN);
    const p = pdfPageLayoutFor(400, 900);
    expect(p.pageWidth).toBe(PM_PDF_A4.short);
    expect(p.drawHeight).toBeLessThanOrEqual(p.pageHeight - 2 * PM_PDF_MARGIN + 0.01);
  });

  it('builds a valid one-page PDF with the JPEG inside and a correct xref table', () => {
    const pdf = buildPicturePdf({ jpeg, width: 1600, height: 800 });
    const s = text(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/Filter /DCTDecode /Length 9');
    expect(s).toContain('/Width 1600 /Height 800');
    expect(s).toContain(text(jpeg));
    const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xref, xref + 4)).toBe('xref');
    const offsets = s.slice(xref).split('\n').slice(3, 8).map((l) => Number(l.slice(0, 10)));
    offsets.forEach((o, i) => expect(s.slice(o, o + 7)).toBe(`${i + 1} 0 obj`));
  });

  it('refuses a picture that is not a JPEG', () => {
    expect(() => buildPicturePdf({ jpeg: new Uint8Array([1, 2, 3, 4]), width: 10, height: 10 })).toThrow();
  });

  it('base64, file name, crop rectangle', () => {
    expect(bytesToBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu');
    expect(bytesToBase64(new Uint8Array([77, 97]))).toBe('TWE=');
    expect(bytesToBase64(new Uint8Array([77]))).toBe('TQ==');
    expect(dashboardPdfFileName('My project / 1', new Date('2026-10-06T06:23:00Z'))).toBe('My_project_1_2026-10-06-06-23-00.pdf');
    expect(dashboardPdfFileName('', new Date('2026-10-06T06:23:00Z'))).toBe('project_2026-10-06-06-23-00.pdf');
    // 2x screenshot of a 1000 px wide window
    expect(cropRectInPixels({ x: 10, y: 100, width: 500, height: 300 }, 1000, 2000, 1600)).toEqual({ x: 20, y: 200, width: 1000, height: 600 });
    expect(cropRectInPixels({ x: 900, y: 700, width: 500, height: 300 }, 1000, 2000, 1600)).toEqual({ x: 1800, y: 1400, width: 200, height: 200 });
    expect(cropRectInPixels({ x: 2000, y: 0, width: 10, height: 10 }, 1000, 2000, 1600)).toBeNull();
  });
});
