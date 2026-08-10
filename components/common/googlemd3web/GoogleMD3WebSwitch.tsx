import React, { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { SwitchAppProps } from '../SwitchApp';
import loadMaterialWebCdn from './loadMaterialWebCdn';

const MdSwitch = 'md-switch' as any;

export const GoogleMD3WebSwitch: React.FC<SwitchAppProps & { themeColors: any; isDark: boolean }> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  themeColors,
  isDark,
  style,
}) => {
  const switchRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && switchRef.current) {
      const elem = switchRef.current;
      const handleChange = (e: any) => {
        if (onValueChange && !disabled) {
          onValueChange(elem.selected);
        }
      };
      elem.addEventListener('change', handleChange);
      return () => {
        elem.removeEventListener('change', handleChange);
      };
    }
  }, [onValueChange, disabled]);

  useEffect(() => {
    if (Platform.OS === 'web' && switchRef.current) {
      switchRef.current.selected = Boolean(value);
    }
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: isDark ? '#1e293b' : '#f0f4f9',
          borderRadius: '12px',
          margin: '4px 0',
          fontFamily: 'Roboto, system-ui, sans-serif',
        }}
      >
        {label && (
          <span style={{ fontSize: '15px', fontWeight: 500, color: themeColors.text }}>
            {label}
          </span>
        )}
        <MdSwitch
          ref={switchRef}
          selected={value ? true : undefined}
          disabled={disabled ? true : undefined}
          style={{
            '--md-switch-selected-handle-color': '#0b57d0',
            '--md-switch-selected-track-color': '#d3e3fd',
          }}
        />
      </div>
    );
  }

  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }, style]}>
      {label && <Text>{label}</Text>}
    </View>
  );
};

export default GoogleMD3WebSwitch;
