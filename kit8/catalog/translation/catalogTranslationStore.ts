// The translations of catalog items for the INTERFACE language (SQL PART 56). One module-level store, like kit8/i18n/organizationTexts.ts: CatalogTranslationsHost (mounted in
// app/_layout.tsx) reads the rows of the active language and hands them here; `rowTitle` (product catalog tools) and `defaultTitleExtractor` (SelectElementFromCatalog) ask it, so
// every read-only display of a catalog title follows the language of the interface. A missing translation = the item's own text. Pure: no i18n / Supabase import.
// An EDITABLE cell (the Title column of a catalog table, the Main tab of a card) keeps showing the item's own text - saving a translated text into the item would overwrite it.
import { useSyncExternalStore } from 'react';

export interface CatalogTranslationRow {
  rowOwnerGUID?: string | null;
  rowParentGUID?: string | null;
  rowJSON?: { translationField?: string; translationText?: string } | null;
}

const texts = new Map<string, string>();
let activeLanguage = '';
let version = 0;
const listeners = new Set<() => void>();

const keyOf = (item: string, field: string) => `${item}|${field}`;

/** replaces the store with the rows of ONE language (rows of another language are ignored; empty text = no translation) */
export function setCatalogTranslations(language: string, rows: readonly CatalogTranslationRow[] | null | undefined): void {
  texts.clear();
  activeLanguage = language || '';
  for (const r of rows || []) {
    const field = r?.rowJSON?.translationField;
    const text = typeof r?.rowJSON?.translationText === 'string' ? r.rowJSON.translationText.trim() : '';
    if (!r?.rowOwnerGUID || (field !== 'title' && field !== 'description') || !text) continue;
    if (r.rowParentGUID && r.rowParentGUID !== activeLanguage) continue;
    texts.set(keyOf(r.rowOwnerGUID, field), text);
  }
  version += 1;
  listeners.forEach((l) => l());
}

/** the translated title of a catalog item in the interface language; undefined = none (the caller shows the item's own text) */
export const translatedTitle = (itemGUID: string | null | undefined): string | undefined => (texts.size && itemGUID ? texts.get(keyOf(itemGUID, 'title')) : undefined);

/** the translated description of a catalog item in the interface language; undefined = none */
export const translatedDescription = (itemGUID: string | null | undefined): string | undefined => (texts.size && itemGUID ? texts.get(keyOf(itemGUID, 'description')) : undefined);

export const catalogTranslationCount = (): number => texts.size;
export const catalogTranslationLanguage = (): string => activeLanguage;
export const catalogTranslationVersion = (): number => version;
export const subscribeCatalogTranslations = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** re-renders the component when the translations change (a language switch, a new translation); returns the version (put it in the deps of a useMemo that builds labels) */
export const useCatalogTranslationVersion = (): number => useSyncExternalStore(subscribeCatalogTranslations, catalogTranslationVersion, catalogTranslationVersion);
