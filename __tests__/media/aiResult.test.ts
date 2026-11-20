/** @jest-environment node */
import { recognitionFromAi } from '../../kit8/ui/components/media/nfc/identification/aiResult';
import type { AiDocument } from '../../supabase/functions/identification-recognize/handler';

jest.mock('expo-mlkit-ocr', () => ({ isSupported: () => true, recognizeText: async () => ({ text: '', blocks: [] }) }));

const TD1 = ['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'];
const doc = (o: Partial<AiDocument> = {}): AiDocument => ({
  documentType: 'id_card', issuingCountry: 'UTO', mrzLines: TD1, surname: 'ERIKSSON', givenNames: 'ANNA MARIA', documentNumber: 'D23145890', dateOfBirth: '1974-08-12', dateOfExpiry: '2012-04-15',
  sex: 'F', nationality: 'UTO', personalNumber: null, can: null, canCandidate: null, quality: 'good', notes: null, ...o,
});

describe('what Google AI said -> the values', () => {
  it('a zone that passes its check digits is trusted: the values of the zone, no notes', () => {
    const r = recognitionFromAi(doc(), 'ID');
    expect(r).toMatchObject({ source: 'ai', confidence: 'checked', notes: [], lines: TD1 });
    expect(r.values).toEqual({ documentNumber: 'D23145890', birthDate: '12.08.1974', expiryDate: '15.04.2012', country: 'UTO', can: '' });
    expect(r.printed).toMatchObject({ name: 'ERIKSSON, ANNA MARIA', sex: 'F' });
  });

  it('a character the model invented in the zone is repaired or caught by the check digits (O for 0)', () => {
    const r = recognitionFromAi(doc({ mrzLines: [TD1[0], TD1[1].replace('740812', '74O812'), TD1[2]] }), 'ID');
    expect(r.confidence).toBe('checked');
    expect(r.values.birthDate).toBe('12.08.1974');
  });

  it('the printed fields disagree with the zone: the zone wins and the user is told', () => {
    const r = recognitionFromAi(doc({ documentNumber: 'D23145899', dateOfBirth: '1974-08-13' }), 'ID');
    expect(r.confidence).toBe('checked');
    expect(r.values.documentNumber).toBe('D23145890');
    expect(r.notes.join(' ')).toContain('D23145899');
    expect(r.notes.join(' ')).toContain('13.08.1974');
  });

  it('a wrong digit in the zone cannot be trusted: the printed fields are used and marked "fields"', () => {
    const bad = [TD1[0], TD1[1].replace('740812', '740912'), TD1[2]];
    const r = recognitionFromAi(doc({ mrzLines: bad }), 'ID');
    expect(r.confidence).toBe('fields');
    expect(r.values).toMatchObject({ documentNumber: 'D23145890', birthDate: '12.08.1974', expiryDate: '15.04.2012' });
    expect(r.notes[0]).toContain('did not pass its check digits');
  });

  it('no zone, but printed fields (the front of a card): the fields, marked without check digits', () => {
    const r = recognitionFromAi(doc({ mrzLines: [] }), 'ID');
    expect(r.confidence).toBe('fields');
    expect(r.result).toBeNull();
    expect(r.notes[0]).toContain('No machine readable zone');
    expect(r.printed?.name).toBe('ERIKSSON, ANNA MARIA');
  });

  it('a zone that is only partly right is shown as it is', () => {
    const r = recognitionFromAi(doc({ mrzLines: TD1.map((l, i) => (i === 1 ? l.replace(/6$/, '5') : l)), documentNumber: null, dateOfBirth: null, dateOfExpiry: null }), 'ID');
    expect(r.confidence).toBe('partly');
    expect(r.values.documentNumber).toBe('D23145890');
  });

  it('nothing found: empty values and the reason of the model', () => {
    const r = recognitionFromAi(doc({ mrzLines: [], documentNumber: null, dateOfBirth: null, dateOfExpiry: null, quality: 'poor', notes: 'too blurred', surname: null, givenNames: null }), 'ID');
    expect(r.values.documentNumber).toBe('');
    expect(r.notes.join(' ')).toContain('too blurred');
    expect(r.printed).toBeUndefined();
  });

  it('the CAN of the front side is passed on with a note to check it', () => {
    const r = recognitionFromAi(doc({ can: '246810' }), 'ID');
    expect(r.values.can).toBe('246810');
    expect(r.notes.join(' ')).toContain('CAN (246810)');
  });

  it('the expected document only tries its format first: a passport zone is found for an ID request too', () => {
    const td3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'];
    const r = recognitionFromAi(doc({ mrzLines: td3, documentNumber: null, dateOfBirth: null, dateOfExpiry: null }), 'ID');
    expect(r.result?.format).toBe('TD3');
    expect(r.confidence).toBe('checked');
  });
});

describe('the FRONT of an ID card (no zone), values extracted from the recognised text', () => {
  const front = doc({ mrzLines: [], documentNumber: 'PA3626350', dateOfBirth: '1971-10-02', dateOfExpiry: '2034-06-02', surname: 'TERENTJEVS', givenNames: 'JURIJS', nationality: 'LVA', issuingCountry: 'LVA', can: null, canCandidate: '712656' });
  it('number and dates from the printed fields (no check digits), the unlabelled 6 digit number as a CAN candidate, source ai-text', () => {
    const r = recognitionFromAi(front, 'ID', 'text');
    expect(r.source).toBe('ai-text');
    expect(r.confidence).toBe('fields');
    expect(r.values).toEqual({ documentNumber: 'PA3626350', birthDate: '02.10.1971', expiryDate: '02.06.2034', country: 'LVA', can: '712656' });
    expect(r.notes.join(' ')).toContain('without a label (712656) may be the CAN');
    expect(r.notes.join(' ')).toContain('No machine readable zone');
    expect(r.printed?.name).toBe('TERENTJEVS, JURIJS');
  });
  it('a labelled CAN wins over a candidate', () => {
    const r = recognitionFromAi(doc({ mrzLines: [], can: '111111', canCandidate: '222222' }), 'ID', 'text');
    expect(r.values.can).toBe('111111');
    expect(r.notes.join(' ')).not.toContain('without a label');
  });
  it('the photo job keeps its source name', () => expect(recognitionFromAi(doc(), 'ID').source).toBe('ai'));
});
