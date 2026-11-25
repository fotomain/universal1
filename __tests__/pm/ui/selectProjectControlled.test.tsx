/** @jest-environment jsdom */
// SelectProjectFromList in CONTROLLED mode (the Estimation dashboard): it shows the name it is given, a pick calls onPick and touches neither the PM store nor the ribbon of recent
// projects, "Create new" calls onCreateNew.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, seedStore } from './pmUiTestKit';

const mockProjects = [{ rowGUID: 'pA', rowJSON: { name: 'Alpha' }, rowProgress: 10, rowDuration: null }, { rowGUID: 'pB', rowJSON: { name: 'Beta' }, rowProgress: 0, rowDuration: null }];
jest.mock('../../../kit8/pm/crud/queries', () => ({ useProjectSearchQuery: () => ({ data: mockProjects, isFetching: false }) }));

const SelectProjectFromList = require('../../../kit8/pm/view/project/SelectProjectFromList').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

afterEach(() => cleanupUI());

test('it shows the given name; a pick goes to onPick only; the PM store keeps its project and its ribbon', () => {
  seedStore();
  const before = { sel: usePMStore.getState().selectedProjectGUID, recent: [...usePMStore.getState().recentProjectGUIDs] };
  const onPick = jest.fn();
  renderUI(<SelectProjectFromList ownerGUID="u1" onPick={onPick} selectedName="Estimation 1" />);
  expect((q('pm-project-search') as HTMLInputElement).value).toBe('Estimation 1');
  act(() => press('pm-project-search-toggle'));
  act(() => press('pm-project-search-item-pB'));
  expect(onPick).toHaveBeenCalledWith('pB');
  expect(usePMStore.getState().selectedProjectGUID).toBe(before.sel);
  expect(usePMStore.getState().recentProjectGUIDs).toEqual(before.recent);
});

test('Create new calls onCreateNew (not the project settings of the store)', () => {
  const onCreateNew = jest.fn();
  const open = jest.spyOn(usePMStore.getState(), 'openProjectSettings');
  renderUI(<SelectProjectFromList ownerGUID="u1" onPick={jest.fn()} selectedName="X" onCreateNew={onCreateNew} />);
  act(() => press('pm-project-search-toggle'));
  act(() => press('pm-project-search-create'));
  expect(onCreateNew).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
});
