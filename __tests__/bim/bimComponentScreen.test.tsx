/** @jest-environment jsdom */
// The screen of ONE component (/pm/bim/component): only it in 3D, its properties, the edit tables of its task UNDER the image, a full screen button, Back.
import '../pm/ui/pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore, textOf } from '../pm/ui/pmUiTestKit';

let mockCrud: any = {};
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = false;
jest.mock('../../kit8/pm/crud/queries', () => ({
  usePMOwnerGUID: () => 'u1',
  useProjectRealtime: () => undefined,
  useReadProjectDataQuery: () => ({ isLoading: false, isFetched: true }),
  useReadProjectsQuery: () => ({}),
  useReadProjectUserSettingsQuery: () => ({}),
}));
jest.mock('../../kit8/pm/crud/usePMCrud', () => ({ usePMCrud: () => mockCrud }));
jest.mock('../../kit8/pm/view/undo/PMUndoProvider', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../../kit8/pm/view/task/finances/PMTaskEditView', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-edit-tables" data-project={p.projectGUID} data-height={p.height} /> }));
const mockViewer = { props: {} as any };
jest.mock('../../kit8/pm/bim/view/BimViewer', () => ({ __esModule: true, default: (p: any) => { mockViewer.props = p; return <div data-testid="probe-viewer" />; } }));
const mockModel: { current: any } = { current: null };
const mockUseBimModel = jest.fn((..._a: any[]) => mockModel.current);
jest.mock('../../kit8/pm/bim/view/useBimModel', () => ({ useBimModel: (...a: any[]) => (mockUseBimModel as any)(...a) }));
jest.mock('../../kit8/pm/bim/cloud/bimCloud', () => ({ createBimCloud: () => ({ property: () => Promise.resolve({ sets: { Pset_Wall: { FireRating: '2HR' } } }) }) }));
const mockShare = jest.fn(() => Promise.resolve('shared'));
jest.mock('../../kit8/pm/bim/component/shareBimComponent', () => ({ shareBimComponent: (...a: any[]) => (mockShare as any)(...a) }));
jest.doMock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: mockNavigate, replace: mockReplace, back: mockBack, canGoBack: () => mockCanGoBack }),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

const PMBimComponentScreen = require('../../kit8/pm/bim/component/PMBimComponentScreen').default;

const readyModel = (elements: any[], chunks: any[] = [{ hash: 'h', chunk: {} }], chunksTotal = 1) => ({
  reload: jest.fn(),
  model: { state: 'ready', manifest: { model: { modelGUID: 'm', bbox: [0, 0, 0, 10, 10, 10] }, storeys: [{ storeyGUID: 's1', name: 'Level 1' }] }, elements, chunks, chunksTotal, source: 'cloud', localKind: 'memory' },
});
const element = (taskGUID: string | null) => ({ ifcGuid: 'g1', ifcClass: 'IfcWall', name: 'Wall W-12', typeName: 'Basic Wall', storeyGUID: 's1', taskGUID, chunkHash: 'h', elementNumber: 0, bbox: [1, 2, 3, 4, 5, 6] });

beforeEach(() => {
  mockCrud = fakeCrud();
  mockCanGoBack = false;
});
afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
});

const open = (link: Record<string, any> = {}, taskName = 'Task 111', elTask: boolean = true) => {
  const { byName } = seedStore();
  const t = byName(taskName);
  mockModel.current = readyModel([element(elTask ? t.rowGUID : null)]);
  renderUI(<PMBimComponentScreen link={{ projectGUID: t.projectGUID, elementGUID: 'g1', taskGUID: elTask ? t.rowGUID : undefined, ...link }} />);
  return t;
};

