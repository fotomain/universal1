/** @jest-environment jsdom */
// NormBookPanel: the norm books are a ReusableTable with a folders tree (world > continent > country > book > sections); the table has every field of a norm as a column.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, toggleSwitch, typeInto, wait } from '../ui/pmUiTestKit';

let mockTableProps: any = null;
const mockSearchCalls: (string | null)[] = [];
const mockSearchModes: string[] = [];
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTableProps = p; return null; } }));

const world = { rowGUID: 'estWorldNorms2', rowOwnerGUID: 'o', rowParentGUID: 'empty', orderInList: 0, rowJSON: { nodeKind: 'world', title: 'World Norms (v2)' } };
const europe = { rowGUID: 'estContinentEurope', rowOwnerGUID: 'o', rowParentGUID: 'estWorldNorms2', orderInList: 1, rowJSON: { nodeKind: 'continent', title: 'Europe' } };
const ru = { rowGUID: 'estCountryRU', rowOwnerGUID: 'o', rowParentGUID: 'estContinentEurope', orderInList: 1, rowJSON: { nodeKind: 'country', title: 'Russia' } };
const bk = { rowGUID: 'book1', rowOwnerGUID: 'o', rowParentGUID: 'estCountryRU', orderInList: 1, rowJSON: { nodeKind: 'book', title: 'FSNB-2022' } };
const sec = { rowGUID: 'sec1', rowOwnerGUID: 'book1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { nodeKind: 'section', code: '01', title: 'Earthworks' } };
const norm = { rowGUID: 'n1', rowOwnerGUID: 'book1', rowParentGUID: 'sec1', orderInList: 1, rowJSON: { nodeKind: 'norm', code: '01-01-001', title: 'Dig', unit: 'm3', resources: [{ code: 'A', qty: 2 }, { code: 'B', qty: 1 }], nrCode: 'NR1' } };
jest.mock('../../../kit8/pm/estimation/ui/normBookApi', () => ({
  NORM_SEARCH_MIN_CHARS: 3,
  DEFAULT_NORM_SEARCH_MODE: 'start',
  NormSearchTimeoutError: class NormSearchTimeoutError extends Error { constructor() { super('The search took too long. Type more letters to narrow it.'); } },
  __mockSearchFail: { on: false },
  readNormBookTree: async () => [world, europe, ru, bk],
  readNormChildren: async (_c: any, _b: string, parent: string) => parent === 'sec1' ? [norm] : parent === 'empty' ? [sec] : [],
  readNormLocation: async (_c: any, ref: any) => (ref.normGUID === 'n1' || ref.code === '01-01-001' ? { norm, sections: [sec] } : null),
  readNormTitles: async () => new Map(),
  readPricedResources: async () => new Map([['A', { code: 'A', price: 10, resourceKind: 'material' }], ['B', { code: 'B', price: 100, resourceKind: 'material' }]]),
  searchNorms: async (_c: any, book: string | null, _t: string, _l: number, mode: string) => { if (require('../../../kit8/pm/estimation/ui/normBookApi').__mockSearchFail.on) { const E = require('../../../kit8/pm/estimation/ui/normBookApi').NormSearchTimeoutError; throw new E(); } mockSearchCalls.push(book); mockSearchModes.push(mode); return [norm]; },
}));

import React from 'react';
import NormBookPanel from '../../../kit8/pm/estimation/ui/NormBookPanel';

afterEach(() => { cleanupUI(); mockTableProps = null; });

test('the tree of books and the sections of the picked book are the folders', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  expect(mockTableProps.uxuiTable.showFoldersTree).toBe(true);
  const ids = mockTableProps.foldersTree.nodes.map((n: any) => n.id);
  expect(ids).toEqual(expect.arrayContaining(['estWorldNorms2', 'estContinentEurope', 'estCountryRU', 'book1']));
  expect(ids).not.toContain('sec1');
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('book1'); await wait(30); await wait(30); });
  await wait(80);
  const nodes = mockTableProps.foldersTree.nodes;
  expect(nodes.find((n: any) => n.id === 'sec1')).toMatchObject({ parentId: 'book1' });
});

