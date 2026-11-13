import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export interface RecordMenuIconProps {
  size?: number;
  /** one colour only (black and white by design): the icon follows the text / active colour of the menu row */
  color?: string;
}

/**
 * Icon of the "Record" menu item (video + audio recording): a video camera with a microphone inside it.
 * Outline icon on a 24 x 24 grid (rounded strokes, no fill, no background tile), drawn with the colour of the menu row,
 * so it works on light and dark themes. The camera is the frame (body + lens cone), the microphone has a thinner stroke.
 * WIDTH: the drawing (with the strokes) spans x 3 - 21, the same as the Material camera / home icons of the other rows,
 * so it is not wider than its neighbours in the menu column (it was 1 - 22.5 before).
 */
export default function RecordMenuIcon({ size = 20, color = '#000000' }: RecordMenuIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      testID="record-menu-icon"
    >
      {/* camera: body + lens cone */}
      <Rect x={3.9} y={5.9} width={11.2} height={12.2} rx={2.4} strokeWidth={1.75} />
      <Path d="M15.1 9.5L20.1 7V17L15.1 14.5" strokeWidth={1.75} />
      {/* microphone: capsule, holder, stem, base */}
      <Rect x={8.2} y={8.3} width={2.6} height={4.5} rx={1.3} strokeWidth={1.4} />
      <Path d="M6.75 11.2A2.75 2.75 0 0 0 12.25 11.2" strokeWidth={1.4} />
      <Path d="M9.5 13.95V15.7" strokeWidth={1.4} />
      <Path d="M7.7 15.7H11.3" strokeWidth={1.4} />
    </Svg>
  );
}
