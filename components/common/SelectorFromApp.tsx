import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ViewStyle, ScrollView, Platform } from 'react-native';
import { Surface, TextInput as PaperTextInput } from 'react-native-paper';
import { useDesignSystem } from '../../kit8/providers/DesignSystemContext';
import IconApp from './IconApp';
import GoogleMD3WebSelector from './googlemd3web/GoogleMD3WebSelector';

export interface SelectorOption<T = string> {
  label: string;
  value: T;
}

export interface SelectorFromAppProps<T extends string = string> {
  label?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: (T | SelectorOption<T>)[] | Record<string, T>;
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function SelectorFromApp<T extends string = string>({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  style,
  testID = 'selectorFromApp',
}: SelectorFromAppProps<T>) {
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const [menuVisible, setMenuVisible] = useState(false);

  // Normalize options array or object map into [{ label, value }]
  const normalizedOptions: SelectorOption<T>[] = React.useMemo(() => {
    if (Array.isArray(options)) {
      return options.map((opt) => {
        if (typeof opt === 'object' && opt !== null && 'value' in opt) {
          return opt as SelectorOption<T>;
        }
        return { label: String(opt), value: opt as T };
      });
    }
    if (typeof options === 'object' && options !== null) {
      return Object.entries(options).map(([key, val]) => ({
        label: key,
        value: val as T,
      }));
    }
    return [];
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const selectedLabel = selectedOption ? selectedOption.label : value ? String(value) : placeholder;

  switch (activeSystem) {
    case 'paper': {
      return (
        <View style={[{ marginVertical: 8, width: '100%' }, style]} testID={testID}>
          <TouchableOpacity
            onPress={() => !disabled && setMenuVisible(!menuVisible)}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <View pointerEvents="none">
              <PaperTextInput
                mode="outlined"
                label={label}
                value={selectedLabel}
                editable={false}
                disabled={disabled}
                outlineColor={themeColors.border}
                activeOutlineColor={themeColors.primary}
                style={{ backgroundColor: themeColors.surface }}
                right={<PaperTextInput.Icon icon={menuVisible ? 'chevron-up' : 'chevron-down'} />}
              />
            </View>
          </TouchableOpacity>

          {menuVisible && (
            <Surface
              style={{
                marginTop: 4,
                borderRadius: 8,
                backgroundColor: themeColors.surface,
                elevation: 3,
                maxHeight: 220,
              }}
              elevation={3}
            >
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {normalizedOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      onPress={() => {
                        onValueChange(opt.value);
                        setMenuVisible(false);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: isSelected ? themeColors.primary + '15' : 'transparent',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '400', color: isSelected ? themeColors.primary : themeColors.text }}>
                        {opt.label}
                      </Text>
                      {isSelected && <IconApp name="check" size={18} color={themeColors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Surface>
          )}
        </View>
      );
    }

    case 'tamagui': {
      return (
        <View style={[{ marginVertical: 10, width: '100%' }, style]} testID={testID}>
          {label && (
            <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {label}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => !disabled && setMenuVisible(!menuVisible)}
            disabled={disabled}
            activeOpacity={0.8}
            style={{
              backgroundColor: isDark ? '#1f2937' : '#f9fafb',
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: menuVisible ? themeColors.primary : themeColors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, color: selectedOption ? themeColors.text : '#9ca3af', fontWeight: '500' }}>
              {selectedLabel}
            </Text>
            <IconApp testID="a0265d94-7fb1-2a34-6278-901234567c09" name="chevron-down" size={18} color={themeColors.text} />
          </TouchableOpacity>

          {menuVisible && (
            <View
              style={{
                marginTop: 4,
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: themeColors.border,
                overflow: 'hidden',
                boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    onPress={() => {
                      onValueChange(opt.value);
                      setMenuVisible(false);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      backgroundColor: isSelected ? themeColors.primary + '20' : 'transparent',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: isSelected ? themeColors.primary : themeColors.text, fontWeight: isSelected ? '700' : '400' }}>
                      {opt.label}
                    </Text>
                    {isSelected && <IconApp testID="b1376ea5-8ac2-3b45-7389-012345678d10" name="check" size={16} color={themeColors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    case 'ant': {
      return (
        <View style={[{ marginVertical: 8, width: '100%' }, style]} testID={testID}>
          <TouchableOpacity
            onPress={() => !disabled && setMenuVisible(!menuVisible)}
            disabled={disabled}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: menuVisible ? themeColors.primary : themeColors.border,
              paddingVertical: 12,
              paddingHorizontal: 4,
            }}
          >
            {label && (
              <Text style={{ fontSize: 16, fontWeight: '500', color: themeColors.text }}>
                {label}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, color: selectedOption ? themeColors.primary : '#888' }}>
                {selectedLabel}
              </Text>
              <IconApp testID="c2487fb6-9bd3-4c56-8490-123456789e11" name="chevron-down" size={16} color="#888" />
            </View>
          </TouchableOpacity>

          {menuVisible && (
            <View
              style={{
                backgroundColor: themeColors.surface,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.border,
                paddingVertical: 4,
              }}
            >
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    onPress={() => {
                      onValueChange(opt.value);
                      setMenuVisible(false);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, color: isSelected ? themeColors.primary : themeColors.text, fontWeight: isSelected ? '600' : '400' }}>
                      {opt.label}
                    </Text>
                    {isSelected && <IconApp testID="d3598ac7-0ce4-5d67-95a1-234567890f12" name="check" size={16} color={themeColors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    case 'expo': {
      return (
        <View style={[{ marginVertical: 10, width: '100%' }, style]} testID={testID}>
          {label && (
            <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.primary, marginBottom: 4 }}>
              {label}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => !disabled && setMenuVisible(!menuVisible)}
            disabled={disabled}
            activeOpacity={0.85}
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: 1.5,
              borderColor: menuVisible ? themeColors.primary : 'transparent',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
              {selectedLabel}
            </Text>
            <IconApp testID="e46a9bd8-1df5-6e78-06b2-345678901a13" name="chevron-down" size={18} color={themeColors.primary} />
          </TouchableOpacity>

          {menuVisible && (
            <View
              style={{
                marginTop: 6,
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderRadius: 16,
                padding: 6,
                borderWidth: 1,
                borderColor: themeColors.border,
              }}
            >
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    onPress={() => {
                      onValueChange(opt.value);
                      setMenuVisible(false);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: isSelected ? themeColors.primary : 'transparent',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginVertical: 2,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? '#ffffff' : themeColors.text }}>
                      {opt.label}
                    </Text>
                    {isSelected && <IconApp testID="f57bace9-2ea6-7f89-17c3-456789012b14" name="check" size={16} color="#ffffff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    case 'googlemd3web': {
      return (
        <GoogleMD3WebSelector
          label={label}
          value={value}
          onValueChange={onValueChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          style={style}
          testID={testID}
          themeColors={themeColors}
          isDark={isDark}
        />
      );
    }

    case 'native':
    default: {
      return (
        <View style={[{ marginVertical: 8, width: '100%' }, style]} testID={testID}>
          {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
          <View style={styles.selectWrapper}>
            <select
              value={value}
              onChange={(e) => onValueChange(e.target.value as T)}
              disabled={disabled}
              style={{
                width: '100%',
                height: 44,
                paddingLeft: 12,
                paddingRight: 12,
                fontSize: 15,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: themeColors.border,
                backgroundColor: themeColors.surface,
                color: themeColors.text,
                outline: 'none',
                boxSizing: 'border-box',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {placeholder && (
                <option value="" disabled style={{ backgroundColor: themeColors.surface, color: themeColors.text }}>
                  {placeholder}
                </option>
              )}
              {normalizedOptions.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)} style={{ backgroundColor: themeColors.surface, color: themeColors.text }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </View>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  selectWrapper: {
    width: '100%',
  },
});

export default SelectorFromApp;
