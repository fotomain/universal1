import React, { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { SelectorFromAppProps, SelectorOption } from '../SelectorFromApp';
import loadMaterialWebCdn from './loadMaterialWebCdn';

const MdOutlinedSelect = 'md-outlined-select' as any;
const MdSelectOption = 'md-select-option' as any;

export function GoogleMD3WebSelector<T extends string = string>({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select option',
  disabled = false,
  themeColors,
  isDark,
  style,
}: SelectorFromAppProps<T> & { themeColors: any; isDark: boolean }) {
  const selectRef = useRef<any>(null);

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

  useEffect(() => {
    if (Platform.OS === 'web' && selectRef.current) {
      const elem = selectRef.current;
      const handleClose = () => {
        if (onValueChange && elem.value && elem.value !== value) {
          onValueChange(elem.value as T);
        }
      };
      elem.addEventListener('change', handleClose);
      return () => {
        elem.removeEventListener('change', handleClose);
      };
    }
  }, [onValueChange, value]);

  if (Platform.OS === 'web') {
    return (
      <div style={{ margin: '12px 0', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <MdOutlinedSelect
          ref={selectRef}
          label={label || placeholder}
          value={String(value)}
          disabled={disabled ? true : undefined}
          style={{
            width: '100%',
            '--md-outlined-select-container-shape': '8px',
            '--md-outlined-select-outline-color': themeColors.border,
            '--md-outlined-select-focus-outline-color': '#0b57d0',
            '--md-outlined-select-text-color': themeColors.text,
            fontFamily: 'Roboto, system-ui, sans-serif',
          }}
        >
          {normalizedOptions.map((opt) => (
            <MdSelectOption
              key={String(opt.value)}
              value={String(opt.value)}
              selected={opt.value === value ? true : undefined}
            >
              <div slot="headline">{opt.label}</div>
            </MdSelectOption>
          ))}
        </MdOutlinedSelect>
      </div>
    );
  }

  return (
    <View style={[{ marginVertical: 8 }, style]}>
      {label && <Text>{label}</Text>}
    </View>
  );
}

export default GoogleMD3WebSelector;
