/** @jest-environment jsdom */
// ReusableTable with TableExample2 (task_expense_input_table): rows of one scope, add, edit cells
// (person -> contract dependency, integer hours), row menu, delete with confirmation.
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
const mockPush = jest.fn();
let mockRouteParams: any = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/demo/reusabletable', useGlobalSearchParams: () => mockRouteParams }));
// the default header background comes from the react-native-paper theme (MD3 light surfaceVariant)
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockActions = {
  readData: jest.fn((p: any) => ({ type: 'read', p })),
  createOne: jest.fn((p: any) => ({ type: 'create', p })),
  updateOne: jest.fn((p: any) => ({ type: 'update', p })),
  deleteOne: jest.fn((p: any) => ({ type: 'delete', p })),
};
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { task_expense_input_table: { get actions() { return mockActions; } } } }));
let mockState: any = {};
const mockDispatch = jest.fn();
// @hello-pangea/dnd uses react-redux itself (connect / Provider): only the app hooks are replaced
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));
// the catalog select: shows the stored GUID + owner scope, "pick" stores `<entity>-picked`
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '',
    default: ({ testID, value, onChange, disabled, rowOwnerGUID, entityName }: any) =>
      R.createElement(Pressable, { testID, disabled, onPress: () => onChange(`${entityName}-picked`) }, R.createElement(Text, null, `${value ?? '-'}|${rowOwnerGUID ?? ''}|${disabled ? 'off' : 'on'}`)),
  };
});
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.flatMap((i: any) => [i, ...(i.submenu || [])]).map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress, disabled: i.disabled }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ visible, onConfirm }: any) => (visible ? R.createElement(Pressable, { testID: 'confirm-delete', onPress: onConfirm }, R.createElement(Text, null, 'Delete')) : null) };
});

let mockCheckForm = 'formRound';
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: mockCheckForm }) }));

jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled, badge }: any) => R.createElement(Pressable, { testID, onPress, disabled, 'aria-disabled': !!disabled }, R.createElement(Text, null, `${icon}${badge ?? ''}`)) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput, Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, hideClearIcon, ...p }: any) => R.createElement(View, { accessibilityLabel: heightVariant },
    (leftIcons || []).map((ic: any) => R.createElement(Pressable, { key: ic.icon, testID: ic.testID, onPress: ic.onPress, disabled: ic.disabled }, R.createElement(Text, null, ic.icon))),
    R.createElement(TextInput, p),
    // TextInputApp's own clear icon: at the right, only for a filled input
    p.value && !hideClearIcon ? R.createElement(Pressable, { testID: `${p.testID}-clear`, onPress: () => p.onChangeText('') }, R.createElement(Text, null, 'close')) : null) };
});
const mockDownloadText = jest.fn((..._a: any[]) => Promise.resolve('downloaded'));
const mockDownloadBinary = jest.fn((..._a: any[]) => Promise.resolve('downloaded'));
jest.mock('../../../kit8/pm/crud/exchange/project/export/downloadTextFile', () => ({ downloadTextFile: (...a: any[]) => mockDownloadText(...a) }));
jest.mock('../../../kit8/pm/crud/exchange/pdf/downloadBinaryFile', () => ({ downloadBinaryFile: (...a: any[]) => mockDownloadBinary(...a) }));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
import TaskExpenseInputTable from '../../../kit8/ui/components/table/reusable/example/TaskExpenseInputTable';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'task-expense-table';
const row = (g: string, order: number, json: any, parent = 'task1') => ({ rowGUID: g, rowOwnerGUID: 'proj1', rowParentGUID: parent, orderInList: order, rowJSON: json });