test('a section shows its norms with every field as a column', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={jest.fn()} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('book1'); await wait(30); await wait(30); });
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('sec1'); await wait(30); await wait(30); });
  await wait(80);
  expect(mockTableProps.readOnly).toBe(true);
  expect(mockTableProps.localRows.map((r: any) => r.rowGUID)).toEqual(['n1']);
  expect(mockTableProps.localRows[0].rowJSON).toMatchObject({ resourcesCount: 2, resourcesText: 'A × 2; B × 1', titleShown: 'Dig' });
  expect(mockTableProps.localRows[0].rowJSON).toMatchObject({ unitMaterials: 120, unitDirect: 120, missingPrices: 0 });
  const keys = mockTableProps.visualColumns.map((c: any) => c.key);
  expect(keys).toEqual(expect.arrayContaining(['rowAction', 'kindShown', 'code', 'titleShown', 'titleOriginal', 'unit', 'baseType', 'sectionType', 'content', 'resourcesCount', 'resourcesText', 'unitLabour', 'unitMachines', 'unitMaterials', 'unitDirect', 'missingPrices', 'nrCode', 'spCode', 'language']));
  expect(mockTableProps.foldersTree.folderOfRow(mockTableProps.localRows[0])).toBe('sec1');
});

test('a folder above the books shows no rows', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('estCountryRU'); await wait(30); });
  expect(mockTableProps.localRows).toEqual([]);
});

test('pick mode (the window that selects the norm of a position): no import / export, the row button reads Select', async () => {
  const onAddNorm = jest.fn();
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={onAddNorm} pickMode onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  expect(q('estimation-norm-books-import')).toBeNull();
  expect(q('estimation-norm-books-export')).toBeNull();
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('book1'); await wait(30); await wait(30); });
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('sec1'); await wait(30); await wait(30); });
  await wait(80);
  const cell = mockTableProps.visualColumns.find((c: any) => c.key === 'rowAction').renderCell(mockTableProps.localRows[0]);
  expect(cell.props.title).toBe('Select');
  await act(async () => { cell.props.onPress(); await wait(30); });
  expect(onAddNorm).toHaveBeenCalledTimes(1);
  expect(onAddNorm.mock.calls[0][0].rowGUID).toBe('n1');
});

test('the table has no search box of its own: the search of the book is the field above it (the database)', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30);
  expect(mockTableProps.searchEnabled).toBe(false);
});

test('a search with no book picked runs in ALL books (the rows carry their book); a picked book searches only itself until the switch is on', async () => {
  mockSearchCalls.length = 0;
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  expect(q('estimation-norm-books-search-all')).toBeNull();
  typeInto('estimation-norm-books-search', 'dig'); await act(async () => { await wait(450); });
  await wait(60);
  expect(mockSearchCalls[0]).toBe(null);
  expect(mockTableProps.localRows.map((r: any) => r.rowGUID)).toEqual(['n1']);
  expect(mockTableProps.localRows[0].rowJSON.bookTitle).toBe('FSNB-2022');
  expect(mockTableProps.visualColumns.map((c: any) => c.key)).toContain('bookTitle');
  // picking a book keeps the text but the search then runs in that book (the query is cleared when another book is picked)
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('book1'); await wait(30); await wait(30); });
  typeInto('estimation-norm-books-search', 'dig'); await act(async () => { await wait(450); });
  expect(mockSearchCalls[mockSearchCalls.length - 1]).toBe('book1');
  toggleSwitch('estimation-norm-books-search-all'); await act(async () => { await wait(450); });
  expect(mockSearchCalls[mockSearchCalls.length - 1]).toBe(null);
});

test('From - to keeps only the norms whose chosen cost of a unit (Labour here) is inside the range (sections stay)', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('book1'); await wait(30); await wait(30); });
  await act(async () => { mockTableProps.foldersTree.onSelectedFolderChange('sec1'); await wait(30); await wait(30); });
  await wait(80);
  act(() => press('estimation-norm-books-filter-field-trigger'));
  act(() => press('estimation-norm-books-filter-field-item-unitLabour'));
  await wait(30);
  expect(mockTableProps.localRows.map((r: any) => r.rowGUID)).toEqual(['n1']);   // labour of the test norm = 0
  typeInto('estimation-norm-books-labour-from', '1'); await wait(30);
  expect(mockTableProps.localRows).toEqual([]);
  typeInto('estimation-norm-books-labour-from', '0'); typeInto('estimation-norm-books-labour-to', '5'); await wait(30);
  expect(mockTableProps.localRows.map((r: any) => r.rowGUID)).toEqual(['n1']);
});

test('the search mode selector (Start | Contains | Finished) follows the search field; Start is the default and the mode goes to the search', async () => {
  mockSearchModes.length = 0;
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  expect(q('estimation-norm-books-search-mode')).not.toBeNull();
  typeInto('estimation-norm-books-search', 'dig'); await act(async () => { await wait(450); });
  expect(mockSearchModes[mockSearchModes.length - 1]).toBe('start');
});

