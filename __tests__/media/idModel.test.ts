/** @jest-environment node */
import { bytesToOid, encodeOid, encodeTlv, oidToBytes, readTlv, readTlvs } from '../../kit8/ui/components/media/nfc/iddocread/asn1';
import { bytesToBase64, bytesToHex, hexToBytes } from '../../kit8/ui/components/media/nfc/iddocread/crypto/bytes';
import { aesCbc } from '../../kit8/ui/components/media/nfc/iddocread/crypto/symmetric';
import { checkDigit, fullDate, isValidYyMmDd, mrzInformation, mrzKeySeed, normalizeMrzLines, parseMrz, toYyMmDd } from '../../kit8/ui/components/media/nfc/iddocread/mrz';
import { paceKdf, pacePasswordBytes, parsePaceInfos, pickPace, whyNoPace } from '../../kit8/ui/components/media/nfc/iddocread/pace';
import { dgDate, dgName, findImage, parseDg11, parseEfCom } from '../../kit8/ui/components/media/nfc/iddocread/dataGroups';
import { COUNTRY_NAMES, countryList, countryName, normalizeStateCode } from '../../kit8/ui/components/media/nfc/iddocread/countries';
import { COUNTRIES_WITH_NOTES, countryNote, GENERAL_LIMITS } from '../../kit8/ui/components/media/nfc/iddocread/countryNotes';

describe('TLV / OID', () => {
  it('lengths of 1, 2 and 3 bytes and multi byte tags', () => {
    const big = new Uint8Array(300).fill(7);
    const tlv = encodeTlv(0x7f61, big);
    const t = readTlv(tlv, 0);
    expect(t.tag).toBe(0x7f61);
    expect(t.value.length).toBe(300);
    expect(t.constructed).toBe(true);
    expect(readTlvs(new Uint8Array([0x5c, 0x02, 0x61, 0x75, 0x5f, 0x1f, 0x01, 0x41])).map((x) => x.tag)).toEqual([0x5c, 0x5f1f]);
  });
  it('a value longer than the data is refused', () => expect(() => readTlv(new Uint8Array([0x30, 0x05, 0x01]), 0)).toThrow('longer'));
  it('OIDs both ways (a PACE OID and one with a big arc)', () => {
    for (const oid of ['0.4.0.127.0.7.2.2.4.2.2', '1.3.14.3.2.26', '2.16.840.1.101.3.4.2.1', '1.2.840.113549.1.7.2']) expect(bytesToOid(oidToBytes(oid))).toBe(oid);
    expect(bytesToHex(encodeOid('1.3.14.3.2.26'))).toBe('06052B0E03021A');
  });
});

describe('MRZ (ICAO 9303 specimens)', () => {
  it('check digits', () => {
    expect(checkDigit('L898902C3')).toBe('6');
    expect(checkDigit('740812')).toBe('2');
    expect(checkDigit('120415')).toBe('9');
    expect(checkDigit('ZE184226B<<<<<')).toBe('1');
  });
  it('TD3 passport', () => {
    const m = parseMrz(['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'])!;
    expect(m).toMatchObject({ format: 'TD3', documentCode: 'P', issuingState: 'UTO', surname: 'ERIKSSON', givenNames: 'ANNA MARIA', nationality: 'UTO', sex: 'F', allValid: true });
    expect(m.documentNumber).toEqual({ value: 'L898902C3', valid: true });
    expect(m.birthDate.value).toBe('740812');
  });
  it('TD1 ID card, as three lines and as one string', () => {
    const lines = ['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'];
    const m = parseMrz(lines)!;
    expect(m).toMatchObject({ format: 'TD1', surname: 'ERIKSSON', givenNames: 'ANNA MARIA', allValid: true });
    expect(m.documentNumber.value).toBe('D23145890');
    expect(parseMrz(lines.join(''))?.surname).toBe('ERIKSSON');
    expect(normalizeMrzLines(`${lines[0]} \n ${lines[1].toLowerCase()}\n${lines[2]}`)).toHaveLength(3);
    expect(parseMrz('nonsense')).toBeNull();
  });
  it('a wrong check digit is reported', () => {
    const m = parseMrz(['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C37UTO7408122F1204159ZE184226B<<<<<10'])!;
    expect(m.documentNumber.valid).toBe(false);
    expect(m.allValid).toBe(false);
  });
  it('the access key of the ICAO PACE example', () => {
    const a = { documentNumber: 'T22000129', birthDate: '640812', expiryDate: '101031' };
    expect(mrzInformation(a)).toBe('T22000129364081251010318');
    expect(bytesToHex(mrzKeySeed(a))).toBe('7E2D2A41C74EA0B38CD36F863939BFA8E9032AAD');
    // a short number is padded with <
    expect(mrzInformation({ ...a, documentNumber: 'ab12' }).startsWith('AB12<<<<<')).toBe(true);
  });
  it('dates typed by people', () => {
    expect(toYyMmDd('14.02.1985')).toBe('850214');
    expect(toYyMmDd('1985-02-14')).toBe('850214');
    expect(toYyMmDd('850214')).toBe('850214');
    expect(toYyMmDd('14/2/1985')).toBe('850214');
    expect(toYyMmDd('14021985')).toBe('850214');
    expect(toYyMmDd('hello')).toBe('');
    expect(isValidYyMmDd('850214')).toBe(true);
    expect(isValidYyMmDd('851314')).toBe(false);
    const now = new Date(2026, 10, 19);
    expect(fullDate('850214', 'birth', now)).toBe('1985-02-14');
    expect(fullDate('260101', 'birth', now)).toBe('2026-01-01');
    expect(fullDate('300101', 'birth', now)).toBe('1930-01-01');
    expect(fullDate('320430', 'expiry', now)).toBe('2032-04-30');
  });
});

