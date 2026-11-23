// Every readable datum of an ID card / passport as a list of label + value, for the media post that the reading becomes (IdCardPostOffer).
// Pure: no React, no native module. Empty values are left out. Sources: the zone (MRZ), DG11 (personal details), DG12 (document details).
import { countryName } from './countries';
import { fullDate } from './mrz';
import { idDocumentKind } from '../../common/notePost';
import type { IdDocument } from './emrtd';

export interface IdCardField {
  label: string;
  value: string;
}

const clean = (v: unknown): string => String(v ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();

/** 'YYMMDD' of the zone -> 'DD.MM.YYYY'; anything else is returned as it is */
export function zoneDateText(yymmdd: string, kind: 'birth' | 'expiry', now?: Date): string {
  const v = clean(yymmdd);
  if (!/^\d{6}$/.test(v)) return v;
  return fullDate(v, kind, now).split('-').reverse().join('.');
}

/** a date of the chip data groups: 'YYYYMMDD' -> 'DD.MM.YYYY', anything else as it is */
export function chipDateText(raw: string): string {
  const v = clean(raw);
  return /^\d{8}$/.test(v) ? `${v.slice(6, 8)}.${v.slice(4, 6)}.${v.slice(0, 4)}` : v;
}

/** the fields in the order a person reads a document: who, the document, the rest of the chip */
export function idCardFields(doc: IdDocument, now?: Date): IdCardField[] {
  const out: IdCardField[] = [];
  const add = (label: string, value: unknown) => {
    const v = Array.isArray(value) ? value.map(clean).filter(Boolean).join(', ') : clean(value);
    if (v) out.push({ label, value: v });
  };
  const m = doc.mrz;
  const d11 = doc.details;
  const d12 = doc.document;
  if (m) {
    add('Surname', m.surname);
    add('Given names', m.givenNames);
  }
  add('Full name (chip)', d11?.fullName);
  add('Other names', d11?.otherNames);
  if (m) {
    add('Sex', m.sex);
    add('Date of birth', zoneDateText(m.birthDate.value, 'birth', now));
  }
  if (!m?.birthDate.value) add('Date of birth', chipDateText(d11?.birthDate ?? ''));
  add('Place of birth', d11?.placeOfBirth);
  if (m) add('Nationality', countryName(m.nationality));
  add('Citizenship', d11?.citizenship);
  add('Personal number', d11?.personalNumber);
  add('Address', d11?.address);
  add('Telephone', d11?.telephone);
  add('Profession', d11?.profession);
  add('Title', d11?.title);
  add('Summary', d11?.summary);
  if (m) {
    add('Document', idDocumentKind(m.documentCode));
    add('Document number', m.documentNumber.value);
    add('Issuing state', countryName(m.issuingState));
    add('Valid until', zoneDateText(m.expiryDate.value, 'expiry', now));
    add('Optional data', m.optionalData);
  }
  add('Issued by', d12?.issuingAuthority);
  add('Date of issue', chipDateText(d12?.dateOfIssue ?? ''));
  add('Endorsements', d12?.endorsements);
  add('Other documents', d11?.otherDocuments);
  add('Custodian', d11?.custodian);
  return out;
}
