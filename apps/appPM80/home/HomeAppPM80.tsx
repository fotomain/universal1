import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { DesignSystemType, useDesignSystem } from '../../../kit8/providers/WithDesignSystem';
import PM80HomePaper from './PM80HomePaper';
import PM80HomeTamagui from './PM80HomeTamagui';

export interface HomeAppPM80Props {
  /** Force 'paper' or 'tamagui', or leave undefined to follow WithDesignSystem & top toggle */
  variant?: 'paper' | 'tamagui';
  /** the Paper / Tamagui tab bar: hidden by default (the home follows the design system); the demo page shows it */
  showVariantSwitcher?: boolean;
  testID?: string;
}

export default function HomeAppPM80({
  variant,
  showVariantSwitcher = false,
  testID = 'pm80-home',
}: HomeAppPM80Props) {
  let detectedSystem: DesignSystemType = 'paper';
  let isDark = false;
  try {
    const ds = useDesignSystem();
    if (ds?.activeSystem) detectedSystem = ds.activeSystem;
    if (typeof ds?.isDark === 'boolean') isDark = ds.isDark;
  } catch {
    // outside provider fallback
  }

  const initialStyle: 'paper' | 'tamagui' =
    variant || (detectedSystem === 'tamagui' ? 'tamagui' : 'paper');

  const [activeStyle, setActiveStyle] = useState<'paper' | 'tamagui'>(initialStyle);

  useEffect(() => {
    if (variant) {
      setActiveStyle(variant);
    } else if (detectedSystem === 'tamagui' || detectedSystem === 'paper') {
      setActiveStyle(detectedSystem);
    }
  }, [variant, detectedSystem]);

  const toggleStyle = () => {
    setActiveStyle((prev) => (prev === 'paper' ? 'tamagui' : 'paper'));
  };

  return (
    <View testID={testID} style={styles.container}>
      {showVariantSwitcher && (
        <View
          style={[
            styles.switcherBar,
            {
              backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
            },
          ]}
        >
          <TouchableOpacity
            testID={`${testID}-tab-paper`}
            onPress={() => setActiveStyle('paper')}
            style={[
              styles.switchTab,
              activeStyle === 'paper' && {
                backgroundColor: isDark ? '#4F378B' : '#FFFFFF',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="material-design"
              size={15}
              color={
                activeStyle === 'paper'
                  ? isDark
                    ? '#EADDFF'
                    : '#6750A4'
                  : isDark
                  ? '#94A3B8'
                  : '#64748B'
              }
            />
            <Text
              style={[
                styles.switchTabText,
                {
                  color:
                    activeStyle === 'paper'
                      ? isDark
                        ? '#EADDFF'
                        : '#6750A4'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B',
                  fontWeight: activeStyle === 'paper' ? '800' : '600',
                },
              ]}
            >
              React Native Paper (MD3)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`${testID}-tab-tamagui`}
            onPress={() => setActiveStyle('tamagui')}
            style={[
              styles.switchTab,
              activeStyle === 'tamagui' && {
                backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="lightning-bolt-circle"
              size={15}
              color={
                activeStyle === 'tamagui'
                  ? '#2563EB'
                  : isDark
                  ? '#94A3B8'
                  : '#64748B'
              }
            />
            <Text
              style={[
                styles.switchTabText,
                {
                  color:
                    activeStyle === 'tamagui'
                      ? isDark
                        ? '#60A5FA'
                        : '#2563EB'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B',
                  fontWeight: activeStyle === 'tamagui' ? '800' : '600',
                },
              ]}
            >
              Tamagui Styled
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeStyle === 'tamagui' ? (
        <PM80HomeTamagui onSwitchStyle={toggleStyle} />
      ) : (
        <PM80HomePaper onSwitchStyle={toggleStyle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  switcherBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 480,
    padding: 4,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
    gap: 4,
  },
  switchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    gap: 6,
  },
  switchTabText: {
    fontSize: 12,
  },
});

