import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Button } from 'react-native-paper';
import H1Mi from '../../kit8/ui/H1Mi';
import ArticleTextMi from '../../kit8/ui/ArticleTextMi';

export default function HomeAppPostsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.container}>
      <H1Mi>{t('body.welcomeAppPosts')}</H1Mi>
      <ArticleTextMi>{t('body.homeAppPostsDesc')}</ArticleTextMi>
      <Button mode="contained-tonal" style={styles.menuButton} onPress={() => router.push('/raci/racimember' as any)}>Users (RACI)</Button>

    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  menuButton: { marginVertical: 4, borderRadius: 8, width: 220 },
});
