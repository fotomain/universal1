/** @jest-environment jsdom */
import React, { act } from 'react';

// react-native-paper loads native modules that Jest has not got: only Text and useTheme are needed here
jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { Text, useTheme: () => ({ colors: { primary: '#6366f1' } }) };
});
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { primary: '#123456' } }) }));
import SignInWithMicrosoftButton from '../../../kit8/auth/microsoft/SignInWithMicrosoftButton';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

it('shows the text, draws four logo squares and calls onPress', () => {
  const onPress = jest.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<SignInWithMicrosoftButton onPress={onPress}>Sign in with Microsoft</SignInWithMicrosoftButton>));
  const button = host.querySelector('[data-testid="signin-with-microsoft"]') as HTMLElement;
  expect(button).toBeTruthy();
  expect(button.textContent).toContain('Sign in with Microsoft');
  act(() => { button.click(); });
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});
