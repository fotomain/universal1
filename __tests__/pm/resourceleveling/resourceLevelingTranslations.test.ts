// Every text of Resource optimization is in the dictionaries (documentation/RESOURCE_LEVELING_WBS.html section 12): a pmT('...') in kit8/pm/resourceleveling whose English text is not a key of
// kit8/pm/i18n/locales/keys.ts shows English in all 14 other languages. The generic test (__tests__/pm/i18n) checks that every key is translated in every language.
import * as fs from 'fs';
import * as path from 'path';
import { PM_KEYS } from '../../../kit8/pm/i18n/locales/keys';
import { PM_LOCALES } from '../../../kit8/pm/i18n/locales';

const root = path.join(__dirname, '../../../kit8/pm/resourceleveling');
const files = fs.readdirSync(root).filter((f) => /\.(ts|tsx)$/.test(f));
const literals = (src: string): string[] => {
  const out: string[] = [];
  for (const m of src.matchAll(/pmT\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) out.push((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  return out;
};
// the labels of the menu items are given as plain English and translated by PMMenuItem
const MENU_LABELS = ['Level now', 'Clear leveling', 'Undo last run', 'Run history'];

describe('the texts of kit8/pm/resourceleveling', () => {
  const all = new Set<string>(MENU_LABELS);
  for (const f of files) for (const t of literals(fs.readFileSync(path.join(root, f), 'utf8'))) all.add(t);

  it('there are texts to check', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(all.size).toBeGreaterThan(100);
  });

  it('each one is a key of the dictionaries', () => {
    const keys = new Set(PM_KEYS);
    const missing = [...all].filter((t) => !keys.has(t));
    expect(missing).toEqual([]);
  });

  it('each one is translated in every language, with the same placeholders', () => {
    const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) || []).sort().join(',');
    const problems: string[] = [];
    for (const [lang, dict] of Object.entries(PM_LOCALES)) {
      for (const t of all) {
        const tr = dict[t];
        if (!tr) problems.push(`${lang}: no translation of "${t}"`);
        else if (ph(tr) !== ph(t)) problems.push(`${lang}: placeholders of "${t}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('the languages are the 14 of the app besides English', () => {
    expect(Object.keys(PM_LOCALES).sort()).toEqual(['ar', 'bn', 'de', 'es', 'et', 'fa', 'fr', 'hi', 'lt', 'lv', 'nl', 'pt', 'ru', 'zh']);
  });
});
