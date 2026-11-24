/** @jest-environment jsdom */
// Right click (web) / long press (phone) on an element of the BIM view = a menu: Share (image + details) · Go to component. The 3D viewer is a probe that gives the callbacks back.
import React, { act } from 'react';
import { cleanupUI, mockRouterPush, press, q, renderUI, textOf } from '../pm/ui/pmUiTestKit';

const mockViewer = { props: {} as any };
jest.mock('../../kit8/pm/bim/view/BimViewer', () => ({ __esModule: true, default: (p: any) => { mockViewer.props = p; return require('react').createElement('div', { 'data-testid': 'probe' }); } }));
const mockElement = { ifcGuid: 'g1', ifcClass: 'IfcWall', name: 'Wall W-12', typeName: 'Basic Wall', storeyGUID: 's1', taskGUID: 't1', chunkHash: 'h', elementNumber: 0, bbox: [0, 0, 0, 1, 1, 1] };
const mockModel = {
  reload: jest.fn(),
  model: { state: 'ready', manifest: { model: { modelGUID: 'm', bbox: [0, 0, 0, 10, 10, 10] }, storeys: [{ storeyGUID: 's1', name: 'Level 1' }] }, elements: [mockElement], chunks: [], chunksTotal: 0, source: 'cloud', localKind: 'memory' },
};
jest.mock('../../kit8/pm/bim/view/useBimModel', () => ({ useBimModel: () => mockModel }));
jest.mock('../../kit8/pm/bim/cloud/bimCloud', () => ({ createBimCloud: () => ({ property: () => Promise.resolve(null) }) }));
const mockBridge = { highlighted: new Set<string>(), zoomBox: null, zoomNonce: 0, onElementPress: jest.fn(), onEmptyPress: jest.fn(), elementOf: (g: string) => (g === 'g1' ? mockElement : undefined) };
jest.mock('../../kit8/pm/bim/view/useBimTaskBridge', () => ({ useBimTaskBridge: () => mockBridge }));
const mockShare = jest.fn(() => Promise.resolve('shared'));
jest.mock('../../kit8/pm/bim/component/shareBimComponent', () => ({ shareBimComponent: (...a: any[]) => (mockShare as any)(...a) }));

import PMProjectBimView from '../../kit8/pm/bim/view/PMProjectBimView';
import { BIM_COMPONENT_ROUTE } from '../../kit8/pm/bim/component/bimComponentModel';
import { bimViewOf, useBimViewRegistry } from '../../kit8/pm/bim/component/bimComponentRegistry';
import { makePMPalette } from '../../kit8/pm/view/theme';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const mount = () => renderUI(<PMProjectBimView projectGUID="p1" width={900} height={600} palette={palette} />);
const rightClick = (g: string | null) => act(() => mockViewer.props.onElementContextMenu(g, 40, 50));

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
});

describe('BIM view: menu of a component', () => {
  it('the viewer is given the callback', () => {
    mount();
    expect(typeof mockViewer.props.onElementContextMenu).toBe('function');
    expect(mockViewer.props.captureRef).toBeTruthy();
  });

  it('right click on an element: it is selected like a press and the menu shows Share and Go to component', () => {
    mount();
    expect(q('pm-bim-menu')).toBeNull();
    rightClick('g1');
    expect(mockBridge.onElementPress).toHaveBeenCalledWith('g1');
    expect(textOf('pm-bim-menu-caption')).toBe('Wall W-12');
    expect(q('pm-bim-menu-share')).not.toBeNull();
    expect(q('pm-bim-menu-goto')).not.toBeNull();
  });

  it('right click on an empty place: no menu', () => {
    mount();
    rightClick(null);
    expect(q('pm-bim-menu')).toBeNull();
  });

  it('Go to component: the route of ONE component with the project, the element, its task and the place to return to', () => {
    window.history.pushState({}, '', '/pm/project/dashboard');
    mount();
    rightClick('g1');
    press('pm-bim-menu-goto');
    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: BIM_COMPONENT_ROUTE, params: { projectGUID: 'p1', elementGUID: 'g1', taskGUID: 't1', returnTo: '/pm/project/dashboard' } });
    expect(q('pm-bim-menu')).toBeNull();
  });

  it('the panel under the view has the same button', () => {
    mount();
    act(() => mockViewer.props.onElementPress('g1'));
    press('pm-bim-open-component');
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it('Share: asks the registered view for the picture + details of THIS component, then says what happened', async () => {
    mount();
    rightClick('g1');
    press('pm-bim-menu-share');
    // (a plain wait: an async act() never settles while the context menu modal is closing)
    await new Promise((r) => setTimeout(r, 30));
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [view, element] = (mockShare.mock.calls as any[])[0];
    expect(element.ifcGuid).toBe('g1');
    expect(view.projectGUID).toBe('p1');
    expect(view.byTask.get('t1')).toHaveLength(1);
    expect(textOf('pm-bim-share-note')).toBe('Screenshot shared');
  });
});

describe('registry of the mounted view', () => {
  it('the view of the project is registered while it is open (the Task menu reads it) and gone when it closes', () => {
    const { unmount } = mount() as any;
    const v = bimViewOf('p1')!;
    expect(v.modelGUID).toBe('m');
    expect(v.byGuid.get('g1')?.taskGUID).toBe('t1');
    expect(v.storeyNames.get('s1')).toBe('Level 1');
    expect(bimViewOf('other')).toBeNull();
    act(() => unmount?.());
    cleanupUI();
    expect(useBimViewRegistry.getState().view).toBeNull();
  });
});
