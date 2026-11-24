// The new element of a list of posts: origin types (with the two documents of a person), the check, the rowJSON that is saved.
import { DATA_ORIGIN_TYPE } from '../../../kit8/types/origin';
import {
  buildElementRowJSON, defaultManipulation, ELEMENT_ORIGIN_TYPES, elementExtras, emptyElementValues, isPersonOrigin, isValidHttpUrl, manipulationsOf, validateElement,
} from '../../../kit8/ui/components/list/forms/createListElementModel';

const now = new Date('2026-11-24T10:00:00.000Z');

it('the origin types now include personIDCard and personPassport', () => {
  expect(ELEMENT_ORIGIN_TYPES).toEqual(expect.arrayContaining(['youtube', 'webpage', 'pdf', 'msword', 'msexcel', 'html', 'text', 'personIDCard', 'personPassport']));
  expect(DATA_ORIGIN_TYPE.personIDCard).toBe('personIDCard');
  expect(DATA_ORIGIN_TYPE.personPassport).toBe('personPassport');
  expect(isPersonOrigin('personPassport')).toBe(true);
  expect(isPersonOrigin('youtube')).toBe(false);
});

const fullPerson = { surname: 'TERENTJEVS', givenNames: 'JURIJS', sex: 'M' as const, birthDate: '02.10.1971', placeOfBirth: 'RIGA', nationality: 'LVA', personalNumber: '021071-12345', address: 'Brivibas 1-2, Riga',
  documentNumber: 'pa3626350', issuingState: 'LVA', issueDate: '01.07.2019', expiryDate: '30.06.2029', issuedBy: 'PMLP', notes: 'lost once' };

it('a title is required for a post; an address must be http(s) and may be empty', () => {
  expect(validateElement(emptyElementValues('youtube')).title).toBe('Title is required');
  expect(validateElement({ ...emptyElementValues('webpage'), title: 'x', url: 'ftp://a' }).url).toMatch(/Invalid URL/);
  expect(validateElement({ ...emptyElementValues('webpage'), title: 'x', url: '' })).toEqual({});
  expect(isValidHttpUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  expect(isValidHttpUrl('no')).toBe(false);
});

it('a person document is checked field by field (surname, given names, number, dates); the title and the address do not matter', () => {
  const e = validateElement(emptyElementValues('personIDCard'));
  expect(e.title).toBeUndefined();
  expect(e.person).toMatchObject({ surname: 'Surname is required', givenNames: 'Given names are required', documentNumber: 'Document number is required' });
  expect(validateElement({ ...emptyElementValues('personPassport'), person: fullPerson, url: 'junk' })).toEqual({});
});

it('data manipulation: the matrix of the origin, all of them when it has none, none for a person', () => {
  expect(manipulationsOf('youtube')).toEqual(['YOUTUBE_TO_GOOGLE_DRIVE', 'YOUTUBE_TO_DOWNLOAD']);
  expect(manipulationsOf('pdf').length).toBeGreaterThan(1);
  expect(manipulationsOf('personIDCard')).toEqual([]);
  expect(defaultManipulation('personPassport')).toBe('');
});

it('builds the rowJSON of a web post: the keys of the posts of the web list', () => {
  const json = buildElementRowJSON({ ...emptyElementValues('youtube'), url: ' https://youtu.be/dQw4w9WgXcQ ', title: ' Song ', description: ' d ' }, now);
  expect(json).toMatchObject({
    mediaPostTitle: 'Song', mediaPostDescription: 'd', mediaPostOrigin: 'https://youtu.be/dQw4w9WgXcQ', mediaPostMIME: 'youtube', mediaPostOriginType: 'url',
    dataOriginName: 'youtube', dataManipulationName: 'YOUTUBE_TO_GOOGLE_DRIVE', mediaCreatedAt: '2026-11-24T10:00:00.000Z',
  });
  expect(buildElementRowJSON({ ...emptyElementValues('text'), title: 'Note' }, now)).toMatchObject({ mediaPostOrigin: '', mediaPostOriginType: 'text', mediaPostMIME: 'text/plain' });
});

it('builds the rowJSON of a person document like the ID reader\'s post: owner, number, every datum, no address', () => {
  const json = buildElementRowJSON({ ...emptyElementValues('personIDCard'), person: fullPerson }, now);
  expect(json).toMatchObject({ mediaPostTitle: 'JURIJS TERENTJEVS', mediaPostSubTitle: 'ID card · No. PA3626350', dataOriginName: 'personIDCard', personDocumentType: 'idCard', personDocumentNumber: 'PA3626350',
    idCardOwnerName: 'JURIJS TERENTJEVS', idCardNumber: 'PA3626350', idCardKind: 'ID card', idCardFolder: 'idcard', mediaPostOriginType: 'person' });
  expect(json.idCardFields.map((f: any) => f.label)).toEqual(['Surname', 'Given names', 'Sex', 'Date of birth', 'Place of birth', 'Nationality', 'Personal number', 'Address', 'Document', 'Document number', 'Issuing state', 'Valid until', 'Issued by', 'Date of issue', 'Notes']);
  expect(json.mediaPostDescription.split('\n')[0]).toBe('Surname: TERENTJEVS');
  expect(json.mediaPostOrigin).toBe('');
  expect(json.dataManipulationName).toBeUndefined();
  expect(buildElementRowJSON({ ...emptyElementValues('personPassport'), person: fullPerson }, now)).toMatchObject({ personDocumentType: 'passport', idCardKind: 'Passport', idCardFolder: 'passport', mediaPostSubTitle: 'Passport · No. PA3626350' });
});

it('the photo is in the row as the picture of the post and goes with it as an extra for the file storage', () => {
  const photo = { dataUri: 'data:image/jpeg;base64,/9j/AAAA', mime: 'image/jpeg', base64: '/9j/AAAA' };
  const values = { ...emptyElementValues('personPassport'), person: fullPerson, photo };
  expect(buildElementRowJSON(values, now)).toMatchObject({ mediaImageUri: 'data:image/jpeg;base64,/9j/AAAA', mediaPostMIME: 'image/jpeg' });
  expect(elementExtras(values)).toEqual({ idPhoto: { mime: 'image/jpeg', base64: '/9j/AAAA', folder: 'passport' } });
  expect(elementExtras({ ...values, photo: null })).toBeUndefined();
  expect(elementExtras({ ...emptyElementValues('youtube'), photo })).toBeUndefined();
});
