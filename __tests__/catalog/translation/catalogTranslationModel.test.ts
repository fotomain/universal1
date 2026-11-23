// Catalog translations (SQL PART 56): the model helpers, the metadata entry, the permission flag and the SQL files.
// The behaviour in the database is kit8/docker/tests/105_catalog_translation.sql; the Translate tab is in __tests__/catalog/product/productsWithTree.test.tsx.
import {
  CATALOG_TRANSLATION_TABLE, isTranslationField, LANGUAGE_OPTIONS, languageLabel, nextFreeTranslation, PERMISSION_TRANSLATE_CATALOG, TRANSLATION_FIELDS, translationOf, translationsOfItem,
} from '../../../kit8/catalog/translation/catalogTranslationModel';
import { catalogTranslationSystemMetaData } from '../../../kit8/catalog/translation/catalogTranslationMetaData';
import { LANGUAGES } from '../../../kit8/i18n/i18n';
import { matrixOf, profileTitleOf, TRANSLATE_CATALOG_PROFILE, EMPTY_MATRIX } from '../../../kit8/permissions/permissionModel';
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';

const row = (owner: string, lang: string, field: string, text: string) => ({ rowGUID: `${owner}-${lang}-${field}`, rowOwnerGUID: owner, rowParentGUID: lang, rowJSON: { translationField: field, translationText: text } });

describe('the model', () => {
  it('its own table and entity; a new row is a title', () => {
    const t = CATALOG_TRANSLATION_TABLE;
    expect([t.table, t.entity]).toEqual(['catalogTranslationTable', 'catalogTranslationReusable']);
    expect(t.emptyRowJSON()).toEqual({ translationField: 'title', translationText: '' });
    expect(PERMISSION_TRANSLATE_CATALOG).toBe('permissionTranslateCatalog');
  });
  it('only title and description can be translated', () => {
    expect([...TRANSLATION_FIELDS]).toEqual(['title', 'description']);
    expect(isTranslationField('title')).toBe(true);
    expect(isTranslationField('description')).toBe(true);
    for (const v of ['price', '', null, undefined, 1]) expect(isTranslationField(v)).toBe(false);
  });
  it('the languages are the 15 languages of the application (code = language GUID)', () => {
    expect(LANGUAGE_OPTIONS.map((o) => o.value)).toEqual(LANGUAGES.map((l) => l.code));
    expect(LANGUAGE_OPTIONS).toHaveLength(15);
    expect(languageLabel('lv')).toBe('Latvian (LV)');
    expect(languageLabel('xx')).toBe('xx');
  });
  it('translationsOfItem / translationOf: one item, one language, one field; empty text = no translation', () => {
    const rows = [row('p1', 'lv', 'title', ' Planšete '), row('p1', 'lv', 'description', ''), row('p2', 'lv', 'title', 'Cits')];
    expect(translationsOfItem(rows, 'p1')).toHaveLength(2);
    expect(translationOf(rows, 'p1', 'lv', 'title')).toBe('Planšete');
    expect(translationOf(rows, 'p1', 'lv', 'description')).toBeNull();
    expect(translationOf(rows, 'p1', 'ru', 'title')).toBeNull();
    expect(translationOf(null, 'p1', 'lv', 'title')).toBeNull();
  });
  it('nextFreeTranslation: the first language / field pair without a row, per item; null when all 30 are used', () => {
    expect(nextFreeTranslation([], 'p1')).toEqual({ language: 'en', field: 'title' });
    expect(nextFreeTranslation([row('p1', 'en', 'title', 'x')], 'p1')).toEqual({ language: 'zh', field: 'title' });
    expect(nextFreeTranslation([row('p2', 'en', 'title', 'x')], 'p1')).toEqual({ language: 'en', field: 'title' });
    const all = LANGUAGES.flatMap((l) => TRANSLATION_FIELDS.map((f) => row('p1', l.code, f, 'x')));
    expect(nextFreeTranslation(all, 'p1')).toBeNull();
    expect(nextFreeTranslation(all.slice(1), 'p1')).toEqual({ language: 'en', field: 'title' });
  });
  it('the SystemMetaData entry reads / writes the table', () => {
    const e = catalogTranslationSystemMetaData().catalogTranslationReusable;
    expect(e.tableName).toBe('catalogTranslationTable');
    expect(e.defaultData).toEqual({ translationField: 'title', translationText: '' });
  });
});

