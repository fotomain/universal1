// DateInputApp - date input that looks like TextInputApp in the active design system:
//
//   [ 📅  2026-10-06                              ✕ ]
//
//   * calendar icon INSIDE the input area at the left  -> opens DatePickerModal (react-native-paper-dates)
//   * close (clear) icon INSIDE the input area at the right (only when the field has text)
//   * the text stays editable: the user can type the date or pick it
//
// The value is the TEXT of the field. `parse` / `format` convert it to / from the calendar's Date
// (local year / month / day); the defaults read YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY and write YYYY-MM-DD.
//
//   <DateInputApp testID="start" value={text} onChangeText={setText} />
//
// testIDs: `testID` = the text input · `${pickerTestID}-trigger` = calendar icon (pickerTestID defaults to
// `${testID}-datepicker`) · `${testID}-clear` = clear icon.

import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';
import { TextInput as PaperTextInput, HelperText as PaperHelperText } from 'react-native-paper';
import { DatePickerModal, registerTranslation, en } from 'react-native-paper-dates';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../IconApp';
import { defaultFormatDateInput, defaultParseDateInput } from './dateInputFormat';

try {
  registerTranslation('en', en);
} catch {
  // already registered
}

export interface DateInputAppProps {
  /** the text of the field */
  value?: string;
  onChangeText?: (text: string) => void;
  /** also called with the picked Date (local year / month / day), null after "clear" */
  onSelectDate?: (date: Date | null) => void;
  /** text -> Date shown by the calendar (null / undefined = not a date) */
  parse?: (text: string) => Date | null | undefined;
  /** picked Date -> text of the field */
  format?: (date: Date) => string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean | string;
  helperText?: string;
  /** no clear (x) icon */
  hideClearIcon?: boolean;
  /** calendar language (a locale registered with react-native-paper-dates; default 'en') */
  locale?: string;
  /** tip / accessibility label of the calendar icon and title of the calendar */
  pickerLabel?: string;
  clearLabel?: string;
  validRange?: { startDate?: Date; endDate?: Date };
  /** lower field (36 px) for dense dialogs */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  pickerTestID?: string;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}

interface Look {
  background: string;
  border: string;
  borderFocused: string;
  borderWidth: number;
  borderWidthFocused: number;
  radius: number;
  height: number;
  paddingH: number;
  fontSize: number;
  icon: string;
  placeholder: string;
  labelStyle: any;
  marginBottom: number;
}

