// PersonDocumentDataInput - the data of a person's ID card / passport typed in by hand, as COMPLETE as the data a reading gives (iddocread/idCardFields.ts):
// who (surname, given names, sex, date and place of birth, nationality, personal number, address), the document (number, issuing state, dates, issued by), the owner photo.
// Pure: no React. It makes the same rowJSON as the ID reader's post (`idCardFields`, `idCardOwnerName`, `idCardNumber`, `idCardKind`, `idCardFolder`, `mediaImageUri`), so the
// card, the read only details (PersonDocumentDetailsCard) and the exports show a document typed in like a document that was read.
import { countryName } from '../../media/nfc/iddocread/countries';
import { ID_POST_PHOTO_MAX_CHARS } from '../../media/common/notePost';

export type PersonDocumentKind = 'idCard' | 'passport';
export const personKindLabel = (kind: PersonDocumentKind): 'ID card' | 'Passport' => (kind === 'passport' ? 'Passport' : 'ID card');
export const personKindFolder = (kind: PersonDocumentKind): 'idcard' | 'passport' => (kind === 'passport' ? 'passport' : 'idcard');

export type PersonSex = '' | 'M' | 'F' | 'X';
export const SEX_OPTIONS: { label: string; value: PersonSex }[] = [
  { label: 'Not given', value: '' }, { label: 'Male (M)', value: 'M' }, { label: 'Female (F)', value: 'F' }, { label: 'Unspecified (X)', value: 'X' },
];

export interface PersonDocumentInput {
  surname: string;
  givenNames: string;
  sex: PersonSex;
  /** DD.MM.YYYY */
  birthDate: string;
  placeOfBirth: string;
  /** 3 letters (ISO / ICAO): LVA */
  nationality: string;
  personalNumber: string;
  address: string;
  documentNumber: string;
  /** 3 letters */
  issuingState: string;
  /** DD.MM.YYYY */
  issueDate: string;
  /** DD.MM.YYYY: valid until */
  expiryDate: string;
  issuedBy: string;
  notes: string;
}

export const emptyPersonDocumentInput = (): PersonDocumentInput => ({
  surname: '', givenNames: '', sex: '', birthDate: '', placeOfBirth: '', nationality: '', personalNumber: '', address: '',
  documentNumber: '', issuingState: '', issueDate: '', expiryDate: '', issuedBy: '', notes: '',
});

/** the owner photo picked by the user, already a JPEG small enough for the post (personPhoto.ts) */
export interface PersonPhoto {
  /** data:image/jpeg;base64,... (what the card draws and what the post stores) */
  dataUri: string;
  mime: string;
  base64: string;
}

// ---- dates: DD.MM.YYYY ----
const DMY = /^(\d{2})\.(\d{2})\.(\d{4})$/;
/** 'DD.MM.YYYY' (also 'DDMMYYYY' and 'D.M.YYYY') -> a Date at noon (no time zone trap), null when it is no real day */
export function parseDmy(text: string): Date | null {
  const t = String(text ?? '').trim();
  const m = DMY.exec(t) ?? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
}
export const formatDmy = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
/** the typed date in the one written form ('1.2.1990' -> '01.02.1990'); anything that is no date is returned as typed */
export const normalizeDmy = (text: string): string => { const d = parseDmy(text); return d ? formatDmy(d) : String(text ?? '').trim(); };

const clean = (v: string) => String(v ?? '').replace(/\s+/g, ' ').trim();
const code3 = (v: string) => String(v ?? '').trim().toUpperCase();

export interface PersonDocumentErrors {
  surname?: string; givenNames?: string; documentNumber?: string; birthDate?: string; issueDate?: string; expiryDate?: string; nationality?: string; issuingState?: string;
}