function mount(rows: any[]) {
  mockState = { uxuiState: { askBeforeDeletePost: true }, task_expense_input_table: { entityDataFromServer: rows, readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<TaskExpenseInputTable projectGUID="proj1" taskGUID="task1" />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

const seed = () => [
  row('r2', 200, { personGUID: 'p1', contractGUID: 'c1', hours: 8 }),
  row('r1', 100, { personGUID: null, contractGUID: null, hours: null }),
  row('other', 50, { personGUID: 'p9', contractGUID: null, hours: 1 }, 'task2'),
];

it('bar variant leftCrudPanel_rightSearchTitle shows the title on the right', () => {
  const ReusableTable = require('../../../kit8/ui/components/table/reusable/ReusableTable').default;
  const { taskExpenseInputColumns } = require('../../../kit8/ui/components/table/reusable/example/taskExpenseInputModel');
  mockState = { uxuiState: {}, task_expense_input_table: { entityDataFromServer: seed(), readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID="t" crudListTitle="Expenses" entityName="task_expense_input_table" listOwnerGUID="proj1" listParentGUID="task1" visualColumns={taskExpenseInputColumns} uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearchTitle' }} />));
  expect(q('t-bar-right')!.contains(q('t-title'))).toBe(true);
  expect(q('t-title')!.textContent).toBe('Expenses');
  expect(q('t-bar-left')!.contains(q('t-crud-panel'))).toBe(true);
});

it('reads the scope of the task and shows only its rows, ordered, numbered, with the hours total', () => {
  mount(seed());
  expect(mockActions.readData).toHaveBeenCalledWith(expect.objectContaining({ match: { rowOwnerGUID: 'proj1', rowParentGUID: 'task1' } }));
  expect(q(`${T}-row-other`)).toBeNull();
  expect(q(`${T}-cell-r1-tableRowNumber`)!.textContent).toBe('1');
  expect(q(`${T}-cell-r2-tableRowNumber`)!.textContent).toBe('2');
  expect(q(`${T}-total-hours`)!.textContent).toBe('8');
  expect(q(`${T}-count`)!.textContent).toContain('2 expenses');
});

it('contract waits for the person and is scoped by the selected person', () => {
  mount(seed());
  expect(q(`${T}-cell-r1-contract`)!.textContent).toBe('-||off');
  expect(q(`${T}-cell-r2-contract`)!.textContent).toBe('c1|p1|on');
});

it('picking a person stores its GUID and clears the contract; picking a contract stores its GUID', () => {
  mount(seed());
  press(`${T}-cell-r2-person`);
  expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'r2', rowOwnerGUID: 'proj1', rowJSON: { personGUID: 'personReusable-picked', contractGUID: null } });
  expect(q(`${T}-cell-r2-contract`)!.textContent).toBe('-|personReusable-picked|on');
  press(`${T}-cell-r2-contract`);
  expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'r2', rowOwnerGUID: 'proj1', rowJSON: { contractGUID: 'contractReusable-picked' } });
});

it('hours: integer saved on blur', () => {
  mount(seed());
  const input = q(`${T}-cell-r1-hours`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, '12x'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(input.value).toBe('12');
  act(() => { input.focus(); input.blur(); });
  expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'r1', rowOwnerGUID: 'proj1', rowJSON: { hours: 12 } });
  expect(q(`${T}-total-hours`)!.textContent).toBe('20');
});

it('+ Add appends an empty row of this scope', () => {
  mount(seed());
  press(`${T}-add`);
  const p = mockActions.createOne.mock.calls[0][0];
  expect(p).toMatchObject({ rowOwnerGUID: 'proj1', rowParentGUID: 'task1', rowJSON: { personGUID: null, contractGUID: null, hours: null } });
  expect(p.orderInList).toBeGreaterThan(200);
  expect(q(`${T}-row-${p.rowGUID}`)).not.toBeNull();
});

it('row menu: add below, move up, delete (asks first)', () => {
  mount(seed());
  press(`${T}-menu-button-r1`);
  press(`${T}-menu-add-below`);
  const created = mockActions.createOne.mock.calls[0][0];
  expect(created.orderInList).toBe(150);

  press(`${T}-menu-button-r2`);
  press(`${T}-menu-make-first`);
  const moved = mockActions.updateOne.mock.calls[0][0];
  expect(moved).toMatchObject({ rowGUID: 'r2', field: 'orderInList' });
  expect(moved.value).toBeLessThan(100);

  press(`${T}-menu-button-r1`);
  press(`${T}-menu-delete`);
  expect(mockActions.deleteOne).not.toHaveBeenCalled();
  press('confirm-delete');
  expect(mockActions.deleteOne).toHaveBeenCalledWith({ rowGUID: 'r1', rowOwnerGUID: 'proj1' });
  expect(q(`${T}-row-r1`)).toBeNull();
});

