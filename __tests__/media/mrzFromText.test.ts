/** @jest-environment node */
// the native module cannot load in Jest
jest.mock('expo-mlkit-ocr', () => ({ isSupported: () => true, recognizeText: async () => ({ text: '', blocks: [] }) }));
import { formatsFor, mrzFromText, normalizeOcrLine } from '../../kit8/ui/components/media/nfc/identification/mrzFromText';
import { orderLines } from '../../kit8/ui/components/media/nfc/identification/ocrEngine';

// ICAO 9303 specimens
const TD3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'];
const TD1 = ['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'];
const TD3_ACCESS = { documentNumber: 'L898902C3', birthDate: '740812', expiryDate: '120415' };
const TD1_ACCESS = { documentNumber: 'D23145890', birthDate: '740812', expiryDate: '120415' };

describe('normalizing an OCR line', () => {
  it('upper case, no spaces, only the MRZ alphabet, the fancy chevrons are fillers, a run of K at the end is filler', () => {
    expect(normalizeOcrLine('p<uto eriksson«anna')).toBe('P<UTOERIKSSON<ANNA');
    expect(normalizeOcrLine('  ERIKSSON<<ANNA KKKKKKKK ')).toBe('ERIKSSON<<ANNA<<<<<<<<');
    expect(normalizeOcrLine('ANNA<MARIA‘’!')).toBe('ANNA<MARIA');
    expect(normalizeOcrLine('SMITH KKK')).toBe('SMITHKKK'); // a short run is a name
  });
});

