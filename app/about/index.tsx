import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, Surface, Text } from 'react-native-paper';

export default function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.surfaceCard} elevation={2}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginBottom: 16, textAlign: 'center', fontWeight: 'bold' }}>
          {t('menu.about')}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
          {t('body.aboutDescription')}
        </Text>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16 
  },
  surfaceCard: {
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
  },
});