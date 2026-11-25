import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import { expandNormFiles, importNormBooks, translationRow, type NormStore } from '../../../kit8/pm/estimation/import/importNormBooks';
import { geminiTranslator, parseTranslation, translationPrompt } from '../../../kit8/pm/estimation/import/normTranslator';
import { buildNormBookZip, importNormBookZip, NormZipError, normPrefixOfBook, readNormBookZip } from '../../../kit8/pm/estimation/export/normBookZip';
import { bookGUIDOf, buildNormTree, booksOf, countryOf, nodePath, WORLD_NORMS_GUID, COUNTRIES, CONTINENTS } from '../../../kit8/pm/estimation/model/normBookModel';
import { isNormGUID, normRowGUID, stableHash } from '../../../kit8/pm/estimation/model/estimationModel';

const enc = (s: string) => new TextEncoder().encode(s);
const NORMS = `<base BaseName="T"><ResourcesDirectory><ResourceCategory Type="СТРОИТЕЛЬНЫЕ РАБОТЫ" CodePrefix="ГЭСН"><Section Name="Земляные работы" Type="Сборник" Code="01">
<NameGroup BeginName="Разработка грунта:"><Work Code="01-01-001-01" EndName="группа 1" MeasureUnit="1000 м3"><Resources><Resource Code="1-100-38" Quantity="1.5"/></Resources></Work>
<Work Code="01-01-001-02" EndName="группа 2" MeasureUnit="1000 м3"><Resources><Resource Code="2" Quantity="2"/></Resources></Work></NameGroup></Section></ResourceCategory></ResourcesDirectory></base>`;
const RES = `<ResourceCatalog><ResourcesDirectory><ResourceCategory Type="Материал"><Section Name="Доски" Code="01" Type="Группа"><Resource Code="01.1" Name="Доска" MeasureUnit="м2"><Prices><Price Cost="900" OptCost="800"/></Prices></Resource></Section></ResourceCategory></ResourcesDirectory></ResourceCatalog>`;
const OTHER = `<NewDataSet><base BaseName="x"><TechnologyGroup Code="1"><Work Code="2"/></TechnologyGroup></base></NewDataSet>`;

class FakeStore implements NormStore {
  tables: Record<string, Record<string, any>> = {};
  calls: { table: string; n: number }[] = [];
  async upsert(table: string, rows: Record<string, any>[]) {
    if (!rows.length) return;
    this.calls.push({ table, n: rows.length });
    this.tables[table] ??= {};
    for (const r of rows) this.tables[table][r.rowGUID] = r;
  }
  rows(table: string) { return Object.values(this.tables[table] ?? {}); }
}
const BASE = { countryCode: 'RU', bookCode: 'FSNB-2022', bookTitle: 'FSNB-2022', version: 'sup20', sourceCurrency: 'RUB', targetCurrency: 'EUR', fxRate: 0.01, fxDate: '2026-11-24', language: 'ru' };

