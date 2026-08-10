import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapMi from '../../kit8/components/MapMi/MapMi';
import H1Mi from '../../kit8/ui/H1Mi';

export default function MapScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <H1Mi>{t('menu.map')}</H1Mi>
      <MapMi />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16 },
});