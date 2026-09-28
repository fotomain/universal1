// Test kit for the PM UI tests (jsdom + react-native-web + react-dom).
//
// Import this file FIRST in every PM UI test: its jest.mock calls must run before the
// components are required. It mocks the native-only / heavy modules (Reanimated, Paper,
// clipboard, icons, design system) and gives small DOM helpers:
//   renderUI(<X/>)  q(testID)  qa(prefix)  press(testID)  typeInto(testID, text)  fakeCrud()

import React from 'react';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({
    activeSystem: 'native',
    isDark: false,
    themeColors: {
      primary: '#6366f1',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      border: '#cbd5e1',
      error: '#dc2626',
      card: '#ffffff',
    },
  }),
}));

jest.mock('../../../kit8/components/common/IconApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const IconApp = ({ testID, name, onPress }: any) =>
    onPress ? R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, name)) : R.createElement(Text, { testID }, name);
  return { __esModule: true, default: IconApp, IconApp };
});

jest.mock('../../../kit8/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, editable, onChangeText, label }: any) =>
    R.createElement(TextInput, { testID, value, editable, onChangeText, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});

jest.mock('../../../kit8/components/common/googlemd3web/GoogleMD3WebButton', () => ({ __esModule: true, default: () => null }));

jest.mock('react-native-paper', () => {
  const Stub = () => null;
  (Stub as any).Icon = () => null;
  return { Button: Stub, TextInput: Stub, HelperText: Stub };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const sv = (v: any) => ({ value: v });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: any) => c },
    View,
    useSharedValue: sv,
    useAnimatedStyle: () => ({}),
    useDerivedValue: (fn: any) => ({ value: fn() }),
    useAnimatedReaction: () => undefined,
    withTiming: (v: any) => v,
    withDecay: () => 0,
    runOnJS: (fn: any) => fn,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, setParams: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

// ---------------------------------------------------------------------------------------
import { act } from 'react';
// react-dom has no bundled types in this app (RN project) -> typed locally
type Root = { render(node: React.ReactNode): void; unmount(): void };
const { createRoot } = require('react-dom/client') as { createRoot: (container: Element) => Root };

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

export function renderUI(el: React.ReactElement) {
  cleanupUI();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
  return { rerender: (next: React.ReactElement) => act(() => root!.render(next)) };
}

export function cleanupUI() {
  if (root) act(() => root!.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = '';
}

/** Element by testID (react-native-web renders testID as data-testid). Modals render in document.body. */
export function q(testID: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testID}"]`);
}

/** All testIDs starting with `prefix`, in document order. */
export function qa(prefix: string): string[] {
  return Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`)).map((e) => e.getAttribute('data-testid') || '');
}

export function mustGet(testID: string): HTMLElement {
  const el = q(testID);
  if (!el) throw new Error(`testID "${testID}" not rendered`);
  return el;
}

/** Click like a mouse user (react-native-web Pressable handles click -> onPress). */
export function press(testID: string) {
  const el = mustGet(testID);
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

/** Types into a react-native-web TextInput (<input>) and fires React's change events. */
export function typeInto(testID: string, text: string) {
  const el = mustGet(testID) as HTMLInputElement;
  const input = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : el.querySelector('input,textarea')) as HTMLInputElement;
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function textOf(testID: string): string {
  return mustGet(testID).textContent || '';
}

/** A crud object whose every command is a jest.fn (plus the few plain values the UI reads). */
export function fakeCrud(): any {
  const target: Record<string, any> = { isUndoing: false };
  return new Proxy(target, {
    get: (t, k: string) => {
      if (!(k in t)) t[k] = jest.fn();
      return t[k];
    },
  });
}

/** Toggles a react-native-web Switch (clicks its checkbox input). */
export function toggleSwitch(testID: string) {
  const el = mustGet(testID);
  const input = (el.tagName === 'INPUT' ? el : el.querySelector('input')) as HTMLInputElement;
  act(() => {
    input.click();
  });
}

/** Key press on a TextInput (e.g. 'Enter' -> onSubmitEditing, 'Escape'). */
export function pressKey(testID: string, key: string) {
  const el = mustGet(testID);
  const input = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : el.querySelector('input,textarea')) as HTMLElement;
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

export function inputValue(testID: string): string {
  const el = mustGet(testID) as HTMLInputElement;
  const input = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : el.querySelector('input,textarea')) as HTMLInputElement;
  return input.value;
}

/** Order check: every id of `ids` is rendered and appears in the DOM in this order. */
export function expectInOrder(ids: string[]) {
  const all = Array.from(document.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid'));
  const positions = ids.map((id) => {
    const i = all.indexOf(id);
    if (i < 0) throw new Error(`testID "${id}" not rendered`);
    return i;
  });
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] <= positions[i - 1]) throw new Error(`"${ids[i]}" should come after "${ids[i - 1]}"`);
  }
}

/** web mouse hover (React onMouseEnter listens to mouseover). */
export function hover(testID: string) {
  const el = mustGet(testID);
  act(() => {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
  });
}

/** let real timers run (debounces) inside act. */
export async function wait(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

export const OWNER = '11111111-1111-4111-8111-111111111111';

/**
 * Fills the real Zustand store with the demo (Project 1 + Project 2), selects Project 1
 * and hydrates it - exactly what the dashboard does after loading.
 */
export function seedStore() {
  const { usePMStore } = require('../../../kit8/pm/store');
  const { buildDemoData } = require('../../../kit8/pm/seedDemo');
  let n = 0;
  const guid = () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  };
  const demo = buildDemoData(OWNER, Date.UTC(2026, 8, 28), guid, null);
  const s = usePMStore.getState();
  act(() => {
    s.selectProject(null);
    s.setRecentProjects([]);
    s.setProjects(demo.projects);
    usePMStore.getState().selectProject(demo.projects[0].rowGUID);
    usePMStore.getState().hydrate(demo.projects[0].rowGUID, demo.tasks.filter((t: any) => t.projectGUID === demo.projects[0].rowGUID), demo.deps.filter((d: any) => d.projectGUID === demo.projects[0].rowGUID));
  });
  const byName = (name: string) => demo.tasks.find((t: any) => t.rowJSON.name === name)!;
  return { demo, byName, store: usePMStore };
}

// react-native-web warns about deprecated shadow* styles - noise for these tests
const origWarn = console.warn;
jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('style props are deprecated')) return;
  origWarn(...args);
});
