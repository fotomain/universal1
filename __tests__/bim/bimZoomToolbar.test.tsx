/** @jest-environment jsdom */
// The zoom controls of the BIM view: - / + buttons, the percent field (+ and -), the level. The 3D viewer is replaced by a probe that records what the toolbar sends it.
import React, { act } from 'react';
import { cleanupUI, inputValue, pressKey, press, q, renderUI, textOf, typeInto } from '../pm/ui/pmUiTestKit';

const mockViewer = { props: {} as any };
jest.mock('../../kit8/pm/bim/view/BimViewer', () => ({ __esModule: true, default: (p: any) => { mockViewer.props = p; return require('react').createElement('div', { 'data-testid': 'probe' }); } }));
jest.mock('../../kit8/pm/bim/view/useBimModel', () => ({
  useBimModel: () => ({
    reload: jest.fn(),
    model: { state: 'ready', manifest: { model: { modelGUID: 'm', bbox: [0, 0, 0, 10, 10, 10] } }, elements: [], chunks: [], chunksTotal: 0, source: 'cloud', localKind: 'memory' },
  }),
}));
jest.mock('../../kit8/pm/bim/cloud/bimCloud', () => ({ createBimCloud: () => ({ property: () => Promise.resolve(null) }) }));
jest.mock('../../kit8/pm/bim/view/useBimTaskBridge', () => ({
  useBimTaskBridge: () => ({ highlighted: new Set(), zoomBox: null, zoomNonce: 0, onElementPress: jest.fn(), onEmptyPress: jest.fn(), elementOf: () => undefined }),
}));

import PMProjectBimView from '../../kit8/pm/bim/view/PMProjectBimView';
import { makePMPalette } from '../../kit8/pm/view/theme';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const mount = () => renderUI(<PMProjectBimView projectGUID="p1" width={900} height={600} palette={palette} />);
const sent = () => ({ nonce: mockViewer.props.zoomPercentNonce, percent: mockViewer.props.zoomPercent });

afterEach(cleanupUI);

describe('BIM zoom controls', () => {
  it('+ zooms in by 25 %, - is its exact reverse (-20 %)', () => {
    mount();
    expect(sent().nonce).toBe(0);
    press('pm-bim-zoom-in');
    expect(sent()).toEqual({ nonce: 1, percent: 25 });
    press('pm-bim-zoom-out');
    expect(sent().nonce).toBe(2);
    expect(sent().percent).toBeCloseTo(-20, 9);
  });

  it('the field takes a positive and a negative percent, then it empties', () => {
    mount();
    typeInto('pm-bim-zoom-input', '50');
    press('pm-bim-zoom-apply');
    expect(sent()).toEqual({ nonce: 1, percent: 50 });
    expect(inputValue('pm-bim-zoom-input')).toBe('');
    typeInto('pm-bim-zoom-input', '-30');
    pressKey('pm-bim-zoom-input', 'Enter');
    expect(sent()).toEqual({ nonce: 2, percent: -30 });
  });

  it('a wrong value (text, -100 or less) sends nothing', () => {
    mount();
    for (const bad of ['abc', '-100', '-250']) {
      typeInto('pm-bim-zoom-input', bad);
      press('pm-bim-zoom-apply');
    }
    expect(sent().nonce).toBe(0);
  });

  it('shows the zoom level the viewer reports (100 % = the whole model fits)', () => {
    mount();
    expect(textOf('pm-bim-zoom-level')).toBe('100%');
    act(() => mockViewer.props.onZoomLevel(340));
    expect(textOf('pm-bim-zoom-level')).toBe('340%');
    expect(q('pm-bim-zoom-in')).not.toBeNull();
  });
});