it('selection: select all + delete selected', () => {
  mount(seed());
  press(`${T}-select-all`);
  press(`${T}-delete-selected`);
  press('confirm-delete');
  expect(mockActions.deleteOne).toHaveBeenCalledTimes(2);
  expect(q(`${T}-empty`)).not.toBeNull();
});

it('selectRowCheckBoxForm: round by default, square from the project UX/UI setting; headers can be resized', () => {
  mount(seed());
  const box = () => q(`${T}-select-r1`)!.firstElementChild as HTMLElement;
  expect(getComputedStyle(box()).borderTopLeftRadius).toBe('9px');
  expect(q(`${T}-resize-person`)).not.toBeNull();
  act(() => root.unmount());
  document.body.innerHTML = '';
  mockCheckForm = 'formSquare';
  mount(seed());
  expect(getComputedStyle(box()).borderTopLeftRadius).toBe('4px');
  mockCheckForm = 'formRound';
});

it('crud panel: icons; duplicate / move need ONE selected row', () => {
  mount(seed());
  expect(q(`${T}-crud-panel`)).not.toBeNull();
  expect(q(`${T}-duplicate-selected`)!.getAttribute('aria-disabled')).toBe('true');
  press(`${T}-select-r1`);
  expect(q(`${T}-delete-selected`)!.textContent).toBe('delete1');
  press(`${T}-move-down-selected`);
  expect(mockActions.updateOne.mock.calls[0][0]).toMatchObject({ rowGUID: 'r2', field: 'orderInList' }); // r2 jumped above r1
  press(`${T}-duplicate-selected`);
  expect(mockActions.createOne.mock.calls[0][0].rowJSON).toEqual({ personGUID: null, contractGUID: null, hours: null });
});

it('column menu: sort by hours, filter hours >= 5, clear', () => {
  mount(seed());
  expect(q(`${T}-column-menu-button-tableRowNumber`)).toBeNull();
  press(`${T}-column-menu-button-hours`);
  press(`${T}-column-menu-sort-desc`);
  expect(q(`${T}-cell-r2-tableRowNumber`)!.textContent).toBe('1'); // 8 hours first, the empty row last
  press(`${T}-column-menu-button-hours`);
  press(`${T}-column-menu-op-notEmpty`);
  press(`${T}-column-menu-apply`);
  expect(q(`${T}-row-r1`)).toBeNull();
  expect(q(`${T}-count`)!.textContent).toContain('1 of 2');
  press(`${T}-clear-filters`);
  expect(q(`${T}-row-r1`)).not.toBeNull();
  expect(q(`${T}-cell-r1-tableRowNumber`)!.textContent).toBe('1');
});

it('header check box: − when some rows are selected, ✓ when all, empty when none', () => {
  mount(seed());
  const head = () => q(`${T}-select-all`)!;
  expect(head().getAttribute('aria-checked')).not.toBe('mixed');
  expect(head().textContent).toBe('');
  press(`${T}-select-r1`);
  expect(head().getAttribute('aria-checked')).toBe('mixed');
  expect(q(`${T}-select-all-partial`)).not.toBeNull();
  press(`${T}-select-r2`);
  expect(head().getAttribute('aria-checked')).toBe('true');
  expect(head().textContent).toBe('✓');
  expect(q(`${T}-select-all-partial`)).toBeNull();
});

it('number cells have − / + buttons: one step, never below min, empty counts as 0', () => {
  mount(seed());
  press(`${T}-cell-r2-hours-increase`);
  expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'r2', rowOwnerGUID: 'proj1', rowJSON: { hours: 9 } });
  press(`${T}-cell-r1-hours-increase`);
  expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'r1', rowOwnerGUID: 'proj1', rowJSON: { hours: 1 } });
  press(`${T}-cell-r1-hours-decrease`);
  expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'r1', rowOwnerGUID: 'proj1', rowJSON: { hours: 0 } });
  mockActions.updateOne.mockClear();
  press(`${T}-cell-r1-hours-decrease`); // already at min 0
  expect(mockActions.updateOne).not.toHaveBeenCalled();
});

