// AppleTextField - iOS text field (HIG: Text fields): label, placeholder, helper / error text, clear button,
// secure entry toggle, focus ring, keyboard types. variant "grouped" = a row of an inset grouped list
// (label at the left, value at the right of it, no own border).
import React, { forwardRef, memo, useMemo, useState } from 'react';
import { KeyboardTypeOptions, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import IconApp from '../../components/common/IconApp';
import { useAppleMacUI } from '../WithAppleMacUI';

export interface AppleTextFieldProps extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  /** true = error state, a string = error state + that message */
  error?: boolean | string;
  helperText?: string;
  disabled?: boolean;
  /** clear (x) button while there is text (default true) */
  clearButton?: boolean;
  /** password field with a show / hide toggle */
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  variant?: 'default' | 'grouped';
  /** custom element inside the field at the left / right (right replaces the clear button) */
  left?: React.ReactNode;
  right?: React.ReactNode;
  leftIcon?: string;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  clearLabel?: string;
}

export const AppleTextField = memo(
  forwardRef<TextInput, AppleTextFieldProps>(function AppleTextField(
    {
      label,
      value = '',
      onChangeText,
      placeholder,
      error,
      helperText,
      disabled = false,
      clearButton = true,
      secureTextEntry = false,
      keyboardType,
      variant = 'default',
      left,
      right,
      leftIcon,
      multiline = false,
      style,
      testID,
      clearLabel = 'Clear text',
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) {
    const { theme, text } = useAppleMacUI();
    const [focused, setFocused] = useState(false);
    const [reveal, setReveal] = useState(false);
    const hasError = !!error;
    const message = typeof error === 'string' && error ? error : helperText;
    const grouped = variant === 'grouped';

    const s = useMemo(() => {
      const c = theme.colors;
      return StyleSheet.create({
        root: { width: '100%', marginBottom: grouped ? 0 : theme.space[3] },
        label: { ...text('subhead'), color: c.secondaryLabel, marginBottom: theme.space[1] + 2, marginLeft: theme.space[1] },
        groupedLabel: { ...text('body'), color: c.label, minWidth: 96, marginRight: theme.space[3] },
        box: {
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: theme.size.touchTarget,
          paddingHorizontal: grouped ? theme.space[4] : theme.space[3],
          paddingVertical: multiline ? theme.space[2] + 2 : 0,
          borderRadius: grouped ? 0 : theme.radii.input,
          backgroundColor: grouped ? 'transparent' : c.tertiaryFill,
          borderWidth: grouped ? 0 : 1,
          borderColor: hasError ? c.systemRed : 'transparent',
          opacity: disabled ? 0.5 : 1,
          ...(Platform.OS === 'web' && !grouped ? { marginHorizontal: theme.focusRing.width, marginVertical: theme.focusRing.width } : null),
        },
        // focus ring: tint border + soft outer ring (web shadow). The field is inset by the ring's width (ringRoom), so
        // the whole ring is visible inside a scroll view / dialog that clips its content.
        focused: grouped
          ? {}
          : ({ borderColor: hasError ? c.systemRed : theme.tint, ...(Platform.OS === 'web' ? { boxShadow: `0 0 0 ${theme.focusRing.width}px ${theme.focusRing.color}` } : null) } as any),
        input: { ...text('body'), flex: 1, minWidth: 0, color: c.label, paddingVertical: 0, minHeight: multiline ? 66 : undefined, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null) },
        adornLeft: { marginRight: theme.space[2] },
        adornRight: { marginLeft: theme.space[2], minWidth: 22, minHeight: theme.size.touchTarget, alignItems: 'center', justifyContent: 'center' },
        message: { ...text('footnote'), color: hasError ? c.systemRed : c.secondaryLabel, marginTop: theme.space[1], marginLeft: theme.space[1] },
      });
    }, [theme, text, grouped, multiline, hasError, disabled]);
    const c = theme.colors;
    const showClear = clearButton && right === undefined && !disabled && value.length > 0 && !secureTextEntry;

    return (
      <View style={[s.root, style]}>
        {!!label && !grouped && (
          <Text style={s.label} allowFontScaling>
            {label}
          </Text>
        )}
        <View style={[s.box, focused && s.focused]}>
          {!!label && grouped && (
            <Text style={s.groupedLabel} numberOfLines={1} allowFontScaling>
              {label}
            </Text>
          )}
          {left !== undefined ? left : leftIcon ? <IconApp name={leftIcon} size={18} color={c.secondaryLabel} style={s.adornLeft} /> : null}
          <TextInput
            ref={ref}
            testID={testID}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={c.placeholderText}
            editable={!disabled}
            secureTextEntry={secureTextEntry && !reveal}
            keyboardType={keyboardType}
            multiline={multiline}
            allowFontScaling
            accessibilityLabel={label || placeholder}
            accessibilityState={{ disabled }}
            aria-invalid={hasError || undefined}
            selectionColor={theme.tint}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={s.input}
            {...rest}
          />
          {right !== undefined ? right : null}
          {showClear && (
            <Pressable testID={testID ? `${testID}-clear` : undefined} accessibilityRole="button" accessibilityLabel={clearLabel} onPress={() => onChangeText?.('')} hitSlop={theme.space[3]} style={s.adornRight}>
              <IconApp name="cancel" size={18} color={c.systemGray2} />
            </Pressable>
          )}
          {secureTextEntry && right === undefined && (
            <Pressable
              testID={testID ? `${testID}-reveal` : undefined}
              accessibilityRole="button"
              accessibilityLabel={reveal ? 'Hide text' : 'Show text'}
              accessibilityState={{ selected: reveal }}
              aria-pressed={reveal}
              onPress={() => setReveal((v) => !v)}
              hitSlop={theme.space[3]}
              style={s.adornRight}
            >
              <IconApp name={reveal ? 'visibility_off' : 'visibility'} size={20} color={c.secondaryLabel} />
            </Pressable>
          )}
        </View>
        {!!message && (
          <Text testID={testID ? `${testID}-message` : undefined} style={s.message} accessibilityLiveRegion={hasError ? 'polite' : 'none'} allowFontScaling>
            {message}
          </Text>
        )}
      </View>
    );
  })
);

export default AppleTextField;
