import React from 'react';
import {Alert, Linking, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Surface, Text} from 'react-native-paper';
import {DesignSystemType, useDesignSystem} from '../../context/DesignSystemContext';
import TextApp from '../../components/common/TextApp';
import TextInputApp from '../../components/common/TextInputApp';
import ButtonPrimaryApp from '../../components/common/ButtonPrimaryApp';
import ButtonSecondaryApp from '../../components/common/ButtonSecondaryApp';
import BrandLogo from './BrandLogo';

interface SystemOption {
  id: DesignSystemType;
  name: string;
  badge: string;
  description: string;
  color: string;
  url: string;
}

const DESIGN_SYSTEMS: SystemOption[] = [
  {
    id: 'native',
    name: 'React Native Native',
    badge: 'Core Primitives',
    description: 'Clean standard React Native core components & styling.',
    color: '#8b5cf6',
    url: 'https://reactnative.dev/',
  },
  {
    id: 'paper',
    name: 'React Native Paper',
    badge: 'Material 3',
    description: 'Google Material Design 3 guidelines for cross-platform apps.',
    color: '#6366f1',
    url: 'https://callstack.github.io/react-native-paper/',
  },
  {
    id: 'tamagui',
    name: 'Tamagui',
    badge: 'Tamagui v2',
    description: 'High-performance universal styles and optimized animations.',
    color: '#ec4899',
    url: 'https://tamagui.dev/',
  },
  {
    id: 'ant',
    name: 'Ant Design',
    badge: 'Ant Mobile',
    description: 'Enterprise-class mobile UI design language from Ant Financial.',
    color: '#10b981',
    url: 'https://ant.design/',
  },
  {
    id: 'expo',
    name: 'Expo UI',
    badge: 'SwiftUI / Native',
    description: 'Modern universal Expo native primitive UI strategy.',
    color: '#f59e0b',
    url: 'https://expo.dev/',
  },
  {
    id: 'googlemd3web',
    name: 'Google Material Desing 3',
    badge: 'M3 Web Only',
    description: 'Official Google Material Design 3 Web components & tokens (Web Only).',
    color: '#4285F4',
    url: 'https://m3.material.io/',
  },
];

export const DesignSystemSelectorComponent: React.FC = () => {
  const { activeSystem, setActiveSystem, themeColors, isDark, toggleTheme } = useDesignSystem();
  const [testText, setTestText] = React.useState('Dynamic System Preview');

  return (
    <Surface style={[styles.container, { backgroundColor: themeColors.surface }]} elevation={2}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', color: themeColors.text }}>
            🎨 Design System & Theme
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={toggleTheme}
              activeOpacity={0.7}
              style={{
                backgroundColor: isDark ? '#334155' : '#e2e8f0',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: themeColors.text }}>
                {isDark ? '🌙 Dark' : '☀️ Light'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.activeTag, { backgroundColor: themeColors.primary + '20' }]}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: themeColors.primary }}>
                {activeSystem.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <Text variant="bodySmall" style={{ color: isDark ? '#94a3b8' : '#64748b', marginTop: 4 }}>
          Select active UI library strategy and theme mode for your application.
        </Text>
      </View>

      {/* Systems Grid */}
      <View style={styles.grid}>
        {DESIGN_SYSTEMS.map((item) => {
          const isActive = activeSystem === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setActiveSystem(item.id)}
              activeOpacity={0.8}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isActive
                    ? isDark
                      ? '#1e293b'
                      : '#f0fdf4'
                    : isDark
                    ? '#0f172a'
                    : '#f8fafc',
                  borderColor: isActive ? themeColors.primary : themeColors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                {/* Radio button circle */}
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isActive ? themeColors.primary : themeColors.border,
                    },
                  ]}
                >
                  {isActive && (
                    <View
                      style={[
                        styles.radioCircleInner,
                        { backgroundColor: themeColors.primary },
                      ]}
                    />
                  )}
                </View>
                <BrandLogo system={item.id} size={28} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: isActive ? themeColors.primary : themeColors.text,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                    {item.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive ? themeColors.primary : isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
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
                {/* External link button */}
                <TouchableOpacity
                  onPress={() => {
                    Linking.openURL(item.url).catch(() =>
                      Alert.alert('Error', 'Could not open link')
                    );
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  style={{
                    marginLeft: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isActive
                      ? themeColors.primary + '20'
                      : isDark
                        ? '#334155'
                        : '#e2e8f0',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, color: isActive ? themeColors.primary : themeColors.text }}>
                    ↗
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Live System Preview */}
      <View
        style={[
          styles.previewBox,
          {
            backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
            borderColor: themeColors.border,
          },
        ]}
      >
        <TextApp variant="caption" style={{ color: themeColors.primary, marginBottom: 8, fontWeight: '700' }}>
          Live Strategy Component Preview ({activeSystem.toUpperCase()}):
        </TextApp>
        <TextInputApp
          label="Preview Input"
          value={testText}
          onChangeText={setTestText}
          placeholder="Type here..."
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <ButtonPrimaryApp
            title="Primary Button"
            onPress={() => {}}
            style={{ flex: 1 }}
          />
          <ButtonSecondaryApp
            title="Secondary Button"
            onPress={() => {}}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  header: {
    marginBottom: 14,
  },
  activeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  grid: {
    gap: 10,
    marginBottom: 16,
  },
  optionCard: {
    padding: 12,
    borderRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  previewBox: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});

export default DesignSystemSelectorComponent;
