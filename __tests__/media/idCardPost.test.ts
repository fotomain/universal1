// The media post of an ID card / passport that was read: the name of the owner and the document number are what the Media Posts list shows.
import { buildIdCardPost, ID_POST_PHOTO_MAX_CHARS, idDocumentFolder, idDocumentKind } from '../../kit8/ui/components/media/common/notePost';
import { mediaPostRows } from '../../kit8/ui/components/media/common/mediaPostList';

const base = { ownerGUID: 'u1', rowGUID: 'r1', platform: 'android', ownerName: 'JURIJS TERENTJEVS', documentNumber: 'PA3626350', documentCode: 'ID', nationality: 'Latvia', expiryDate: '02.06.2034', now: new Date(2026, 10, 23, 10, 5) };

describe('buildIdCardPost', () => {
  it('title = the owner, sub title = the kind + the number, nothing else of the chip is kept', () => {
    const p = buildIdCardPost(base);
    expect(p.rowJSON.mediaPostTitle).toBe('JURIJS TERENTJEVS');
    expect(p.rowJSON.mediaPostSubTitle).toBe('ID card · No. PA3626350');
    expect(p.rowJSON.mediaPostDescription).toBe('Owner: JURIJS TERENTJEVS\nNumber: PA3626350\nNationality: Latvia\nValid until: 02.06.2034');
    expect(p.rowJSON.idCardOwnerName).toBe('JURIJS TERENTJEVS');
    expect(p.rowJSON.idCardNumber).toBe('PA3626350');
    expect(p.rowJSON.idCardFolder).toBe('idcard');   // the folder of the owner photo in the file storage
    expect(p.rowJSON.mediaKind).toBeUndefined();
    expect(JSON.stringify(p.rowJSON)).not.toMatch(/photo|image/i);
  });

  it('a passport code says Passport; a document with no name is titled by its kind and time', () => {
    expect(idDocumentKind('P')).toBe('Passport');
    expect(idDocumentKind('PA')).toBe('Passport');
    expect(idDocumentKind('I')).toBe('ID card');
    expect(idDocumentFolder('P')).toBe('passport');
    expect(idDocumentFolder('ID')).toBe('idcard');
    expect(buildIdCardPost({ ...base, documentCode: 'P' }).rowJSON.idCardFolder).toBe('passport');
    expect(idDocumentKind(undefined)).toBe('ID card');
    const p = buildIdCardPost({ ...base, ownerName: '', documentCode: 'P' });
    expect(p.rowJSON.mediaPostTitle).toBe('Passport 2026-11-23 10:05');
  });

  it('the list shows the owner and the number', () => {
    const post = buildIdCardPost(base);
    const [row] = mediaPostRows([post]);
    expect(row.title).toBe('JURIJS TERENTJEVS');
    expect(row.subtitle).toBe('ID card · No. PA3626350 · 2026-11-23 10:05');
    expect(row.description).toContain('Number: PA3626350');
    expect(row.kind).toBe('');
  });
});

describe('the post of a whole reading: all the data + the photo', () => {
  const fields = [{ label: 'Surname', value: 'TERENTJEVS' }, { label: 'Date of birth', value: '01.02.1980' }, { label: 'Place of birth', value: 'RIGA' }];
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQ';

  it('the description is one line per datum, the structured list and the photo are in the row', () => {
    const p = buildIdCardPost({ ...base, fields, photoDataUri: jpeg });
    expect(p.rowJSON.mediaPostDescription).toBe('Surname: TERENTJEVS\nDate of birth: 01.02.1980\nPlace of birth: RIGA');
    expect(p.rowJSON.idCardFields).toEqual(fields);
    expect(p.rowJSON.mediaImageUri).toBe(jpeg);
    expect(p.rowJSON.mediaPostMIME).toBe('image/jpeg');
    expect(p.rowJSON.mediaKind).toBeUndefined();
  });

  it('the phone list draws it as an ID post with the photo and the whole description', () => {
    const [row] = mediaPostRows([buildIdCardPost({ ...base, fields, photoDataUri: jpeg })]);
    expect(row.imageUri).toBe(jpeg);
    expect(row.isIdCard).toBe(true);
    expect(row.description).toContain('Place of birth: RIGA');
  });

  it('a JPEG 2000 photo (no data address) or a huge one stays out of the row; empty fields are dropped', () => {
    expect(buildIdCardPost({ ...base, fields, photoDataUri: 'data:image/jp2;base64,AAAA' }).rowJSON.mediaImageUri).toBeUndefined();
    expect(buildIdCardPost({ ...base, fields, photoDataUri: `data:image/jpeg;base64,${'A'.repeat(ID_POST_PHOTO_MAX_CHARS)}` }).rowJSON.mediaImageUri).toBeUndefined();
    expect(buildIdCardPost({ ...base, fields: [{ label: 'X', value: '' }] }).rowJSON.mediaPostDescription).toContain('Owner: JURIJS TERENTJEVS');
  });
});