describe('PACE keys (ICAO 9303-11 appendix: MRZ T22000129364081251010318, AES-128)', () => {
  it('K_pi and the nonce of the specimen', () => {
    const info = { hash: 'sha1' as const, keyBytes: 16, cipher: 'aes' as const };
    const kPi = paceKdf(info, pacePasswordBytes({ kind: 'mrz', access: { documentNumber: 'T22000129', birthDate: '640812', expiryDate: '101031' } }), 3);
    expect(bytesToHex(kPi)).toBe('89DED1B26624EC1E634C1989302849DD');
    expect(bytesToHex(aesCbc(kPi, new Uint8Array(16), hexToBytes('95A3A016522EE98D01E76CB6B98B42C3'), false))).toBe('3F00C4D39D153F2B2A214A078D899B22');
  });
  it('the CAN is the password as ASCII', () => expect(bytesToHex(pacePasswordBytes({ kind: 'can', can: '123456' }))).toBe('313233343536'));
  it('the PACE protocols of EF.CardAccess', () => {
    const mk = (oid: string, param: number | null) => encodeTlv(0x30, new Uint8Array([...encodeOid(oid), ...encodeTlv(0x02, new Uint8Array([2])), ...(param == null ? [] : encodeTlv(0x02, new Uint8Array([param])))]));
    const set = encodeTlv(0x31, new Uint8Array([
      ...mk('0.4.0.127.0.7.2.2.4.2.2', 13), ...mk('0.4.0.127.0.7.2.2.4.2.4', 16), ...mk('0.4.0.127.0.7.2.2.4.4.2', 13), ...mk('0.4.0.127.0.7.2.2.4.1.2', 2),
      // other security infos: chip authentication, terminal authentication
      ...mk('0.4.0.127.0.7.2.2.3.2.4', 13), ...mk('0.4.0.127.0.7.2.2.2', null),
    ]));
    const infos = parsePaceInfos(set);
    expect(infos.map((i) => `${i.mapping}/${i.cipherLabel}/${i.parameterId}/${i.supported}`)).toEqual(['ECDH-GM/AES-128/13/true', 'ECDH-GM/AES-256/16/true', 'ECDH-IM/AES-128/13/false', 'DH-GM/AES-128/2/false']);
    expect(pickPace(infos)).toMatchObject({ cipherLabel: 'AES-256', parameterId: 16 }); // the strongest usable
    expect(whyNoPace([infos[2]])).toContain('ECDH-IM');
    expect(pickPace([infos[2], infos[3]])).toBeNull();
    expect(whyNoPace([])).toBe('The card does not offer PACE.');
  });
});

