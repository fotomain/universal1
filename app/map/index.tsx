import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapMi from '../../kit8/ui/components/MapMi/MapMi';
import H1App from '../../kit8/ui/components/common/H1App';

export default function MapScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <H1App>{t('menu.map')}</H1App>
      <MapMi />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16 },
});