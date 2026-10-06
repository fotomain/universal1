// ColorPickerApp: app-wide color selector built on reanimated-color-picker. The row itself is ColorPickerRowApp
// (drawn in the look of the active design system); this file keeps the original API.
//
//   [● Default] [quick swatches ...] [🎨 Custom #RRGGBB]
//
// - "Default" chip (only when `defaultColor` is given) -> onChange(null)
// - quick swatches (optional)                         -> onChange(swatch)
// - "Custom" chip opens a modal with the full picker (saturation/brightness panel, hue slider,
//   preview old -> new, swatches, HEX input). "Select" -> onChange('#RRGGBB'), "Cancel" / backdrop discard.
//
// Values are always upper-case '#RRGGBB' (no alpha). The picker itself is loaded lazily
// (colorpicker/ColorPickerAppModalContent) - only when the modal opens.

import React from 'react';
import ColorPickerRowApp, { normalizeHexColor } from './ColorPickerRowApp';

export { normalizeHexColor };

export interface ColorPickerAppColors {
  text: string;
  border: string;
  background: string;
  primary?: string;
}

export interface ColorPickerAppProps {
  /** current color ('#RRGGBB'); null / undefined = default */
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  /** color used when value is null; when given a "Default" chip is shown */
  defaultColor?: string;
  /** quick swatches shown in the row and inside the picker */
  swatches?: readonly string[];
  /** title of the picker window */
  title?: string;
  /** theme colors; default = the active design system colors */
  colors?: ColorPickerAppColors;
  testID: string;
}

export default function ColorPickerApp(props: ColorPickerAppProps) {
  return <ColorPickerRowApp {...props} />;
}
