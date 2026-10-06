// AppleDatePicker (web): a styled <input type="date | time | datetime-local"> - the browser's own picker.
import React, { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppleMacUI } from '../WithAppleMacUI';
import { AppleDatePickerProps, clampDate, fromInputValue, toInputValue } from './appleDatePickerShared';

export type { AppleDatePickerProps, AppleDatePickerMode } from './appleDatePickerShared';

export const AppleDatePicker = memo(function AppleDatePicker({ value, onChange, mode = 'date', min, max, label, disabled = false, style, testID }: AppleDatePickerProps) {
  const { theme, text } = useAppleMacUI();
  const [focused, setFocused] = useState(false);
  const c = theme.colors;
  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { width: '100%', marginBottom: theme.space[3] },
        label: { ...text('subhead'), color: c.secondaryLabel, marginBottom: theme.space[1] + 2, marginLeft: theme.space[1] },
      }),
    [theme, text, c]
  );
  const body = text('body');
  const inputStyle: React.CSSProperties = {
    minHeight: theme.size.touchTarget,
    boxSizing: 'border-box',
    padding: `0 ${theme.space[3]}px`,
    borderRadius: theme.radii.input,
    border: `1px solid ${focused ? theme.tint : 'transparent'}`,
    boxShadow: focused ? `0 0 0 ${theme.focusRing.width}px ${theme.focusRing.color}` : 'none',
    // room for the focus ring inside a clipping scroll view
    margin: theme.focusRing.width,
    width: `calc(100% - ${2 * theme.focusRing.width}px)`,
    backgroundColor: c.tertiaryFill,
    color: c.label,
    fontFamily: body.fontFamily,
    fontSize: body.fontSize,
    outline: 'none',
    colorScheme: theme.dark ? 'dark' : 'light',
    accentColor: theme.tint,
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <View style={[s.root, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <input
        data-testid={testID}
        aria-label={label}
        type={mode === 'datetime' ? 'datetime-local' : mode}
        value={toInputValue(value, mode)}
        min={min ? toInputValue(min, mode) : undefined}
        max={max ? toInputValue(max, mode) : undefined}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const d = fromInputValue(e.target.value, mode, value);
          if (d) onChange(mode === 'time' ? d : clampDate(d, min, max));
        }}
        style={inputStyle}
      />
    </View>
  );
});

export default AppleDatePicker;
