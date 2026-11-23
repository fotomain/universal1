// idCardFields: every readable datum of the document as label + value (the description of the media post)
import { chipDateText, idCardFields, zoneDateText } from '../../kit8/ui/components/media/nfc/iddocread/idCardFields';

const f = (v: string, valid: boolean | null = true) => ({ value: v, valid });
const doc: any = {
  mrz: { format: 'TD1', documentCode: 'ID', issuingState: 'LVA', surname: 'TERENTJEVS', givenNames: 'JURIJS', documentNumber: f('PA3626350'), nationality: 'LVA', birthDate: f('800201'), sex: 'M', expiryDate: f('340602'), optionalData: '', allValid: true },
  details: { fullName: 'TERENTJEVS JURIJS', otherNames: [], personalNumber: '010280-12345', birthDate: '19800201', placeOfBirth: ['RIGA', 'LATVIA'], address: ['BRIVIBAS 1', 'RIGA'], telephone: '', profession: '', title: '', summary: '', citizenship: '', otherDocuments: '', custodian: '' },
  document: { issuingAuthority: 'PMLP', dateOfIssue: '20240602', endorsements: '', taxExitRequirements: '', serialNumber: '', personalizationTime: '', otherPersons: [] },
  photo: null,
};
const now = new Date(2026, 10, 23);

describe('idCardFields', () => {
  it('lists the person, the document and the chip data, in reading order, with no empty value', () => {
    const list = idCardFields(doc, now);
    const text = list.map((x) => `${x.label}: ${x.value}`);
    expect(text).toEqual(expect.arrayContaining([
      'Surname: TERENTJEVS',
      'Given names: JURIJS',
      'Sex: M',
      'Date of birth: 01.02.1980',
      'Place of birth: RIGA, LATVIA',
      'Personal number: 010280-12345',
      'Address: BRIVIBAS 1, RIGA',
      'Document: ID card',
      'Document number: PA3626350',
      'Valid until: 02.06.2034',
      'Issued by: PMLP',
      'Date of issue: 02.06.2024',
    ]));
    expect(list.every((x) => x.label && x.value)).toBe(true);
    expect(text.indexOf('Surname: TERENTJEVS')).toBeLessThan(text.indexOf('Document number: PA3626350'));
  });

  it('a document without the zone or without chip details still gives what it has', () => {
    expect(idCardFields({ ...doc, mrz: null, details: null, document: null }, now)).toEqual([]);
    const onlyZone = idCardFields({ ...doc, details: null, document: null }, now).map((x) => x.label);
    expect(onlyZone).toEqual(expect.arrayContaining(['Surname', 'Date of birth', 'Document number']));
    expect(onlyZone).not.toContain('Issued by');
  });

  it('date helpers leave unknown shapes alone', () => {
    expect(zoneDateText('800201', 'birth', now)).toBe('01.02.1980');
    expect(zoneDateText('', 'birth')).toBe('');
    expect(chipDateText('20240602')).toBe('02.06.2024');
    expect(chipDateText('2024-06-02')).toBe('2024-06-02');
  });
});
