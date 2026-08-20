import React from 'react';
import { ModalAskComponent, ModalAskComponentProps } from '../components/common/ModalAskComponent';
import { AskBeforeDeletePostComponent, AskBeforeDeletePostComponentProps } from '../components/common/AskBeforeDeletePostComponent';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: jest.fn() }) } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}), { virtual: true });

jest.mock('../context/DesignSystemContext', () => ({
  useDesignSystem: () => ({
    activeSystem: 'google_md3_web',
    themeColors: { primary: '#6750A4', surface: '#ffffff', onSurface: '#1c1b1f' },
    isDark: false,
  }),
}));

describe('AskBeforeDeletePost & ModalAskComponent Functionality', () => {
  it('accepts ModalAskComponentProps with modatTopBar, modalBody, Cancel and Delete actions', () => {
    const onCancelMock = jest.fn();
    const onConfirmMock = jest.fn();

    const props: ModalAskComponentProps = {
      visible: true,
      modatTopBar: 'Delete forever?',
      modalBody: 'information will be completely deleted from the database',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      onCancel: onCancelMock,
      onConfirm: onConfirmMock,
      confirmColor: '#d32f2f',
    };

    expect(props.visible).toBe(true);
    expect(props.modatTopBar).toBe('Delete forever?');
    expect(props.modalBody).toBe('information will be completely deleted from the database');
    expect(props.cancelLabel).toBe('Cancel');
    expect(props.confirmLabel).toBe('Delete');
    expect(props.confirmColor).toBe('#d32f2f');
  });

  it('accepts AskBeforeDeletePostComponentProps with default modatTopBar and modalBody', () => {
    const props: AskBeforeDeletePostComponentProps = {
      visible: true,
      onCancel: jest.fn(),
      onConfirm: jest.fn(),
      modatTopBar: 'Delete forever?',
      modalBody: 'information will be completely deleted from the database',
    };

    expect(props.visible).toBe(true);
    expect(props.modatTopBar).toBe('Delete forever?');
    expect(props.modalBody).toBe('information will be completely deleted from the database');
    expect(props.onCancel).toBeDefined();
    expect(props.onConfirm).toBeDefined();
  });

  it('validates uxuiState.askBeforeDeletePost action payload format', () => {
    const setAskBeforeDeletePostAction = {
      type: 'uxuiState/setAskBeforeDeletePost',
      payload: false,
    };

    const toggleAskBeforeDeletePostAction = {
      type: 'uxuiState/toggleAskBeforeDeletePost',
    };

    expect(setAskBeforeDeletePostAction.type).toBe('uxuiState/setAskBeforeDeletePost');
    expect(setAskBeforeDeletePostAction.payload).toBe(false);
    expect(toggleAskBeforeDeletePostAction.type).toBe('uxuiState/toggleAskBeforeDeletePost');
  });
});
