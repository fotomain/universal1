// The rows of the "Application texts" screen and the writes an edit needs (pure).
import { flattenBundle, newTextRowOf, textScreenRows, textWrites, type TextRow } from '../../../kit8/catalog/organization/texts/organizationTextsModel';

const bundle = flattenBundle({ menu: { home: 'Home', profile: 'Profile' }, screens: { map: 'Map' }, other: { x: 'not listed' }, n: 5 });
const own: TextRow[] = [
  { rowGUID: 'r1', rowParentGUID: 'lv', rowJSON: { textKind: 'menu', textKey: 'menu.home', text: 'Sākums' } },
  { rowGUID: 'r2', rowParentGUID: 'lv', rowJSON: { textKind: 'column', textKey: 'project_task_table.taskDescription', text: 'Work package' } },
  { rowGUID: 'r3', rowParentGUID: 'lv', rowJSON: { textKind: 'wrong' as any, textKey: 'x', text: 'y' } },
];

describe('flattenBundle / textScreenRows', () => {
  it('flattens the nested bundle to dotted keys of strings', () => {
    expect(bundle).toEqual({ 'menu.home': 'Home', 'menu.profile': 'Profile', 'screens.map': 'Map', 'other.x': 'not listed' });
  });
  it('the rows: pmT titles, the menu / screen texts of i18next, the organization rows (also a column that has no delivered list)', () => {
    const rows = textScreenRows(['Saved', 'Delete'], bundle, own);
    expect(rows.map((r) => `${r.kind}:${r.key}`)).toEqual(['column:project_task_table.taskDescription', 'menu:menu.home', 'menu:menu.profile', 'menu:screens.map', 'title:Delete', 'title:Saved']);
    const home = rows.find((r) => r.key === 'menu.home')!;
    expect(home).toMatchObject({ delivered: 'Home', text: 'Sākums', rowGUID: 'r1' });
    expect(rows.find((r) => r.key === 'Saved')).toMatchObject({ delivered: 'Saved', text: '', rowGUID: null });
    expect(rows.find((r) => r.kind === 'column')).toMatchObject({ delivered: 'taskDescription', text: 'Work package', rowGUID: 'r2' });
  });
});

describe('textWrites', () => {
  const rows = textScreenRows(['Saved'], bundle, own);
  const id = (kind: string, key: string) => `${kind}|${key}`;
  it('a filled cell without a row is an insert, with a row an update', () => {
    expect(textWrites(rows, [{ id: id('title', 'Saved'), text: ' Stored ' }])).toEqual([{ kind: 'insert', textKind: 'title', key: 'Saved', text: 'Stored' }]);
    expect(textWrites(rows, [{ id: id('menu', 'menu.home'), text: 'Sākums 2' }])).toEqual([{ kind: 'update', guid: 'r1', text: 'Sākums 2' }]);
  });
  it('a cleared cell, or the delivered text, removes the row; nothing to remove writes nothing', () => {
    expect(textWrites(rows, [{ id: id('menu', 'menu.home'), text: '' }])).toEqual([{ kind: 'delete', guid: 'r1' }]);
    expect(textWrites(rows, [{ id: id('menu', 'menu.home'), text: 'Home' }])).toEqual([{ kind: 'delete', guid: 'r1' }]);
    expect(textWrites(rows, [{ id: id('title', 'Saved'), text: '' }])).toEqual([]);
  });
  it('an unchanged or unknown row writes nothing', () => {
    expect(textWrites(rows, [{ id: id('menu', 'menu.home'), text: 'Sākums' }, { id: 'title|nope', text: 'x' }])).toEqual([]);
  });
});

describe('newTextRowOf (the Add bar)', () => {
  it('a column header needs table.column', () => {
    expect(newTextRowOf('column', ' project_task_table.taskDescription ', ' Work package ')).toEqual({ ok: true, row: { kind: 'insert', textKind: 'column', key: 'project_task_table.taskDescription', text: 'Work package' } });
    expect(newTextRowOf('column', 'taskDescription', 'x')).toEqual({ ok: false, error: 'columnKey' });
  });
  it('kind, key and text are obligatory', () => {
    expect(newTextRowOf('button', 'k', 't')).toEqual({ ok: false, error: 'kind' });
    expect(newTextRowOf('title', '  ', 't')).toEqual({ ok: false, error: 'key' });
    expect(newTextRowOf('title', 'k', ' ')).toEqual({ ok: false, error: 'text' });
    expect(newTextRowOf('menu', 'menu.home', 'Sākums').ok).toBe(true);
  });
});
