/** @jest-environment jsdom */
// CatalogTreePicker + BusinessUnitPickerField: the tree of the units in a modal; selectFromTree = a unit of ANY level (the first too), else the leaves; a unit that
// cannot be chosen says why; the four project centers offer only the units that fit them.
import React, { act } from 'react';
import { cfrRows, unitRows } from './businessUnitTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, ...p }: any) => R.createElement(TextInput, p) };
});

jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: 'formRound' }) }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(View, { testID }) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const ButtonApp = ({ title, icon, onPress, testID }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, title ?? icon));
  return { __esModule: true, default: ButtonApp, ButtonApp };
});

import BusinessUnitPickerField from '../../../kit8/catalog/business_unit/BusinessUnitPickerField';
import { unitFitsProjectCenter } from '../../../kit8/catalog/business_unit/businessUnitModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const pick = (id: string) => act(() => { (q(`bu-picker-tree-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

const rows = unitRows();
function mount(props: Record<string, any> = {}) {
  const onChange = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<BusinessUnitPickerField testID="bu" rows={rows} value={null} onChange={onChange} label="Business unit" {...props} />));
  return onChange;
}

describe('the field', () => {
  it('shows the path of the value; empty = the placeholder; clear', () => {
    const onChange = mount({ value: 'bu_team1costs' });
    expect(q('bu')!.textContent).toContain('Enterprise #1 › Project Management › PM Team #1 › Team #1 costs');
    press('bu-clear');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('opens the tree; a unit of ANY level can be chosen (selectFromTree), the first level too', () => {
    const onChange = mount();
    expect(q('bu-picker')).toBeNull();
    press('bu');
    expect(q('bu-picker')).not.toBeNull();
    pick('bu_pm'); // a branch of the 2nd level
    expect(onChange).toHaveBeenLastCalledWith('bu_pm');
    press('bu');
    pick('bu_enterprise1'); // the first level
    expect(onChange).toHaveBeenLastCalledWith('bu_enterprise1');
  });

  it('without selectFromTree only a unit without sub-units can be chosen: a branch says why', () => {
    const onChange = mount({ selectFromTree: false });
    press('bu');
    pick('bu_sales');
    expect(onChange).not.toHaveBeenCalled();
    expect(q('bu-picker-message')!.textContent).toBe('Choose a unit without sub-units');
    pick('bu_keyaccounts');
    expect(onChange).toHaveBeenCalledWith('bu_keyaccounts');
  });

  it('isSelectable / reasonWhy: a Cost center field of a project refuses a revenue center and says why', () => {
    const onChange = mount({ isSelectable: (g: string) => unitFitsProjectCenter(rows, cfrRows(), 'projectCostCenter', g), reasonWhy: () => 'The cost center must be: takes costs' });
    press('bu');
    pick('bu_pmteam1'); // its tree row is visible (3rd level); a profit center takes costs
    expect(onChange).toHaveBeenLastCalledWith('bu_pmteam1');
    press('bu');
    pick('bu_pmteam2');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('an inactive unit is not offered; an error turns the field red', () => {
    const off = rows.map((r) => (r.rowGUID === 'bu_board' ? { ...r, rowJSON: { ...r.rowJSON, isActive: false } } : r));
    const onChange = mount({ rows: off, error: 'Obligatory' });
    expect(q('bu-error')!.textContent).toBe('Obligatory');
    press('bu');
    pick('bu_board');
    expect(onChange).not.toHaveBeenCalled();
    expect(q('bu-picker-message')!.textContent).toBe('This unit is not active');
  });
});