describe('the norm book tree', () => {
  it('has the world, six continents and the known countries; every country is under a continent of the tree', () => {
    expect(CONTINENTS).toHaveLength(6);
    const guids = new Set(CONTINENTS.map((c) => c.guid));
    for (const c of COUNTRIES) expect(guids.has(c.continent)).toBe(true);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(countryOf('ru')?.title).toBe('Russia');
    expect(countryOf('ZZ')).toBeUndefined();
  });
  it('builds the tree and the path of a book', () => {
    const rows: any[] = [
      { rowGUID: WORLD_NORMS_GUID, rowOwnerGUID: 'x', rowParentGUID: 'empty', orderInList: 1, rowJSON: { nodeKind: 'world', title: 'World Norms (v2)' } },
      { rowGUID: 'estContinentEurope', rowOwnerGUID: 'x', rowParentGUID: WORLD_NORMS_GUID, orderInList: 1, rowJSON: { nodeKind: 'continent', title: 'Europe' } },
      { rowGUID: 'estCountryRU', rowOwnerGUID: 'x', rowParentGUID: 'estContinentEurope', orderInList: 1, rowJSON: { nodeKind: 'country', title: 'Russia' } },
      { rowGUID: 'b1', rowOwnerGUID: 'x', rowParentGUID: 'estCountryRU', orderInList: 1, rowJSON: { nodeKind: 'book', title: 'FSNB-2022' } },
      { rowGUID: 'lost', rowOwnerGUID: 'x', rowParentGUID: 'nowhere', orderInList: 1, rowJSON: { nodeKind: 'book', title: 'Lost' } },
    ];
    const tree = buildNormTree(rows);
    expect(tree?.children[0].children[0].children[0].row.rowGUID).toBe('b1');
    expect(booksOf(tree).map((b) => b.rowGUID)).toEqual(['b1']);
    expect(nodePath(rows, 'b1')).toEqual(['World Norms (v2)', 'Europe', 'Russia', 'FSNB-2022']);
    expect(buildNormTree([])).toBeNull();
  });
  it('rowGUIDs are stable and recognisable', () => {
    expect(stableHash('a')).toBe(stableHash('a'));
    expect(stableHash('a')).not.toBe(stableHash('b'));
    expect(isNormGUID(normRowGUID('book', 'norm', '01-01'))).toBe(true);
    expect(isNormGUID('estWorldNorms2')).toBe(false);
    expect(bookGUIDOf('ru', 'FSNB-2022', 'sup 20')).toBe('estBookRU-FSNB2022-sup20');
  });
});

