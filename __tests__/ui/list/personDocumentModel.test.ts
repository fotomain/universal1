// The read only details of a person document: from the ID reader's post and from a post typed in with the Add form.
import { isPersonDocumentRow, personDocumentDetails, personDocumentExportRows, personDocumentPhotoBase64 } from '../../../kit8/ui/components/list/cards/mediapost/personDocumentModel';

const reader = { rowGUID: 'r', rowJSON: { dataOriginName: 'idreader', idCardOwnerName: 'JURIJS TERENTJEVS', idCardNumber: 'PA3626350', idCardKind: 'ID card', mediaImageUri: 'data:image/jpeg;base64,AAAA', mediaCreatedAt: '2026-11-24T13:35:00', idCardFields: [{ label: 'Surname', value: 'TERENTJEVS' }, { label: 'Sex', value: 'M' }, { label: '', value: 'x' }] } } as any;

it('the reader post: name, kind, number, photo, every datum of the chip (empty ones left out)', () => {
  const d = personDocumentDetails(reader);
  expect(d).toMatchObject({ name: 'JURIJS TERENTJEVS', kind: 'ID card', number: 'PA3626350', photoUri: 'data:image/jpeg;base64,AAAA' });
  expect(d.fields).toEqual([{ label: 'Surname', value: 'TERENTJEVS' }, { label: 'Sex', value: 'M' }]);
  expect(d.created).toBe('2026-11-24 13:35');
});

it('a passport of the reader is a Passport', () => {
  expect(personDocumentDetails({ rowGUID: 'p', rowJSON: { dataOriginName: 'idreader', idCardKind: 'Passport', idCardOwnerName: 'A', idCardNumber: 'LV1' } } as any).kind).toBe('Passport');
});

it('a document typed in by hand: name, document, number and the notes', () => {
  const d = personDocumentDetails({ rowGUID: 'h', rowJSON: { dataOriginName: 'personPassport', mediaPostTitle: 'Anna', personDocumentNumber: 'P1', mediaPostDescription: 'Lost once', personDocumentType: 'passport' } } as any);
  expect(d).toMatchObject({ name: 'Anna', kind: 'Passport', number: 'P1', photoUri: '' });
  expect(d.fields).toEqual([{ label: 'Name', value: 'Anna' }, { label: 'Document', value: 'Passport' }, { label: 'Document number', value: 'P1' }, { label: 'Notes', value: 'Lost once' }]);
});

it('which posts are documents of a person', () => {
  expect(isPersonDocumentRow(reader)).toBe(true);
  expect(isPersonDocumentRow({ rowJSON: { dataOriginName: 'personIDCard' } } as any)).toBe(true);
  expect(isPersonDocumentRow({ rowJSON: { dataOriginName: 'youtube' } } as any)).toBe(false);
  expect(isPersonDocumentRow({ rowJSON: {} } as any)).toBe(false);
});

it('the export rows end with the owner photo as plain base64; no picture = no photo row', () => {
  const d = personDocumentDetails(reader);
  expect(personDocumentPhotoBase64(d)).toEqual({ mime: 'image/jpeg', base64: 'AAAA' });
  const rows = personDocumentExportRows(d);
  expect(rows.map((r: any) => r.rowJSON.label)).toEqual(['Name', 'Document', 'Document number', 'Surname', 'Sex', 'Photo (base64 image/jpeg)']);
  expect((rows[rows.length - 1] as any).rowJSON.value).toBe('AAAA');
  const without = personDocumentExportRows({ ...d, photoUri: '' });
  expect(without.map((r: any) => r.rowJSON.label)).not.toContain('Photo (base64 image/jpeg)');
  expect(personDocumentPhotoBase64({ ...d, photoUri: 'file:///x.jpg' })).toBeNull();
});
