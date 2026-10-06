import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import H1App from '../../kit8/ui/components/common/H1App';
import ArticleTextApp from '../../kit8/ui/components/common/ArticleTextApp';

export default function PostsPageClothes1() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <H1App>{t('body.postsAppClothes1Title') || 'Posts - App Clothes1'}</H1App>
      <ArticleTextApp>{t('body.postsAppClothes1Desc') || 'This is the posts page for the Clothes1 app.'}</ArticleTextApp>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 20 },
});
