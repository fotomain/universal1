// The machine readable zone (ICAO 9303 parts 3-5): check digits, the three formats, the access key of BAC / PACE. Pure.
import { asciiBytes } from './crypto/bytes';
import { digest } from './crypto/hash';

const WEIGHTS = [7, 3, 1];

function charValue(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  return 0; // '<' and anything else
}

/** the check digit of ICAO 9303 (weights 7 3 1, modulo 10) */
export function checkDigit(field: string): string {
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) sum += charValue(field[i]) * WEIGHTS[i % 3];
  return String(sum % 10);
}

export type MrzFormat = 'TD1' | 'TD2' | 'TD3';

export interface MrzField {
  value: string;
  /** the check digit of the field was right ('' = the field has none) */
  valid: boolean | null;
}

export interface MrzData {
  format: MrzFormat;
  /** the document code: 'P', 'I', 'ID', 'AC' ... */
  documentCode: string;
  /** three letter code of the issuing state / organisation ('D' for Germany is 'D' in the MRZ) */
  issuingState: string;
  surname: string;
  givenNames: string;
  documentNumber: MrzField;
  nationality: string;
  /** YYMMDD */
  birthDate: MrzField;
  sex: string;
  /** YYMMDD */
  expiryDate: MrzField;
  optionalData: string;
  /** every check digit that exists was right */
  allValid: boolean;
}

const clean = (s: string) => s.replace(/</g, ' ').trim().replace(/ +/g, ' ');
const field = (value: string, digit: string | undefined): MrzField => {
  const v = value.replace(/</g, ' ').trim();
  return { value: v, valid: digit == null ? null : digit === '<' ? value.replace(/</g, '') === '' : checkDigit(value) === digit };
};

function splitName(raw: string): { surname: string; givenNames: string } {
  const [surname, ...given] = raw.split('<<');
  return { surname: clean(surname ?? ''), givenNames: clean(given.join(' ')) };
}

/** the lines of a MRZ (2 or 3, upper case, filler `<`): spaces and other noise are removed; null when the lengths fit no format */
export function normalizeMrzLines(input: string | string[]): string[] | null {
  const lines = (Array.isArray(input) ? input : input.split(/\r?\n/))
    .map((l) => l.toUpperCase().replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length > 0);
  if (lines.length === 3 && lines.every((l) => l.length === 30)) return lines;
  if (lines.length === 2 && lines.every((l) => l.length === 36)) return lines;
  if (lines.length === 2 && lines.every((l) => l.length === 44)) return lines;
  // one long line (the data group 1 gives the zone as one string)
  if (lines.length === 1) {
    const all = lines[0];
    if (all.length === 90) return [all.slice(0, 30), all.slice(30, 60), all.slice(60)];
    if (all.length === 72) return [all.slice(0, 36), all.slice(36)];
    if (all.length === 88) return [all.slice(0, 44), all.slice(44)];
  }
  return null;
}

