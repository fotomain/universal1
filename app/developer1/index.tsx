import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Text, useTheme, Surface } from 'react-native-paper';
import { ButtonPrimaryApp } from '../../kit8/components/common';
import { useSelector } from 'react-redux';
import HomeAppPostsPage from '../../apps/appPosts/HomeAppPostsPage';
import HomeAppCC1 from '../../apps/appCC1/HomeAppCC1';
import HomeAppOnTrend from '../../apps/appOnTrend/HomeAppOnTrend';
import { useWorkPlace } from '../../kit8/providers/WithWorkPlace';
import { ActiveUserState } from '../../kit8/redux/activeUserSlice';

const homeComponentsMap = {
  appPosts: HomeAppPostsPage,
  appCC1: HomeAppCC1,
  appOnTrend: HomeAppOnTrend,
};
const appName = (Constants.expoConfig?.extra?.appName as keyof typeof homeComponentsMap) || 'appPosts';
const HomeComponent = homeComponentsMap[appName] || HomeAppPostsPage;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const { workPlaceGUID } = useWorkPlace();
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
      <HomeComponent />

      {workPlaceGUID && (
        <Text style={[styles.workplaceText, { color: theme.colors.onSurfaceVariant }]}>
          Workplace GUID: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{workPlaceGUID}</Text>
        </Text>
      )}

      <View style={styles.links}>
        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginVertical: 8, color: theme.colors.primary }}>
          Video & Audio Features
        </Text>
        <ButtonPrimaryApp icon="video" style={styles.menuButton} onPress={() => router.push('/record/recordvideoweb?withAudio=true' as any)}>
          1) Record Video Web (With Audio)
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="video-off" style={styles.menuButton} onPress={() => router.push('/record/recordvideoweb?withAudio=false' as any)}>
          2) Record Video Web (Without Audio)
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="play-circle" style={styles.menuButton} onPress={() => router.push('/play/playvideoweb' as any)}>
          Play Video Web
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="camera-gopro" style={styles.menuButton} onPress={() => router.push('/record/recordvideonative' as any)}>
          Record Video Native
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="video-vintage" style={styles.menuButton} onPress={() => router.push('/play/playvideonative' as any)}>
          Play Video Native
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="microphone" style={styles.menuButton} onPress={() => router.push('/record/recordaudioweb' as any)}>
          Record Audio Web
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="microphone-settings" style={styles.menuButton} onPress={() => router.push('/record/recordaudionative' as any)}>
          Record Audio Native
        </ButtonPrimaryApp>

        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: theme.colors.primary }}>
          Application Screens
        </Text>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/raci/racimember' as any)}>Users (RACI)</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/sqlite/demo/native')}>{t('menu.sqliteDemo')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/userprofile')}>{t('menu.userProfile')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/about')}>{t('menu.about')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/signup')}>{t('menu.signUp')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/signin')}>{t('menu.signIn')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/posts/mediapostcrud' as any)}>{t('menu.posts')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/feedback')}>{t('menu.feedback')}</ButtonPrimaryApp>
        <ButtonPrimaryApp style={styles.menuButton} onPress={() => router.push('/map')}>{t('menu.map')}</ButtonPrimaryApp>
      </View>

      {/* Active User State section rendered at the bottom of the homepage */}
      {activeUserState && (
        <Surface style={styles.activeUserBox} elevation={1}>
          <Text variant="titleMedium" style={{ color: theme.colors.primary, marginBottom: 8, fontWeight: 'bold' }}>👤 Active User State</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginVertical: 2 }}>
            activeUserGUID: <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{activeUserState.activeUserGUID || 'Empty'}</Text>
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginVertical: 2 }}>
            activeUserEmail: <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{activeUserState.activeUserEmail || 'Empty'}</Text>
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginVertical: 2 }}>
            activeUserFirstName: <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{activeUserState.activeUserFirstName || 'Empty'}</Text>
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginVertical: 2 }}>
            activeUserLastName: <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{activeUserState.activeUserLastName || 'Empty'}</Text>
          </Text>
        </Surface>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', minHeight: '100%' },
  workplaceText: {
    marginVertical: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  links: { marginTop: 10, width: '100%', maxWidth: 300 },
  menuButton: { 
    marginVertical: 4, 
    borderRadius: 8 
  },
  activeUserBox: {
    marginTop: 24,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
    padding: 16,
    borderRadius: 8,
  },
});