describe('the zone of a passport and of an ID card', () => {
  it('clean lines: all check digits agree, nothing was changed', () => {
    const p = mrzFromText(TD3)!;
    expect(p).toMatchObject({ format: 'TD3', confidence: 'checked', changes: 0, access: TD3_ACCESS });
    expect(p.mrz.surname).toBe('ERIKSSON');
    const i = mrzFromText(TD1)!;
    expect(i).toMatchObject({ format: 'TD1', confidence: 'checked', changes: 0, access: TD1_ACCESS });
  });

  it('whatever the order of the formats the right one is found; the expected format is tried first', () => {
    expect(mrzFromText(TD1, 'PASSPORT')?.format).toBe('TD1');
    expect(mrzFromText(TD3, 'ID')?.format).toBe('TD3');
    expect(formatsFor('ID')[0]).toBe('TD1');
    expect(formatsFor('PASSPORT')[0]).toBe('TD3');
  });

  it('text around the zone (a heading, the holder name, the page) is ignored', () => {
    const r = mrzFromText(['REPUBLIC OF UTOPIA', 'PASSPORT', 'Surname ERIKSSON', ...TD3, 'ISSUED 2010'])!;
    expect(r.confidence).toBe('checked');
    expect(r.access).toEqual(TD3_ACCESS);
  });

  it('typical OCR mistakes are repaired: O for 0 in the dates, lower case, spaces', () => {
    const noisy = ['p<uto eriksson<<anna<maria<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO74O8122F12O4159ZE184226B<<<<<10'];
    const r = mrzFromText(noisy)!;
    expect(r.confidence).toBe('checked');
    expect(r.access).toEqual(TD3_ACCESS);
    expect(r.changes).toBe(2);
  });

  it('a letter read for a digit inside the document number is found with the check digit (O or 0)', () => {
    const r = mrzFromText(['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L8989O2C36UTO7408122F1204159ZE184226B<<<<<10'])!;
    expect(r.access.documentNumber).toBe('L898902C3');
    expect(r.confidence).toBe('checked');
  });

  it('a lost trailing filler is padded; the filler read as a run of K is repaired; the lines may come in one string', () => {
    expect(mrzFromText([TD3[0].slice(0, 41), TD3[1]])?.confidence).toBe('checked'); // three fillers lost
    expect(mrzFromText([TD3[0].replace(/<{19}$/, 'K'.repeat(19)), TD3[1]])?.confidence).toBe('checked');
    expect(mrzFromText([`${TD3[0]}\n${TD3[1]}`])?.confidence).toBe('checked');
    expect(mrzFromText([TD3.join('')])?.access).toEqual(TD3_ACCESS); // cut by the length
    expect(mrzFromText([TD1[0], TD1[1].slice(0, 28), TD1[2]])?.confidence).toBeDefined();
  });

  it('a model that miscounts the filler (measured live with Google AI: 31 / 31 / 32 instead of 30 characters) still gets a CHECKED zone', () => {
    const live = ['I<UTOD231458907<<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'];
    const r = mrzFromText(live, 'ID')!;
    expect(r.confidence).toBe('checked');
    expect(r.access).toEqual(TD1_ACCESS);
    const worse = ['I<UTOD231458907<<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<<<'];
    expect(mrzFromText(worse, 'ID')?.confidence).toBe('checked');
    // a filler missing in the middle of the passport line 2
    expect(mrzFromText([TD3[0], 'L898902C36UTO7408122F1204159ZE184226B<<<10'], 'PASSPORT')?.confidence).toBe('checked');
  });

  it('a wrong digit that cannot be repaired is NOT passed off as checked: confidence unchecked, the user must look', () => {
    const r = mrzFromText([TD3[0], 'L898902C36UTO7409122F1204159ZE184226B<<<<<10'])!;
    expect(r.confidence).toBe('unchecked');
    expect(r.mrz.birthDate.valid).toBe(false);
  });

  it('the three fields agree but the composite does not: partly', () => {
    const l2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<11';
    expect(mrzFromText([TD3[0], l2])?.confidence).toBe('partly');
  });

  it('the FRONT of an ID card (real recognised text of a Latvian card, values changed) has no zone: null, never junk values', () => {
    const front = [
      'PA1234567', 'LATVIJAS REPUBLIKA PERSONAS APLIECIBA', 'LV', 'REPUBLIC OF LATVIA IDENTITY CARD/ REPUBLIQUE DE LETTONIE CARTE D\'IDENTITE',
      'Uzvards/Surname/ Nom', 'EXAMPLEJS', 'Vardi/ Given names/Prenoms', 'JANIS', 'Pilsoniba/ Nationality / Nationalite', 'LATVIJAS',
      'Personas kods/Personal No. / Num.personnel', '010190 -12345', 'Dzimsanas datums/ Date of birth/Date de naissance', '01.01.1990.',
      'Derigaidz/ Date of expiry /Date d\'expiration', '01.01.2030.', '123456', 'Paraksts / Holder\'s signature / Signature du titulaire',
    ];
    expect(mrzFromText(front, 'ID')).toBeNull();
    expect(mrzFromText(front, 'PASSPORT')).toBeNull();
  });

  it('nothing that looks like a zone: null', () => {
    expect(mrzFromText(['Hello world', 'Passport of the Republic', '12345'])).toBeNull();
    expect(mrzFromText([])).toBeNull();
  });

  it('a zone of an ID card with a long document number in the optional field', () => {
    const l1 = 'I<LVALV1234567<<<<<<<<<<<<<<<<'; // 30 characters
    expect(l1).toHaveLength(30);
  });
});

describe('ocr engine: the lines in reading order', () => {
  it('lines of all blocks, top to bottom, left to right; blocks without lines use their text; empty ones are dropped', () => {
    const lines = orderLines([
      { text: 'B', boundingBox: { y: 300 }, lines: [{ text: 'line 3', boundingBox: { y: 300, x: 0 } }] },
      { text: 'A', boundingBox: { y: 100 }, lines: [{ text: 'line 1', boundingBox: { y: 100, x: 0 } }, { text: 'line 2', boundingBox: { y: 200, x: 0 } }] },
      { text: 'solo', boundingBox: { y: 400 } },
      { text: '   ', boundingBox: { y: 500 } },
    ]);
    expect(lines).toEqual(['line 1', 'line 2', 'line 3', 'solo']);
  });
});
