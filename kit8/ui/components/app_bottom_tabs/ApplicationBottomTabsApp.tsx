// ApplicationBottomTabsApp - the bottom tab bar of the app. It navigates with expo-router (router.push, the active tab is read from usePathname)
// and takes its colors / shapes from the active design system (WithDesignSystem: paper, googlemd3web, tamagui, ant, expo, native, applemacui),
// like FABApp does. While it is mounted it tells redux (bottomTabsAreVisible) so the floating button (FABAppComponent) sits ABOVE the bar
// on web and on mobile: bottom = bar height + system inset + FAB_GAP (navigation/bottomTabsLayout.ts).
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { setBottomTabsAreVisible } from '../../../redux/uxuiSlice';
import type { ActiveUserState } from '../../../redux/activeUserSlice';
import { BOTTOM_TABS_CONTENT_HEIGHT, BOTTOM_TABS_PADDING, useBottomInset } from '../navigation/bottomTabsLayout';
import { appBottomTabsLook, isTabActive, tabHref, withAlpha } from './appBottomTabsModel';
import type { TabItem } from './appBottomTabsModel';

export type { TabItem } from './appBottomTabsModel';

export interface ApplicationBottomTabsAppProps {
  /** name of the navigator (a label for logs / tests) */
  tabsNavigatorName?: string;
  /** the tabs; without it the default tabs of the app are shown */
  tabsArray?: TabItem[];
  testID?: string;
}

export default function ApplicationBottomTabsApp({ tabsArray, testID = 'app-bottom-tabs' }: ApplicationBottomTabsAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { activeSystem, themeColors: c } = useDesignSystem();
  const bottomInset = useBottomInset();
  const activeUserState = useSelector((state: any) => state?.activeUserState as ActiveUserState | undefined);
  const look = appBottomTabsLook(activeSystem);

  // the floating button reads this flag: it stands above the bar while the bar is on the screen
  useEffect(() => {
    dispatch(setBottomTabsAreVisible(true));
    return () => {
      dispatch(setBottomTabsAreVisible(false));
    };
  }, [dispatch]);

  const defaultTabs: TabItem[] = [
    { tabIcon: 'link-variant', tabTitle: t('tabs.media'), tabRoute: 'posts/mediapostcrud' },
    { tabIcon: 'account-child-outline', tabTitle: t('tabs.raci'), tabRoute: 'raci/racimember' },
    { tabIcon: 'format-list-checks', tabTitle: t('tabs.my'), tabRoute: 'raci/racidashboard', params: { raciGUID: activeUserState?.activeUserGUID || '' } },
    { tabIcon: 'history', tabTitle: t('tabs.history'), tabRoute: 'historyofactivity' },
  ];
  const tabs = tabsArray && tabsArray.length > 0 ? tabsArray : defaultTabs;

  const barBackground = look.background === 'card' ? c.card : look.background === 'translucent' ? withAlpha(c.surface, 0.92) : c.surface;
  const inactive = withAlpha(c.text, 0.6);

  return (
    <View
      testID={testID}
      accessibilityRole={Platform.OS === 'web' ? ('navigation' as any) : undefined}
      style={[
        styles.bar,
        { backgroundColor: barBackground, borderTopColor: c.border, paddingBottom: BOTTOM_TABS_PADDING + bottomInset },
        look.elevation > 0 && Platform.OS !== 'web' ? { elevation: look.elevation } : null,
        look.elevation > 0 && Platform.OS === 'web' ? ({ boxShadow: `0 -${look.elevation}px ${look.elevation * 3}px rgba(0,0,0,0.12)` } as any) : null,
      ]}
    >
      <View style={styles.row}>
        {tabs.map((tab, idx) => {
          const active = isTabActive(pathname, tab.tabRoute);
          const iconColor = active ? (look.indicator === 'pill' ? c.text : c.primary) : inactive;
          return (
            <TouchableOpacity
              key={`${tab.tabRoute}-${idx}`}
              testID={`${testID}-tab-${idx}`}
              accessibilityRole="tab"
              aria-selected={active}
              accessibilityLabel={tab.tabTitle}
              style={styles.tab}
              activeOpacity={0.7}
              onPress={() => router.push(tabHref(tab, tab.tabRoute.includes('racidashboard') ? { raciGUID: activeUserState?.activeUserGUID || '' } : undefined) as any)}
            >
              {look.indicator === 'topLine' ? <View style={[styles.topLine, { backgroundColor: active ? c.primary : 'transparent' }]} /> : null}
              <View style={[styles.iconBox, look.indicator === 'pill' && active ? { backgroundColor: withAlpha(c.primary, 0.18) } : null]}>
                <MaterialCommunityIcons name={tab.tabIcon as any} size={look.iconSize} color={iconColor} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: look.labelSize, fontWeight: active ? '600' : look.labelWeight, color: active ? c.primary : inactive }}>
                {tab.tabTitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: BOTTOM_TABS_PADDING, paddingHorizontal: 8 },
  row: { height: BOTTOM_TABS_CONTENT_HEIGHT, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  topLine: { position: 'absolute', top: -BOTTOM_TABS_PADDING, left: 12, right: 12, height: 3, borderRadius: 2 },
  iconBox: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 16, marginBottom: 2 },
});