describe('data groups', () => {
  it('EF.COM', () => {
    const com = encodeTlv(0x60, new Uint8Array([...encodeTlv(0x5f01, new Uint8Array([0x30, 0x31, 0x30, 0x37])), ...encodeTlv(0x5c, new Uint8Array([0x61, 0x75, 0x6b]))]));
    expect(parseEfCom(com)).toEqual({ ldsVersion: '0107', unicodeVersion: '', dataGroups: [1, 2, 11] });
  });
  it('names and dates of DG11 / DG12', () => {
    expect(dgName('ZVEJNIEKS<<JANIS<KARLIS')).toBe('ZVEJNIEKS, JANIS KARLIS');
    expect(dgName('MADONNA')).toBe('MADONNA');
    expect(dgDate(new Uint8Array([0x19, 0x85, 0x02, 0x14]))).toBe('1985-02-14');
    expect(dgDate(new TextEncoder().encode('19850214'))).toBe('1985-02-14');
    expect(dgDate(new Uint8Array([1, 2]))).toBe('');
    const dg11 = encodeTlv(0x6b, new Uint8Array([...encodeTlv(0x5f10, new TextEncoder().encode('010185-12345')), ...encodeTlv(0x5f0f, new TextEncoder().encode('SMITH<<J'))]));
    expect(parseDg11(dg11)).toMatchObject({ personalNumber: '010185-12345', otherNames: ['SMITH, J'] });
  });
  it('the face image inside the biometric block: JPEG, JPEG 2000 file and codestream', () => {
    const jpg = findImage(new Uint8Array([1, 2, 3, 0xff, 0xd8, 0xff, 0xe0, 9, 9]))!;
    expect(jpg.mime).toBe('image/jpeg');
    expect(jpg.bytes[0]).toBe(0xff);
    expect(findImage(new Uint8Array([9, 0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20]))?.mime).toBe('image/jp2');
    expect(findImage(new Uint8Array([9, 9, 0xff, 0x4f, 0xff, 0x51, 0]))?.mime).toBe('image/jp2');
    expect(findImage(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBeNull();
  });
  it('base64', () => {
    expect(bytesToBase64(new TextEncoder().encode('Man'))).toBe('TWFu');
    expect(bytesToBase64(new TextEncoder().encode('Ma'))).toBe('TWE=');
    expect(bytesToBase64(new TextEncoder().encode('M'))).toBe('TQ==');
  });
});

describe('countries', () => {
  it('every ISO state and the special codes of the MRZ are there', () => {
    const iso = Object.keys(COUNTRY_NAMES).filter((c) => c.length === 3 && !c.startsWith('X') && !['GBD', 'GBN', 'GBO', 'GBP', 'GBS', 'RKS', 'UNK', 'UNO', 'UNA', 'EUE', 'ZZZ'].includes(c));
    expect(iso.length).toBeGreaterThanOrEqual(245);
    expect(countryName('LVA')).toBe('Latvia');
    expect(countryName('D')).toBe('Germany');
    expect(countryName('d<<')).toBe('Germany');
    expect(countryName('XXA')).toBe('Stateless person');
    expect(countryName('QQQ')).toBe('QQQ');
    expect(normalizeStateCode('D')).toBe('DEU');
    expect(countryList()[0].name).toBe('Afghanistan');
    expect(countryList().find((c) => c.code === 'XXA')).toBeUndefined();
  });
  it('the codes of the list are unique three letters (or D)', () => {
    for (const c of Object.keys(COUNTRY_NAMES)) expect(c).toMatch(/^([A-Z]{3}|D)$/);
  });
  it('notes: Latvia, Germany (online only) and a generic one', () => {
    expect(countryNote('LVA').text).toContain('Latvia');
    expect(countryNote('lva').code).toBe('LVA');
    expect(countryNote('D').idCard).toBe('online-only');
    expect(countryNote('DEU').links.length).toBeGreaterThan(0);
    const generic = countryNote('FRA');
    expect(generic).toMatchObject({ code: 'FRA', idCard: 'check', source: 'standard' });
    expect(generic.text).toContain('ICAO 9303');
    expect(COUNTRIES_WITH_NOTES).toEqual(expect.arrayContaining(['LVA', 'DEU', 'EST', 'ESP', 'ITA']));
    expect(GENERAL_LIMITS.join(' ')).toMatch(/Nothing is stored/);
    for (const code of COUNTRIES_WITH_NOTES) expect(COUNTRY_NAMES[code]).toBeTruthy();
  });
});
