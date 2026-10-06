// Translations of the PM module (kit8/pm/i18n): every language of the app has a dictionary for every text.
import fs from 'fs';
import path from 'path';
import i18n, { LANGUAGES, changeAppLanguage } from '../../../kit8/i18n/i18n';
import { pmT, pmLanguage, pmTranslatedTexts } from '../../../kit8/pm/i18n/pmT';
import { PM_LOCALES } from '../../../kit8/pm/i18n/locales';
import { PM_KEYS } from '../../../kit8/pm/i18n/locales/keys';

const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) || []).sort();

afterEach(async () => {
  await changeAppLanguage('en');
});

describe('PM translations', () => {
  it('every language of the app (LanguageSelectorComponent) is translated completely', () => {
    const langs = LANGUAGES.map((l) => l.code).filter((c) => c !== 'en');
    expect(langs.length).toBeGreaterThan(10);
    for (const lang of langs) {
      const dict = PM_LOCALES[lang];
      expect(dict).toBeDefined();
      const missing = PM_KEYS.filter((k) => !dict[k] || !dict[k].trim());
      expect({ lang, missing }).toEqual({ lang, missing: [] });
      // values keep the {{placeholders}} of the English text
      for (const k of PM_KEYS) expect({ lang, k, p: placeholders(dict[k]) }).toEqual({ lang, k, p: placeholders(k) });
      expect(pmTranslatedTexts(lang).length).toBe(PM_KEYS.length);
    }
  });

  it('pmT follows the app language; English and unknown texts stay as they are', async () => {
    expect(pmT('Export to PDF')).toBe('Export to PDF');
    await changeAppLanguage('lv');
    expect(pmLanguage()).toBe('lv');
    expect(pmT('Export to PDF')).toBe('Eksportēt uz PDF');
    expect(pmT('Export Kanban Stage')).toBe('Eksportēt Kanban posmu');
    expect(pmT('Exported {{file}} ({{count}} tasks).', { file: 'a.xml', count: 3 })).toBe('Eksportēts a.xml (3 uzdevumi).');
    expect(pmT('A text nobody translated {{n}}', { n: 1 })).toBe('A text nobody translated 1');
    await changeAppLanguage('ru');
    expect(pmT('Cancel')).toBe('Отмена');
    await changeAppLanguage('de');
    expect(pmT('Save')).toBe('Speichern');
    expect(i18n.language).toBe('de');
  });

  it('the texts of the export / date input features are in the dictionary', () => {
    for (const k of ['Export', 'Export to PDF', 'Export to JSON', 'Export to MS Project', 'Export custom fields', 'Export Kanban Stage', 'Export Kanban Percent', 'Select date', 'Clear', 'Start', 'Finish', 'Save as template']) {
      expect(PM_KEYS).toContain(k);
    }
  });

  it('the generated dictionaries are in sync with their sources (kit8/pm/i18n/src/*.txt)', () => {
    const src = path.join(__dirname, '../../../kit8/pm/i18n/src');
    const files = fs.readdirSync(src).filter((f) => f.endsWith('.txt'));
    expect(files.map((f) => f.replace('.txt', '')).sort()).toEqual(Object.keys(PM_LOCALES).sort());
    for (const f of files) {
      const lang = f.replace('.txt', '');
      for (const line of fs.readFileSync(path.join(src, f), 'utf8').split('\n')) {
        const m = /^(\d+)\|(.*)$/.exec(line);
        if (!m) continue;
        expect(PM_LOCALES[lang][PM_KEYS[Number(m[1]) - 1]]).toBe(m[2].trim());
      }
    }
  });
});
