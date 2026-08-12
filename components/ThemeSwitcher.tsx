import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useDesignSystem, DesignSystemType } from '../context/DesignSystemContext';

export interface ThemeSwitcherProps {
  style?: any;
}

const SYSTEMS: { id: DesignSystemType; label: string; badge: string; icon: string }[] = [
  { id: 'paper', label: 'Paper', badge: 'MD3', icon: '📄' },
  { id: 'tamagui', label: 'Tamagui', badge: 'v2', icon: '🎨' },
  { id: 'ant', label: 'Ant Design', badge: 'RN', icon: '🐜' },
  { id: 'expo', label: 'Expo UI', badge: 'Swift/Native', icon: '🚀' },
  { id: 'native', label: 'RN Native', badge: 'Core', icon: '📱' },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ style }) => {
  const { activeSystem, setActiveSystem, isDark, toggleTheme, themeColors } = useDesignSystem();

  return (
    <View
      style={[
        {
          backgroundColor: themeColors.surface,
          borderRadius: 16,
          padding: 14,
          marginVertical: 10,
          borderWidth: 1,
          borderColor: themeColors.border,
          boxShadow: isDark ? '0px 4px 12px rgba(0,0,0,0.5)' : '0px 2px 8px rgba(0,0,0,0.05)',
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
            Design Strategy:
          </Text>
          <View
            style={{
              marginLeft: 8,
              backgroundColor: themeColors.primary + '25',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.primary }}>
              {activeSystem.toUpperCase()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={toggleTheme}
          activeOpacity={0.7}
          style={{
            backgroundColor: isDark ? '#334155' : '#e2e8f0',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text }}>
            {isDark ? '🌙 Dark' : '☀️ Light'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
        {SYSTEMS.map((item) => {
          const isActive = activeSystem === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setActiveSystem(item.id)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isActive ? themeColors.primary : isDark ? '#1e293b' : '#f1f5f9',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
                borderWidth: 1,
                borderColor: isActive ? themeColors.primary : themeColors.border,
              }}
            >
              <Text style={{ fontSize: 13, marginRight: 6 }}>{item.icon}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#ffffff' : themeColors.text,
                }}
              >
                {item.label}
              </Text>
              <View
                style={{
                  marginLeft: 6,
                  backgroundColor: isActive ? '#ffffff40' : isDark ? '#334155' : '#cbd5e1',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: isActive ? '#ffffff' : themeColors.text,
                  }}
                >
                  {item.badge}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default ThemeSwitcher;
