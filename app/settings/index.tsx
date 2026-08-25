import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, Text, Surface } from 'react-native-paper';
import ModifyThemeColorsComponent from '../../kit8/components/ModifyThemeColorsComponent';
import { FABColorSelectorComponent, FABAnimationSelectorComponent } from '../../kit8/components/fab';
import ThemeSyncStatusComponent from '../../kit8/components/ThemeSyncStatusComponent';
import DesignSystemSelectorComponent from '../../kit8/components/DesignSystemSelectorComponent';
import { useDesignSystem } from '../../kit8/providers/WithDesignSystem';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { iconsVariant, setIconsVariant } = useDesignSystem();

  const iconVariantOptions = [
    { label: 'Material Icons', value: 'materialIconsOnly' as const },
    { label: 'Platform Oriented', value: 'platformOrientedIcons' as const },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold', marginBottom: 8 }}>
          {t('menu.settings')}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('body.settingsDescription')}
        </Text>
      </View>

      <Surface style={styles.contentCard} elevation={2}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600', marginBottom: 12 }}>
          Icon styles
        </Text>
        <View style={styles.iconVariantRow}>
          {iconVariantOptions.map((option) => {
            const isSelected = iconsVariant === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setIconsVariant(option.value)}
                style={[
                  styles.iconVariantOption,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface,
                    fontWeight: isSelected ? '700' : '500',
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Surface>

      {/* Single Unified Design System & Theme Switcher */}
      <View style={styles.sectionWrapper}>
        <DesignSystemSelectorComponent />
      </View>

      {/* Main Theme Colors Customization Section */}
      <Surface style={styles.contentCard} elevation={2}>
        <ModifyThemeColorsComponent />
      </Surface>

      {/* Dedicated FAB Options */}
      <View style={styles.sectionWrapper}>
        <FABAnimationSelectorComponent />
      </View>
      <View style={styles.sectionWrapper}>
        <FABColorSelectorComponent />
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, alignItems: 'center' },
  contentCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  iconVariantRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconVariantOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
