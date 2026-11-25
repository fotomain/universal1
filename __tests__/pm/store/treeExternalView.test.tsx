/** @jest-environment jsdom */
// The filter / sort of a grid beside the tree (Estimation dashboard) reaches the visible rows of the PM store, and clearing it brings the tree order back.
import { act } from 'react';
import { seedStore } from '../ui/pmUiTestKit';

test('setTreeExternalView hides the rows that do not match (the stages above a match stay) and reorders siblings; null restores the tree', () => {
  const { byName, store } = seedStore();
  const before = [...store.getState().visibleRows];
  expect(before.length).toBeGreaterThan(3);
  const keepGUID = byName('Task 112').rowGUID;
  act(() => store.getState().setTreeExternalView({ matches: new Set([keepGUID]), compare: null }));
  const after = store.getState().visibleRows;
  expect(after).toContain(keepGUID);
  expect(after.length).toBeLessThan(before.length);
  expect(store.getState().treeFilterMatchCount).toBe(1);
  // a sort that puts the last sibling first
  act(() => store.getState().setTreeExternalView({ matches: null, compare: (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0) }));
  expect(store.getState().visibleRows).not.toEqual(before);
  expect([...store.getState().visibleRows].sort()).toEqual([...before].sort());
  act(() => store.getState().setTreeExternalView(null));
  expect(store.getState().visibleRows).toEqual(before);
});
