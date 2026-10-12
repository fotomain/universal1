/** @jest-environment jsdom */
// The Budget item column of a task line: still a catalog column (title / search / fill column), but its input is SelectCatalogItemWithFolders: a window with a
// RadioSetApp Tree | List; it offers the items of THIS genus only (and their folder); the List shows title + description as before.
import React, { act } from 'react';
import { budgetSeedRows } from '../../../../catalog/budget/budgetItemTestKit';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('../../../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(View, { testID }) };
});
jest.mock('../../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import { buildTaskLineColumns } from '../../../../../kit8/pm/view/task/finances/taskLineColumns';
import { emptyTaskLineCatalogs } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
// a wide window (jsdom has none): the window opens as the Tree; on a small width it opens as the List
Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 1024 });
Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 800 });
beforeAll(() => { act(() => { window.dispatchEvent(new Event('resize')); }); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

function mount(genusName: string, value: string | null) {
  const data = { ...emptyTaskLineCatalogs(), budgetItem: budgetSeedRows() };
  const col: any = buildTaskLineColumns({ data, genus: taskLineGenusDef(genusName)!, textColor: '#000', errorColor: '#f00', showErrors: false }).find((c) => c.key === 'budgetItem');
  const onChange = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<>{col.renderPicker({ testID: 'bi', value, onChange, disabled: false, compact: true, triggerStyle: {}, placeholder: 'Select budget item…', row: { rowGUID: 'L1', rowJSON: {} } })}</>));
  return { col, onChange };
}

it('stays a catalog column of the budget items (title, search, fill column) with an own picker', () => {
  const { col } = mount('timeGenus', null);
  expect(col).toMatchObject({ type: 'catalog', field: 'budgetItemTaskLine', catalogEntityName: 'budgetItemReusable' });
  expect(typeof col.renderPicker).toBe('function');
});

it('the window offers the items of the genus of the tab only, with their folder; Tree | List; the choice is the rowGUID', () => {
  const { onChange } = mount('timeGenus', null);
  expect(q('bi')!.textContent).toContain('Select budget item…');
  press('bi-trigger');
  expect(q('bi-view-tree')).not.toBeNull();
  expect(q('bi-view-list')).not.toBeNull();
  expect(q('bi-tree-row-timeBudgetItem')).not.toBeNull();
  expect(q('bi-tree-row-costsBudgetFolder')).not.toBeNull();
  expect(q('bi-tree-row-materialBudgetItem')).toBeNull(); // another genus
  expect(q('bi-tree-row-revenueBudgetItem')).toBeNull();
  press('bi-tree-row-timeBudgetItem');
  expect(onChange).toHaveBeenCalledWith('timeBudgetItem');
});

it('the List: the items with title + description (as the plain list was); the value shows its title in the cell', () => {
  mount('timeGenus', 'timeBudgetItem');
  expect(q('bi')!.textContent).toContain('Time');
  press('bi-trigger');
  press('bi-view-list');
  expect(q('bi-list-item-timeBudgetItem')!.textContent).toContain('Budget item:'); // the description line
  expect(q('bi-list-item-timeBudgetItem')!.textContent).toContain('ACTIVE');
  expect(q('bi-list-item-materialBudgetItem')).toBeNull();
});
