// A view that zooms by a two finger pinch (iOS / Android / touch screens of the web): the zoom of the start of the pinch × the spread of
// the fingers. Plain touch events (no gesture handler), so it works under the camera preview and in tests.
import React, { useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { pinchZoom, touchDistance, ZoomRange } from './cameraZoom';

export interface PinchZoomViewProps {
  zoom: number;
  range: ZoomRange;
  onZoom: (zoom: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

export default function PinchZoomView({ zoom, range, onZoom, disabled, style, children, testID }: PinchZoomViewProps) {
  const start = useRef<{ distance: number; zoom: number } | null>(null);
  const zoomNow = useRef(zoom);
  zoomNow.current = zoom;

  const onTouch = (e: any) => {
    if (disabled) return;
    const distance = touchDistance(e?.nativeEvent?.touches);
    if (distance <= 0) {
      start.current = null;
      return;
    }
    if (!start.current) {
      start.current = { distance, zoom: zoomNow.current };
      return;
    }
    onZoom(pinchZoom(start.current.zoom, distance / start.current.distance, range));
  };

  return (
    <View style={style} onTouchStart={onTouch} onTouchMove={onTouch} onTouchEnd={onTouch} onTouchCancel={() => { start.current = null; }} testID={testID}>
      {children}
    </View>
  );
}
