// The side panel of the catalog dashboards (Products, Persons, Roles, Equipment) and the Task -> Edit tables follow the app language:
// the English texts they show have a translation in every language of the app (kit8/pm/i18n), and pmT gives it.
import { changeAppLanguage, LANGUAGES } from '../../../kit8/i18n/i18n';
import { pmT } from '../../../kit8/pm/i18n/pmT';
import { PM_LOCALES } from '../../../kit8/pm/i18n/locales';

afterEach(async () => {
  await changeAppLanguage('en');
});

// what the left panel of the Products dashboard shows (see the screen of the owner, 2026-11-23) + the panels of the other three
const CATALOG_PANEL = [
  'Overview', 'Product card', 'Products & folders', 'Catalog', 'Products', 'Product types', 'Folders', 'VAT rates', 'Units',
  'Descriptors', 'Descriptor values', 'Descriptor sets', 'Plan lines', 'Description modes', 'Product data', 'Property values', 'Variants', 'Variant values',
  'Pricing', 'Prices', 'Price types', 'Logistics', 'Barcodes', 'Packs', 'Batches', 'Series',
  'Checks', 'Persons', 'Person types', 'Person data', 'Roles', 'Role types', 'Role data', 'Roles & folders', 'Resource roles', 'Equipment', 'Equipment types', 'Equipment data',
  'Back to {{tab}}', '(the row you came from)', 'all', 'New rows get the filter values.',
  'Product type → product → properties + variants · {{products}} products · {{variants}} variants',
];
// the tables of Task -> Edit: column titles, tabs, empty states, post messages
const TASK_EDIT = [
  'Budget item', 'Business unit', 'Qty', 'Price', 'VAT %', 'Sum', 'Budget distribution', 'Exchange rate', 'Currency', 'Supplier', 'Customer', 'Contract', 'Role', 'Resource',
  'Time', 'Material', 'Expenses', 'Deliverable', 'Payments', 'Outbound', 'Inbound', 'Cash flow', 'Shift (days)', 'Planned date', 'Task start', 'Task end', 'Paid (with VAT)', 'Open (with VAT)',
  'Post', 'Nothing to post', 'No lines yet. Press "+ Add".', 'Select budget item…', 'Select work center…', 'Total', 'Timeline', 'Plan', 'Fact', 'Finances',
  'Posted {{tasks}} task(s) · {{rows}} day row(s)', '{{resource}} is booked twice on {{day}}', 'Search…', 'Filter & Sort',
];

describe('catalog panels and Task -> Edit in all languages', () => {
  it('every text has a translation in every language of the app, with its {{placeholders}}', () => {
    const langs = LANGUAGES.map((l) => l.code).filter((c) => c !== 'en');
    const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) || []).sort();
    for (const lang of langs) {
      for (const text of [...CATALOG_PANEL, ...TASK_EDIT]) {
        const hit = PM_LOCALES[lang]?.[text];
        expect({ lang, text, translated: !!hit }).toEqual({ lang, text, translated: true });
        expect(ph(hit)).toEqual(ph(text));
      }
    }
  });

  it('pmT gives the panel and the table texts in the app language', async () => {
    await changeAppLanguage('lv');
    expect(pmT('Product card')).toBe('Preces kartīte');
    expect(pmT('Product types')).toBe('Preču veidi');
    expect(pmT('Budget item')).toBe('Budžeta postenis');
    expect(pmT('Back to {{tab}}', { tab: 'X' })).toBe('Atpakaļ uz X');
    await changeAppLanguage('de');
    expect(pmT('Products & folders')).toBe('Produkte und Ordner');
    expect(pmT('Post')).toBe('Buchen');
    await changeAppLanguage('ru');
    expect(pmT('Descriptor sets')).toBe('Наборы дескрипторов');
    expect(pmT('Posted {{tasks}} task(s) · {{rows}} day row(s)', { tasks: 2, rows: 5 })).toBe('Проведено задач: 2 · строк по дням: 5');
    await changeAppLanguage('en');
    expect(pmT('Product card')).toBe('Product card');
  });
});
