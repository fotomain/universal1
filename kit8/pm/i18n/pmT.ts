// Translations of the project management module (kit8/pm).
//
//   pmT('Export to PDF')                                  -> text in the app language (kit8/i18n: LANGUAGES)
//   pmT('Exported {{file}}', { file: 'a.json' })          -> with values
//
// The ENGLISH TEXT IS THE KEY: a text that is not translated yet is shown in English, and English needs no
// dictionary. The dictionaries are locales/<lang>.ts = { 'English text': 'translation' }, registered in the app's
// i18next instance as the namespace "pm" (the language is the one of the app: LanguageSelectorComponent).
//
// React: screens re-render on a language change through usePMLanguage() (PMProjectDashboard / PMProjectTaskInfo
// remount their content with key={language}).

import { useEffect, useState } from 'react';
import i18n from '../../i18n/i18n';
import { PM_LOCALES } from './locales';

export const PM_I18N_NS = 'pm';

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registered = true;
  try {
    for (const lang of Object.keys(PM_LOCALES)) i18n.addResourceBundle(lang, PM_I18N_NS, PM_LOCALES[lang], true, true);
  } catch {
    // i18next not initialised (tests that mock it): English is used
  }
}

const fill = (text: string, values?: Record<string, string | number>) =>
  values ? text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (values[k] !== undefined ? String(values[k]) : m)) : text;

/** The text in the app language (English when there is no translation). */
export function pmT(text: string, values?: Record<string, string | number>): string {
  ensureRegistered();
  try {
    const lang = (i18n.language || 'en').split('-')[0];
    if (lang !== 'en') {
      const hit = PM_LOCALES[lang]?.[text];
      if (hit) return fill(hit, values);
    }
  } catch {
    // fall through to English
  }
  return fill(text, values);
}

/** The app language code ('en', 'lv', ...). */
export function pmLanguage(): string {
  try {
    return (i18n.language || 'en').split('-')[0];
  } catch {
    return 'en';
  }
}

/** Re-renders the component when the app language changes; returns the language code. */
export function usePMLanguage(): string {
  const [lang, setLang] = useState(pmLanguage());
  useEffect(() => {
    ensureRegistered();
    const on = (l: string) => setLang((l || 'en').split('-')[0]);
    try {
      i18n.on('languageChanged', on);
    } catch {
      return undefined;
    }
    setLang(pmLanguage());
    return () => {
      try {
        i18n.off('languageChanged', on);
      } catch {
        // ignore
      }
    };
  }, []);
  return lang;
}

/** Every English text that has a translation in `lang` (tests / the translation check). */
export function pmTranslatedTexts(lang: string): string[] {
  return Object.keys(PM_LOCALES[lang] || {});
}
