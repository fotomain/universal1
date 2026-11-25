/** @jest-environment jsdom */
// useTreeScopeSelection: the Project dashboard and the Estimation dashboard (one PM store, Drawer screens stay mounted) each remember their OWN project + task.
let mockFocus: Record<string, boolean> = { dash: true, est: false };
jest.mock('expo-router', () => ({ useIsFocused: () => { const { useContext } = require('react'); return mockFocus[useContext(mockCtx())]; } }));
let ctx: any;
function mockCtx() { return ctx ?? (ctx = require('react').createContext('dash')); }

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
function renderUI(el: React.ReactElement) {
  root = createRoot(document.createElement('div'));
  act(() => root!.render(el));
  return { rerender: (next: React.ReactElement) => act(() => root!.render(next)) };
}
function cleanupUI() { if (root) act(() => root!.unmount()); root = null; }
import { usePMStore } from '../../../../../kit8/pm/store/store_pm';
import { PROJECT_DASHBOARD_SCOPE, treeSelectionMemory, useTreeScopeSelection } from '../../../../../kit8/pm/view/project/tree/useTreeScopeSelection';

function Dash() { useTreeScopeSelection(PROJECT_DASHBOARD_SCOPE); return null; }
function Est() { useTreeScopeSelection('estimation', { forcedProjectGUID: 'E1' }); return null; }
function Screens({ dash, est }: { dash: boolean; est: boolean }) {
  mockFocus = { dash, est };
  const C = mockCtx();
  return <><C.Provider value="dash"><Dash /></C.Provider><C.Provider value="est"><Est /></C.Provider></>;
}
/** the project is read: its rows are loaded (a task can be selected) */
const load = (g: string) => act(() => { usePMStore.setState({ loadedProjectGUID: g }); });
const select = (t: string | null) => act(() => { usePMStore.getState().setSelected(t); });

afterEach(cleanupUI);
beforeEach(() => { treeSelectionMemory.clear(); usePMStore.setState({ selectedProjectGUID: null, loadedProjectGUID: null, selectedGUID: null, focusRequest: null } as any); });

describe('useTreeScopeSelection', () => {
  it('each screen gets back its own project and task', () => {
    const view = renderUI(<Screens dash est={false} />);
    act(() => { usePMStore.getState().selectProject('P1'); }); load('P1'); select('t1');
    view.rerender(<Screens dash={false} est />); // Estimation dashboard opens
    expect(usePMStore.getState().selectedProjectGUID).toBe('E1');
    load('E1'); select('e7');
    view.rerender(<Screens dash est={false} />); // back to the Project dashboard
    expect(usePMStore.getState().selectedProjectGUID).toBe('P1');
    expect(usePMStore.getState().focusRequest?.guid).toBe('t1');
    load('P1');
    act(() => { usePMStore.getState().selectProject('P2'); }); load('P2');
    view.rerender(<Screens dash={false} est />);
    expect(usePMStore.getState().selectedProjectGUID).toBe('E1');
    expect(usePMStore.getState().focusRequest?.guid).toBe('e7');
    view.rerender(<Screens dash est={false} />);
    expect(usePMStore.getState().selectedProjectGUID).toBe('P2'); // the project picked last in the dashboard stays
  });
  it('the estimation project does not override the dashboard while the dashboard is focused', () => {
    renderUI(<Screens dash est={false} />);
    act(() => { usePMStore.getState().selectProject('P1'); }); load('P1');
    act(() => { usePMStore.getState().selectProject('P2'); });
    expect(usePMStore.getState().selectedProjectGUID).toBe('P2');
  });
  it('the Estimation dashboard opened first leaves the dashboard its own selection', () => {
    usePMStore.setState({ selectedProjectGUID: 'P9' } as any);
    const view = renderUI(<Screens dash={false} est />);
    expect(usePMStore.getState().selectedProjectGUID).toBe('E1');
    expect(treeSelectionMemory.get(PROJECT_DASHBOARD_SCOPE)?.projectGUID).toBe('P9');
    view.rerender(<Screens dash est={false} />);
    expect(usePMStore.getState().selectedProjectGUID).toBe('P9');
  });
});
