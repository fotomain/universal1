// From a parsed zone to the values of the confirm step. Pure.
import { fullDate, isValidYyMmDd } from '../iddocread/mrz';
import type { MrzFromText } from './mrzFromText';
import { ConfirmedValues, EMPTY_VALUES } from './identificationTypes';

/** YYMMDD -> DD.MM.YYYY (an invalid one is returned as it is) */
export const ddmmyyyy = (yymmdd: string, kind: 'birth' | 'expiry'): string => (isValidYyMmDd(yymmdd) ? fullDate(yymmdd, kind).split('-').reverse().join('.') : yymmdd);

/** YYYY-MM-DD -> DD.MM.YYYY */
export const isoToDdmmyyyy = (iso: string | null | undefined): string => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : '');

export const valuesOf = (r: MrzFromText | null): ConfirmedValues =>
  r
    ? { documentNumber: r.access.documentNumber.replace(/</g, ''), birthDate: ddmmyyyy(r.access.birthDate, 'birth'), expiryDate: ddmmyyyy(r.access.expiryDate, 'expiry'), country: r.mrz.issuingState, can: '' }
    : { ...EMPTY_VALUES };

export const hasValues = (v: ConfirmedValues): boolean => !!v.documentNumber && !!v.birthDate && !!v.expiryDate;
