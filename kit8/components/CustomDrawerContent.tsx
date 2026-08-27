import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Drawer as PaperDrawer } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useDesignSystem } from '../providers/DesignSystemContext';
import IconApp from '../../components/common/IconApp';
import LanguageSelectorComponent from './LanguageSelectorComponent';
import DarkThemeSwitchComponent from './DarkThemeSwitchComponent';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { activeSystem, themeColors, isDark } = useDesignSystem();

  const navigateAndClose = (route: string) => {
    const fullRoute = route.startsWith('/') ? route : `/${route}`;
    try {
      if ((router as any).navigate) {
        (router as any).navigate(fullRoute);
      } else {
        router.replace(fullRoute as any);
      }
    } catch (e) {
      router.replace(fullRoute as any);
    }
    navigation.closeDrawer();
  };

  const isCurrentRoute = (route: string) => {
    const cleanPath = (pathname || '').replace(/^\//, '').replace(/\/index$/, '');
    const cleanRoute = (route || '').replace(/^\//, '').replace(/\/index$/, '');
    return cleanPath === cleanRoute || (cleanPath === '' && cleanRoute === 'home');
  };

  const mainNavItems: MenuItem[] = [
    { id: 'home', label: t('menu.home'), icon: 'home', route: 'home' },
    { id: 'developer1', label: 'Developer 1', icon: 'logo_dev', route: 'developer1' },
    { id: 'posts', label: 'Media Posts', icon: 'list_alt', route: 'posts/mediapostcrud' },
    { id: 'raci', label: 'Users (RACI)', icon: 'groups', route: 'raci/racimember' },
  ];

  const bottomNavItems: MenuItem[] = [
    { id: 'userprofile', label: 'User Profile', icon: 'account_circle', route: 'userprofile' },
    { id: 'settings', label: t('menu.settings'), icon: 'settings', route: 'settings' },
  ];

  const renderDrawerItem = (item: MenuItem) => {
    const active = isCurrentRoute(item.route);

    switch (activeSystem) {
      case 'paper': {
        return (
          <PaperDrawer.Item
            key={item.id}
            label={item.label}
            icon={(iconProps) => <IconApp testID="c42a9bde-7bf5-2cd4-6mr8-901234567e29" name={item.icon} size={iconProps.size} color={iconProps.color} />}
            active={active}
            onPress={() => navigateAndClose(item.route)}
          />
        );
      }

      case 'tamagui': {
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigateAndClose(item.route)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.primary : isDark ? '#1f2937' : '#f9fafb',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginVertical: 4,
              marginHorizontal: 12,
              borderWidth: 1,
              borderColor: active ? themeColors.primary : themeColors.border,
            }}
          >
            <IconApp testID="d53b0cef-8ca6-3de5-7ns9-012345678f30" name={item.icon} size={20} color={active ? '#ffffff' : themeColors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? '#ffffff' : themeColors.text, flex: 1 }}>
              {item.label}
            </Text>
            {active && <IconApp testID="e64c1df0-9db7-4ef6-8ot0-123456789a31" name="check" size={16} color="#ffffff" />}
          </TouchableOpacity>
        );
      }

      case 'ant': {
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigateAndClose(item.route)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.primary + '15' : 'transparent',
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: themeColors.border,
            }}
          >
            <IconApp testID="f75d2e01-0ec8-5fg7-9pu1-234567890b32" name={item.icon} size={20} color={active ? themeColors.primary : themeColors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: active ? '600' : '400', color: active ? themeColors.primary : themeColors.text, flex: 1 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }

      case 'expo': {
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigateAndClose(item.route)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.primary : isDark ? '#1e293b' : '#f1f5f9',
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 18,
              marginVertical: 4,
              marginHorizontal: 10,
            }}
          >
            <IconApp testID="a86e3f12-1fd9-6gh8-0qv2-345678901c33" name={item.icon} size={20} color={active ? '#ffffff' : themeColors.primary} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: active ? '#ffffff' : themeColors.text, flex: 1 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }

      case 'native':
      default: {
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigateAndClose(item.route)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.surface : 'transparent',
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginVertical: 2,
              borderLeftWidth: active ? 4 : 0,
              borderLeftColor: themeColors.primary,
            }}
          >
            <IconApp testID="b97f4023-2ge0-7hi9-1rw3-456789012d34" name={item.icon} size={20} color={active ? themeColors.primary : themeColors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: active ? '700' : '400', color: active ? themeColors.primary : themeColors.text }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.surface }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header Badge adapted to design system */}
        <View
          style={[
            styles.drawerHeader,
            {
              borderBottomColor: themeColors.border,
              backgroundColor: activeSystem === 'tamagui' ? (isDark ? '#1f2937' : '#f8fafc') : 'transparent',
              paddingVertical: activeSystem === 'expo' ? 20 : 16,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: themeColors.text,
              }}
            >
              {t('appName')}
            </Text>
            <View
              style={{
                backgroundColor: themeColors.primary + '20',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.primary }}>
                {activeSystem.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {mainNavItems.map(renderDrawerItem)}
      </DrawerContentScrollView>

      {/* Bottom section of the left menu */}
      <View style={[styles.bottomMenuContainer, { borderTopWidth: 1, borderTopColor: themeColors.border }]}>
        {bottomNavItems.map(renderDrawerItem)}
        <View style={{ paddingHorizontal: 12, marginVertical: 6 }}>
          <LanguageSelectorComponent onSelectLanguage={() => navigation.closeDrawer()} />
        </View>
        <DarkThemeSwitchComponent testID="darkModeSwitch1" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerHeader: { paddingHorizontal: 16, borderBottomWidth: 1, marginBottom: 8 },
  bottomMenuContainer: {
    paddingBottom: 12,
    paddingTop: 8,
  },
});
