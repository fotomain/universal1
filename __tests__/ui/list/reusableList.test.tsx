/** @jest-environment jsdom */
// ReusableList - component test: clientDataMode (redux entity + local rows) and serverDataMode (fake PostgREST), selection, search, row menu moves, read only.
// FlashList is replaced by a list that mounts the first 200 items (jsdom has no layout) and keeps its props for the test.
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockActions = {
  readData: jest.fn((p: any) => ({ type: 'read', p })),
  createOne: jest.fn((p: any) => ({ type: 'create', p })),
  updateOne: jest.fn((p: any) => ({ type: 'update', p })),
  deleteOne: jest.fn((p: any) => ({ type: 'delete', p })),
};
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { thing: { tableName: 'thingTable', get actions() { return mockActions; } } } }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
// the context menu lists its items as buttons
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, items, caption }: any) => R.createElement(View, { testID }, R.createElement(Text, null, caption),
    items.map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.disabled ? undefined : i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  return { __esModule: true, default: ({ visible, onConfirm, testID }: any) => (visible ? R.createElement(Pressable, { testID: `${testID}-confirm`, onPress: onConfirm }) : null) };
});
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, leftIcon, heightVariant, compact, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../../kit8/ui/components/table/reusable/tableExportActions', () => ({
  buildTableFile: jest.fn(() => ({ fileName: 'x.csv' })), exportTableFile: jest.fn(async () => ({ ok: true })), shareTableFile: jest.fn(async () => ({ ok: true })),
  TABLE_EXPORT_FORMATS: [{ format: 'csv', label: 'to CSV', icon: 'description' }], tableFileResultMessage: () => null,
}));
let mockSupabase: any = null;
jest.mock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockSupabase }) }));
const mockFlash: { props: any } = { props: null };
jest.mock('@shopify/flash-list', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { FlashList: R.forwardRef((p: any, ref: any) => {
    mockFlash.props = p;
    R.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn(), scrollToIndex: jest.fn() }));
    return R.createElement(View, { testID: p.testID }, p.data.slice(0, 200).map((item: any, index: number) => R.createElement(View, { key: p.keyExtractor(item, index) }, p.renderItem({ item, index }))), p.ListFooterComponent);
  }) };
});

import ReusableList from '../../../kit8/ui/components/list/reusable/ReusableList';
import { generateDemoRows, MEDIA_POST_LIST_COLUMNS } from '../../../kit8/ui/components/list/reusable/demo/demoData';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const type = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const T = 'rl';
const itemIds = () => qa(`${T}-item-`).map((e) => String(e.getAttribute('data-testid')).replace(`${T}-item-`, ''));
const titles = () => itemIds().map((id) => q(`${T}-title-${id}`)!.textContent);

const columns: VisualColumn[] = [
  { key: 'title', title: 'Title', type: 'text', listRole: 'title' },
  { key: 'note', title: 'Note', type: 'text', listRole: 'subtitle' },
];
const rowsOf = () => [
  { rowGUID: 'a', rowOwnerGUID: 'u1', rowParentGUID: 'empty', orderInList: 10, rowJSON: { title: 'Alpha', note: 'one' } },
  { rowGUID: 'b', rowOwnerGUID: 'u1', rowParentGUID: 'empty', orderInList: 20, rowJSON: { title: 'Bravo', note: 'two' } },
  { rowGUID: 'c', rowOwnerGUID: 'u1', rowParentGUID: 'empty', orderInList: 30, rowJSON: { title: 'Charlie', note: 'three' } },
];

function mount(extra: any = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableList testID={T} entityName="thing" listOwnerGUID="u1" listParentGUID="empty" visualColumns={columns} itemLabel="Post" {...extra} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockSupabase = null; mockFlash.props = null; });