export const DateInputApp: React.FC<DateInputAppProps> = ({
  value = '',
  onChangeText,
  onSelectDate,
  parse = defaultParseDateInput,
  format = defaultFormatDateInput,
  label,
  placeholder = 'YYYY-MM-DD',
  disabled = false,
  error,
  helperText,
  hideClearIcon = false,
  locale = 'en',
  pickerLabel = 'Select date',
  clearLabel = 'Clear',
  validRange,
  compact = false,
  style,
  testID = 'date-input-app',
  pickerTestID,
  onSubmitEditing,
  autoFocus,
}) => {
  const { activeSystem, themeColors, isDark, appleMacUITheme: apple } = useDesignSystem();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const text = typeof value === 'string' ? value : '';
  const hasError = Boolean(error);
  const errorText = typeof error === 'string' ? error : '';
  const showClear = text.length > 0 && !disabled && !hideClearIcon;
  const triggerID = `${pickerTestID || `${testID}-datepicker`}-trigger`;
  const clearID = `${testID}-clear`;

  const date = useMemo(() => {
    const d = text.trim() ? parse(text) : null;
    return d instanceof Date && !isNaN(d.getTime()) ? d : undefined;
  }, [text, parse]);

  const openPicker = useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);
  const clear = useCallback(() => {
    onChangeText?.('');
    onSelectDate?.(null);
  }, [onChangeText, onSelectDate]);
  const confirm = useCallback(
    (params: { date?: Date }) => {
      const picked = params?.date || date;
      setOpen(false);
      if (!picked) return;
      onChangeText?.(format(picked));
      onSelectDate?.(picked);
    },
    [date, format, onChangeText, onSelectDate]
  );
  // web: pressing an icon must not blur the input first (inline editors close on blur)
  const keepFocus = Platform.OS === 'web' ? ({ onMouseDown: (e: any) => e?.preventDefault?.() } as any) : {};

  const modal = (
    <DatePickerModal
      locale={locale}
      mode="single"
      visible={open}
      label={pickerLabel}
      onDismiss={() => setOpen(false)}
      date={date}
      onConfirm={confirm}
      onChange={(p: any) => {
        if (p?.date) confirm({ date: p.date });
      }}
      validRange={validRange}
    />
  );

  if (activeSystem === 'paper') {
    return (
      <View style={[{ marginBottom: 12, width: '100%' }, style]}>
        <PaperTextInput
          mode="outlined"
          dense={compact}
          testID={testID}
          label={label}
          value={text}
          onChangeText={onChangeText}
          placeholder={placeholder}
          disabled={disabled}
          error={hasError}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          left={<PaperTextInput.Icon testID={triggerID} icon="calendar" color={themeColors.primary} onPress={openPicker} forceTextInputFocus={false} accessibilityLabel={pickerLabel} />}
          right={showClear ? <PaperTextInput.Icon testID={clearID} icon="close" onPress={clear} forceTextInputFocus={false} accessibilityLabel={clearLabel} /> : undefined}
          outlineColor={themeColors.border}
          activeOutlineColor={themeColors.primary}
          style={{ backgroundColor: themeColors.surface }}
        />
        {(hasError && !!errorText) || helperText ? (
          <PaperHelperText type={hasError ? 'error' : 'info'} visible>
            {hasError && errorText ? errorText : helperText}
          </PaperHelperText>
        ) : null}
        {modal}
      </View>
    );
  }

  // the same boxes as TextInputApp draws in each design system
  const look: Look =
    activeSystem === 'applemacui'
      ? {
          background: apple.colors.tertiaryFill, border: 'transparent', borderFocused: apple.tint, borderWidth: 1, borderWidthFocused: 1,
          radius: apple.radii.input, height: apple.size.touchTarget, paddingH: apple.space[3], fontSize: apple.typography.body.fontSize, icon: apple.colors.systemGray2, placeholder: apple.colors.placeholderText, marginBottom: apple.space[3],
          labelStyle: { ...apple.typography.subhead, fontFamily: apple.fontFamily, color: apple.colors.secondaryLabel, marginBottom: 6, marginLeft: 4 },
        }
      : activeSystem === 'tamagui'
      ? {
          background: isDark ? '#1f2937' : '#f9fafb', border: '#e5e7eb', borderFocused: '#6366f1', borderWidth: 1, borderWidthFocused: 2,
          radius: 10, height: 42, paddingH: 14, fontSize: 15, icon: '#888', placeholder: isDark ? '#6b7280' : '#9ca3af', marginBottom: 14,
          labelStyle: { fontSize: 13, fontWeight: '600', color: themeColors.text, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
        }
      : activeSystem === 'ant'
      ? {
          background: disabled ? '#f5f5f5' : themeColors.surface, border: '#d9d9d9', borderFocused: themeColors.primary, borderWidth: 1, borderWidthFocused: 1,
          radius: 4, height: 38, paddingH: 11, fontSize: 14, icon: '#888', placeholder: '#bfbfbf', marginBottom: 14,
          labelStyle: { fontSize: 14, fontWeight: '500', color: themeColors.text, marginBottom: 4 },
        }
      : activeSystem === 'expo'
      ? {
          background: isDark ? '#1e293b' : '#f1f5f9', border: 'transparent', borderFocused: themeColors.primary, borderWidth: 1.5, borderWidthFocused: 1.5,
          radius: 20, height: 44, paddingH: 16, fontSize: 15, icon: '#64748b', placeholder: isDark ? '#64748b' : '#94a3b8', marginBottom: 14,
          labelStyle: { fontSize: 14, fontWeight: '700', color: themeColors.primary, marginBottom: 4 },
        }
      : activeSystem === 'googlemd3web'
      ? {
          background: 'transparent', border: isDark ? '#938f99' : '#79747e', borderFocused: themeColors.primary, borderWidth: 1, borderWidthFocused: 2,
          radius: 4, height: 48, paddingH: 12, fontSize: 16, icon: '#757575', placeholder: isDark ? '#938f99' : '#79747e', marginBottom: 12,
          labelStyle: { fontSize: 12, fontWeight: '500', color: themeColors.text, marginBottom: 4 },
        }
      : {
          background: themeColors.surface, border: themeColors.border, borderFocused: themeColors.primary, borderWidth: 1, borderWidthFocused: 1,
          radius: 6, height: 44, paddingH: 12, fontSize: 15, icon: '#888', placeholder: isDark ? '#71717a' : '#a1a1aa', marginBottom: 12,
          labelStyle: { fontSize: 14, fontWeight: '500', color: themeColors.text, marginBottom: 4 },
        };
  const height = compact ? 36 : look.height;
  const appleRing = activeSystem === 'applemacui' && Platform.OS === 'web';
  const iconColor = disabled ? look.placeholder : themeColors.primary;

  return (
    <View style={[{ marginBottom: look.marginBottom, width: '100%' }, style]}>
      {!!label && <Text style={look.labelStyle}>{label}</Text>}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height,
          backgroundColor: look.background,
          borderWidth: focused ? look.borderWidthFocused : look.borderWidth,
          borderColor: hasError ? themeColors.error : focused ? look.borderFocused : look.border,
          borderRadius: look.radius,
          paddingHorizontal: compact ? Math.min(10, look.paddingH) : look.paddingH,
          opacity: disabled ? 0.6 : 1,
          // AppleMacUI on web: the same focus ring as AppleTextField (tint border + soft outer ring); the field is
          // inset by the ring's width so the whole ring is visible inside a clipping scroll view / dialog
          ...(appleRing ? ({ marginHorizontal: apple.focusRing.width, marginVertical: apple.focusRing.width, boxShadow: focused ? `0 0 0 ${apple.focusRing.width}px ${apple.focusRing.color}` : undefined } as any) : null),
        }}
      >
        <Pressable
          testID={triggerID}
          onPress={openPicker}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={pickerLabel}
          style={{ marginRight: 8, justifyContent: 'center' }}
          {...keepFocus}
        >
          <IconApp name="calendar_today" size={18} color={iconColor} />
        </Pressable>
        <TextInput
          testID={testID}
          value={text}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={look.placeholder}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, minWidth: 0, height: '100%', fontSize: compact ? Math.min(14, look.fontSize) : look.fontSize, color: themeColors.text, outlineStyle: 'none', borderWidth: 0, paddingVertical: 0 } as any}
        />
        {showClear && (
          <Pressable
            testID={clearID}
            onPress={clear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            style={{ marginLeft: 6, justifyContent: 'center' }}
            {...keepFocus}
          >
            <IconApp name="close" size={18} color={look.icon} />
          </Pressable>
        )}
      </View>
      {(hasError && !!errorText) || helperText ? (
        <Text style={{ fontSize: 12, color: hasError ? themeColors.error : look.placeholder, marginTop: 4 }}>{hasError && errorText ? errorText : helperText}</Text>
      ) : null}
      {modal}
    </View>
  );
};

export default DateInputApp;
