import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import H1Mi from '../../kit8/ui/H1Mi';
import ArticleTextMi from '../../kit8/ui/ArticleTextMi';

export default function PostsPageOnTrend() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <H1Mi>{t('body.postsAppOnTrendTitle') || 'Posts - App OnTrend'}</H1Mi>
      <ArticleTextMi>{t('body.postsAppOnTrendDesc') || 'This is the posts page for the OnTrend app.'}</ArticleTextMi>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 20 },
});