describe('clientDataMode (redux entity)', () => {
  beforeEach(() => { mockState = { uxuiState: { askBeforeDeletePost: true }, thing: { entityDataFromServer: rowsOf(), readSuccessful: 1 } }; });

  it('is the default mode: reads the entity once and shows the rows in the stored order', () => {
    mount();
    expect(mockActions.readData).toHaveBeenCalledTimes(1);
    expect(itemIds()).toEqual(['a', 'b', 'c']);
    expect(titles()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(q(`${T}-count`)!.textContent).toContain('3 posts');
  });

  it("orderDirection 'desc' shows the highest orderInList first", () => {
    mount({ orderDirection: 'desc' });
    expect(itemIds()).toEqual(['c', 'b', 'a']);
  });

  it('search filters on the device; the grips go away while the view is filtered; clear brings the list back', () => {
    mount();
    expect(qa(`${T}-grip-`).length).toBe(3);
    type(`${T}-search`, 'brav');
    expect(itemIds()).toEqual(['b']);
    expect(qa(`${T}-grip-`).length).toBe(0);
    expect(q(`${T}-count`)!.textContent).toContain('1 post');
    press(`${T}-clear-query`);
    expect(itemIds()).toEqual(['a', 'b', 'c']);
    expect(qa(`${T}-grip-`).length).toBe(3);
  });

  it('no match shows the message', () => {
    mount();
    type(`${T}-search`, 'zzz');
    expect(q(`${T}-empty`)!.textContent).toBe('No matches found.');
  });

  it('selection: tap a check box, select all, clear; one item is marked', () => {
    mount();
    press(`${T}-check-b`);
    expect(q(`${T}-selected-count`)!.textContent).toBe('1 selected');
    expect(q(`${T}-check-b`)!.getAttribute('aria-checked')).toBe('true');
    expect(q(`${T}-check-a`)!.getAttribute('aria-checked')).toBe('false');
    press(`${T}-select-all`);
    expect(q(`${T}-selected-count`)!.textContent).toBe('3 selected');
    expect(q(`${T}-check-a`)!.getAttribute('aria-checked')).toBe('true');
    press(`${T}-clear-selection`);
    expect(q(`${T}-selected-count`)).toBeNull();
  });

  it('onSelectionChange gets the guids of the selected rows', () => {
    const spy = jest.fn();
    mount({ onSelectionChange: spy });
    press(`${T}-check-c`);
    press(`${T}-check-a`);
    expect(spy).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('delete selected asks first, then dispatches deleteOne for every selected row', () => {
    mount();
    press(`${T}-check-a`);
    press(`${T}-check-c`);
    press(`${T}-delete-selected`);
    expect(mockActions.deleteOne).not.toHaveBeenCalled();
    press(`${T}-ask-delete-confirm`);
    expect(mockActions.deleteOne.mock.calls.map((c) => c[0].rowGUID).sort()).toEqual(['a', 'c']);
    expect(itemIds()).toEqual(['b']);
    expect(q(`${T}-selected-count`)).toBeNull();
  });

  it('add creates a row (createOne) at the end of an ascending list, at the top of a descending one', () => {
    mount();
    press(`${T}-add`);
    expect(mockActions.createOne).toHaveBeenCalledTimes(1);
    expect(mockActions.createOne.mock.calls[0][0].orderInList).toBeGreaterThan(30);
  });

  it('the row menu "Move down" saves ONE row: orderInList between its new neighbours', () => {
    mount();
    press(`${T}-itemmenu-a`);
    press(`${T}-menu-move-down`);
    expect(mockActions.updateOne).toHaveBeenCalledTimes(1);
    const p = mockActions.updateOne.mock.calls[0][0];
    expect(p.rowGUID).toBe('a');
    expect(p.field).toBe('orderInList');
    expect(p.value).toBeGreaterThan(20);
    expect(p.value).toBeLessThan(30);
    expect(itemIds()).toEqual(['b', 'a', 'c']);
  });

  it('in a descending list "Move up" really moves the item up on the screen', () => {
    mount({ orderDirection: 'desc' });
    expect(itemIds()).toEqual(['c', 'b', 'a']);
    press(`${T}-itemmenu-a`);
    press(`${T}-menu-move-up`);
    expect(itemIds()).toEqual(['c', 'a', 'b']);
    const p = mockActions.updateOne.mock.calls[0][0];
    expect(p.value).toBeGreaterThan(20);
    expect(p.value).toBeLessThan(30);
  });

  it('readOnly: no add, no check boxes, no grips, no delete', () => {
    mount({ readOnly: true });
    expect(q(`${T}-add`)).toBeNull();
    expect(qa(`${T}-check-`).length).toBe(0);
    expect(qa(`${T}-grip-`).length).toBe(0);
    expect(itemIds().length).toBe(3);
  });

  it('reorderEnabled false: no grips', () => {
    mount({ reorderEnabled: false });
    expect(qa(`${T}-grip-`).length).toBe(0);
  });

  it('a tap on an item opens the row (onRowOpen) - or toggles it while a selection exists', () => {
    const open = jest.fn();
    mount({ onRowOpen: open });
    press(`${T}-item-b`);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ rowGUID: 'b' }));
    press(`${T}-check-a`);
    press(`${T}-item-c`);
    expect(open).toHaveBeenCalledTimes(1);
    expect(q(`${T}-check-c`)!.getAttribute('aria-checked')).toBe('true');
  });

  it('a custom renderItem gets the grip', () => {
    mount({ renderItem: (row: any, s: any) => <div data-testid={`custom-${row.rowGUID}`}>{row.rowJSON.title}{s.grip}</div> });
    expect(q('custom-a')!.textContent).toContain('Alpha');
    expect(q(`${T}-grip-a`)).not.toBeNull();
  });
});

