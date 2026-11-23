// Catalog translations - the title and the description of ANY catalog item in another language (SQL PART 56; the Translate tab of a catalog card).
//   language_catalog          rowGUID = the language code (en, lv, ru ...) - the same 15 codes as LANGUAGES of kit8/i18n/i18n.ts
//   catalogTranslationTable   rowOwnerGUID = the GUID of the catalog item · rowParentGUID = the language · rowJSON { translationField: 'title' | 'description', translationText }
//   Unique: item + language + field. A missing row = the item's own text.
// Written by who holds permissionTranslateCatalog (the organization administrator, a project manager, the application administrator, or a user that got it); read by everybody.
import { LANGUAGES } from '../../i18n/i18n';
import type { DefRow, ProductTableDef } from '../product/productModel';
import type { SelectOption } from '../../ui/components/table/reusable/reusableTableTypes';

export const CATALOG_TRANSLATION_TABLE: ProductTableDef = {
  table: 'catalogTranslationTable',
  entity: 'catalogTranslationReusable',
  itemLabel: 'Translation',
  catalogOwner: null,
  purpose: 'The title and the description of a catalog item in another language.',
  emptyRowJSON: () => ({ translationField: 'title', translationText: '' }),
};

/** the permission that lets a user write translations (all catalogs) */
export const PERMISSION_TRANSLATE_CATALOG = 'permissionTranslateCatalog';

/** the fields of a catalog item that can be translated */
export const TRANSLATION_FIELDS = ['title', 'description'] as const;
export type TranslationField = (typeof TRANSLATION_FIELDS)[number];

export const TRANSLATION_FIELD_OPTIONS: SelectOption[] = [
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
];

export const isTranslationField = (v: unknown): v is TranslationField => typeof v === 'string' && (TRANSLATION_FIELDS as readonly string[]).includes(v);

/** the language rows: rowGUID = code (SQL start4 PART 56 seeds the same list) */
export const LANGUAGE_OPTIONS: SelectOption[] = LANGUAGES.map((l) => ({ value: l.code, label: `${l.name} (${l.abbr})` }));

export const languageLabel = (code: string | null | undefined): string => LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? String(code ?? '');

export type TranslationRow = Pick<DefRow<any>, 'rowGUID' | 'rowOwnerGUID' | 'rowParentGUID' | 'rowJSON'>;

/** the translations of ONE catalog item */
export const translationsOfItem = (rows: TranslationRow[] | undefined | null, itemGUID: string): TranslationRow[] =>
  (rows ?? []).filter((r) => r.rowOwnerGUID === itemGUID);

/** the translated text of an item field in a language; null when there is none (the caller shows the item's own text) */
export function translationOf(rows: TranslationRow[] | undefined | null, itemGUID: string, language: string, field: TranslationField): string | null {
  const row = (rows ?? []).find((r) => r.rowOwnerGUID === itemGUID && r.rowParentGUID === language && r.rowJSON?.translationField === field);
  const text = typeof row?.rowJSON?.translationText === 'string' ? row.rowJSON.translationText.trim() : '';
  return text === '' ? null : text;
}

/** the first (language, field) pair of an item that has no row yet - a new row gets it, so the unique key is not hit by "+"; null when all are used */
export function nextFreeTranslation(rows: TranslationRow[] | undefined | null, itemGUID: string): { language: string; field: TranslationField } | null {
  const used = new Set(translationsOfItem(rows, itemGUID).map((r) => `${r.rowParentGUID}|${r.rowJSON?.translationField}`));
  for (const field of TRANSLATION_FIELDS) {
    for (const o of LANGUAGE_OPTIONS) {
      if (!used.has(`${o.value}|${field}`)) return { language: o.value, field };
    }
  }
  return null;
}
