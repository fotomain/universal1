/** @jest-environment jsdom */
// Settings -> Dashboards: the button that copies the system font of the browser for the canvases (web only).
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { text: '#000', surface: '#fff', border: '#ccc', primary: '#00f' }, isDark: false }) }));
jest.mock('../../../kit8/ui/components/common/ButtonSecondaryApp', () => {
  const R = require('react');
  return { __esModule: true, default: ({ children, onPress, testID }: any) => R.createElement('button', { 'data-testid': testID, onClick: onPress }, children) };
});
const mockCapture = jest.fn();
jest.mock('../../../kit8/pm/skia/systemFontWeb', () => {
  let font: any = null;
  const subs = new Set<() => void>();
  return {
    isSystemFontCaptureSupported: () => true,
    loadStoredSystemFont: async () => font,
    getSystemFontSnapshot: () => font,
    subscribeSystemFont: (l: () => void) => { subs.add(l); return () => subs.delete(l); },
    captureSystemFont: async () => { const r = await mockCapture(); if (r.ok) { font = { family: r.family, faces: {} }; subs.forEach((l) => l()); } return r; },
    clearSystemFont: async () => { font = null; subs.forEach((l) => l()); },
  };
});

import { SystemFontForCanvases } from '../../../kit8/ui/settings/SystemFontForCanvases';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: any;
let box: HTMLElement;
const mount = async (web: boolean) => {
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
  await act(async () => { root.render(<SystemFontForCanvases web={web} />); });
};
const q = (id: string) => box.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = async (id: string) => { await act(async () => { q(id)!.click(); }); };
afterEach(() => { act(() => root.unmount()); box.remove(); });

describe('SystemFontForCanvases', () => {
  it('copies the font on a click and says which one is used; Forget it goes back', async () => {
    mockCapture.mockResolvedValue({ ok: true, family: 'Helvetica Neue', roles: ['regular'] });
    await mount(true);
    expect(q('settings-system-font-status')!.textContent).toMatch(/Not copied yet/);
    await press('settings-system-font-copy');
    expect(q('settings-system-font-status')!.textContent).toMatch(/Helvetica Neue/);
    await press('settings-system-font-clear');
    expect(q('settings-system-font-status')!.textContent).toMatch(/Not copied yet/);
  });
  it('a refused permission is explained', async () => {
    mockCapture.mockResolvedValue({ ok: false, reason: 'denied' });
    await mount(true);
    await press('settings-system-font-copy');
    expect(q('settings-system-font-status')!.textContent).toMatch(/did not allow/);
  });
  it('nothing on a phone', async () => {
    await mount(false);
    expect(q('settings-system-font-canvas')).toBeNull();
  });
});
