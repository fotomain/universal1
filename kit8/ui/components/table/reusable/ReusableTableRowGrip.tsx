// ReusableTable - the ⠿ grip of a row on iOS / Android: touch it and drag the row up or down (the web table has its own drag and drop body).
//   The grip owns the gesture (the table / the page below does not scroll while it is held); the row follows the finger (the table moves it by
//   `dy`), on release the table drops it where the finger is (tableRows.rowDropIndex -> crud.moveTo).
import React, { useRef } from 'react';
import { PanResponder, Text, View } from 'react-native';

export interface ReusableTableRowGripProps {
  testID: string;
  color: string;
  /** false: the table is searched / filtered / sorted - the order on the screen is not the order of the rows */
  enabled: boolean;
  onStart: () => void;
  /** the finger moved: dy px from where it started */
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
  onCancel: () => void;
}

export default function ReusableTableRowGrip({ testID, color, enabled, onStart, onMove, onEnd, onCancel }: ReusableTableRowGripProps) {
  // the responder is made once: it must call the newest callbacks
  const cb = useRef({ enabled, onStart, onMove, onEnd, onCancel });
  cb.current = { enabled, onStart, onMove, onEnd, onCancel };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => cb.current.enabled,
      onMoveShouldSetPanResponder: () => cb.current.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => cb.current.onStart(),
      onPanResponderMove: (_e, g) => cb.current.onMove(g.dy),
      onPanResponderRelease: (_e, g) => cb.current.onEnd(g.dy),
      onPanResponderTerminate: () => cb.current.onCancel(),
    }),
  ).current;
  return (
    <View testID={testID} accessibilityLabel="Drag the row up or down" {...pan.panHandlers}
      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.35 }}>
      <Text style={{ color, opacity: 0.8, fontSize: 18 }}>⠿</Text>
    </View>
  );
}
