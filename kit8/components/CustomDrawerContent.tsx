import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Drawer as PaperDrawer } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../redux/activeUserSlice';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from './common/IconApp';
import LanguageSelectorComponent from './LanguageSelectorComponent';
import DarkThemeSwitchComponent from './DarkThemeSwitchComponent';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  /** accordion group (e.g. Catalogs): the row toggles, its children are compact sub-rows */
  children?: MenuItem[];
}

/** height of an accordion sub-row (Catalogs -> Currencies ...) */
export const DRAWER_SUBITEM_HEIGHT = 32;

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const isLoggedIn = useSelector(selectIsLoggedIn);

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
    {
      id: 'catalogs',
      label: 'Catalogs',
      icon: 'menu_book',
      route: '',
      children: [{ id: 'currencies', label: 'Currencies', icon: 'payments', route: 'currency/list' }],
    },
    { id: 'pm-projects', label: 'Projects', icon: 'view_timeline', route: 'pm/project/dashboard' },
  ];

  // ---- accordion groups: open / closed; a group opens by itself while one of its pages is shown ----
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groupHasActive = (item: MenuItem) => !!item.children?.some((c) => isCurrentRoute(c.route) || isCurrentRoute(c.route.replace(/\/list$/, '/edit')));
  const isGroupOpen = (item: MenuItem) => openGroups[item.id] ?? groupHasActive(item);
  const pressItem = (item: MenuItem) => {
    if (item.children) setOpenGroups((g) => ({ ...g, [item.id]: !isGroupOpen(item) }));
    else navigateAndClose(item.route);
  };
  /** tamagui paints the active row in the primary color -> white chevron there */
  const chevronColor = (active: boolean) => (active && activeSystem === 'tamagui' ? '#ffffff' : themeColors.text);
  /** chevron at the end of a group row (▾ open / ▸ closed) */
  const groupChevron = (item: MenuItem, color: string) =>
    item.children ? (
      <View style={{ marginLeft: 'auto', transform: [{ rotate: isGroupOpen(item) ? '90deg' : '0deg' }] }} testID={`drawer-group-chevron-${item.id}`}>
        <IconApp name="chevron_forward" size={18} color={color} />
      </View>
    ) : null;

  /** compact sub-row of an accordion group */
  const renderSubItem = (item: MenuItem) => {
    const active = isCurrentRoute(item.route);
    return (
      <TouchableOpacity
        key={item.id}
        testID={`drawer-subitem-${item.id}`}
        accessibilityRole="menuitem"
        onPress={() => navigateAndClose(item.route)}
        activeOpacity={0.7}
        style={[
          styles.subItem,
          {
            backgroundColor: active ? themeColors.primary + '18' : 'transparent',
            borderLeftColor: active ? themeColors.primary : 'transparent',
          },
        ]}
      >
        <IconApp name={item.icon} size={16} color={active ? themeColors.primary : themeColors.text} style={{ marginRight: 10 }} />
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? themeColors.primary : themeColors.text }}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  /** a normal row, or a group row + (when open) its compact sub-rows */
  const renderNavEntry = (item: MenuItem) =>
    item.children ? (
      <View key={item.id} testID={`drawer-group-${item.id}`}>
        {renderDrawerItem(item)}
        {isGroupOpen(item) && <View testID={`drawer-group-items-${item.id}`}>{item.children.map(renderSubItem)}</View>}
      </View>
    ) : (
      renderDrawerItem(item)
    );

  const bottomNavItems: MenuItem[] = [
    // signed out -> "Sign In"; signed in -> "User Profile"
    isLoggedIn
      ? { id: 'userprofile', label: t('menu.userProfile'), icon: 'account_circle', route: 'userprofile' }
      : { id: 'signin', label: t('menu.signIn'), icon: 'login', route: 'signin' },
    { id: 'settings', label: t('menu.settings'), icon: 'settings', route: 'settings' },
  ];

  const renderDrawerItem = (item: MenuItem) => {
    // a group row is "active" (highlighted) only while closed and one of its pages is shown
    const active = item.children ? !isGroupOpen(item) && groupHasActive(item) : isCurrentRoute(item.route);

    switch (activeSystem) {
      case 'paper': {
        return (
          <PaperDrawer.Item
            key={item.id}
            testID={`drawer-item-${item.id}`}
            label={item.label}
            icon={(iconProps) => <IconApp testID="c42a9bde-7bf5-2cd4-6mr8-901234567e29" name={item.icon} size={iconProps.size} color={iconProps.color} />}
            active={active}
            right={item.children ? () => groupChevron(item, themeColors.text) : undefined}
            onPress={() => pressItem(item)}
          />
        );
      }

      case 'tamagui': {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
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
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }

      case 'ant': {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
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
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }

      case 'expo': {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
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
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }

      case 'native':
      default: {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
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
            {groupChevron(item, chevronColor(active))}
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

        {mainNavItems.map(renderNavEntry)}
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
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DRAWER_SUBITEM_HEIGHT,
    paddingLeft: 48,
    paddingRight: 12,
    marginHorizontal: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  bottomMenuContainer: {
    paddingBottom: 12,
    paddingTop: 8,
  },
});
