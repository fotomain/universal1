// NumberInputApp - numeric input with stepper arrows to increase and decrease (step = 1 by default).
// Matches the active design system aesthetics with label, validation, and focus states.

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardTypeOptions,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from './IconApp';

export interface NumberInputAppProps {
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  value?: string | number;
  onChangeText?: (text: string) => void;
  onChangeValue?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  editable?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
  selectTextOnFocus?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  helperText?: string;
  error?: boolean | string;
  compact?: boolean;
}

export const NumberInputApp: React.FC<NumberInputAppProps> = ({
  label,
  labelStyle,
  value = '',
  onChangeText,
  onChangeValue,
  step = 1,
  min,
  max,
  disabled = false,
  editable = true,
  placeholder,
  style,
  inputStyle,
  testID = 'number-input-app',
  selectTextOnFocus = false,
  keyboardType = 'number-pad',
  onSubmitEditing,
  autoFocus = false,
  helperText,
  error,
  compact = false,
}) => {
  const { themeColors, isDark } = useDesignSystem();
  const [focused, setFocused] = useState(false);

  const isEditable = !disabled && editable;
  const strValue = value === undefined || value === null ? '' : String(value);

  const numValue = useMemo(() => {
    if (strValue.trim() === '') return null;
    const n = parseFloat(strValue);
    return isNaN(n) ? null : n;
  }, [strValue]);

  const canInc = isEditable && (max === undefined || (numValue !== null ? numValue < max : true));
  const canDec = isEditable && (min === undefined || (numValue !== null ? numValue > min : true));

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      if (!isEditable) return;
      const current = numValue !== null ? numValue : min !== undefined ? min : 0;
      let next = current + direction * step;
      // round to avoid floating precision issues like 0.1 + 0.2
      next = Math.round(next * 1e6) / 1e6;
      if (max !== undefined && next > max) next = max;
      if (min !== undefined && next < min) next = min;

      const nextStr = String(next);
      onChangeText?.(nextStr);
      onChangeValue?.(next);
    },
    [isEditable, numValue, min, max, step, onChangeText, onChangeValue]
  );

  const handleTextChange = useCallback(
    (t: string) => {
      onChangeText?.(t);
      const parsed = parseFloat(t);
      if (!isNaN(parsed)) {
        onChangeValue?.(parsed);
      }
    },
    [onChangeText, onChangeValue]
  );

  const hasError = Boolean(error);
  const errorText = typeof error === 'string' ? error : '';
  const height = compact ? 36 : 42;

  // On web, prevent blur when clicking arrow buttons
  const keepFocus = Platform.OS === 'web' ? ({ onMouseDown: (e: any) => e?.preventDefault?.() } as any) : {};

  return (
    <View style={[{ width: '100%' }, style]}>
      {!!label && (
        <Text
          style={[
            styles.defaultLabel,
            { color: themeColors.text },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.container,
          {
            height,
            backgroundColor: themeColors.surface,
            borderColor: hasError
              ? themeColors.error
              : focused
              ? themeColors.primary
              : themeColors.border,
            borderWidth: focused ? 1.5 : 1,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <TextInput
          testID={testID}
          value={strValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
          editable={isEditable}
          keyboardType={keyboardType}
          selectTextOnFocus={selectTextOnFocus}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: themeColors.text,
              fontSize: compact ? 13 : 14,
            },
            inputStyle,
          ]}
        />

        <View
          style={[
            styles.arrowsColumn,
            {
              borderLeftColor: themeColors.border,
            },
          ]}
        >
          {/* Increase arrow (Up) */}
          <Pressable
            testID={`${testID}-inc`}
            accessibilityRole="button"
            accessibilityLabel="Increase"
            disabled={!canInc}
            onPress={() => handleStep(1)}
            style={({ pressed, hovered }: any) => [
              styles.arrowBtn,
              styles.arrowBtnUp,
              (pressed || hovered) && canInc && { backgroundColor: `${themeColors.primary}22` },
              !canInc && styles.arrowDisabled,
            ]}
            {...keepFocus}
          >
            <IconApp
              name="keyboard_arrow_up"
              size={14}
              color={canInc ? themeColors.text : isDark ? '#52525b' : '#cbd5e1'}
            />
          </Pressable>

          <View style={[styles.arrowDivider, { backgroundColor: themeColors.border }]} />

          {/* Decrease arrow (Down) */}
          <Pressable
            testID={`${testID}-dec`}
            accessibilityRole="button"
            accessibilityLabel="Decrease"
            disabled={!canDec}
            onPress={() => handleStep(-1)}
            style={({ pressed, hovered }: any) => [
              styles.arrowBtn,
              styles.arrowBtnDown,
              (pressed || hovered) && canDec && { backgroundColor: `${themeColors.primary}22` },
              !canDec && styles.arrowDisabled,
            ]}
            {...keepFocus}
          >
            <IconApp
              name="keyboard_arrow_down"
              size={14}
              color={canDec ? themeColors.text : isDark ? '#52525b' : '#cbd5e1'}
            />
          </Pressable>
        </View>
      </View>

      {(hasError && !!errorText) || helperText ? (
        <Text style={[styles.helper, { color: hasError ? themeColors.error : isDark ? '#71717a' : '#6b7280' }]}>
          {hasError && errorText ? errorText : helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  defaultLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  arrowsColumn: {
    width: 26,
    height: '100%',
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  arrowBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  arrowBtnUp: {
    borderTopRightRadius: 7,
  },
  arrowBtnDown: {
    borderBottomRightRadius: 7,
  },
  arrowDisabled: {
    opacity: 0.35,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
    }),
  },
  arrowDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  helper: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default NumberInputApp;