test('the window that SELECTS a norm: the button column is narrow, the columns lead Direct cost, Unit, Title, Code, Kind and the rows cannot be dragged', async () => {
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={() => {}} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  const keys = mockTableProps.visualColumns.map((c: any) => c.key);
  expect(keys.slice(0, 6)).toEqual(['rowAction', 'unitDirect', 'unit', 'titleShown', 'code', 'kindShown']);
  expect(mockTableProps.visualColumns[0].width).toBeLessThan(150);
  expect(mockTableProps.foldersTree.rowsDraggable).toBe(false);
});

test('the norm books screen has the same column order as the picker, and keeps the drag onto a folder', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  expect(mockTableProps.visualColumns.map((c: any) => c.key).slice(0, 6)).toEqual(['rowAction', 'unitDirect', 'unit', 'titleShown', 'code', 'kindShown']);
  expect(mockTableProps.foldersTree.rowsDraggable).toBe(true);
});

test('a statement timeout of the search shows the short instruction in red, never the words of the database', async () => {
  const api = require('../../../kit8/pm/estimation/ui/normBookApi');
  api.__mockSearchFail.on = true;
  try {
    renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
    await wait(30); await wait(30);
    typeInto('estimation-norm-books-search', 'Разр'); await act(async () => { await wait(450); });
    const msg = q('estimation-norm-books-error');
    expect(msg).not.toBeNull();
    expect(msg!.textContent).toContain('Type more letters');
    expect(msg!.textContent).not.toMatch(/statement timeout/i);
  } finally { api.__mockSearchFail.on = false; }
});

test('in the picker Select is a LINK (text only, narrow), on the norm books screen it stays a button', async () => {
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={() => {}} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  const col = mockTableProps.visualColumns[0];
  // as wide as the word + 2 px each side + the delimiter (a few tens of px), the word centred
  expect(col.width).toBeLessThanOrEqual(80);
  expect(col).toMatchObject({ cellPaddingX: 8, align: 'center' });
  // Direct cost: 40 % narrower than the 150 px of the norm books screen
  expect(mockTableProps.visualColumns.find((c: any) => c.key === 'unitDirect').width).toBe(90);
  const cell = renderUI(col.renderCell({ rowGUID: 'n1', rowJSON: { nodeKind: 'norm' } }));
  expect(q('estimation-norm-books-add-n1')).not.toBeNull();
  expect(q('estimation-norm-books-add-n1')!.getAttribute('role')).toBe('link');
  expect(q('estimation-norm-books-add-n1')!.textContent).toBe('Select');
  void cell;
});

test('the table ends where its space ends (inside the window, above the Close button): the room under it is measured and handed to the table as the bottom offset', async () => {
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={() => {}} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  // the default keeps the usual 16 px until the space is measured; the value is a number of px, never negative
  const off = mockTableProps.foldersTree.uxuiFolders.fullHeightBottomOffset;
  expect(typeof off).toBe('number');
  expect(off).toBeGreaterThanOrEqual(0);
});

test('in the picker a double click on a norm row selects it (the same as the Select link); on the norm books screen there is no double click action', async () => {
  const onAddNorm = jest.fn();
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={onAddNorm} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  typeInto('estimation-norm-books-search', 'dig'); await act(async () => { await wait(450); });
  expect(typeof mockTableProps.onRowDoubleClick).toBe('function');
  await act(async () => { mockTableProps.onRowDoubleClick({ rowGUID: 'n1', rowJSON: { nodeKind: 'norm' } }); await wait(30); });
  expect(onAddNorm).toHaveBeenCalledTimes(1);
  expect(onAddNorm.mock.calls[0][0].rowGUID).toBe('n1');
  cleanupUI();
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30);
  expect(mockTableProps.onRowDoubleClick).toBeUndefined();
});

test('the search field keeps a history of the substrings (on the device); a Select remembers the search that found the norm', async () => {
  const mod = require('@react-native-async-storage/async-storage');
  if (!mod.default) mod.default = mod; // the app reads `.default`; the jest mock of the package has none
  const storage = mod.default;
  const set = jest.spyOn(storage, 'setItem');
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={() => {}} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  typeInto('estimation-norm-books-search', 'Разр'); await act(async () => { await wait(450); });
  const select = mockTableProps.visualColumns[0].renderCell({ rowGUID: 'n1', rowJSON: { nodeKind: 'norm' } });
  await act(async () => { select.props.onPress(); await wait(30); });
  const call = set.mock.calls.find((c: any[]) => String(c[0]).includes('estimationNormSearch'));
  expect(call).toBeTruthy();
  expect(JSON.parse(call![1] as string)).toEqual(['Разр']);
  expect(q('estimation-norm-books-search-history-menu')).toBeNull();
});