describe('the permission flag', () => {
  it('canTranslateCatalog comes from perm_my_matrix; nothing = false', () => {
    expect(EMPTY_MATRIX.canTranslateCatalog).toBe(false);
    expect(matrixOf({ canTranslateCatalog: true }).canTranslateCatalog).toBe(true);
    expect(matrixOf({ canTranslateCatalog: 'true' }).canTranslateCatalog).toBe(false);
    expect(matrixOf({ crud: {} }).canTranslateCatalog).toBe(false);
  });
  it('the profile name has a title and is not one of the 11 profiles', () => {
    expect(TRANSLATE_CATALOG_PROFILE).toBe(PERMISSION_TRANSLATE_CATALOG);
    expect(profileTitleOf(TRANSLATE_CATALOG_PROFILE)).toBe('Translate catalogs');
  });
});

describe('the SQL files (PART 56)', () => {
  const tables = sqlPart(tablesSql, 56);
  const code = sqlPart(codeSql, 56);
  it('start1: the two tables, the unique key item + language + field, only tables', () => {
    expect(tables).toContain('CREATE TABLE IF NOT EXISTS public.language_catalog (');
    expect(tables).toContain('CREATE TABLE IF NOT EXISTS public."catalogTranslationTable" (');
    expect(tables).toContain('("rowOwnerGUID", "rowParentGUID", ("rowJSON"->>\'translationField\'))');
    expect(tables).toContain('REFERENCES public.language_catalog("rowGUID")');
    expect(tables).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
  });
  it('start2: the permission function names the four holders; writes need it, reads are open', () => {
    expect(code).toContain('CREATE OR REPLACE FUNCTION public.permission_translate_catalog()');
    for (const part of ['permission_application_admin()', 'organization_is_admin(v_org)', "'permissionProjectManager'", "'permissionTranslateCatalog'"]) expect(code).toContain(part);
    expect(code).toContain("FOR SELECT TO authenticated USING (true)', t || '_select'");
    for (const op of ['insert', 'update', 'delete']) expect(code).toMatch(new RegExp(`'_${op}'`));
    expect(code.match(/public\.permission_translate_catalog\(\)/g)!.length).toBeGreaterThanOrEqual(6);
    // the interface asks perm_my_matrix
    expect(codeSql).toContain("'canTranslateCatalog', public.permission_translate_catalog()");
  });
  it('start4 / start5 seed the same 15 languages as the application', () => {
    for (const f of ['start4_sql_insert_missing.sql', 'start5_sql_upsert_all.sql']) {
      const s = readSql(f);
      for (const l of LANGUAGES) expect(s).toContain(`('${l.code}', 'languageCatalog', 'empty',`);
    }
    expect(readSql('start4_sql_insert_missing.sql')).toMatch(/PART 56: create_catalog_translation\.sql\s+\(seed data: the languages\)/);
  });
  it('the delete file drops both tables and the functions, as the newest part', () => {
    const del = readSql('delete_sql_structure.sql');
    expect(del).toContain('PART 1a-00000000000000000000000: delete_catalog_translation.sql');
    expect(del.indexOf('PART 1a-00000000000000000000000:')).toBeLessThan(del.indexOf('PART 1a-0000000000000000000000:'));
    for (const x of ['DROP TABLE IF EXISTS public."catalogTranslationTable"', 'DROP TABLE IF EXISTS public.language_catalog', 'DROP FUNCTION IF EXISTS public.permission_translate_catalog()']) expect(del).toContain(x);
  });
});
