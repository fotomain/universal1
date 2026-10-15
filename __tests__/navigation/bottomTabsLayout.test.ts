jest.mock('react-native-safe-area-context', () => ({ SafeAreaInsetsContext: require('react').createContext(null) }));

import { bottomTabsHeight, fabBottomOffset, BOTTOM_TABS_CONTENT_HEIGHT, FAB_GAP } from '../../kit8/ui/components/navigation/bottomTabsLayout';

describe('bottomTabsLayout', () => {
  it('tab bar height includes the system bottom inset', () => {
    expect(bottomTabsHeight(0)).toBe(12 + BOTTOM_TABS_CONTENT_HEIGHT);
    expect(bottomTabsHeight(48)).toBe(bottomTabsHeight(0) + 48);
  });

  it('FAB sits FAB_GAP above the tab bar when tabs are visible', () => {
    expect(fabBottomOffset(true, 0)).toBe(bottomTabsHeight(0) + FAB_GAP);
    expect(fabBottomOffset(true, 48)).toBe(bottomTabsHeight(48) + FAB_GAP);
  });

  it('FAB clears the system bar when there are no tabs', () => {
    expect(fabBottomOffset(false, 0)).toBe(24);
    expect(fabBottomOffset(false, 48)).toBe(72);
  });
});