/** parses a MRZ of the three formats; null when it is none of them */
export function parseMrz(input: string | string[]): MrzData | null {
  const lines = normalizeMrzLines(input);
  if (!lines) return null;
  if (lines.length === 3) {
    const [l1, l2, l3] = lines;
    const number = field(l1.slice(5, 14), l1[14]);
    const dob = field(l2.slice(0, 6), l2[6]);
    const doe = field(l2.slice(8, 14), l2[14]);
    const composite = checkDigit(l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29)) === l2[29];
    return {
      format: 'TD1', documentCode: clean(l1.slice(0, 2)), issuingState: clean(l1.slice(2, 5)), ...splitName(l3),
      documentNumber: number, nationality: clean(l2.slice(15, 18)), birthDate: dob, sex: l2[7] === '<' ? '' : l2[7], expiryDate: doe,
      optionalData: clean(l1.slice(15, 30) + l2.slice(18, 29)),
      allValid: number.valid !== false && dob.valid !== false && doe.valid !== false && composite,
    };
  }
  const [l1, l2] = lines;
  const td3 = l1.length === 44;
  const number = field(l2.slice(0, 9), l2[9]);
  const dob = field(l2.slice(13, 19), l2[19]);
  const doe = field(l2.slice(21, 27), l2[27]);
  const optionalEnd = td3 ? 42 : 35;
  const composite = checkDigit(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, optionalEnd + 1)) === l2[optionalEnd + 1];
  const finalOk = td3 ? (l2[42] === '<' || checkDigit(l2.slice(28, 42)) === l2[42]) : true;
  return {
    format: td3 ? 'TD3' : 'TD2', documentCode: clean(l1.slice(0, 2)), issuingState: clean(l1.slice(2, 5)), ...splitName(l1.slice(5)),
    documentNumber: number, nationality: clean(l2.slice(10, 13)), birthDate: dob, sex: l2[20] === '<' ? '' : l2[20], expiryDate: doe,
    optionalData: clean(l2.slice(28, optionalEnd)),
    allValid: number.valid !== false && dob.valid !== false && doe.valid !== false && composite && finalOk,
  };
}

/** what the user types / the zone gives: the three values the access key is made of */
export interface MrzAccess {
  /** the document number as printed (upper case; longer than 9 is allowed: the whole number goes into the key) */
  documentNumber: string;
  /** YYMMDD */
  birthDate: string;
  /** YYMMDD */
  expiryDate: string;
}

/** 'DD.MM.YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'YYMMDD' -> 'YYMMDD', '' when it is none */
export function toYyMmDd(input: string): string {
  const t = input.trim();
  let m = /^(\d{2})(\d{2})(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})$/.exec(t);
  if (m) return `${m[1].slice(2)}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{4})$/.exec(t);
  if (m) return `${m[3].slice(2)}${m[2].padStart(2, '0')}${m[1].padStart(2, '0')}`;
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(t); // DDMMYYYY
  if (m) return `${m[3].slice(2)}${m[2]}${m[1]}`;
  return '';
}

export function isValidYyMmDd(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** the document number as the key wants it: upper case, no spaces, padded with `<` to 9 characters */
export const keyDocumentNumber = (n: string): string => n.toUpperCase().replace(/[^A-Z0-9<]/g, '').padEnd(9, '<');

/** MRZ_information = document number + check, date of birth + check, date of expiry + check (ICAO 9303-11 section 9.7.2) */
export function mrzInformation(a: MrzAccess): string {
  const number = keyDocumentNumber(a.documentNumber);
  return `${number}${checkDigit(number)}${a.birthDate}${checkDigit(a.birthDate)}${a.expiryDate}${checkDigit(a.expiryDate)}`;
}

/** SHA-1 of the MRZ information: the K of BAC (first 16 bytes) and of PACE (the whole 20 bytes) */
export const mrzKeySeed = (a: MrzAccess): Uint8Array => digest('sha1', asciiBytes(mrzInformation(a)));

/** the access values of a parsed MRZ (the data group 1 of a document that was read, or lines the user pasted) */
export function accessFromMrz(mrz: MrzData): MrzAccess {
  return { documentNumber: mrz.documentNumber.value.replace(/ /g, '<'), birthDate: mrz.birthDate.value, expiryDate: mrz.expiryDate.value };
}

/** 'YYMMDD' -> 'YYYY-MM-DD'; a birth date in the future of this year goes to the last century, an expiry date to this one */
export function fullDate(yymmdd: string, kind: 'birth' | 'expiry', now: Date = new Date()): string {
  if (!/^\d{6}$/.test(yymmdd)) return yymmdd;
  const yy = Number(yymmdd.slice(0, 2));
  const thisYear = now.getFullYear();
  let year = Math.floor(thisYear / 100) * 100 + yy;
  if (kind === 'birth' && year > thisYear) year -= 100;
  if (kind === 'expiry' && year < thisYear - 60) year += 100;
  return `${year}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}
