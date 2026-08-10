import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Text, useTheme, Button, Surface } from 'react-native-paper';
import { useSelector } from 'react-redux';
import HomeAppPostsPage from '../../apps/appPosts/HomeAppPostsPage';
import HomeAppCC1 from '../../apps/appCC1/HomeAppCC1';
import { useWorkPlace } from '../../kit8/providers/WithWorkPlace';
import { ActiveUserState } from '../../kit8/redux/activeUserSlice';

import BottomTabsRoutingComponent from '../../kit8/components/navigation/BottomTabsRoutingComponent';
import IconApp from '../../components/common/IconApp';
import { ButtonApp } from "../../components/common";

const homeComponentsMap = {
  appPosts: HomeAppPostsPage,
  appCC1: HomeAppCC1,
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
        <HomeComponent />

        <ButtonApp
          icon="list"
          variant="contained"
          // style={styles.mediaButton}
          onPress={() => router.push('/posts/mediapostcrud' as any)}
        >
          Media Posts
        </ButtonApp>

        {workPlaceGUID && (
          <Text style={[styles.workplaceText, { color: theme.colors.onSurfaceVariant }]}>
            Workplace GUID: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{workPlaceGUID}</Text>
          </Text>
        )}
      </ScrollView>

      {/* BottomTabsRoutingComponent at the home page */}
      <BottomTabsRoutingComponent tabsNavigatorName="tabsHome" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', minHeight: '100%' },
  workplaceText: {
    marginVertical: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  mediaButton: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
    width: 220,
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
