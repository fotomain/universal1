// Test kit for the media components (jsdom + react-native-web + react-dom). Import it FIRST in a test: its jest.mock calls
// must run before the components load. Mocks Paper, the common inputs / buttons, expo-router, expo-audio ... and gives
// small DOM helpers: render(<X/>)  q(testID)  press(testID)  text(testID)  flush()
import React, { act } from 'react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-paper', () => {
  const R = require('react');
  const RN = require('react-native');
  const Card: any = ({ children, testID }: any) => R.createElement(RN.View, { testID }, children);
  Card.Title = ({ title }: any) => R.createElement(RN.Text, null, title);
  Card.Content = ({ children }: any) => R.createElement(RN.View, null, children);
  const Text = ({ children, testID }: any) => R.createElement(RN.Text, { testID }, children);
  const IconButton = ({ icon, onPress, testID, disabled, accessibilityLabel }: any) =>
    R.createElement(RN.Pressable, { testID, accessibilityLabel, onPress: disabled ? undefined : onPress }, R.createElement(RN.Text, null, icon));
  const Icon = ({ source }: any) => R.createElement(RN.Text, null, source);
  const Surface = ({ children }: any) => R.createElement(RN.View, null, children);
  const ProgressBar = ({ progress }: any) => R.createElement(RN.View, { testID: 'progress', accessibilityValue: { now: progress } });
  const colors = new Proxy({}, { get: () => '#123456' });
  return { Card, Text, IconButton, Icon, Surface, ProgressBar, useTheme: () => ({ colors }) };
});

jest.mock('../../kit8/ui/components/common', () => {
  const R = require('react');
  const RN = require('react-native');
  const button = ({ children, onPress, disabled, testID }: any) =>
    R.createElement(RN.Pressable, { testID, onPress: disabled ? undefined : onPress, accessibilityState: { disabled: !!disabled } }, R.createElement(RN.Text, null, children));
  const TextInputApp = ({ value, onChangeText, testID }: any) => R.createElement(RN.TextInput, { testID, value, onChangeText });
  const SwitchApp = ({ value, onValueChange, disabled, label, testID }: any) =>
    R.createElement(RN.Pressable, { testID, onPress: disabled ? undefined : () => onValueChange(!value) }, R.createElement(RN.Text, null, `${label}|${value}`));
  return { ButtonPrimaryApp: button, ButtonSecondaryApp: button, TextInputApp, SwitchApp, showErrorModal: (globalThis as any).__showError = jest.fn() };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (globalThis as any).__push, replace: jest.fn() }),
  useLocalSearchParams: () => (globalThis as any).__params || {},
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(() => cb(), []),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...a: any[]) => (globalThis as any).__pick(...a) }));

(globalThis as any).__push = jest.fn();
(globalThis as any).__pick = jest.fn();

const { createRoot } = require('react-dom/client');
let root: any;

export const q = (testID: string): HTMLElement | null => document.querySelector(`[data-testid="${testID}"]`);
export const text = (testID: string): string => q(testID)?.textContent ?? '';
export const press = (testID: string) => act(() => { (q(testID) as any).click(); });
export const pressAsync = (testID: string) => act(async () => { (q(testID) as any).click(); });
export const flush = () => act(async () => { await Promise.resolve(); });

export function render(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(element));
}

export function cleanup() {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
}
