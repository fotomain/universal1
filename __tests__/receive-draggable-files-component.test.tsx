/** @jest-environment jsdom */
import React from 'react';
import { cleanupUI, q, renderUI } from './pm/ui/pmUiTestKit';
import { ReceiveDraggableFilesComponent } from '../kit8/components/common/ReceiveDraggableFilesComponent';
import { PM_EXPORT_BUTTON_WIDTH } from '../kit8/pm/model/constants';

jest.mock('expo-drag-drop-content-view', () => {
  const { View } = require('react-native');
  return {
    DragDropContentView: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
  };
});

afterEach(() => {
  cleanupUI();
});

describe('ReceiveDraggableFilesComponent pickButton sizing', () => {
  it('renders pickButton with fixed width when pickButtonWidth is passed', () => {
    renderUI(
      <ReceiveDraggableFilesComponent
        folderName="Test"
        compact={true}
        pickable={true}
        pickLabel="Choose file…"
        pickButtonWidth={PM_EXPORT_BUTTON_WIDTH}
        testID="test-drop"
        onFilesDropped={jest.fn()}
      />
    );

    const button = q('test-drop-pick');
    expect(button).not.toBeNull();
    // In web, width style will be set to `${PM_EXPORT_BUTTON_WIDTH}px`
    expect(button?.style.width).toBe(`${PM_EXPORT_BUTTON_WIDTH}px`);
  });
});
