import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, usePathname } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ActiveUserState } from '../../redux/activeUserSlice';
import { setBottomTabsAreVisible } from '../../redux/uxuiSlice';

export interface TabItem {
  tabIcon: string;
  tabTitle: string;
  tabRoute: string;
  params?: Record<string, any>;
}

export interface BottomTabsRoutingComponentProps {
  tabsNavigatorName?: string;
  tabsArray?: TabItem[];
}

export default function BottomTabsRoutingComponent(props: BottomTabsRoutingComponentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  useEffect(() => {
    dispatch(setBottomTabsAreVisible(true));
    return () => {
      dispatch(setBottomTabsAreVisible(false));
    };
  }, [dispatch]);

  const defaultTabs: TabItem[] = [
    {
      tabIcon: 'link-variant',
      tabTitle: t('tabs.media'),
      tabRoute: 'posts/mediapostcrud',
    },
    {
      tabIcon: 'account-child-outline',
      tabTitle: t('tabs.raci'),
      tabRoute: 'raci/racimember',
    },
    {
      tabIcon: 'format-list-checks',
      tabTitle: t('tabs.my'),
      tabRoute: 'raci/racidashboard',
      params: { raciGUID: activeUserState?.activeUserGUID || '' },
    },
    {
      tabIcon: 'history',
      tabTitle: t('tabs.history'),
      tabRoute: 'historyofactivity',
    },
  ];

  const tabs = props.tabsArray && props.tabsArray.length > 0 ? props.tabsArray : defaultTabs;

  const handleTabPress = (tab: TabItem) => {
    let routePath = `/${tab.tabRoute}`;
    let params = tab.params;
    
    // Inject activeUserGUID for racidashboard if missing
    if (tab.tabRoute.includes('racidashboard')) {
      params = { raciGUID: activeUserState?.activeUserGUID || '', ...params };
    }

    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params as Record<string, string>).toString();
      router.push(`${routePath}?${queryString}` as any);
    } else {
      router.push(routePath as any);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.elevation.level2, borderTopColor: theme.colors.outlineVariant }]} elevation={2}>
      <View style={styles.tabsRow}>
        {tabs.map((tab, idx) => {
          const isActive = pathname.includes(tab.tabRoute);
          const activeColor = theme.colors.primary;
          const inactiveColor = theme.colors.onSurfaceVariant;
          const color = isActive ? activeColor : inactiveColor;

          return (
            <TouchableOpacity
              key={idx}
              style={styles.tabButton}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isActive && { backgroundColor: theme.colors.secondaryContainer }]}>
                <MaterialCommunityIcons name={tab.tabIcon as any} size={24} color={isActive ? theme.colors.onSecondaryContainer : color} />
              </View>
              <Text variant="labelMedium" style={[styles.tabLabel, { color }]}>
                {tab.tabTitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 2,
  },
  tabLabel: {
    fontWeight: '500',
  },
});
