import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, ViewStyle, StyleProp, Platform } from 'react-native';
import { DatePickerModal, registerTranslation, en } from 'react-native-paper-dates';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from './IconApp';

// Register default English locale translations once
try {
  registerTranslation('en', en);
} catch {
  // Already registered
}

export interface SelectDateAppProps {
  /** Current date value (Date, timestamp in ms, ISO string, or null/undefined) */
  value?: Date | string | number | null;
  /** Callback when date is selected or cleared */
  onSelect?: (date: Date | null) => void;
  /** Controlled modal visibility */
  visible?: boolean;
  /** Modal dismiss callback */
  onDismiss?: () => void;
  /** Modal open callback */
  onOpen?: () => void;
  /** Mode: 'single' (default), 'range', or 'multiple' */
  mode?: 'single' | 'range' | 'multiple';
  /** Locale (default 'en') */
  locale?: string;
  /** Label for trigger / modal header */
  label?: string;
  /** Placeholder text when value is empty */
  placeholder?: string;
  /** Trigger type: 'icon' | 'field' | 'button' | 'none' (default 'icon') */
  trigger?: 'icon' | 'field' | 'button' | 'none';
  /** Disabled */
  disabled?: boolean;
  /** Allowed date range */
  validRange?: { startDate?: Date; endDate?: Date };
  /** Custom trigger style */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
  /** Custom children or trigger render function */
  children?: React.ReactNode | ((props: { open: () => void; value: Date | null; formatted: string }) => React.ReactNode);
}

/** Converts Date, number, or string to a Date object or undefined */
export function normalizeDateValue(val: Date | string | number | null | undefined): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    // try YYYY-MM-DD or DD.MM.YYYY first to construct local Date without UTC offset shift
    const parts = trimmed.split(/[./-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (parts[2].length === 4) {
        const d = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const y = Number(parts[2]);
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    const parsedGeneric = new Date(trimmed);
    if (!isNaN(parsedGeneric.getTime())) return parsedGeneric;
  }
  return undefined;
}

export default function SelectDateApp({
  value,
  onSelect,
  visible,
  onDismiss,
  onOpen,
  mode = 'single',
  locale = 'en',
  label = 'Select date',
  placeholder = 'Select date',
  trigger = 'icon',
  disabled = false,
  validRange,
  style,
  testID = 'select-date-app',
  children,
}: SelectDateAppProps) {
  const { themeColors } = useDesignSystem();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = visible !== undefined;
  const modalVisible = isControlled ? visible : internalOpen;

  const dateValue = useMemo(() => normalizeDateValue(value), [value]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    onOpen?.();
    if (!isControlled) setInternalOpen(true);
  }, [disabled, isControlled, onOpen]);

  const handleDismiss = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    onDismiss?.();
  }, [isControlled, onDismiss]);

  const handleConfirmSingle = useCallback(
    (params: { date?: Date }) => {
      const selected = params.date || dateValue || null;
      onSelect?.(selected);
      handleDismiss();
    },
    [dateValue, onSelect, handleDismiss]
  );

  const formatted = useMemo(() => {
    if (!dateValue) return '';
    const y = dateValue.getFullYear();
    const m = String(dateValue.getMonth() + 1).padStart(2, '0');
    const d = String(dateValue.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [dateValue]);

  const preventMouseDown = useCallback((e: any) => {
    if (Platform.OS === 'web' && e?.preventDefault) {
      e.preventDefault();
    }
  }, []);

  return (
    <>
      {typeof children === 'function' ? (
        children({ open: handleOpen, value: dateValue ?? null, formatted })
      ) : children ? (
        <Pressable
          testID={`${testID}-trigger`}
          onPress={handleOpen}
          disabled={disabled}
          style={style}
          {...(Platform.OS === 'web' ? ({ onMouseDown: preventMouseDown } as any) : {})}
        >
          {children}
        </Pressable>
      ) : trigger === 'icon' ? (
        <Pressable
          testID={`${testID}-trigger`}
          onPress={handleOpen}
          disabled={disabled}
          style={[styles.iconButton, { borderColor: themeColors.border }, style]}
          accessibilityRole="button"
          accessibilityLabel={label}
          {...(Platform.OS === 'web' ? ({ onMouseDown: preventMouseDown } as any) : {})}
        >
          <IconApp name="calendar_today" size={16} color={disabled ? themeColors.border : themeColors.primary} />
        </Pressable>
      ) : trigger === 'field' ? (
        <Pressable
          testID={`${testID}-trigger`}
          onPress={handleOpen}
          disabled={disabled}
          style={[
            styles.fieldContainer,
            { borderColor: themeColors.border, backgroundColor: themeColors.surface },
            style,
          ]}
          accessibilityRole="button"
          accessibilityLabel={label}
          {...(Platform.OS === 'web' ? ({ onMouseDown: preventMouseDown } as any) : {})}
        >
          <Text
            style={[
              styles.fieldText,
              { color: formatted ? themeColors.text : themeColors.border },
            ]}
            numberOfLines={1}
          >
            {formatted || placeholder}
          </Text>
          <IconApp name="calendar_today" size={16} color={themeColors.primary} />
        </Pressable>
      ) : trigger === 'button' ? (
        <Pressable
          testID={`${testID}-trigger`}
          onPress={handleOpen}
          disabled={disabled}
          style={[styles.button, { backgroundColor: themeColors.primary }, style]}
          accessibilityRole="button"
          {...(Platform.OS === 'web' ? ({ onMouseDown: preventMouseDown } as any) : {})}
        >
          <IconApp name="calendar_today" size={14} color="#fff" />
          <Text style={styles.buttonText}>{formatted || label}</Text>
        </Pressable>
      ) : null}

      <DatePickerModal
        locale={locale}
        mode={mode as any}
        visible={modalVisible}
        onDismiss={handleDismiss}
        date={dateValue}
        onConfirm={handleConfirmSingle}
        onChange={(params: any) => {
          if (mode === 'single' && params?.date) {
            handleConfirmSingle({ date: params.date });
          }
        }}
        validRange={validRange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
  },
  fieldText: {
    fontSize: 13,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
