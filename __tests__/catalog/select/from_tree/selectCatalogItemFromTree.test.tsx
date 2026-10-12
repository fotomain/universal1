/** @jest-environment jsdom */
// TREE.PLUGIN - SelectCatalogItemFromTreeReusable: a field + a window with the tree of a catalog (the business units): the path of the value, a SEARCH by a substring
// of a title (the matches keep their ancestors), the counts of the sub-items, items that cannot be chosen say why, clear.
import React, { act } from 'react';
import { unitRows } from '../../business_unit/businessUnitTestKit';

jest.mock('../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(View, { testID }) };
});
jest.mock('../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import SelectCatalogItemFromTreeReusable, { subItemCounts, treePathText } from '../../../../kit8/catalog/select/from_tree/SelectCatalogItemFromTreeReusable';
import { businessUnitNodes } from '../../../../kit8/catalog/business_unit/businessUnitModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const pick = (id: string) => act(() => { (q(`u-picker-tree-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
const search = async (text: string) => act(async () => {
  const input = q('u-picker-tree-search') as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
});
const visibleRows = () => Array.from(document.querySelectorAll('[data-testid^="u-picker-tree-row-"]')).map((e) => e.getAttribute('data-testid')!.replace('u-picker-tree-row-', '')).filter((id) => !id.includes('-'));
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

const nodes = businessUnitNodes(unitRows());
function mount(props: Record<string, any> = {}) {
  const onChange = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<SelectCatalogItemFromTreeReusable testID="u" nodes={nodes} value={null} onChange={onChange} label="Business unit" {...props} />));
  return onChange;
}

it('helpers: the path of an item, the number of its direct sub-items', () => {
  expect(treePathText(nodes, 'bu_keyaccounts')).toBe('Enterprise #1 › Sales › Key Accounts Department');
  expect(treePathText(nodes, null)).toBe('');
  expect(subItemCounts(nodes).get('bu_board')).toBe(4); // CEO CTO CFO CIO
});

it('shows the path of the value, the placeholder when empty; the clear button empties it', () => {
  const onChange = mount({ value: 'bu_keyaccounts' });
  expect(q('u')!.textContent).toContain('Enterprise #1 › Sales › Key Accounts Department');
  press('u-clear');
  expect(onChange).toHaveBeenCalledWith(null);
  act(() => root.unmount());
  mount({ placeholder: 'Not set' });
  expect(q('u')!.textContent).toContain('Not set');
  expect(q('u-clear')).toBeNull();
});

it('the trigger opens the tree window; choosing an item (any level) gives its id and closes the window', () => {
  const onChange = mount();
  expect(q('u-picker')).toBeNull();
  press('u-trigger');
  expect(q('u-picker')).not.toBeNull();
  pick('bu_board');
  expect(onChange).toHaveBeenCalledWith('bu_board');
  expect(q('u-picker')).toBeNull();
});

it('the window has a search box: a substring of a title shows the matches with their ancestors; empty search shows the tree again', async () => {
  mount();
  press('u-trigger');
  const all = visibleRows().length;
  await search('account');
  const found = visibleRows();
  expect(found).toEqual(expect.arrayContaining(['bu_enterprise1', 'bu_sales', 'bu_keyaccounts', 'bu_accounting', 'bu_chiefaccountant']));
  expect(found).not.toContain('bu_board');
  expect(found.length).toBeLessThan(all);
  await search('');
  expect(visibleRows()).toContain('bu_board');
});

it('a search match can be chosen', async () => {
  const onChange = mount();
  press('u-trigger');
  await search('internet');
  const id = visibleRows().find((r) => r.startsWith('bu_') && /internet/i.test(nodes.find((n) => n.id === r)?.title ?? ''))!;
  pick(id);
  expect(onChange).toHaveBeenCalledWith(id);
});

it('shows the counts of the sub-items; isSelectable / reasonWhy: an item that cannot be chosen says why', () => {
  const onChange = mount({ isSelectable: (id: string) => id !== 'bu_board', reasonWhy: () => 'A cost line cannot go to this unit' });
  press('u-trigger');
  expect(q('u-picker-tree-row-bu_board-count')!.textContent).toBe('4');
  pick('bu_board');
  expect(onChange).not.toHaveBeenCalled();
  expect(q('u-picker-message')!.textContent).toBe('A cost line cannot go to this unit');
  pick('bu_sales');
  expect(onChange).toHaveBeenCalledWith('bu_sales');
});

it('RadioSetApp at the right corner of the window: Tree (default) | List; the list shows every item as its path, with the same search and rules', async () => {
  const onChange = mount({ isSelectable: (id: string) => id !== 'bu_board', reasonWhy: () => 'Not here' });
  press('u-trigger');
  expect(q('u-picker-view')).not.toBeNull();
  expect(q('u-picker-view-tree')).not.toBeNull();
  expect(q('u-picker-tree')).not.toBeNull(); // Tree is the default
  expect(q('u-picker-list')).toBeNull();
  press('u-picker-view-list');
  expect(q('u-picker-tree')).toBeNull();
  expect(q('u-picker-list')).not.toBeNull();
  expect(q('u-picker-list-row-bu_keyaccounts')!.textContent).toContain('Enterprise #1 › Sales › Key Accounts Department');
  // the search of the list: a substring of the path
  await act(async () => {
    const input = q('u-picker-list-search') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'sales › key');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(q('u-picker-list-row-bu_keyaccounts')).not.toBeNull();
  expect(q('u-picker-list-row-bu_board')).toBeNull();
  press('u-picker-list-row-bu_keyaccounts');
  expect(onChange).toHaveBeenCalledWith('bu_keyaccounts');
  // a unit that cannot be chosen says why in the list too
  press('u-trigger');
  press('u-picker-view-list');
  press('u-picker-list-row-bu_board');
  expect(q('u-picker-message')!.textContent).toBe('Not here');
});

it('disabled: no window; an error shows under the field', () => {
  mount({ disabled: true, error: 'Obligatory' });
  press('u-trigger');
  expect(q('u-picker')).toBeNull();
  expect(q('u-error')!.textContent).toBe('Obligatory');
});
