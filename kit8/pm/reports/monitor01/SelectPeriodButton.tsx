// SelectPeriodButton - the icon button after the Finish date filter (Monitor01Filters.tsx): opens SelectPeriodModal and writes BOTH startDate and
// finishDate at once (a whole month range), as an alternative to typing / picking the two dates one at a time.
import React, { useState } from 'react';
import { View } from 'react-native';
import { PMIconButton } from '../../inner/buttons';
import { pmT } from '../../i18n/pmT';
import SelectPeriodModal from './SelectPeriodModal';

export interface SelectPeriodButtonProps {
  value: { startDate: string; finishDate: string };
  onApply: (next: { startDate: string; finishDate: string }) => void;
  color: string;
  testID?: string;
}

export default function SelectPeriodButton({ value, onApply, color, testID = 'monitor01-filters-period' }: SelectPeriodButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <PMIconButton testID={`${testID}-button`} icon="date_range" title={pmT('Select period (a range of months)')} color={color} onPress={() => setOpen(true)} />
      <SelectPeriodModal testID={`${testID}-modal`} visible={open} value={value} onApply={onApply} onClose={() => setOpen(false)} />
    </View>
  );
}