it('uxuiTable: delimiter lines + square cells + 100% width by default; fixedWidth px adds a horizontal scroll', () => {
  const ReusableTable = require('../../../kit8/ui/components/table/reusable/ReusableTable').default;
  const { taskExpenseInputColumns } = require('../../../kit8/ui/components/table/reusable/example/taskExpenseInputModel');
  const render = (uxuiTable?: any) => {
    mockState = { uxuiState: {}, task_expense_input_table: { entityDataFromServer: seed(), readSuccessful: 1 } };
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => root.render(<ReusableTable testID="t" entityName="task_expense_input_table" listOwnerGUID="proj1" listParentGUID="task1" visualColumns={taskExpenseInputColumns} uxuiTable={uxuiTable} />));
  };
  render();
  const cellBox = () => q('t-cell-r1-hours')!.parentElement!.parentElement!;
  expect(getComputedStyle(cellBox()).borderRightWidth).toBe('1px');
  expect(getComputedStyle(q('t-cell-r1-hours')!.parentElement!).borderTopLeftRadius).toBe('0px');
  expect(getComputedStyle(q('t-cell-r1-hours')!.parentElement!).borderTopWidth).toBe('0px'); // borderedCells: false
  expect(getComputedStyle(q('t-header-hours')!).borderRightWidth).toBe('1px'); // verticalDelimitersForColumnNames
  expect(q('t-bar-left')!.contains(q('t-crud-panel'))).toBe(true); // default bar: Left CRUD panel · Right Search (no title)
  expect(q('t-title')).toBeNull();
  expect(q('t-bar-right')!.contains(q('t-search'))).toBe(true);
  expect(getComputedStyle(q('t')!).width).toBe('100%');
  expect(q('t-search')!.parentElement!.getAttribute('aria-label')).toBe('smallestHeight');
  expect(Array.from(q('t-search')!.parentElement!.children).map((e) => e.textContent)).toEqual(['search', 'expand_more', '']); // left: search, history; then the input (clear appears at the right when filled)
  expect(getComputedStyle(q('t-headers')!).backgroundColor).toBe('rgb(231, 224, 236)'); // react-native-paper surfaceVariant (#e7e0ec)
  expect(getComputedStyle(q('t-row-r1')!).minHeight).toBe('32px'); // minimumTableRowHeight
  expect(getComputedStyle(q('t-footer')!).minHeight).toBe('32px'); // useTableFooterHeightAsLineHeight
  expect(getComputedStyle(q('t-cell-r1-hours')!.parentElement!).height).toBe('30px');
  expect(getComputedStyle(q('t-total-hours')!.parentElement!).justifyContent).toBe('center'); // justifyTotalsOfFieldsMode
  expect(q('t-fixed-width-scroll')).toBeNull();
  act(() => root.unmount());
  document.body.innerHTML = '';
  render({ verticalDelimitersForCells: false, verticalDelimitersForColumnNames: false, roundedCells: true, borderedCells: true, colorForColumnHeadersBackground: 'transparent', minimumTableRowHeight: false, useTableFooterHeightAsLineHeight: false, justifyTotalsOfFieldsMode: 'justifyTextRight', fixedWidth: 1200, tableBarLayoutVariant: 'leftTitle_rightSearchCrudPanel' });
  expect(q('t-bar-left')!.contains(q('t-title'))).toBe(true);
  expect(q('t-bar-right')!.contains(q('t-crud-panel'))).toBe(true);
  expect(getComputedStyle(q('t-cell-r1-hours')!.parentElement!).borderTopWidth).toBe('1px');
  expect(getComputedStyle(cellBox()).borderRightWidth).not.toBe('1px');
  expect(getComputedStyle(q('t-cell-r1-hours')!.parentElement!).borderTopLeftRadius).toBe('8px');
  expect(getComputedStyle(q('t-header-hours')!).borderRightWidth).not.toBe('1px');
  expect(getComputedStyle(q('t')!).width).toBe('1200px');
  expect(getComputedStyle(q('t-headers')!).backgroundColor).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
  expect(getComputedStyle(q('t-row-r1')!).minHeight).toBe('52px');
  expect(getComputedStyle(q('t-footer')!).minHeight).toBe('38px');
  expect(getComputedStyle(q('t-cell-r1-hours')!.parentElement!).height).toBe('40px');
  expect(getComputedStyle(q('t-total-hours')!.parentElement!).justifyContent).toBe('flex-end');
  expect(q('t-fixed-width-scroll')).not.toBeNull();
});

