// ReusableList - the ⠿ grip of an item. A PanResponder on the grip alone takes the touch (the list does not scroll while a finger is on it) and feeds the reorder controller.
// The same code runs on iOS, Android and the web (react-native-web: mouse + touch). The grip has no state: a recycled cell may show it for another row.
import React, { useRef } from 'react';
import { PanResponder, Platform, Text, View } from 'react-native';
import type { ReorderController } from './reorderController';

export const GRIP_WIDTH = 40;

export interface ReorderHandleProps {
  controller: ReorderController;
  guid: string;
  index: number;
  color: string;
  height: number;
  testID: string;
}

export default function ReorderHandle({ controller, guid, index, color, height, testID }: ReorderHandleProps) {
  // the PanResponder is made once; the row it belongs to is read from a ref (a recycled cell gets new props)
  const live = useRef({ controller, guid, index });
  live.current = { controller, guid, index };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e, g) => live.current.controller.start(live.current.guid, live.current.index, g.y0 || e.nativeEvent.pageY),
    onPanResponderMove: (_e, g) => live.current.controller.move(g.moveY),
    onPanResponderRelease: () => live.current.controller.end(),
    onPanResponderTerminate: () => live.current.controller.cancel(),
  })).current;
  return (
    <View testID={testID} accessibilityRole="button" accessibilityLabel="Drag to reorder" {...responder.panHandlers}
      style={[{ width: GRIP_WIDTH, height, alignItems: 'center', justifyContent: 'center' }, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null]}>
      <Text style={{ color, opacity: 0.6, fontSize: 20 }}>⠿</Text>
    </View>
  );
}
