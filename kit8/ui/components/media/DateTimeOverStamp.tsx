// The date and time text in a corner of a video box (the preview of the recorder, the player). It fills its parent
// (absolute), measures it and places the text by dateTimeOverLayout; touches pass through.
//   <DateTimeOverStamp position="bottomRight" text="2026-11-12 14:03:27" />     the player gives the text
//   <LiveDateTimeOverStamp position="topLeft" />                                 the recorder: the clock of now
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { RecordDateTimeOverPosition } from '../../../redux/recordVideoSettings';
import { dateTimeOverLayout, formatDateTimeOver } from './dateTimeOver';

export interface DateTimeOverStampProps {
  position: RecordDateTimeOverPosition;
  text: string;
  testID?: string;
}

export default function DateTimeOverStamp({ position, text, testID = 'date-time-over' }: DateTimeOverStampProps) {
  const [box, setBox] = useState({ width: 640, height: 360 });
  if (!text) return null;
  const l = dateTimeOverLayout(box.width, box.height, position);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.fill]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== box.width || height !== box.height)) setBox({ width, height });
      }}
    >
      <Text
        testID={testID}
        accessibilityLabel={`Date and time ${position}`}
        style={[
          styles.text,
          { fontSize: l.fontSize },
          l.right ? { right: l.marginX } : { left: l.marginX },
          l.bottom ? { bottom: l.marginY } : { top: l.marginY },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/** the clock of now, changing every second */
export function LiveDateTimeOverStamp({ position, testID }: { position: RecordDateTimeOverPosition; testID?: string }) {
  const [text, setText] = useState(() => formatDateTimeOver(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setText(formatDateTimeOver(new Date())), 250);
    return () => clearInterval(timer);
  }, []);
  return <DateTimeOverStamp position={position} text={text} testID={testID} />;
}

const styles = StyleSheet.create({
  fill: { zIndex: 2 },
  text: {
    position: 'absolute',
    color: '#fff',
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' }),
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