const typeIn = (id: string, text: string) => {
  const input = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); });
  act(() => { input.focus(); input.blur(); });
};

it('search history: typed substrings are remembered and can be applied again', () => {
  mount(seed());
  typeIn(`${T}-search`, '8');
  expect(q(`${T}-row-r1`)).toBeNull();
  typeIn(`${T}-search`, '');
  expect(q(`${T}-row-r1`)).not.toBeNull();
  press(`${T}-search-history`);
  expect(q(`${T}-search-history-0`)!.textContent).toBe('8');
  press(`${T}-search-history-0`);
  expect(q(`${T}-row-r1`)).toBeNull();
  press(`${T}-search-history`);
  press(`${T}-search-history-clear`);
  press(`${T}-search-history`);
  expect(q(`${T}-search-history-empty`)).not.toBeNull();
  expect(q(`${T}-search-history-0`)).toBeNull();
});

it('⋮ menu: export downloads the shown rows (JSON with GUIDs, CSV, both PDFs); Default settings resets the view', async () => {
  mount(seed());
  typeIn(`${T}-search`, '8');
  press(`${T}-more`);
  await act(async () => { q(`${T}-more-export-json`)!.click(); });
  const [jsonName, jsonText] = mockDownloadText.mock.calls[0];
  expect(jsonName).toMatch(/^task_expenses_.*\.json$/);
  const json = JSON.parse(jsonText);
  expect(json.rows).toHaveLength(1); // only the row the search shows
  expect(json.rows[0]).toMatchObject({ rowGUID: 'r2', rowOwnerGUID: 'proj1', rowParentGUID: 'task1', rowJSON: { personGUID: 'p1', contractGUID: 'c1', hours: 8 } });
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: `${jsonName} downloaded` } });

  press(`${T}-more`);
  await act(async () => { q(`${T}-more-export-csv`)!.click(); });
  expect(mockDownloadText.mock.calls[1][1]).toContain('#,Person,Person GUID,Contract,Contract GUID,Hours,rowGUID,rowOwnerGUID,rowParentGUID');

  press(`${T}-more`);
  await act(async () => { q(`${T}-more-export-pdfFull`)!.click(); });
  press(`${T}-more`);
  await act(async () => { q(`${T}-more-export-pdfVisible`)!.click(); });
  const pdf = (i: number) => Array.from(mockDownloadBinary.mock.calls[i][1] as Uint8Array, (b) => String.fromCharCode(b)).join('');
  expect(mockDownloadBinary.mock.calls[0][0]).toMatch(/^task_expenses_full_.*\.pdf$/);
  expect(pdf(0)).toContain('(rowGUID)');
  expect(pdf(1)).not.toContain('(rowGUID)');
  expect(pdf(1)).toContain('(Hours)');

  press(`${T}-more`);
  press(`${T}-more-default-settings`);
  expect(q(`${T}-row-r1`)).not.toBeNull();
  expect(q(`${T}-more-share-json`)).toBeNull(); // menu closed
  press(`${T}-more`);
  expect(q(`${T}-more-share-pdfVisible`)).not.toBeNull();
});

it('service columns: select row is 1st, drag row is 2nd, then the data columns', () => {
  mount(seed());
  const rowEl = q(`${T}-row-r1`)!;
  const kids = Array.from(rowEl.children) as HTMLElement[];
  expect(kids[0].contains(q(`${T}-select-r1`))).toBe(true);
  expect(kids[1].contains(q(`${T}-drag-r1`))).toBe(true);
  expect(getComputedStyle(kids[0]).borderRightWidth).toBe('1px'); // verticalDelimitersForCells
  // the lines of the header and of the rows are on the same x: equal boxes
  expect(getComputedStyle(kids[0]).width).toBe(getComputedStyle(q(`${T}-service-header-select`)!).width);
  expect(getComputedStyle(kids[1]).width).toBe(getComputedStyle(q(`${T}-service-header-drag`)!).width);
  expect(getComputedStyle(q(`${T}-bar-leftCrudPanel_rightSearch`)!).paddingTop).toBe('2px'); // minimumTableToolBarHeight
  // ⋮ of the bar: last, flush right, in a box as wide as the ⋮ column of the rows
  const barRight = q(`${T}-bar-right`)!;
  expect(barRight.lastElementChild).toBe(q(`${T}-bar-more`));
  expect(getComputedStyle(q(`${T}-bar-more`)!).width).toBe(getComputedStyle(q(`${T}-menu-button-r1`)!).width);
  expect(getComputedStyle(q(`${T}-bar-leftCrudPanel_rightSearch`)!).paddingRight).toBe('0px');
  expect(getComputedStyle(q(`${T}-service-header-select`)!).borderRightWidth).toBe('1px'); // verticalDelimitersForColumnNames
  const head = q(`${T}-service-header-select`)!;
  expect(head.nextElementSibling!.getAttribute('data-testid')).toBe(`${T}-service-header-drag`);
  expect(head.contains(q(`${T}-select-all`))).toBe(true);
});