describe('PMBimComponentScreen', () => {
  it('the image shows ONLY this component (isolated), fitted to its box, from the chunk that holds it', () => {
    open();
    expect(textOf('pm-bim-component-title')).toBe('Wall W-12');
    expect(mockViewer.props.isolateGuid).toBe('g1');
    expect(mockViewer.props.modelBox).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mockViewer.props.highlighted.size).toBe(0);
    expect(mockUseBimModel).toHaveBeenCalledWith(expect.any(String), null, 'g1');
  });

  it('properties are visible, and the edit tables of the task are UNDER the image (viewer, then properties, then the tables)', async () => {
    const t = open();
    await act(async () => { await Promise.resolve(); });
    expect(textOf('pm-bim-component-props')).toContain('Pset_Wall');
    expect(textOf('pm-bim-component-props')).toContain('FireRating: 2HR');
    const edit = document.querySelector('[data-testid="stub-edit-tables"]')!;
    expect(edit.getAttribute('data-project')).toBe(t.projectGUID);
    expect(Number(edit.getAttribute('data-height'))).toBeGreaterThanOrEqual(340);
    const order = ['pm-bim-component-viewer', 'pm-bim-component-props', 'pm-bim-component-edit'].map((id) => q(id) ?? document.querySelector(`[data-testid="probe-viewer"]`)!);
    const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(document.querySelector('[data-testid="probe-viewer"]')!, q('pm-bim-component-props')!)).toBe(true);
    expect(follows(q('pm-bim-component-props')!, q('pm-bim-component-edit')!)).toBe(true);
    void order;
  });

  it('the task of the component is the selected task (the tables show its lines)', () => {
    const t = open();
    const { usePMStore } = require('../../kit8/pm/store/store_pm');
    expect(usePMStore.getState().selectedGUID).toBe(t.rowGUID);
  });

  it('full screen: the image alone (no header, no properties, no tables), the exit button brings them back', () => {
    open();
    press('pm-bim-component-fullscreen');
    expect(q('pm-bim-component-edit')).toBeNull();
    expect(q('pm-bim-component-props')).toBeNull();
    expect(q('pm-bim-component-back')).toBeNull();
    expect(q('pm-bim-component-exit-fullscreen')).not.toBeNull();
    expect(mockViewer.props.height).toBeGreaterThan(300);
    press('pm-bim-component-exit-fullscreen');
    expect(q('pm-bim-component-edit')).not.toBeNull();
    expect(q('pm-bim-component-back')).not.toBeNull();
  });

  it('Back: the place it came from (returnTo) wins', () => {
    mockCanGoBack = true;
    open({ returnTo: '/pm/project/dashboard?projectGUID=p1' });
    press('pm-bim-component-back');
    expect(mockNavigate).toHaveBeenCalledWith('/pm/project/dashboard?projectGUID=p1');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Back: without returnTo, the previous screen; with no history at all (a link in a new tab) the dashboard at the task', () => {
    mockCanGoBack = true;
    open();
    press('pm-bim-component-back');
    expect(mockBack).toHaveBeenCalledTimes(1);
    cleanupUI();
    mockCanGoBack = false;
    const t = open();
    press('pm-bim-component-back');
    expect(mockReplace).toHaveBeenCalledWith(`/pm/project/dashboard?projectGUID=${t.projectGUID}&taskGUID=${t.rowGUID}&view=finances`);
  });

  it('Share: the picture + details of this component', async () => {
    open();
    await act(async () => { await Promise.resolve(); });
    press('pm-bim-component-share');
    await new Promise((r) => setTimeout(r, 30));
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [view, el] = (mockShare.mock.calls as any[])[0];
    expect(el.ifcGuid).toBe('g1');
    expect(view.modelGUID).toBe('m');
    expect(textOf('pm-bim-component-note')).toBe('Screenshot shared');
  });

  it('a component with no task: the tables are replaced by a note', () => {
    open({}, 'Task 111', false);
    expect(q('pm-bim-component-notask')).not.toBeNull();
    expect(document.querySelector('[data-testid="stub-edit-tables"]')).toBeNull();
  });

  it('no BIM model / a component that is not in the model / no link: a message, no viewer', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    mockModel.current = { reload: jest.fn(), model: { state: 'none' } };
    renderUI(<PMBimComponentScreen link={{ projectGUID: t.projectGUID, elementGUID: 'g1' }} />);
    expect(textOf('pm-bim-component-missing')).toContain('no BIM model');
    cleanupUI();
    mockModel.current = readyModel([]);
    renderUI(<PMBimComponentScreen link={{ projectGUID: t.projectGUID, elementGUID: 'g1' }} />);
    expect(textOf('pm-bim-component-missing')).toContain('not in the model');
    cleanupUI();
    renderUI(<PMBimComponentScreen link={null} />);
    expect(textOf('pm-bim-component-missing')).toContain('No component in the link');
  });
});