test('the link text is small (12 px, normal weight) and the Select column is measured with that size', () => {
  const { LINK_FONT_SIZE } = require('../../../kit8/pm/estimation/ui/IconLinkAction');
  expect(LINK_FONT_SIZE).toBe(12);
  renderUI(require('react').createElement(require('../../../kit8/pm/estimation/ui/IconLinkAction').default, { title: 'Select', testID: 'lnk', onPress: () => {} }));
  const text = Array.from(q('lnk')!.querySelectorAll('*')).find((e) => e.children.length === 0 && e.textContent === 'Select') as HTMLElement;
  // (the inline style: jsdom ranks the atomic class of react-native-web above it)
  expect(text.style.fontSize).toBe('12px');
  expect(text.style.fontWeight).toBe('400');
});

test('the From / To borders filter the field chosen BEFORE them: Direct cost per unit by default, any other money field from the list', async () => {
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  typeInto('estimation-norm-books-search', 'dig'); await act(async () => { await wait(500); });
  const row = () => mockTableProps.localRows.find((r: any) => r.rowGUID === 'n1');
  expect(row()).toBeTruthy();
  const direct = row().rowJSON.unitDirect;
  expect(typeof direct).toBe('number');
  expect(q('estimation-norm-books-filter-field-input')).not.toBeNull();
  // default field = Direct cost: a lower border above its value hides the norm, below it keeps it
  typeInto('estimation-norm-books-labour-from', String(direct + 1)); await act(async () => { await wait(30); });
  expect(row()).toBeUndefined();
  typeInto('estimation-norm-books-labour-from', String(direct - 1)); await act(async () => { await wait(30); });
  expect(row()).toBeTruthy();
  // another field: Labour per unit is lower than the direct cost, so the same border hides the norm
  const labour = row().rowJSON.unitLabour;
  expect(labour).toBeLessThan(direct);
  typeInto('estimation-norm-books-labour-from', String(labour + 0.5)); await act(async () => { await wait(30); });
  expect(row()).toBeTruthy();
  act(() => press('estimation-norm-books-filter-field-trigger'));
  act(() => press('estimation-norm-books-filter-field-item-unitLabour'));
  await act(async () => { await wait(30); });
  expect(row()).toBeUndefined();
});

test('the history of the From / To borders is kept per chosen filter field (and the search field has its own)', async () => {
  const mod = require('@react-native-async-storage/async-storage');
  if (!mod.default) mod.default = mod;
  const get = jest.spyOn(mod.default, 'getItem');
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(60);
  const keys = () => get.mock.calls.map((c: any[]) => String(c[0]));
  expect(keys()).toEqual(expect.arrayContaining([
    'reusableTable.searchHistory.estimationNormSearch',
    'reusableTable.searchHistory.estimationNormFilter.unitDirect.from',
    'reusableTable.searchHistory.estimationNormFilter.unitDirect.to',
  ]));
  act(() => press('estimation-norm-books-filter-field-trigger'));
  act(() => press('estimation-norm-books-filter-field-item-unitMaterials'));
  await wait(60);
  expect(keys()).toEqual(expect.arrayContaining([
    'reusableTable.searchHistory.estimationNormFilter.unitMaterials.from',
    'reusableTable.searchHistory.estimationNormFilter.unitMaterials.to',
  ]));
});

test('the history of PAIRS (field + from + to): kept when the user leaves From / To; the pair is readable and a bad entry is refused', async () => {
  const { encodeNormPair, decodeNormPair, normPairLabel } = require('../../../kit8/pm/estimation/ui/NormBookPanel');
  const text = encodeNormPair({ field: 'unitLabour', from: ' 100 ', to: '500' });
  expect(decodeNormPair(text)).toEqual({ field: 'unitLabour', from: '100', to: '500' });
  expect(normPairLabel(decodeNormPair(text), (s: string) => s)).toBe('Labour / unit: 100 … 500');
  expect(normPairLabel({ field: 'unitDirect', from: '', to: '9' }, (s: string) => s)).toBe('Direct cost / unit:  … 9');
  expect(decodeNormPair('not json')).toBeNull();
  expect(decodeNormPair(JSON.stringify({ f: 'nope', a: '1', b: '2' }))).toBeNull();

  const mod = require('@react-native-async-storage/async-storage');
  if (!mod.default) mod.default = mod;
  const set = jest.spyOn(mod.default, 'setItem');
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30);
  typeInto('estimation-norm-books-labour-from', '100'); typeInto('estimation-norm-books-labour-to', '500');
  await act(async () => { await wait(30); q('estimation-norm-books-labour-to')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); await wait(30); });
  const call = set.mock.calls.filter((c: any[]) => String(c[0]).endsWith('estimationNormFilterPairs')).pop();
  expect(call).toBeTruthy();
  expect(decodeNormPair(JSON.parse(call![1] as string)[0])).toEqual({ field: 'unitDirect', from: '100', to: '500' });
});

