import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../../redux/activeUserSlice';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import LanguageSelectorComponent from './LanguageSelectorComponent';
import DarkThemeSwitchComponent from './DarkThemeSwitchComponent';
import RouteVisitsTop from '../../catalog/user/visit/RouteVisitsTop';
import { buildRouteLabels } from '../../catalog/user/visit/routeVisitModel';

/** a row of the pinned part (same shape as a row of the scrolling part of the hamburger menu) */
export interface UnmovableMenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

interface HamburgerMenuUnmovableProps {
  /** draws one row in the look of the active design system (the drawer owns that code) */
  renderItem: (item: UnmovableMenuItem) => React.ReactNode;
  /** called after a language was chosen (the drawer closes) */
  onSelectLanguage?: () => void;
  /** a route of the Top 5 was pressed */
  onSelectRoute?: (route: string) => void;
  /** route key -> the name of the menu row of the scrolling part (the rows of this part are added here) */
  routeLabels?: Record<string, string>;
}

/**
 * The part of the hamburger menu that does NOT scroll with the navigation list: FIRST the Top 5 of the most visited routes (kit8/catalog/user/visit,
 * named like the menu rows), then the user profile (Sign In while signed out), Settings, the language input and the dark / light theme switch.
 */
export default function HamburgerMenuUnmovable({ renderItem, onSelectLanguage, onSelectRoute, routeLabels }: HamburgerMenuUnmovableProps) {
  const { t } = useTranslation();
  const { themeColors } = useDesignSystem();
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const items: UnmovableMenuItem[] = [
    // signed out -> "Sign In"; signed in -> "User Profile"
    isLoggedIn
      ? { id: 'userprofile', label: t('menu.userProfile'), icon: 'account_circle', route: 'user/userprofile' }
      : { id: 'signin', label: t('menu.signIn'), icon: 'login', route: 'user/signin' },
    { id: 'settings', label: t('menu.settings'), icon: 'settings', route: 'settings' },
  ];

  // the names of this part first, then the rows of the scrolling part
  const labels = buildRouteLabels([...items, ...Object.entries(routeLabels || {}).map(([route, label]) => ({ route, label }))]);

  return (
    <View testID="hamburger-unmovable" style={[styles.container, { borderTopColor: themeColors.border }]}>
      <RouteVisitsTop onSelectRoute={onSelectRoute} routeLabels={labels} />
      {items.map(renderItem)}
      <View style={styles.language}>
        <LanguageSelectorComponent onSelectLanguage={onSelectLanguage} />
      </View>
      <DarkThemeSwitchComponent testID="darkModeSwitch1" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingBottom: 12, paddingTop: 8 },
  language: { paddingHorizontal: 12, marginVertical: 6 },
});
