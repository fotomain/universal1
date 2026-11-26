/** @jest-environment jsdom */
// ProjectList: the Projects screen list = a ReusableList with ProjectCardForList as renderItem. ReusableList is replaced by a stub that keeps its props,
// so the test checks the WIRING (what the project passes to the list), not the list itself (its own tests: __tests__/ui/list).
import React, { act } from 'react';

const mockList: { props: any } = { props: null };
jest.mock('../../../kit8/ui/components/list/reusable/ReusableList', () => ({ __esModule: true, default: (p: any) => { mockList.props = p; return null; } }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => { const R = require('react'); const { Text } = require('react-native'); return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) }; });
let mockState: any = { projectReusable: { realtimeStatus: 'subscribed', entityDataFromServer: [{ rowGUID: 'a' }, { rowGUID: 'b' }] } };
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => jest.fn() }));
const mockMutate = jest.fn();
const mockBuild = jest.fn((name: string) => ({ rowGUID: 'new', rowJSON: { name } }));
jest.mock('../../../kit8/pm/crud/queries', () => ({
  usePMOwnerGUID: () => 'owner-1',
  useCreateProjectMutation: () => ({ mutate: (...a: any[]) => mockMutate(...a) }),
  useBuildProjectRow: () => (name: string) => mockBuild(name),
}));
const mockCopy = jest.fn();
jest.mock('../../../kit8/catalog/project/copy/useCopyProject', () => ({ useCopyProject: () => ({ copy: mockCopy, busy: false }) }));

import ProjectList, { canArchiveProject, PROJECT_LIST_GUID } from '../../../kit8/catalog/project/ProjectList';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
function mount(props: any = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ProjectList {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockList.props = null; });

const row = (rowJSON: any = {}) => ({ rowGUID: 'p1', rowJSON } as any);

describe('ProjectList = ReusableList of the project rows', () => {
  it('reads the projects of the owner of ANY parent (the organization), has the fixed card height and its own list id', () => {
    mount();
    const p = mockList.props;
    expect(p.entityName).toBe('projectReusable');
    expect(p.listOwnerGUID).toBe('owner-1');
    expect(p.listParentGUID).toBe('*');
    expect(p.reusableListGUID).toBe(PROJECT_LIST_GUID);
    expect(p.itemHeight).toBe(120);
    expect(p.swipeActions).toBe(true);
    expect(p.swipeInset).toEqual({ x: 8, y: 4, radius: 12 });
    expect(p.cardFab).not.toBe(false);
    expect(p.contextMenuEnabled).not.toBe(false);
    expect(p.renderItem).toBeInstanceOf(Function);
    expect(p.visualColumns.map((c: any) => c.key)).toEqual(['name', 'start']);
  });

  it('Add makes a project the project way (onAdd: the generic Add above / below / Duplicate are hidden) and selects it', () => {
    mount();
    act(() => mockList.props.onAdd());
    expect(mockBuild).toHaveBeenCalledWith('Project 3');
    expect(mockMutate).toHaveBeenCalledTimes(1);
    mockMutate.mock.calls[0][1].onSuccess({ rowGUID: 'new-guid' });
    expect(usePMStore.getState().selectedProjectGUID).toBe('new-guid');
  });

  it('the menu and the FAB get the same project commands; Copy variants call the copy hook with the row', () => {
    mount();
    const r = row({ projectIsBIMBased: true });
    const close = jest.fn();
    const items = mockList.props.extraMenuItems(r, close);
    expect(items.map((i: any) => i.label)).toEqual(['Open dashboard', 'Project settings', 'Copy', 'Copy with Tasks', 'Copy with BIM']);
    const fab = mockList.props.cardFabActions(r);
    expect(fab.map((a: any) => a.label)).toEqual(items.map((i: any) => i.label));
    items[2].onPress(); items[3].onPress(); items[4].onPress();
    expect(close).toHaveBeenCalledTimes(3);
    expect(mockCopy.mock.calls).toEqual([[r, false, false], [r, true, false], [r, true, true]]);
    fab[2].onPress();
    expect(mockCopy).toHaveBeenCalledTimes(4);
  });

  it('Open dashboard selects the project and opens the dashboard route; Project settings opens its window', () => {
    mount();
    const openSettings = jest.fn();
    usePMStore.setState({ openProjectSettings: openSettings } as any);
    const [dashboard, settings] = mockList.props.cardFabActions(row());
    act(() => dashboard.onPress());
    expect(usePMStore.getState().selectedProjectGUID).toBe('p1');
    expect(mockPush).toHaveBeenCalledWith('/pm/project/dashboard');
    act(() => settings.onPress());
    expect(openSettings).toHaveBeenCalledWith('p1');
  });

  it('a read-only project is not archived (the database refuses everything but its switch); the others are', () => {
    mount();
    expect(mockList.props.canArchiveRow).toBe(canArchiveProject);
    expect(canArchiveProject(row({ projectIsReadonly: true }))).toBe(false);
    expect(canArchiveProject(row({}))).toBe(true);
  });

  it('the card of the list is ProjectCardForList with the handlers (a press selects the project and tells the screen)', () => {
    const onSelectProject = jest.fn();
    mount({ onSelectProject });
    const el: any = mockList.props.renderItem(row({ name: 'X' }), { grip: null, actions: { markUsed: jest.fn() }, archived: false });
    expect(el.props.onSelect).toBeInstanceOf(Function);
    act(() => el.props.onSelect('p9'));
    expect(onSelectProject).toHaveBeenCalledWith('p9');
    expect(usePMStore.getState().selectedProjectGUID).toBe('p9');
    expect(el.props.onDashboard).toBeInstanceOf(Function);
    expect(el.props.onSettings).toBeInstanceOf(Function);
  });
});