test('the left block of the bar is as wide as the World Norms panel (the tree is a fixed width), so the search starts where the table starts', async () => {
  const { NORM_TREE_WIDTH, NORM_TREE_STACK_BELOW } = require('../../../kit8/pm/estimation/ui/NormBookPanel');
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={null} onImport={() => {}} onExport={() => {}} />);
  await wait(30);
  expect(mockTableProps.uxuiTable).toMatchObject({ foldersTreeWidth: NORM_TREE_WIDTH, foldersTreeResizable: false });
  expect(NORM_TREE_STACK_BELOW).toBe(720); // = the default of ReusableTable: below it the tree is above the table and no block is kept
  // the norm books screen: the Import / Export buttons live in that block
  const left = q('estimation-norm-books-bar-left')!;
  expect(left).not.toBeNull();
  expect(left.contains(q('estimation-norm-books-import')!)).toBe(true);
  expect(left.contains(q('estimation-norm-books-export')!)).toBe(true);
});

test('the picker has no buttons: its left block is empty (it only keeps the room of the tree when the panel is wide)', async () => {
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={() => {}} onImport={() => {}} onExport={() => {}} />);
  await wait(30);
  expect(q('estimation-norm-books-import')).toBeNull();
  expect(q('estimation-norm-books-export')).toBeNull();
});

test('the norm books screen: the action column is a narrow LINK column - "+ Add" for a norm (not a button), "Open" for a section; the same width logic as the picker', async () => {
  const onAddNorm = jest.fn();
  renderUI(<NormBookPanel client={{}} canManage onAddNorm={onAddNorm} onImport={() => {}} onExport={() => {}} />);
  await wait(30); await wait(30);
  const col = mockTableProps.visualColumns[0];
  expect(col).toMatchObject({ key: 'rowAction', cellPaddingX: 8, align: 'center' });
  expect(col.width).toBeLessThanOrEqual(90);
  renderUI(col.renderCell({ rowGUID: 'n1', rowJSON: { nodeKind: 'norm' } }));
  const add = q('estimation-norm-books-add-n1')!;
  expect(add.getAttribute('role')).toBe('link');
  expect(add.textContent).toContain('Add');
  expect(add.getAttribute('aria-label')).toBe('Add to the estimate');
  cleanupUI();
  renderUI(col.renderCell({ rowGUID: 's1', rowJSON: { nodeKind: 'section' } }));
  const open = q('estimation-norm-books-open-s1')!;
  expect(open.getAttribute('role')).toBe('link');
  expect(open.textContent).toBe('Open');
});

test('the picker starts at the norm the position already has: its book, its section, its row marked', async () => {
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={jest.fn()} onImport={() => {}} onExport={() => {}} startAt={{ normGUID: 'n1', code: '01-01-001' }} />);
  await wait(30); await wait(30); await wait(80);
  expect(mockTableProps.foldersTree.selectedFolderId).toBe('sec1');
  expect(mockTableProps.foldersTree.nodes.find((n: any) => n.id === 'sec1')).toMatchObject({ parentId: 'book1' });
  expect(mockTableProps.localRows.map((r: any) => r.rowGUID)).toEqual(['n1']);
  expect(mockTableProps.focusRowGUID).toBe('n1');
});

test('a norm known only by its code is found by the code; an unknown norm = the usual start', async () => {
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={jest.fn()} onImport={() => {}} onExport={() => {}} startAt={{ normGUID: null, code: '01-01-001' }} />);
  await wait(30); await wait(30); await wait(80);
  expect(mockTableProps.foldersTree.selectedFolderId).toBe('sec1');
  cleanupUI(); mockTableProps = null;
  renderUI(<NormBookPanel client={{}} canManage={false} pickMode onAddNorm={jest.fn()} onImport={() => {}} onExport={() => {}} startAt={{ normGUID: 'gone', code: null }} />);
  await wait(30); await wait(30); await wait(80);
  expect(mockTableProps.focusRowGUID).toBeNull();
  expect(mockTableProps.foldersTree.selectedFolderId).not.toBe('sec1');
});