it('search icons: search reads the table again, ✕ clears the text', () => {
  mount(seed());
  mockActions.readData.mockClear();
  typeIn(`${T}-search`, '8');
  press(`${T}-search-refresh`);
  expect(mockActions.readData).toHaveBeenCalledWith(expect.objectContaining({ match: { rowOwnerGUID: 'proj1', rowParentGUID: 'task1' } }));
  expect(q(`${T}-row-r1`)).toBeNull();
  const box = Array.from(q(`${T}-search`)!.parentElement!.children).map((e) => e.textContent);
  expect(box).toEqual(['search', 'expand_more', '', 'close']); // ✕ = 1st at the right
  press(`${T}-search-clear`);
  expect(q(`${T}-row-r1`)).not.toBeNull();
});

it('arrows move all selected rows together', () => {
  mount([...seed(), row('r3', 300, { personGUID: null, contractGUID: null, hours: 3 })]);
  expect(q(`${T}-move-up-selected`)!.getAttribute('aria-disabled')).toBe('true'); // nothing selected
  press(`${T}-select-r2`);
  press(`${T}-select-r3`);
  expect(q(`${T}-move-down-selected`)!.getAttribute('aria-disabled')).toBe('true'); // already at the bottom
  press(`${T}-move-up-selected`);
  expect(q(`${T}-cell-r2-tableRowNumber`)!.textContent).toBe('1');
  expect(q(`${T}-cell-r3-tableRowNumber`)!.textContent).toBe('2');
  expect(q(`${T}-cell-r1-tableRowNumber`)!.textContent).toBe('3');
  // ONE update: the row above the block jumped below it
  expect(mockActions.updateOne).toHaveBeenCalledTimes(1);
  expect(mockActions.updateOne.mock.calls[0][0]).toMatchObject({ rowGUID: 'r1', field: 'orderInList' });
  expect(mockActions.updateOne.mock.calls[0][0].value).toBeGreaterThan(300);
});

it('catalog cells have a "…" button that opens the details of the selected element', () => {
  mount(seed());
  press(`${T}-cell-r2-person-details`);
  // the details page also gets the place to return to: this screen + the row the user left from
  const target = { pathname: '/catalog/person/edit', params: { rowGUID: 'p1', returnTo: '/demo/reusabletable?focusRowGUID=r2' } };
  expect(mockPush).toHaveBeenLastCalledWith(target);
  press(`${T}-cell-r2-contract-details`); // a contract opens its person
  expect(mockPush).toHaveBeenLastCalledWith(target);
  mockPush.mockClear();
  press(`${T}-cell-r1-person-details`); // nothing selected
  expect(mockPush).not.toHaveBeenCalled();
});

it('returning with focusRowGUID marks that row; other route parameters are kept in returnTo', () => {
  mockRouteParams = { tab: 'x', focusRowGUID: 'r2', returnTo: '/old' };
  mount(seed());
  expect(q(`${T}-row-r2`)!.getAttribute('aria-current')).toBe('true');
  expect(q(`${T}-row-r1`)!.getAttribute('aria-current')).toBeNull();
  // the marker does not take part in the layout: the cells of the focused row start at the same x as the others
  expect(getComputedStyle(q(`${T}-focus-marker`)!).position).toBe('absolute');
  expect(getComputedStyle(q(`${T}-row-r2`)!).borderLeftWidth).toBe('0px');
  press(`${T}-cell-r2-person-details`);
  expect(mockPush.mock.calls[0][0].params.returnTo).toBe('/demo/reusabletable?tab=x&focusRowGUID=r2');
  mockRouteParams = {};
});
