// The data of a person document typed in: dates, the check, the fields in the order of a scan, the rowJSON of the reader's post.
import {
  buildPersonDocumentRowJSON, emptyPersonDocumentInput, formatDmy, normalizeDmy, parseDmy, personDocumentFieldsOf, personOwnerName, validatePersonDocumentInput,
} from '../../../kit8/ui/components/list/forms/personDocumentInputModel';

const full = { ...emptyPersonDocumentInput(), surname: ' TERENTJEVS ', givenNames: 'JURIJS', sex: 'M' as const, birthDate: '2.10.1971', placeOfBirth: 'RIGA', nationality: 'lva', personalNumber: '021071-12345',
  address: 'Brivibas 1-2,  Riga', documentNumber: 'lv6073206', issuingState: 'LVA', issueDate: '01.07.2019', expiryDate: '30.06.2029', issuedBy: 'PMLP', notes: '' };

it('dates: DD.MM.YYYY, D.M.YYYY and DDMMYYYY are read; a day that does not exist is no date', () => {
  expect(formatDmy(parseDmy('02.10.1971')!)).toBe('02.10.1971');
  expect(formatDmy(parseDmy('2.10.1971')!)).toBe('02.10.1971');
  expect(formatDmy(parseDmy('02101971')!)).toBe('02.10.1971');
  expect(parseDmy('31.02.2020')).toBeNull();
  expect(parseDmy('1971-10-02')).toBeNull();
  expect(parseDmy('')).toBeNull();
  expect(normalizeDmy('2.10.1971')).toBe('02.10.1971');
  expect(normalizeDmy('soon')).toBe('soon');
});

it('surname, given names and the document number are needed; empty optional data is fine', () => {
  expect(Object.keys(validatePersonDocumentInput(emptyPersonDocumentInput())).sort()).toEqual(['documentNumber', 'givenNames', 'surname']);
  expect(validatePersonDocumentInput(full)).toEqual({});
  expect(validatePersonDocumentInput({ ...emptyPersonDocumentInput(), surname: 'A', givenNames: 'B', documentNumber: '1' })).toEqual({});
});

it('bad dates, bad states, a document that expires before it was issued, issued before the birth', () => {
  const e = validatePersonDocumentInput({ ...full, birthDate: '99.99.1971', nationality: 'LATVIA', issuingState: '12' });
  expect(e).toMatchObject({ birthDate: 'Date as DD.MM.YYYY', nationality: expect.stringContaining('3 letters'), issuingState: expect.stringContaining('3 letters') });
  expect(validatePersonDocumentInput({ ...full, expiryDate: '01.01.2019' }).expiryDate).toMatch(/before the date of issue/);
  expect(validatePersonDocumentInput({ ...full, issueDate: '01.01.1960' }).issueDate).toMatch(/before the birth/);
});

it('the fields come in the order and with the words of a scan; the states are written as names; empty ones are left out', () => {
  const f = personDocumentFieldsOf(full, 'idCard');
  expect(f.map((x) => x.label)).toEqual(['Surname', 'Given names', 'Sex', 'Date of birth', 'Place of birth', 'Nationality', 'Personal number', 'Address', 'Document', 'Document number', 'Issuing state', 'Valid until', 'Issued by', 'Date of issue']);
  const by = Object.fromEntries(f.map((x) => [x.label, x.value]));
  expect(by).toMatchObject({ Surname: 'TERENTJEVS', 'Date of birth': '02.10.1971', Nationality: 'Latvia', 'Issuing state': 'Latvia', Document: 'ID card', 'Document number': 'LV6073206', Address: 'Brivibas 1-2, Riga' });
  expect(personDocumentFieldsOf(emptyPersonDocumentInput(), 'passport').map((x) => x.label)).toEqual(['Document']);
});

it('the owner name is given names first, like the reader writes it', () => {
  expect(personOwnerName(full)).toBe('JURIJS TERENTJEVS');
  expect(personOwnerName({ ...full, givenNames: '' })).toBe('TERENTJEVS');
});

it('the rowJSON is the reader\'s post: description lists every datum, idCardFields, owner, number, kind, folder', () => {
  const j = buildPersonDocumentRowJSON(full, 'passport', null, new Date('2026-11-24T10:00:00Z'));
  expect(j).toMatchObject({ mediaPostTitle: 'JURIJS TERENTJEVS', mediaPostSubTitle: 'Passport · No. LV6073206', dataOriginName: 'personPassport', idCardKind: 'Passport', idCardFolder: 'passport', idCardNumber: 'LV6073206', mediaCreatedAt: '2026-11-24T10:00:00.000Z' });
  expect(j.mediaPostDescription).toContain('Nationality: Latvia');
  expect(j.mediaPostDescription.split('\n')).toHaveLength(j.idCardFields.length);
  expect(j.mediaImageUri).toBeUndefined();
});

it('a photo that is too big for the post stays out of the row (the file storage still gets it); a small one is the picture of the post', () => {
  const small = { dataUri: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg', base64: 'AAAA' };
  expect(buildPersonDocumentRowJSON(full, 'idCard', small).mediaImageUri).toBe(small.dataUri);
  const big = { dataUri: `data:image/jpeg;base64,${'A'.repeat(500_000)}`, mime: 'image/jpeg', base64: 'A'.repeat(500_000) };
  expect(buildPersonDocumentRowJSON(full, 'idCard', big).mediaImageUri).toBeUndefined();
  expect(buildPersonDocumentRowJSON(full, 'idCard', { dataUri: 'data:image/gif;base64,AAAA', mime: 'image/gif', base64: 'AAAA' }).mediaImageUri).toBeUndefined();
});
