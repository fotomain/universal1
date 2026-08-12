import React, { useEffect, useRef } from 'react';
import { View, Text, Platform, Switch as RNSwitch } from 'react-native';
import { SwitchAppProps } from '../../SwitchApp';

let useDesignSystem: any;
try {
  useDesignSystem = require('../../../../context/DesignSystemContext').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: '#0b57d0', text: '#1f1f1f' }, isDark: false });
}

const MdSwitch = 'md-switch' as any;

export const GoogleMD3WebSwitchSub: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID = 'googleMD3WebSwitch',
}) => {
  let designSystem: any = { themeColors: { primary: '#0b57d0', text: '#1f1f1f' }, isDark: false };
  try {
    designSystem = useDesignSystem() || designSystem;
  } catch (e) {}

  const { themeColors, isDark } = designSystem;
  const switchRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && switchRef.current) {
      const elem = switchRef.current;
      const handleChange = () => {
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
          padding: '8px 12px',
          backgroundColor: isDark ? '#1e293b' : '#f0f4f9',
          borderRadius: '12px',
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
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }, style]}>
      {label && <Text style={{ fontSize: 15, color: themeColors.text }}>{label}</Text>}
      <RNSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#767577', true: themeColors.primary || '#0b57d0' }}
        thumbColor={value ? '#ffffff' : '#f4f3f4'}
      />
    </View>
  );
};

export default GoogleMD3WebSwitchSub;
