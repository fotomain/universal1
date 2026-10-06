// Row of color swatches + a "Default" chip (null = default color) = ColorPickerRowApp limited to the given set
// (no custom colors: the progress lines only use PM_PROGRESS_LINE_SWATCHES).

import React from 'react';
import ColorPickerRowApp from '../../../../../components/common/ColorPickerRowApp';
import { PM_PROGRESS_LINE_SWATCHES } from './progressLineConstants';
import { pmT } from '../../../../i18n/pmT';

export { PM_PROGRESS_LINE_SWATCHES };

export default function PMColorSwatchPicker({
  value,
  onChange,
  swatches = PM_PROGRESS_LINE_SWATCHES,
  defaultColor,
  colors,
  testID,
}: {
  /** current color; null / undefined = default */
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  swatches?: string[];
  /** shown inside the "Default" chip */
  defaultColor: string;
  colors: { text: string; border: string; background: string };
  testID: string;
}) {
  return (
    <ColorPickerRowApp
      testID={testID}
      value={value}
      onChange={onChange}
      swatches={swatches}
      defaultColor={defaultColor}
      allowCustom={false}
      defaultLabel={pmT('Default')}
      colors={colors}
      // the set's own spelling of the color stays in the testID
      swatchTestID={(c) => `${testID}-${swatches.find((s) => s.toUpperCase() === (c || '').toUpperCase()) ?? c}`}
    />
  );
}
