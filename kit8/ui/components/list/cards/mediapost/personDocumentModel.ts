// What the read-only details of a person's document show (PersonDocumentDetailsCard). Pure: no React.
// Two kinds of post: the ID reader (rowJSON.idCardFields = every datum of the chip, idCardOwnerName / idCardNumber / idCardKind, the owner photo in mediaImageUri)
// and a document typed in by hand with the Add form (origin personIDCard / personPassport: name, personDocumentNumber, description).
import type { ReusableTableRow, VisualColumn } from '../../../table/reusable/reusableTableTypes';

export interface PersonDocumentField { label: string; value: string }
export interface PersonDocumentDetails {
  name: string;
  kind: 'ID card' | 'Passport';
  number: string;
  /** the owner photo the post carries ('' = none) */
  photoUri: string;
  fields: PersonDocumentField[];
  /** when the post was made, 'YYYY-MM-DD HH:mm' */
  created: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim());

/** the post is a document of a person: the reader's post or one typed in with the Add form */
export const isPersonDocumentRow = (row: ReusableTableRow | { rowJSON?: any }): boolean => ['idreader', 'personIDCard', 'personPassport'].includes(str((row as any)?.rowJSON?.dataOriginName));

export function personDocumentDetails(row: ReusableTableRow): PersonDocumentDetails {
  const json: Record<string, any> = (row as any)?.rowJSON ?? {};
  const origin = str(json.dataOriginName);
  const kind: PersonDocumentDetails['kind'] = str(json.idCardKind) === 'Passport' || origin === 'personPassport' || str(json.personDocumentType) === 'passport' || /passport/i.test(str(json.mediaPostSubTitle)) ? 'Passport' : 'ID card';
  const name = str(json.idCardOwnerName) || str(json.mediaPostTitle);
  const number = str(json.idCardNumber) || str(json.personDocumentNumber);
  const read: PersonDocumentField[] = Array.isArray(json.idCardFields)
    ? json.idCardFields.filter((f: any) => f && str(f.label) && str(f.value)).map((f: any) => ({ label: str(f.label), value: str(f.value) }))
    : [];
  let fields = read;
  if (fields.length === 0) {
    fields = [{ label: 'Name', value: name }, { label: 'Document', value: kind }, { label: 'Document number', value: number }, { label: 'Notes', value: str(json.mediaPostDescription) }].filter((f) => f.value);
  }
  const d = new Date(str(json.mediaCreatedAt) || str((row as any)?.created_at));
  const created = Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { name, kind, number, photoUri: str(json.mediaImageUri), fields, created };
}

// ---- Export / Share of ALL the data of the document (the three dots menu of the details card): a two column table, one row per datum ----
export const PERSON_DOCUMENT_EXPORT_COLUMNS: VisualColumn[] = [
  { key: 'label', title: 'Field', type: 'text', field: 'label' },
  { key: 'value', title: 'Value', type: 'text', field: 'value' },
];

/** the owner photo as plain base64 (no `data:` start) + its type; null when the post has no picture or it is no data address */
export function personDocumentPhotoBase64(d: PersonDocumentDetails): { mime: string; base64: string } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(d.photoUri || '');
  return m ? { mime: m[1].toLowerCase(), base64: m[2].replace(/\s+/g, '') } : null;
}

/** the rows of the export: who, the document, then every datum (a datum that repeats the first rows is not written twice), and LAST the owner photo as base64 (JSON and CSV) */
export function personDocumentExportRows(d: PersonDocumentDetails): ReusableTableRow[] {
  const head: PersonDocumentField[] = [{ label: 'Name', value: d.name }, { label: 'Document', value: d.kind }, { label: 'Document number', value: d.number }];
  const seen = new Set(head.map((f) => `${f.label}|${f.value}`));
  const all = [...head, ...d.fields].filter((f) => f.value && !(seen.has(`${f.label}|${f.value}`) && !head.includes(f)));
  const photo = personDocumentPhotoBase64(d);
  if (photo) all.push({ label: `Photo (base64 ${photo.mime})`, value: photo.base64 });
  return all.map((f, i) => ({ rowGUID: `field-${i}`, rowOwnerGUID: 'empty', rowParentGUID: 'empty', orderInList: i, rowJSON: { label: f.label, value: f.value } } as ReusableTableRow));
}

/** the title of the file: 'JURIJS TERENTJEVS Passport' */
export const personDocumentExportTitle = (d: PersonDocumentDetails): string => `${d.name || 'Person'} ${d.kind}`.trim();
