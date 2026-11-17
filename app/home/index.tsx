import React, {useCallback, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View} from 'react-native';
import {useRouter} from 'expo-router';
import Constants from 'expo-constants';
import {useTranslation} from 'react-i18next';
import {Text, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
import HomeAppPostsPage from '../../apps/appPosts/HomeAppPostsPage';
import HomeAppCC1 from '../../apps/appCC1/HomeAppCC1';
import HomeAppOnTrend from '../../apps/appOnTrend/HomeAppOnTrend';
import HomeAppClothes1 from '../../apps/appClothes1/HomeAppClothes1';
import HomeAppPM80 from '../../apps/appPM80/home/HomeAppPM80';
import {useWorkPlace} from '../../kit8/providers/WithWorkPlace';
import {ActiveUserState} from '../../kit8/redux/activeUserSlice';

import {HomeScrollContext, HomeScrollHost} from '../../kit8/ui/home/HomeScrollContext';
import ApplicationBottomTabsApp from '../../kit8/ui/components/app_bottom_tabs/ApplicationBottomTabsApp';

const homeComponentsMap = {
  appPosts: HomeAppPostsPage,
  appCC1: HomeAppCC1,
  appOnTrend: HomeAppOnTrend,
  appClothes1: HomeAppClothes1,
  appPM80: HomeAppPM80,
};
export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const { workPlaceGUID } = useWorkPlace();
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  const configurationName = (Constants.expoConfig?.extra?.configurationName as keyof typeof homeComponentsMap) || 'appClothes1';
  const HomeComponent = homeComponentsMap[configurationName] || HomeAppClothes1;

  // the page scrolls here: a home component can ask to scroll it (HomeScrollContext), e.g. appPM80 "Business order" to the top
  const wrapRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const host = useMemo<HomeScrollHost>(
    () => ({
      viewportH,
      contentH,
      getOffset: () => offsetRef.current,
      measureTop: (cb) => wrapRef.current?.measureInWindow((_x, y) => cb(y)),
      scrollTo: (y, animated = true) => scrollRef.current?.scrollTo({ y, animated }),
    }),
    [viewportH, contentH]
  );
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onScrollLayout = useCallback((e: LayoutChangeEvent) => setViewportH(Math.round(e.nativeEvent.layout.height)), []);

  return (
    <View ref={wrapRef} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onLayout={onScrollLayout}
        onContentSizeChange={(_w, h) => setContentH(Math.round(h))}
        contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <HomeScrollContext.Provider value={host}>
          <HomeComponent />
        </HomeScrollContext.Provider>

        {workPlaceGUID && (
          <Text style={[styles.workplaceText, { color: theme.colors.onSurfaceVariant }]}>
            Workplace GUID: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{workPlaceGUID}</Text>
          </Text>
        )}
      </ScrollView>

      {/* the bottom tabs at the home page; the FAB stands above them */}
      <ApplicationBottomTabsApp tabsNavigatorName="tabsHome" />
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