describe('importNormBooks', () => {
  it('opens a zip, skips what is not a norm file, makes the country + book nodes and writes norms, sections, resources in batches', async () => {
    const zip = zipSync({ 'a.xml': enc(NORMS), 'b.xml': enc(RES), 'c.xml': enc(OTHER), 'readme.txt': enc('x') });
    const store = new FakeStore();
    const progress: string[] = [];
    const r = await importNormBooks(store, { ...BASE, files: [{ name: 'x.zip', bytes: zip }], batchSize: 2, onProgress: (p) => progress.push(p.step) });
    expect(r).toMatchObject({ norms: 2, sections: 2, resources: 1, groups: 1, cancelled: false });
    expect(r.skippedFiles.sort()).toEqual(['c.xml', 'readme.txt']);
    expect(store.rows('estimation_norm_book_catalog').map((x) => x.rowJSON.nodeKind).sort()).toEqual(['book', 'country']);
    const book = store.tables.estimation_norm_book_catalog[r.bookGUID];
    expect(book.rowParentGUID).toBe('estCountryRU');
    expect(book.rowJSON).toMatchObject({ currency: 'EUR', sourceCurrency: 'RUB', fxRate: 0.01, normCount: 2, resourceCount: 1 });
    const mat = store.rows('estimation_resource_catalog').find((x) => x.rowJSON.nodeKind === 'resource')!;
    expect(mat.rowJSON).toMatchObject({ price: 9, sourcePrice: 900, priceOpt: 8, currency: 'EUR' });
    expect(Math.max(...store.calls.map((c) => c.n))).toBeLessThanOrEqual(2 * 3);
    expect(progress.some((p) => p.startsWith('Reading'))).toBe(true);
  });
  it('a second import of the same edition changes the rows instead of doubling them', async () => {
    const store = new FakeStore();
    const files = [{ name: 'a.xml', bytes: enc(NORMS) }];
    await importNormBooks(store, { ...BASE, files });
    const n = store.rows('estimation_norm_catalog').length;
    await importNormBooks(store, { ...BASE, files });
    expect(store.rows('estimation_norm_catalog').length).toBe(n);
  });
  it('with a translator the main title is English; the Russian original and the English text are rows of catalogTranslationTable', async () => {
    const store = new FakeStore();
    const translator = jest.fn(async (texts: string[]) => texts.map((t) => `EN(${t})`));
    const r = await importNormBooks(store, { ...BASE, files: [{ name: 'a.xml', bytes: enc(NORMS) }], translator, storeOriginals: true });
    const norm = store.rows('estimation_norm_catalog').find((x) => x.rowJSON.nodeKind === 'norm')!;
    expect(norm.rowJSON.title).toMatch(/^EN\(/);
    expect(norm.rowJSON).toMatchObject({ titleLanguage: 'en', originalLanguage: 'ru' });
    expect(norm.rowJSON.titleOriginal).toContain('Разработка грунта');
    const tr = store.rows('catalogTranslationTable').filter((t) => t.rowOwnerGUID === norm.rowGUID);
    expect(tr.map((t) => t.rowParentGUID).sort()).toEqual(['en', 'ru']);
    expect(tr.find((t) => t.rowParentGUID === 'ru')!.rowJSON).toEqual({ translationField: 'title', translationText: expect.stringContaining('Разработка грунта') });
    expect(r.translations).toBe(store.rows('catalogTranslationTable').length);
    expect(isNormGUID(tr[0].rowOwnerGUID)).toBe(true);
    expect(translationRow('estn-x', 'lv', 'T').rowGUID).toBe('estn-x~lv~title');
  });
  it('without a translator the original text stays the title (and is marked); no translation rows unless asked', async () => {
    const store = new FakeStore();
    await importNormBooks(store, { ...BASE, files: [{ name: 'a.xml', bytes: enc(NORMS) }] });
    const norm = store.rows('estimation_norm_catalog').find((x) => x.rowJSON.nodeKind === 'norm')!;
    expect(norm.rowJSON.titleLanguage).toBe('ru');
    expect(store.rows('catalogTranslationTable')).toHaveLength(0);
  });
  it('refuses unknown countries, a rate of zero and files without norms; cancel stops between rows', async () => {
    const store = new FakeStore();
    await expect(importNormBooks(store, { ...BASE, countryCode: 'ZZ', files: [] })).rejects.toThrow(/Unknown country/);
    await expect(importNormBooks(store, { ...BASE, fxRate: 0, files: [] })).rejects.toThrow(/rate/);
    await expect(importNormBooks(store, { ...BASE, files: [{ name: 'c.xml', bytes: enc(OTHER) }] })).rejects.toThrow(/No norm file/);
    let n = 0;
    const r = await importNormBooks(new FakeStore(), { ...BASE, files: [{ name: 'a.xml', bytes: enc(NORMS) }], isCancelled: () => ++n > 2 });
    expect(r.cancelled).toBe(true);
  });
  it('expandNormFiles opens a zip and leaves a plain file alone', () => {
    const out = expandNormFiles([{ name: 'x.zip', bytes: zipSync({ 'a.xml': enc('<a/>') }) }, { name: 'p.xml', bytes: enc('<p/>') }]);
    expect(out.map((o) => o.name)).toEqual(['a.xml', 'p.xml']);
  });
});

describe('the translator', () => {
  it('builds a prompt that asks for the same number of strings and parses the answer strictly', () => {
    expect(translationPrompt(['а', 'б'], 'ru', 'en')).toContain('exactly 2 strings');
    const ok = { candidates: [{ content: { parts: [{ text: '```json\n["a","b"]\n```' }] } }] };
    expect(parseTranslation(ok, 2)).toEqual(['a', 'b']);
    expect(() => parseTranslation(ok, 3)).toThrow(/instead of 3/);
    expect(() => parseTranslation({ candidates: [{ content: { parts: [{ text: 'no' }] } }] }, 1)).toThrow(/not JSON/);
  });
  it('sends batches with the key in a header (not in the url), retries a bad answer and returns the strings in order', async () => {
    const calls: any[] = [];
    let first = true;
    const fetchFn = jest.fn(async (url: string, init: any) => {
      calls.push({ url, headers: init.headers });
      const texts: string[] = JSON.parse(init.body).contents[0].parts[0].text.split('\n').pop() ? JSON.parse(JSON.parse(init.body).contents[0].parts[0].text.split('\n').pop()!) : [];
      if (first) { first = false; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) } as any; }
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(texts.map((t) => t.toUpperCase())) }] } }] }) } as any;
    });
    const tr = geminiTranslator({ apiKey: 'SECRET', fetchFn: fetchFn as any, batch: 2, retries: 1 });
    expect(await tr(['a', 'b', 'c'], 'ru', 'en')).toEqual(['A', 'B', 'C']);
    expect(calls[0].headers['x-goog-api-key']).toBe('SECRET');
    expect(calls.every((c) => !c.url.includes('SECRET'))).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe('norm book zip (csv + json)', () => {
  const rows = (guid: string, kind: string, extra: any = {}) => ({ rowGUID: guid, rowOwnerGUID: 'book', rowParentGUID: 'empty', orderInList: 10, rowJSON: { nodeKind: kind, code: guid, title: `T ${guid}, "q"`, resources: [{ code: '1', qty: 2 }], ...extra } });
  const data = {
    estimation_norm_book_catalog: [{ rowGUID: 'book', rowOwnerGUID: 'estimationCatalog', rowParentGUID: 'estCountryRU', orderInList: 1, rowJSON: { nodeKind: 'book', code: 'FSNB-2022', title: 'FSNB-2022', countryCode: 'RU', currency: 'EUR', normCount: 1, resourceCount: 1 } }],
    estimation_norm_catalog: [rows('estn-a-norm-1', 'norm')],
    estimation_resource_catalog: [rows('estn-a-res-1', 'resource', { price: 9 })],
    catalogTranslationTable: [translationRow('estn-a-norm-1', 'ru', 'Разработка') as any],
  };
  it('writes the manifest, a json and a csv file per table; the csv is flat, quoted, with a byte order mark', () => {
    const bytes = buildNormBookZip(data as any, new Date('2026-11-24T10:00:00Z'));
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['csv/catalogTranslationTable.csv', 'csv/estimation_norm_book_catalog.csv', 'csv/estimation_norm_catalog.csv', 'csv/estimation_resource_catalog.csv', 'json/catalogTranslationTable.json', 'json/estimation_norm_book_catalog.json', 'json/estimation_norm_catalog.json', 'json/estimation_resource_catalog.json', 'manifest.json']);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    expect(manifest).toMatchObject({ format: 'universal1.normbooks', version: 1, exportedAt: '2026-11-24T10:00:00.000Z', counts: { estimation_norm_catalog: 1 } });
    expect(manifest.books[0]).toMatchObject({ code: 'FSNB-2022', country: 'RU', currency: 'EUR' });
    const csv = strFromU8(files['csv/estimation_norm_catalog.csv']);
    expect([...files['csv/estimation_norm_catalog.csv'].subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);   // the byte order mark (the text decoder drops it)
    expect(csv).toContain('"T estn-a-norm-1, ""q"""');
    expect(csv.split('\r\n')[0]).toContain('nodeKind');
  });
  it('the import reads the json and writes the tree first, the translations last', async () => {
    const store = new FakeStore();
    const out = await importNormBookZip(store, buildNormBookZip(data as any), { batchSize: 1 });
    expect(out.cancelled).toBe(false);
    expect(store.calls.map((c) => c.table)).toEqual(['estimation_norm_book_catalog', 'estimation_norm_catalog', 'estimation_resource_catalog', 'catalogTranslationTable']);
    expect(store.tables.estimation_norm_catalog['estn-a-norm-1'].rowJSON.resources).toEqual([{ code: '1', qty: 2 }]);
  });
  it('refuses a file that is not a zip, a zip with no manifest, another format, a newer version and a foreign translation', async () => {
    expect(() => readNormBookZip(enc('plain'))).toThrow(NormZipError);
    expect(() => readNormBookZip(zipSync({ 'a.txt': enc('x') }))).toThrow(/no manifest/);
    expect(() => readNormBookZip(zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'other', version: 1 })) }))).toThrow(/Unknown format/);
    expect(() => readNormBookZip(zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'universal1.normbooks', version: 9 })) }))).toThrow(/version 9/);
    const bad = buildNormBookZip({ catalogTranslationTable: [translationRow('product-1', 'ru', 'x') as any] });
    await expect(importNormBookZip(new FakeStore(), bad)).rejects.toThrow(/not an imported norm book row/);
  });
  it('knows the prefix of the translation rows of a book', () => {
    expect(normPrefixOfBook('book')).toBe(`estn-${stableHash('book')}-`);
  });
});
