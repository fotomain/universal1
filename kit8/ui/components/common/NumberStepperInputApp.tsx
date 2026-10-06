// NumberStepperInputApp - whole-number field = TextInputApp with
//   * a close (clear) button INSIDE the input at the LEFT
//   * increase ▲ / decrease ▼ arrows INSIDE the input at the RIGHT (step, min, max; hold = repeat)
//
//   [ ✕  12                         ▲▼ ]
//
// The value is the text of the field (digits only), like TextInputApp. Works in paper, tamagui, ant, expo and
// native (googlemd3web draws its own web input: plain field without the buttons).
// testIDs: `testID` = the input · `${testID}-clear` · `${testID}-increase` · `${testID}-decrease`.

import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from './IconApp';
import TextInputApp, { TextInputAppProps } from './TextInputApp';

/** room one field needs to look good: clear button + 3 digits + arrows + paddings */
export const NUMBER_STEPPER_MIN_WIDTH = 150;

export interface NumberStepperInputAppProps extends Omit<TextInputAppProps, 'left' | 'right' | 'leftIcon' | 'rightIcon' | 'keyboardType' | 'onChangeText' | 'value'> {
  value?: string;
  onChangeText?: (text: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** most digits the field accepts */
  maxDigits?: number;
  /** value the arrows start from when the field is empty (default: min ?? 0) */
  emptyValue?: number;
  clearLabel?: string;
  increaseLabel?: string;
  decreaseLabel?: string;
  testID?: string;
}

/** The next value of an arrow press (pure). */
export function stepNumberText(text: string, delta: number, opts: { min?: number; max?: number; emptyValue?: number } = {}): string {
  const lo = opts.min ?? Number.NEGATIVE_INFINITY;
  const hi = opts.max ?? Number.POSITIVE_INFINITY;
  const parsed = parseInt(text, 10);
  const next = Number.isFinite(parsed) ? parsed + delta : opts.emptyValue ?? (Number.isFinite(lo) ? lo : 0);
  return String(Math.min(hi, Math.max(lo, next)));
}

export const NumberStepperInputApp: React.FC<NumberStepperInputAppProps> = ({
  value = '',
  onChangeText,
  min = 0,
  max,
  step = 1,
  maxDigits,
  emptyValue,
  disabled = false,
  clearLabel = 'Clear',
  increaseLabel = 'Increase',
  decreaseLabel = 'Decrease',
  testID = 'number-stepper-input-app',
  ...rest
}) => {
  const { activeSystem, themeColors } = useDesignSystem();
  const text = typeof value === 'string' ? value : '';
  // the newest value / callback for the "hold to repeat" timer
  const live = useRef({ text, onChangeText });
  live.current = { text, onChangeText };
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const change = (t: string) => {
    let clean = t.replace(/[^0-9]/g, '');
    if (maxDigits) clean = clean.slice(0, maxDigits);
    onChangeText?.(clean);
  };
  const bump = (delta: number) => {
    const next = stepNumberText(live.current.text, delta, { min, max, emptyValue });
    if (next !== live.current.text) live.current.onChangeText?.(next);
  };
  const hold = (delta: number) => {
    stop();
    timer.current = setInterval(() => bump(delta), 90);
  };
  const n = parseInt(text, 10);
  const canUp = !disabled && !(Number.isFinite(n) && max !== undefined && n >= max);
  const canDown = !disabled && !(Number.isFinite(n) && n <= min);
  const muted = `${themeColors.text}99`;
  // web: the buttons must not take the focus (and the caret) out of the input
  const keepFocus = Platform.OS === 'web' ? ({ onMouseDown: (e: any) => e?.preventDefault?.() } as any) : {};

  const arrow = (dir: 1 | -1, enabled: boolean) => (
    <Pressable
      testID={`${testID}-${dir > 0 ? 'increase' : 'decrease'}`}
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? increaseLabel : decreaseLabel}
      accessibilityState={{ disabled: !enabled }}
      aria-disabled={!enabled || undefined}
      disabled={!enabled}
      onPress={() => bump(dir * step)}
      onLongPress={() => hold(dir * step)}
      delayLongPress={350}
      onPressOut={stop}
      hitSlop={{ left: 8, right: 8, top: dir > 0 ? 6 : 0, bottom: dir > 0 ? 0 : 6 }}
      style={({ hovered, pressed }: any) => ({
        width: 24,
        height: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        opacity: enabled ? 1 : 0.3,
        backgroundColor: hovered || pressed ? `${themeColors.primary}22` : 'transparent',
      })}
      {...keepFocus}
    >
      <IconApp name={dir > 0 ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={18} color={enabled ? themeColors.primary : muted} />
    </Pressable>
  );
  const arrows = (
    <View testID={`${testID}-arrows`} style={{ marginLeft: 6, justifyContent: 'center' }}>
      {arrow(1, canUp)}
      {arrow(-1, canDown)}
    </View>
  );
  const canClear = !disabled && text.length > 0;
  const clear = (
    <Pressable
      testID={`${testID}-clear`}
      accessibilityRole="button"
      accessibilityLabel={clearLabel}
      accessibilityState={{ disabled: !canClear }}
      aria-disabled={!canClear || undefined}
      disabled={!canClear}
      onPress={() => onChangeText?.('')}
      hitSlop={8}
      style={{ marginRight: 8, justifyContent: 'center', opacity: canClear ? 1 : 0.3 }}
      {...keepFocus}
    >
      <IconApp name="close" size={18} color={muted} />
    </Pressable>
  );

  const paper = activeSystem === 'paper';
  return (
    <TextInputApp
      {...(rest as any)}
      testID={testID}
      value={text}
      onChangeText={change}
      disabled={disabled}
      keyboardType="numeric"
      hideClearIcon
      // paper accepts only its own adornments: an Icon that clears, and an Icon slot that carries the arrows
      left={paper ? <PaperTextInput.Icon testID={`${testID}-clear`} icon="close" disabled={!canClear} onPress={() => onChangeText?.('')} forceTextInputFocus={false} accessibilityLabel={clearLabel} /> : clear}
      right={paper ? <PaperTextInput.Icon icon={() => arrows} forceTextInputFocus={false} /> : arrows}
    />
  );
};

export default NumberStepperInputApp;
