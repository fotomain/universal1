import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import H1App from '../../kit8/ui/components/common/H1App';
import ArticleTextApp from '../../kit8/ui/components/common/ArticleTextApp';

export default function PostsPageCC1() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <H1App>{t('body.postsAppCC1Title')}</H1App>
      <ArticleTextApp>{t('body.postsAppCC1Desc')}</ArticleTextApp>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 20 },
});