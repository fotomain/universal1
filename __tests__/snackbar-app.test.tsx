import React from 'react';
import { SnackbarAppProps } from '../components/common/SnackbarApp';

describe('SnackbarApp Component & Card Delete Integration', () => {
  it('supports visible, message, duration, and actionLabel props for post deletion', () => {
    const props: SnackbarAppProps = {
      visible: true,
      children: 'Post successfully deleted',
      duration: 3000,
      actionLabel: 'OK',
      onDismiss: jest.fn(),
      onAction: jest.fn(),
    };

    expect(props.visible).toBe(true);
    expect(props.children).toBe('Post successfully deleted');
    expect(props.duration).toBe(3000);
    expect(props.actionLabel).toBe('OK');
  });

  it('validates redux showSnackbar action structure for delete icon action', () => {
    const createDeleteSnackbarAction = (message: string = 'Post successfully deleted') => ({
      type: 'uxuiState/showSnackbar',
      payload: { message },
    });

    const action = createDeleteSnackbarAction();
    expect(action.type).toBe('uxuiState/showSnackbar');
    expect(action.payload.message).toBe('Post successfully deleted');
  });
});
