// The PDF of a person document: the owner photo (the JPEG as it is), the name, the document and every datum.
import * as fs from 'fs';
import * as path from 'path';
import { base64ToBytes, buildPersonDocumentPdf, jpegOfDataUri, wrapPdfText } from '../../../kit8/ui/components/list/cards/mediapost/personDocumentPdf';
import type { PersonDocumentDetails } from '../../../kit8/ui/components/list/cards/mediapost/personDocumentModel';

const jpeg = fs.readFileSync(path.join(__dirname, '../../media/fixtures/face_30x40.jpg'));
const uri = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const details = (over: Partial<PersonDocumentDetails> = {}): PersonDocumentDetails => ({
  name: 'JURIJS TERENTJEVS', kind: 'Passport', number: 'LV6073206', photoUri: uri, created: '2026-11-23 19:30',
  fields: [{ label: 'Surname', value: 'TERENTJEVS' }, { label: 'Date of birth', value: '02.10.1971' }], ...over,
});
const text = (b: Uint8Array) => Buffer.from(b).toString('latin1');

it('reads the JPEG and its size from the data address; anything else is no photo', () => {
  const j = jpegOfDataUri(uri)!;
  expect(j).toMatchObject({ width: 30, height: 40, components: 3 });
  expect(j.bytes.length).toBe(jpeg.length);
  expect(Buffer.from(j.bytes).equals(jpeg)).toBe(true);
  expect(jpegOfDataUri('data:image/png;base64,AAAA')).toBeNull();
  expect(jpegOfDataUri('')).toBeNull();
  expect(jpegOfDataUri('data:image/jpeg;base64,AAAA')).toBeNull();
  expect(Buffer.from(base64ToBytes('SGVsbG8=')).toString()).toBe('Hello');
});

it('the PDF holds the photo (as an image of the page), the name, the document and every datum', () => {
  const pdf = buildPersonDocumentPdf(details());
  const s = text(pdf);
  expect(s.startsWith('%PDF-1.4')).toBe(true);
  expect(s).toContain('/Subtype /Image /Width 30 /Height 40 /ColorSpace /DeviceRGB');
  expect(s).toContain('/Filter /DCTDecode');
  expect(s).toContain('/Im0 Do');
  // the JPEG bytes are inside the file, untouched
  expect(Buffer.from(pdf).includes(jpeg)).toBe(true);
  ['(JURIJS TERENTJEVS)', '(Passport \\267 No. LV6073206)', '(Surname)', '(TERENTJEVS)', '(Date of birth)', '(02.10.1971)', '(page 1 / 1)'].forEach((t) => expect(s).toContain(t));
  expect(s.trim().endsWith('%%EOF')).toBe(true);
});

it('xref points at every object (the file opens)', () => {
  const s = text(buildPersonDocumentPdf(details()));
  const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
  expect(s.slice(xref, xref + 4)).toBe('xref');
  const count = Number(/xref\n0 (\d+)/.exec(s)![1]);
  const entries = s.slice(xref).split('\n').slice(2, 2 + count);
  entries.slice(1).forEach((e, i) => { const off = Number(e.slice(0, 10)); expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`); });
});

it('no photo = no image object, the data is still there', () => {
  const s = text(buildPersonDocumentPdf(details({ photoUri: '' })));
  expect(s).not.toContain('/Subtype /Image');
  expect(s).toContain('(JURIJS TERENTJEVS)');
});

it('a long list of data goes on more pages, the photo only on the first', () => {
  const fields = Array.from({ length: 80 }, (_v, i) => ({ label: `Field ${i}`, value: `Value ${i} ` + 'long text '.repeat(12) }));
  const s = text(buildPersonDocumentPdf(details({ fields })));
  const pages = (s.match(/\/Type \/Page /g) || []).length;
  expect(pages).toBeGreaterThan(1);
  expect(s.match(/\/Im0 Do/g)).toHaveLength(1);
  expect(s).toContain(`(page ${pages} / ${pages})`);
});

it('text is wrapped to the width, an over long word is cut', () => {
  expect(wrapPdfText('aaa bbb ccc', 30, 10).length).toBeGreaterThan(1);
  expect(wrapPdfText('x'.repeat(200), 100, 10).every((l) => l.length <= 20)).toBe(true);
  expect(wrapPdfText('', 100)).toEqual(['']);
});
