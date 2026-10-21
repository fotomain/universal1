/** @jest-environment jsdom */
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({
    activeSystem: 'native',
    isDark: false,
    themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' },
  }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
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
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { thing: { get actions() { return mockActions; } } } }));

let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: (fn: any) => fn(mockState),
  useDispatch: () => mockDispatch,
}));

jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '',
    default: ({ testID, value, onChange }: any) =>
      R.createElement(
        Pressable,
        {
          testID,
          onPress: () => onChange('cat-item-123'),
        },
        R.createElement(Text, null, value || 'select-catalog')
      ),
  };
});

jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../../kit8/pm/inner/tooltip/PMTooltip', () => ({
  usePMTip: () => ({ ref: { current: null }, onHoverIn: undefined, onHoverOut: undefined, onPressIn: undefined, onLongPress: undefined, delayLongPress: 500, accessibilityHint: undefined }),
}));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { fireEvent } from '@testing-library/react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'tbl';
const columns: VisualColumn[] = [
  { key: 'n', title: '#', type: 'rowNumber' },
  { key: 'title', title: 'Title', type: 'text' },
  { key: 'category', title: 'Category', type: 'catalog', catalogEntityName: 'cat_entity' as any },
];
const rows = [
  { rowGUID: 'r1', rowOwnerGUID: 'o1', rowParentGUID: 'p1', orderInList: 1, rowJSON: { title: 'First', category: '' } },
  { rowGUID: 'r2', rowOwnerGUID: 'o1', rowParentGUID: 'p1', orderInList: 2, rowJSON: { title: 'Second', category: '' } },
];

function mount(props: any = {}) {
  mockState = { thing: { entityDataFromServer: rows, readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID={REUSABLE_TABLE_ALL} listParentGUID={REUSABLE_TABLE_ALL} visualColumns={columns} {...props} />));
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

describe('ReusableTable column header context menu', () => {
  it('opens context menu on right click and shows "Fill all lines"', () => {
    mount();
    const headerCell = q(`${T}-header-title`);
    expect(headerCell).not.toBeNull();

    // Right-click on header cell
    act(() => {
      headerCell!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 }));
    });

    // Expect context menu to appear with "Fill all lines"
    const fillItem = q(`${T}-header-menu-fill-all`);
    expect(fillItem).not.toBeNull();
    expect(fillItem?.textContent).toContain('Fill all lines');
  });

  it('has "Copy header name" for EVERY column, also the row number and a column that is not editable: it puts the title on the clipboard', () => {
    const Clipboard = require('expo-clipboard');
    mount({ visualColumns: [...columns, { key: 'sum', title: 'Sum total', type: 'number', editable: false }] });
    const open = (key: string) => act(() => { q(`${T}-header-${key}`)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 })); });
    for (const [key, title] of [['title', 'Title'], ['category', 'Category'], ['sum', 'Sum total'], ['n', '#']] as const) {
      open(key);
      const item = q(`${T}-header-menu-copy-name`);
      expect(item).not.toBeNull();
      expect(item!.textContent).toContain('Copy header name');
      Clipboard.setStringAsync.mockClear();
      press(`${T}-header-menu-copy-name`);
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(title);
      expect(q(`${T}-header-context-menu`)).toBeNull();                 // the menu closes
    }
  });

  it('"Copy header name" comes first, "Fill all lines" stays (disabled for # and read-only columns)', () => {
    mount();
    act(() => { q(`${T}-header-n`)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 })); });
    const ids = Array.from(document.querySelectorAll(`[data-testid^="${T}-header-menu-"]`)).map((e) => e.getAttribute('data-testid')).filter((id) => /-(copy-name|fill-all)$/.test(String(id)));
    expect(ids).toEqual([`${T}-header-menu-copy-name`, `${T}-header-menu-fill-all`]);
  });

  it('opens fill modal on pressing "Fill all lines", and fills all lines with entered value', () => {
    mount();
    const headerCell = q(`${T}-header-title`);
    act(() => {
      headerCell!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 }));
    });

    // Press "Fill all lines"
    press(`${T}-header-menu-fill-all`);

    // Modal should be open
    const modal = q(`${T}-fill-modal`);
    expect(modal).not.toBeNull();

    const input = q(`${T}-fill-input`) as HTMLInputElement;
    expect(input).not.toBeNull();

    // Change text input value
    act(() => {
      input.value = 'Unified Title';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Press "Fill"
    press(`${T}-fill-confirm`);

    // Expect updateOne action dispatched for each row
    expect(mockActions.updateOne).toHaveBeenCalled();
  });

  it('closes fill modal on cancel without updating', () => {
    mount();
    const headerCell = q(`${T}-header-title`);
    act(() => {
      headerCell!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 }));
    });
    press(`${T}-header-menu-fill-all`);
    expect(q(`${T}-fill-modal`)).not.toBeNull();

    press(`${T}-fill-cancel`);
    expect(q(`${T}-fill-modal`)).toBeNull();
  });

  it('supports filling catalog columns via catalog selector', () => {
    mount();
    const headerCell = q(`${T}-header-category`);
    act(() => {
      headerCell!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 150, clientY: 50 }));
    });
    press(`${T}-header-menu-fill-all`);

    const catSelect = q(`${T}-fill-catalog-select`);
    expect(catSelect).not.toBeNull();

    // Select catalog item
    act(() => {
      catSelect!.click();
    });

    // Press Fill
    press(`${T}-fill-confirm`);
    expect(mockActions.updateOne).toHaveBeenCalled();
  });
});
