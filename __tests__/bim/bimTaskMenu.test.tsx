/** @jest-environment jsdom */
// The Task context menu (PMTaskRowMenu) of a BIM project: a task that is exactly ONE component of the open model gets "Share component (image + details)" and "Go to component".
import './../pm/ui/pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, mockRouterPush, press, q, renderUI, seedStore } from '../pm/ui/pmUiTestKit';

const mockShare = jest.fn(() => Promise.resolve('shared'));
jest.mock('../../kit8/pm/bim/component/shareBimComponent', () => ({ shareBimComponent: (...a: any[]) => (mockShare as any)(...a) }));

import PMTaskRowMenu from '../../kit8/pm/view/task/PMTaskRowMenu';
import { usePMStore } from '../../kit8/pm/store/store_pm';
import { BIM_COMPONENT_ROUTE } from '../../kit8/pm/bim/component/bimComponentModel';
import { makeBimViewRegistration, useBimViewRegistry } from '../../kit8/pm/bim/component/bimComponentRegistry';

const row = (ifcGuid: string, taskGUID: string | null) => ({ ifcGuid, ifcClass: 'IfcWall', name: `Wall ${ifcGuid}`, typeName: 'Basic', storeyGUID: null, taskGUID, chunkHash: 'h', elementNumber: 0, bbox: [0, 0, 0, 1, 1, 1] });
const register = (projectGUID: string, elements: any[]) =>
  act(() => useBimViewRegistry.getState().set(makeBimViewRegistration({ projectGUID, modelGUID: 'm', elements, storeys: [], capture: async () => null, properties: async () => null })));
const open = (guid: string) => act(() => usePMStore.getState().setRowMenu({ guid, x: 50, y: 50, source: 'tree' }));

afterEach(() => {
  act(() => useBimViewRegistry.getState().set(null));
  cleanupUI();
  jest.clearAllMocks();
});

describe('Task menu: BIM component items', () => {
  it('no BIM view open: no BIM items', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    open(t.rowGUID);
    expect(q('pm-row-menu')).not.toBeNull();
    expect(q('pm-row-menu-bim-share')).toBeNull();
    expect(q('pm-row-menu-bim-goto')).toBeNull();
  });

  it('a task that is ONE component: Share + Go to component (before Options)', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    register(t.projectGUID, [row('g1', t.rowGUID)]);
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    open(t.rowGUID);
    const ids = ['pm-row-menu-bim-share', 'pm-row-menu-bim-goto', 'pm-row-menu-options'];
    const pos = ids.map((id) => Array.from(document.querySelectorAll('[data-testid]')).findIndex((n) => n.getAttribute('data-testid') === id));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect(pos[0]).toBeLessThan(pos[1]);
    expect(pos[1]).toBeLessThan(pos[2]);
  });

  it('Go to component: the route of that component, the menu closes', () => {
    window.history.pushState({}, '', '/pm/project/dashboard');
    const { byName } = seedStore();
    const t = byName('Task 111');
    register(t.projectGUID, [row('g1', t.rowGUID)]);
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    open(t.rowGUID);
    press('pm-row-menu-bim-goto');
    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: BIM_COMPONENT_ROUTE, params: { projectGUID: t.projectGUID, elementGUID: 'g1', taskGUID: t.rowGUID, returnTo: '/pm/project/dashboard' } });
    expect(usePMStore.getState().rowMenu).toBeNull();
  });

  it('Share component: the registered view + the element of the task', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    register(t.projectGUID, [row('g1', t.rowGUID)]);
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    open(t.rowGUID);
    press('pm-row-menu-bim-share');
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [view, element] = (mockShare.mock.calls as any[])[0];
    expect(view.projectGUID).toBe(t.projectGUID);
    expect(element.ifcGuid).toBe('g1');
  });

  it('a task of SEVERAL components, a task without one, or a view of another project: no BIM items', () => {
    const { byName } = seedStore();
    const many = byName('Task 111');
    const none = byName('Task 112');
    register(many.projectGUID, [row('g1', many.rowGUID), row('g2', many.rowGUID)]);
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    for (const t of [many, none]) {
      open(t.rowGUID);
      expect(q('pm-row-menu-bim-goto')).toBeNull();
      act(() => usePMStore.getState().setRowMenu(null));
    }
    register('another-project', [row('g3', none.rowGUID)]);
    open(none.rowGUID);
    expect(q('pm-row-menu-bim-goto')).toBeNull();
  });
});
