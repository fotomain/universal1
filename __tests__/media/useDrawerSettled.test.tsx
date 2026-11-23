/** @jest-environment jsdom */
// useDrawerSettled: a camera screen starts only when the hamburger menu is closed AND has finished sliding (Android: the camera permission dialog froze the closing
// animation and the camera ran under the open menu, 2026-11-23). Does not use mediaUiTestKit: that kit replaces the hook.
import React from 'react';
import { act } from 'react';
import { DrawerStatusContext } from 'expo-router/build/react-navigation/drawer/utils/DrawerStatusContext';
import { DRAWER_SETTLE_MS, useDrawerSettled } from '../../kit8/ui/components/media/common/useDrawerSettled';

const { createRoot } = require('react-dom/client');

function Probe() {
  return <span data-testid="settled">{String(useDrawerSettled())}</span>;
}
const shown = () => document.querySelector('[data-testid="settled"]')?.textContent;

let root: any;
const mount = (status?: 'open' | 'closed') => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  show(status);
};
const show = (status?: 'open' | 'closed') =>
  act(() => root.render(status ? <DrawerStatusContext.Provider value={status}><Probe /></DrawerStatusContext.Provider> : <Probe />));
const wait = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; jest.useFakeTimers(); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.useRealTimers(); });

it('is false while the menu is open, however long', () => {
  mount('open');
  wait(DRAWER_SETTLE_MS * 5);
  expect(shown()).toBe('false');
});

it('turns true only after the menu closed and the settle time passed', () => {
  mount('open');
  show('closed');
  expect(shown()).toBe('false');
  wait(DRAWER_SETTLE_MS - 1);
  expect(shown()).toBe('false');
  wait(2);
  expect(shown()).toBe('true');
});

it('a screen mounted while the menu is already "closed" (still sliding) waits too', () => {
  mount('closed');
  expect(shown()).toBe('false');
  wait(DRAWER_SETTLE_MS + 1);
  expect(shown()).toBe('true');
});

it('falls back to false when the menu is opened again', () => {
  mount('closed');
  wait(DRAWER_SETTLE_MS + 1);
  expect(shown()).toBe('true');
  show('open');
  expect(shown()).toBe('false');
});

it('outside a drawer it settles after the same short time (no crash)', () => {
  mount();
  wait(DRAWER_SETTLE_MS + 1);
  expect(shown()).toBe('true');
});
