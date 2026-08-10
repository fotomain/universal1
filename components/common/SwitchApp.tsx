import React from 'react';
import { View, Text, Switch as RNSwitch, TouchableOpacity } from 'react-native';
import { Switch as PaperSwitch } from 'react-native-paper';
import { useDesignSystem } from '../../context/DesignSystemContext';
import GoogleMD3WebSwitch from './googlemd3web/GoogleMD3WebSwitch';

export interface SwitchAppProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: any;
}

export const SwitchApp: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
}) => {
  const { activeSystem, themeColors, isDark } = useDesignSystem();

  switch (activeSystem) {
    case 'paper': {
      return (
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }, style]}>
          {label && <Text style={{ fontSize: 16, color: themeColors.text }}>{label}</Text>}
          <PaperSwitch value={value} onValueChange={onValueChange} disabled={disabled} color={themeColors.primary} />
        </View>
      );
    }

    case 'tamagui': {
      return (
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: isDark ? '#1f2937' : '#f8fafc',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: themeColors.border,
            },
            style,
          ]}
        >
          {label && <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>{label}</Text>}
          <RNSwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ false: '#d1d5db', true: themeColors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      );
    }

    case 'ant': {
      return (
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: themeColors.border,
            },
            style,
          ]}
        >
          {label && <Text style={{ fontSize: 15, color: themeColors.text }}>{label}</Text>}
          <RNSwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ false: '#e5e5e5', true: themeColors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      );
    }

    case 'expo': {
      return (
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              borderRadius: 20,
            },
            style,
          ]}
        >
          {label && <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text }}>{label}</Text>}
          <RNSwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ false: '#cbd5e1', true: themeColors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      );
    }

    case 'googlemd3web': {
      return (
        <GoogleMD3WebSwitch
          value={value}
          onValueChange={onValueChange}
          label={label}
          disabled={disabled}
          style={style}
          themeColors={themeColors}
          isDark={isDark}
        />
      );
    }

    case 'native':
    default: {
      return (
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }, style]}>
          {label && <Text style={{ fontSize: 15, color: themeColors.text }}>{label}</Text>}
          <RNSwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ false: '#767577', true: themeColors.primary }}
            thumbColor={value ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      );
    }
  }
};

export default SwitchApp;
