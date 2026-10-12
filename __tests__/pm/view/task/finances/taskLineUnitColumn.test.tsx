/** @jest-environment jsdom */
// The Business unit column of a task line: the unit is chosen from the TREE of the units (a window with a search box); a unit that does not take the kind of the line
// (a cost line - a revenue center) is refused with the reason; the choice is the user's own (source 'line'); clear = the line follows the sources again.
import React, { act } from 'react';
import { cfrRows, unitRows } from '../../../../catalog/business_unit/businessUnitTestKit';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
// the columns module draws a tip icon (a button of the design system): a test double
jest.mock('../../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
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
const pick = (id: string) => act(() => { (q(`task-line-unit-L1-picker-tree-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

const TIME = taskLineGenusDef('timeGenus')!;
function mount(rowJSON: Record<string, any>) {
  const data = { ...emptyTaskLineCatalogs(), businessUnit: unitRows(), cfrType: cfrRows() };
  const col: any = buildTaskLineColumns({ data, genus: TIME, textColor: '#000', errorColor: '#f00', showErrors: false }).find((c) => c.key === 'businessUnit');
  const patch = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<>{col.renderCell({ rowGUID: 'L1', rowJSON }, 0, patch)}</>));
  return { col, patch };
}

it('the column is a custom cell with the tree selector, only while there are units', () => {
  const { col } = mount({});
  expect(col).toMatchObject({ type: 'custom' });
  expect(buildTaskLineColumns({ data: emptyTaskLineCatalogs(), genus: TIME, textColor: '#000', errorColor: '#f00', showErrors: false }).some((c) => c.key === 'businessUnit')).toBe(false);
  expect(col.searchText({ rowJSON: { businessUnitTaskLine: 'bu_keyaccounts' } })).toBe('Enterprise #1 › Sales › Key Accounts Department');
});

it('shows the path of the unit; the tree window chooses a unit of the right kind and marks it as chosen on the line', () => {
  const { patch } = mount({ businessUnitTaskLine: 'bu_keyaccounts' });
  expect(q('task-line-unit-L1')!.textContent).toContain('Enterprise #1 › Sales › Key Accounts Department');
  press('task-line-unit-L1-trigger');
  pick('bu_board'); // a cost center: takes a cost line
  expect(patch).toHaveBeenCalledWith({ businessUnitTaskLine: 'bu_board', businessUnitSourceTaskLine: 'line' });
});

it('a cost line cannot go to a revenue center: refused with the reason; clear = the line follows the sources again', () => {
  const { patch } = mount({ businessUnitTaskLine: 'bu_board' });
  press('task-line-unit-L1-trigger');
  const revenue = unitRows().find((r) => r.rowJSON?.cfrAssigned === 'revenueCenter')!;
  pick(revenue.rowGUID);
  expect(patch).not.toHaveBeenCalled();
  expect(q('task-line-unit-L1-picker-message')!.textContent).toContain('cannot be posted');
  act(() => (q('task-line-unit-L1-picker-cancel') as HTMLElement).click());
  press('task-line-unit-L1-clear');
  expect(patch).toHaveBeenCalledWith({ businessUnitTaskLine: null, businessUnitSourceTaskLine: null });
});