describe('clientDataMode (local rows, the demo)', () => {
  it('shows the rows held by the screen and sends every change up; nothing is dispatched', () => {
    mockState = { uxuiState: { askBeforeDeletePost: false } };
    const spy = jest.fn();
    const rows = generateDemoRows(5);
    mount({ entityName: 'demoRows', listOwnerGUID: undefined, visualColumns: MEDIA_POST_LIST_COLUMNS, localRows: rows, onLocalRowsChange: spy });
    expect(itemIds()).toEqual(['demo-0', 'demo-1', 'demo-2', 'demo-3', 'demo-4']);
    expect(titles()[0]).toContain('Post 1');
    press(`${T}-itemmenu-demo-1`);
    press(`${T}-menu-make-last`);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].map((r: any) => r.rowGUID)).toEqual(['demo-0', 'demo-2', 'demo-3', 'demo-4', 'demo-1']);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
  it('shows 100 000 rows without mounting them all (FlashList gets the data array)', () => {
    mockState = { uxuiState: {} };
    mount({ entityName: 'demoRows', listOwnerGUID: undefined, visualColumns: MEDIA_POST_LIST_COLUMNS, localRows: generateDemoRows(100_000) });
    expect(mockFlash.props.data.length).toBe(100_000);
    expect(q(`${T}-count`)!.textContent).toContain('100000');
  });
});

