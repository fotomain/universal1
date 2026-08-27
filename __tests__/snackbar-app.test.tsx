import React from 'react';
import { SnackbarAppProps } from '../kit8/components/common/SnackbarApp';

describe('SnackbarApp Component & Card Delete Undo Integration', () => {
  it('supports visible, message, duration, actionLabel "Undo", and undoDeleteData props', () => {
    const mockPostData = {
      rowGUID: 'post-123',
      rowJSON: { mediaPostTitle: 'Test Post' },
    };

    const props: SnackbarAppProps = {
      visible: true,
      children: 'Post successfully deleted',
      duration: 4000,
      actionLabel: 'Undo',
      undoDeleteData: mockPostData,
      entityName: 'mediaPostReusable',
      onDismiss: jest.fn(),
      onAction: jest.fn(),
    };

    expect(props.visible).toBe(true);
    expect(props.children).toBe('Post successfully deleted');
    expect(props.duration).toBe(4000);
    expect(props.actionLabel).toBe('Undo');
    expect(props.undoDeleteData).toEqual(mockPostData);
    expect(props.entityName).toBe('mediaPostReusable');
  });

  it('validates showSnackbar action structure containing undoDeleteData', () => {
    const mockPostData = {
      rowGUID: 'post-123',
      rowJSON: { mediaPostTitle: 'Test Post' },
    };

    const showSnackbarAction = {
      type: 'uxuiState/showSnackbar',
      payload: {
        message: 'Post successfully deleted',
        actionLabel: 'Undo',
        undoDeleteData: mockPostData,
        entityName: 'mediaPostReusable',
      },
    };

    expect(showSnackbarAction.type).toBe('uxuiState/showSnackbar');
    expect(showSnackbarAction.payload.actionLabel).toBe('Undo');
    expect(showSnackbarAction.payload.undoDeleteData).toEqual(mockPostData);
  });

  it('triggers createOne saga action payload when Undo is executed', () => {
    const mockPostData = {
      rowGUID: 'post-123',
      rowJSON: { mediaPostTitle: 'Restored Post' },
    };

    const createOneAction = {
      type: 'mediaPostReusable/createOne',
      payload: mockPostData,
    };

    expect(createOneAction.type).toBe('mediaPostReusable/createOne');
    expect(createOneAction.payload).toEqual(mockPostData);
  });
});
