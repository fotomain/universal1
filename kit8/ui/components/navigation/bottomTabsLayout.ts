// Vertical layout of the bottom tabs and of the floating button (FAB) above them.
// Both read the system bottom inset (Android 3-button / gesture bar, iPhone home indicator),
// so the tab labels are never covered by the system bar and the FAB sits right above the tabs.

import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/** height of the tab row itself (icon + label), without the system inset */
export const BOTTOM_TABS_CONTENT_HEIGHT = 64;
/** padding above and below the tab row */
export const BOTTOM_TABS_PADDING = 6;
/** gap between the FAB and the tabs (or the screen bottom when there are no tabs) */
export const FAB_GAP = 16;

/** system bottom inset in dp; 0 on web and without a SafeAreaProvider (tests) */
export function useBottomInset(): number {
  const insets = useContext(SafeAreaInsetsContext);
  return insets?.bottom ?? 0;
}

/** total height of the tab bar = padding + row + padding + system inset */
export function bottomTabsHeight(bottomInset: number): number {
  return BOTTOM_TABS_PADDING * 2 + BOTTOM_TABS_CONTENT_HEIGHT + bottomInset;
}

/** `bottom` of the FAB container */
export function fabBottomOffset(tabsVisible: boolean, bottomInset: number): number {
  return tabsVisible ? bottomTabsHeight(bottomInset) + FAB_GAP : bottomInset + 24;
}