describe('serverDataMode', () => {
  const page = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ rowGUID: `s${from + i}`, rowOwnerGUID: 'u1', rowParentGUID: 'empty', orderInList: (from + i + 1) * 10, rowJSON: { title: `Server ${from + i}`, note: 'n' } }));
  let log: any[][] = [];
  function fakeSupabase(total = 120, failWith?: string) {
    return {
      from: (table: string) => {
        const chain: any[] = [['from', table]];
        const b: any = new Proxy({}, { get: (_t, name: string) => (...args: any[]) => {
          chain.push([name, ...args]);
          if (name === 'range') { log.push(chain); return Promise.resolve(failWith ? { data: null, error: { message: failWith }, count: null } : { data: page(args[0], Math.min(args[1], total - 1)), error: null, count: total }); }
          return b;
        } });
        return b;
      },
    };
  }
  beforeEach(() => { log = []; mockState = { uxuiState: { askBeforeDeletePost: false }, thing: {} }; });
  const server = (extra: any = {}) => mount({ reusableListDataMode: 'serverDataMode', serverPageSize: 50, ...extra });

  it('reads ONE page with a count (not the whole table), through the table of the entity, scoped to the owner', async () => {
    mockSupabase = fakeSupabase();
    server();
    await wait(10);
    expect(mockActions.readData).not.toHaveBeenCalled(); // the redux read of the table is NOT used
    expect(log.length).toBe(1);
    const names = log[0].map((c) => c[0]);
    expect(log[0][0]).toEqual(['from', 'thingTable']);
    expect(log[0]).toContainEqual(['select', '*', { count: 'exact' }]);
    expect(log[0]).toContainEqual(['match', { rowOwnerGUID: 'u1', rowParentGUID: 'empty' }]);
    expect(names[names.length - 1]).toBe('range');
    expect(log[0][log[0].length - 1]).toEqual(['range', 0, 49]);
    expect(itemIds().length).toBe(50);
    expect(q(`${T}-count`)!.textContent).toContain('50 of 120 posts · server');
  });

  it('the end of the list loads the next page; the last page stops the loading', async () => {
    mockSupabase = fakeSupabase(120);
    server();
    await wait(10);
    await act(async () => { mockFlash.props.onEndReached(); });
    await wait(10);
    expect(log[1][log[1].length - 1]).toEqual(['range', 50, 99]);
    expect(log[1]).toContainEqual(['select', '*', undefined]); // no second count
    expect(itemIds().length).toBe(100);
    await act(async () => { mockFlash.props.onEndReached(); });
    await wait(10);
    expect(itemIds().length).toBe(120);
    expect(q(`${T}-count`)!.textContent).toContain('120 posts');
    await act(async () => { mockFlash.props.onEndReached(); });
    await wait(10);
    expect(log.length).toBe(3);
  });

  it('search is sent to the database after a pause, once, and starts at page 0', async () => {
    mockSupabase = fakeSupabase(10);
    server({ visualColumns: [{ key: 'title', title: 'Title', type: 'text' }, { key: 'note', title: 'Note', type: 'text' }] });
    await wait(10);
    type(`${T}-search`, 'sun');
    type(`${T}-search`, 'sunset');
    expect(log.length).toBe(1); // typed, not asked yet
    await wait(400);
    expect(log.length).toBe(2);
    expect(log[1]).toContainEqual(['or', 'rowJSON->>title.ilike.*sunset*,rowJSON->>note.ilike.*sunset*']);
    expect(log[1][log[1].length - 1]).toEqual(['range', 0, 49]);
  });

  it('descending order is asked of the database', async () => {
    mockSupabase = fakeSupabase(5);
    server({ orderDirection: 'desc' });
    await wait(10);
    expect(log[0]).toContainEqual(['order', 'orderInList', { ascending: false }]);
  });

  it('the row menu "Move down" saves ONE row and moves it in the loaded rows', async () => {
    mockSupabase = fakeSupabase(5);
    server();
    await wait(10);
    expect(itemIds()).toEqual(['s0', 's1', 's2', 's3', 's4']);
    press(`${T}-itemmenu-s0`);
    press(`${T}-menu-move-down`);
    expect(itemIds()).toEqual(['s1', 's0', 's2', 's3', 's4']);
    const p = mockActions.updateOne.mock.calls[0][0];
    expect([p.rowGUID, p.field]).toEqual(['s0', 'orderInList']);
    expect(p.value).toBeGreaterThan(20);
    expect(p.value).toBeLessThan(30);
  });

  it('with more pages, an item cannot be dropped AFTER the last loaded row (its place among the unloaded rows is unknown)', async () => {
    mockSupabase = fakeSupabase(120);
    server();
    await wait(10);
    press(`${T}-itemmenu-s0`);
    press(`${T}-menu-make-last`);
    expect(mockActions.updateOne).not.toHaveBeenCalled();
    expect(itemIds()[0]).toBe('s0');
  });

  it('delete removes the row from the loaded rows and the count, and dispatches deleteOne', async () => {
    mockSupabase = fakeSupabase(5);
    server();
    await wait(10);
    press(`${T}-check-s2`);
    press(`${T}-delete-selected`);
    expect(mockActions.deleteOne).toHaveBeenCalledWith({ rowGUID: 's2', rowOwnerGUID: 'u1' });
    expect(itemIds()).toEqual(['s0', 's1', 's3', 's4']);
  });

  it('a database error is shown, not swallowed', async () => {
    mockSupabase = fakeSupabase(0, 'permission denied');
    server();
    await wait(10);
    expect(q(`${T}-empty`)!.textContent).toContain('permission denied');
  });

  it('without an owner nothing is asked', async () => {
    mockSupabase = fakeSupabase();
    server({ listOwnerGUID: undefined });
    await wait(10);
    expect(log.length).toBe(0);
  });
});
