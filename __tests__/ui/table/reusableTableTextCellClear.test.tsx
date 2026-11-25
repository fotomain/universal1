/** @jest-environment jsdom */
// The text cell of ReusableTable shows a close icon at the right while it is edited; pressing it deletes the text and saves the empty value.
import React, { act } from 'react';
import { cleanupUI, q, renderUI, wait } from '../../pm/ui/pmUiTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }) }));
jest.mock('../../../kit8/ui/components/common/IconApp', () => { const R = require('react'); const { Text } = require('react-native'); return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) }; });
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/calculator/CalculatorTrigger', () => ({ __esModule: true, default: () => null }));

import { TextCell } from '../../../kit8/ui/components/table/reusable/ReusableTableCell';
afterEach(() => cleanupUI());

test('the close icon also shows while the mouse is over the cell', async () => {
  renderUI(<TextCell radius={4} border={1} h={36} value="Part 1" editable align="left" onCommit={jest.fn()} testID="th" />);
  expect(q('th-clear')).toBeNull();
  await act(async () => { q('th')!.parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
  expect(q('th-clear')).not.toBeNull();
  await act(async () => { q('th')!.parentElement!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
  expect(q('th-clear')).toBeNull();
});

test('the close icon deletes the text of the cell', async () => {
  const onCommit = jest.fn();
  renderUI(<TextCell radius={4} border={1} h={36} value="New section" editable align="left" onCommit={onCommit} testID="tc" />);
  expect(q('tc-clear')).toBeNull();
  await act(async () => { q('tc')!.focus(); });
  expect(q('tc-clear')).not.toBeNull();
  await act(async () => { q('tc-clear')!.click(); });
  await wait(20);
  expect(onCommit).toHaveBeenCalledWith('');
});