/** an empty object = the document may be saved. Surname, given names and document number are needed; a date must be a real day; a state is 3 letters; it expires after it was issued and after the birth */
export function validatePersonDocumentInput(v: PersonDocumentInput): PersonDocumentErrors {
  const e: PersonDocumentErrors = {};
  if (!clean(v.surname)) e.surname = 'Surname is required';
  if (!clean(v.givenNames)) e.givenNames = 'Given names are required';
  if (!clean(v.documentNumber)) e.documentNumber = 'Document number is required';
  const dates: Array<['birthDate' | 'issueDate' | 'expiryDate', string]> = [['birthDate', v.birthDate], ['issueDate', v.issueDate], ['expiryDate', v.expiryDate]];
  for (const [key, value] of dates) if (clean(value) && !parseDmy(value)) e[key] = 'Date as DD.MM.YYYY';
  for (const key of ['nationality', 'issuingState'] as const) if (clean(v[key]) && !/^[A-Za-z]{1,3}$/.test(clean(v[key]))) e[key] = '3 letters, e.g. LVA';
  const birth = parseDmy(v.birthDate), issue = parseDmy(v.issueDate), expiry = parseDmy(v.expiryDate);
  if (!e.expiryDate && expiry && issue && expiry < issue) e.expiryDate = 'Valid until is before the date of issue';
  if (!e.issueDate && issue && birth && issue < birth) e.issueDate = 'The date of issue is before the birth';
  return e;
}

export interface PersonDocumentField { label: string; value: string }

/** every datum typed, as label + value in the order of a document (the order and the words of the reader's idCardFields); empty ones left out */
export function personDocumentFieldsOf(v: PersonDocumentInput, kind: PersonDocumentKind): PersonDocumentField[] {
  const out: PersonDocumentField[] = [];
  const add = (label: string, value: string) => { const x = clean(value); if (x) out.push({ label, value: x }); };
  add('Surname', v.surname);
  add('Given names', v.givenNames);
  add('Sex', v.sex);
  add('Date of birth', normalizeDmy(v.birthDate));
  add('Place of birth', v.placeOfBirth);
  add('Nationality', v.nationality ? countryName(code3(v.nationality)) : '');
  add('Personal number', v.personalNumber);
  add('Address', v.address);
  add('Document', personKindLabel(kind));
  add('Document number', v.documentNumber.toUpperCase());
  add('Issuing state', v.issuingState ? countryName(code3(v.issuingState)) : '');
  add('Valid until', normalizeDmy(v.expiryDate));
  add('Issued by', v.issuedBy);
  add('Date of issue', normalizeDmy(v.issueDate));
  add('Notes', v.notes);
  return out;
}

/** 'JURIJS TERENTJEVS' (given names first, as the reader writes it) */
export const personOwnerName = (v: PersonDocumentInput): string => [clean(v.givenNames), clean(v.surname)].filter(Boolean).join(' ');

/** the rowJSON of the new post: the keys of the ID reader's post (IdCardPostInput / buildIdCardPost) */
export function buildPersonDocumentRowJSON(v: PersonDocumentInput, kind: PersonDocumentKind, photo: PersonPhoto | null, now: Date = new Date()): Record<string, any> {
  const fields = personDocumentFieldsOf(v, kind);
  const number = v.documentNumber.trim().toUpperCase();
  const label = personKindLabel(kind);
  const json: Record<string, any> = {
    mediaPostTitle: personOwnerName(v),
    mediaPostSubTitle: `${label}${number ? ` · No. ${number}` : ''}`,
    mediaPostDescription: fields.map((f) => `${f.label}: ${f.value}`).join('\n'),
    mediaPostOrigin: '',
    mediaPostOriginType: 'person',
    mediaPostMIME: 'application/x-person-document',
    dataOriginName: kind === 'passport' ? 'personPassport' : 'personIDCard',
    mediaCreatedAt: now.toISOString(),
    personDocumentType: kind,
    personDocumentNumber: number,
    idCardOwnerName: personOwnerName(v),
    idCardNumber: number,
    idCardKind: label,
    idCardFolder: personKindFolder(kind),
    idCardFields: fields,
  };
  // the picture the list draws: only a JPEG / PNG data address that is small enough (the file storage gets the photo anyway)
  if (photo && /^data:image\/(jpeg|png);base64,/i.test(photo.dataUri) && photo.dataUri.length <= ID_POST_PHOTO_MAX_CHARS) {
    json.mediaImageUri = photo.dataUri;
    json.mediaPostMIME = photo.mime;
  }
  return json;
}
