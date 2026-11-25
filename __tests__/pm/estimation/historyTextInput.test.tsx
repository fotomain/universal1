/** @jest-environment jsdom */
// HistoryTextInput: every field has its OWN history (kept on the device under its key); a key that changes (the chosen filter field) shows the history of that key.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, typeInto, wait } from '../ui/pmUiTestKit';

const store: Record<string, string> = {};
// the UI kit mocks TextInputApp and the storage itself: override them AFTER importing it, then load the component
jest.doMock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async (k: string) => store[k] ?? null), setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }) },
}));
jest.doMock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({
  __esModule: true,
  default: ({ items, testID }: any) => require('react').createElement('div', { 'data-testid': testID }, items.map((i: any) => require('react').createElement('button', { key: i.testID, 'data-testid': i.testID, onClick: i.onPress }, i.label))),
}));
jest.doMock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput, Pressable } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, testID, onChangeText, onBlur, value }: any) => R.createElement(R.Fragment, null,
    R.createElement(TextInput, { testID, value, onChangeText, onBlur }),
    R.createElement(Pressable, { testID: leftIcons[0].testID, onPress: leftIcons[0].onPress })) };
});

import React from 'react';
const HistoryTextInput = require('../../../kit8/pm/estimation/ui/HistoryTextInput').default;

afterEach(() => { cleanupUI(); for (const k of Object.keys(store)) delete store[k]; });

function Field({ historyKey, initial = '' }: { historyKey: string; initial?: string }) {
  const [v, setV] = React.useState(initial);
  return <HistoryTextInput historyKey={historyKey} testID="f" label="From" value={v} onChangeText={setV} />;
}

test('a typed text goes to the history of ITS key when the field is left; another key keeps its own list', async () => {
  renderUI(<Field historyKey="a.from" initial="100" />);
  await act(async () => { await wait(20); });
  await act(async () => { q('f')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); await wait(20); });
  expect(JSON.parse(store['reusableTable.searchHistory.a.from'])).toEqual(['100']);
  expect(store['reusableTable.searchHistory.b.from']).toBeUndefined();
});

test('the history button opens the list of the field, a pick puts the text back, and a different key shows ITS entries (not the previous ones)', async () => {
  store['reusableTable.searchHistory.a.from'] = JSON.stringify(['7', '5']);
  store['reusableTable.searchHistory.b.from'] = JSON.stringify(['900']);
  renderUI(<Field historyKey="a.from" />);
  await act(async () => { await wait(20); });
  act(() => press('f-history-button'));
  expect(q('f-history-0')!.textContent).toBe('7');
  expect(q('f-history-1')!.textContent).toBe('5');
  act(() => press('f-history-1'));
  expect((q('f') as HTMLInputElement).value).toBe('5');
  cleanupUI();
  renderUI(<Field historyKey="b.from" />);
  await act(async () => { await wait(20); });
  act(() => press('f-history-button'));
  expect(q('f-history-0')!.textContent).toBe('900');
  expect(q('f-history-1')).toBeNull();
});

test('the fields of the filter bar are wide enough for the icons and the number, and the icons are the size of the text', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../../kit8/pm/estimation/ui/NormBookPanel.tsx'), 'utf8');
  const widths = [...src.matchAll(/<View style=\{\{ width: (\d+), flexDirection: 'row' \}\}><HistoryTextInput/g)].map((m: any) => Number(m[1]));
  expect(widths).toHaveLength(2);
  widths.forEach((w: number) => expect(w).toBeGreaterThanOrEqual(180));
  expect(require('fs').readFileSync(require('path').join(__dirname, '../../../kit8/pm/estimation/ui/HistoryTextInput.tsx'), 'utf8')).toContain('iconSize={16}');
});
