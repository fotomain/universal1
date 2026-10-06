import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import H1Mi from '../../kit8/ui/H1Mi';
import ArticleTextApp from '../../kit8/components/common/ArticleTextApp';

export default function HomeAppCC1() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <H1Mi>{t('body.welcomeAppCC1')}</H1Mi>
      <ArticleTextApp>{t('body.homeAppCC1Desc')}</ArticleTextApp>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 20 },
});