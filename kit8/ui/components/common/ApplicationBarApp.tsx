import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, useWindowDimensions } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useNavigation, useRouter, usePathname } from 'expo-router';
import { DrawerHeaderProps } from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from './IconApp';
import ArrowToLeftApp from './ArrowToLeftApp';
import { useAppSignOut } from '../../../hooks/useAppSignOut';
import { useDispatch, useSelector } from 'react-redux';
import {
  refreshProjectData,
  setHideGanttChartNode,
  setHideGanttToolBar,
  setHideProjectToolBar,
  setHideTreeNode,
  showSnackbar,
} from '../../../redux/uxuiSlice';
import { usePMTip } from '../../../pm/inner/tooltip/PMTooltip';
import { shareScreenshot, shareScreenshotResultText } from '../../../lib/shareScreenshot';

/** User calendar route (kit8/catalog/user/calendar). */
const USER_CALENDAR_PATH = '/user/calendar';

/**
 * App bar icon button with a tip: hover on web, long-press on touch (kit8/pm/inner/tooltip).
 * The bubble is drawn by the root layout's tip layer (scope 'app': it covers the whole window, app bar included).
 */
function AppBarTipButton({ testID, icon, tip, onPress, color, active, activeColor, dimmed, size = 20 }: { testID: string; icon: string; tip: string; onPress: () => void; color: string; active?: boolean; activeColor?: string; dimmed?: boolean; size?: number }) {
  const t = usePMTip(tip, 'app');
  return (
    <Pressable
      ref={t.ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={tip}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      onHoverIn={t.onHoverIn}
      onHoverOut={t.onHoverOut}
      onPressIn={t.onPressIn}
      onLongPress={t.onLongPress}
      delayLongPress={t.delayLongPress}
      style={({ pressed }) => [styles.pmBtn, dimmed ? { opacity: 0.45 } : active && activeColor ? { backgroundColor: `${activeColor}1F` } : null, pressed ? { opacity: 0.6 } : null]}
    >
      <IconApp testID={`${testID}-icon`} name={icon} size={size} color={active && activeColor ? activeColor : color} />
    </Pressable>
  );
}

/** "Go to the user calendar": on every screen, right before the three dots menu. */
function AppBarCalendarButton({ color, activeColor, active, onPress }: { color: string; activeColor: string; active: boolean; onPress: () => void }) {
  return <AppBarTipButton testID="appbar-user-calendar" icon="calendar_month" tip="Calendar" size={22} onPress={onPress} color={color} active={active} activeColor={activeColor} />;
}

/** Project dashboard route: the app bar shows the view buttons there (before the three dots menu). */
const PROJECT_DASHBOARD_PATH = '/pm/project/dashboard';

/**
 * App bar buttons of the Project dashboard, right-justified before the three dots menu. They only switch
 * Redux flags (uxuiState): hideProjectToolBar · hideGanttToolBar · hideGanttChartNode · hideTreeNode ·
 * refreshProjectData (a counter - the dashboard re-reads the project when it changes).
 */
function AppBarProjectButtons({ color, activeColor }: { color: string; activeColor: string }) {
  const dispatch = useDispatch();
  const hideProjectToolBar = useSelector((s: any) => !!s.uxuiState?.hideProjectToolBar);
  const hideGanttToolBar = useSelector((s: any) => !!s.uxuiState?.hideGanttToolBar);
  const hideGanttChartNode = useSelector((s: any) => !!s.uxuiState?.hideGanttChartNode);
  const hideTreeNode = useSelector((s: any) => !!s.uxuiState?.hideTreeNode);
  const btn = (testID: string, icon: string, hidden: boolean, label: string, onPress: () => void) => (
    <AppBarTipButton key={testID} testID={testID} icon={icon} tip={`${hidden ? 'Show' : 'Hide'} ${label}`} onPress={onPress} color={color} active={!hidden} activeColor={activeColor} dimmed={hidden} />
  );
  return (
    <View style={styles.pmBtns} testID="appbar-project-buttons">
      {btn('appbar-pm-project-toolbar', 'toolbar', hideProjectToolBar, 'the project tool bar', () => dispatch(setHideProjectToolBar(!hideProjectToolBar)))}
      {btn('appbar-pm-gantt-toolbar', 'construction', hideGanttToolBar, 'the tree / Gantt tool bars', () => dispatch(setHideGanttToolBar(!hideGanttToolBar)))}
      {btn('appbar-pm-tree-node', 'account_tree', hideTreeNode, 'the task tree', () => dispatch(setHideTreeNode(!hideTreeNode)))}
      {btn('appbar-pm-chart-node', 'view_timeline', hideGanttChartNode, 'the chart (Gantt / Kanban / Versions)', () => dispatch(setHideGanttChartNode(!hideGanttChartNode)))}
      <AppBarTipButton testID="appbar-pm-refresh" icon="refresh" tip="Refresh the project data" onPress={() => dispatch(refreshProjectData())} color={color} />
    </View>
  );
}

export default function ApplicationBarApp({ route, options }: DrawerHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { handleSignOut } = useAppSignOut();
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const title = options?.title || route?.name || t('menu.home');

  const [visible, setVisible] = useState(false);
  const dispatch = useDispatch();
  const isProjectDashboard = !!pathname && pathname.startsWith(PROJECT_DASHBOARD_PATH);
  const hasCurrentJSON = useSelector((s: any) => !!s.uxuiState?.currentJSON);
  // Phone width: the Project dashboard has 7 buttons on the right. The title gives its place to them
  // (otherwise the three dots menu is pushed off the screen).
  const { width: windowWidth } = useWindowDimensions();
  const hideTitle = isProjectDashboard && windowWidth < 480;
  const isUserCalendar = !!pathname && pathname.startsWith(USER_CALENDAR_PATH);
  const handleCalendar = () => {
    if (!isUserCalendar) router.push(USER_CALENDAR_PATH as any);
  };
  const calendarButton = <AppBarCalendarButton color={themeColors.text} activeColor={themeColors.primary} active={isUserCalendar} onPress={handleCalendar} />;

  /** Three dots menu: "Share screenshot" / "Share screenshot + JSON" (uxui.currentJSON). */
  const handleShareScreenshot = (withJSON: boolean) => {
    setVisible(false);
    // after the menu has faded out, so it is not in the picture
    setTimeout(async () => {
      const r = await shareScreenshot({ withJSON });
      if (r !== 'shared') dispatch(showSnackbar(shareScreenshotResultText(r, withJSON)));
    }, 350);
  };

  const isHome = pathname === '/home' || pathname === '/' || route?.name === 'home' || route?.name === 'index';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleSignIn = () => {
    closeMenu();
    router.push('/signin');
  };

  const handleSignUp = () => {
    closeMenu();
    router.push('/signup');
  };

  const onSignOutClick = async () => {
    closeMenu();
    await handleSignOut();
  };

  const handleSettings = () => {
    closeMenu();
    try {
      if ((router as any).navigate) {
        (router as any).navigate('/settings');
      } else {
        router.replace('/settings');
      }
    } catch (e) {
      router.replace('/settings');
    }
  };

  const handleDesigns = () => {
    closeMenu();
    try {
      if ((router as any).navigate) {
        (router as any).navigate('/kit8/designs');
      } else {
        router.replace('/kit8/designs');
      }
    } catch (e) {
      router.replace('/kit8/designs');
    }
  };

  const renderRightMenuOverlay = () => {
    if (!visible) return null;

    return (
      <Modal transparent visible={visible} animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
                borderRadius: activeSystem === 'expo' ? 20 : activeSystem === 'tamagui' ? 14 : 8,
              },
            ]}
          >
            <TouchableOpacity style={styles.menuRow} onPress={handleSignIn}>
              <IconApp testID="ca805134-3hf1-8ij0-2sx4-567890123e35" name="login" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>{t('menu.signIn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleSignUp}>
              <IconApp testID="db916245-4ig2-9jk1-3ty5-678901234f36" name="account-plus" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>{t('menu.signUp')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={onSignOutClick}>
              <IconApp testID="ec027356-5jh3-0kl2-4uz6-789012345a37" name="logout" size={18} color={themeColors.error} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.error }}>{t('menu.signOut')}</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: themeColors.border, marginVertical: 4 }} />

            <TouchableOpacity testID="appbar-menu-share-screenshot" style={styles.menuRow} onPress={() => handleShareScreenshot(false)}>
              <IconApp testID="appbar-menu-share-screenshot-icon" name="screenshot_monitor" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>Share screenshot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="appbar-menu-share-screenshot-json"
              style={[styles.menuRow, !hasCurrentJSON && { opacity: 0.45 }]}
              disabled={!hasCurrentJSON}
              onPress={() => handleShareScreenshot(true)}
            >
              <IconApp testID="appbar-menu-share-screenshot-json-icon" name="data_object" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>Share screenshot + JSON</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: themeColors.border, marginVertical: 4 }} />

            <TouchableOpacity style={styles.menuRow} onPress={handleDesigns}>
              <IconApp testID="fd138467-6ki4-1lm3-5va7-890123456b38" name="palette" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>Kit8 Designs</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleSettings}>
              <IconApp testID="ae249578-7lj5-2mn4-6wb8-901234567c39" name="settings" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>{t('menu.settings')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    );
  };

  const handleOpenDrawer = () => {
    try {
      (navigation as any)?.dispatch?.({ type: 'OPEN_DRAWER' });
    } catch (e) {
      try {
        (navigation as any)?.openDrawer?.();
      } catch (err) {
        try {
          (navigation as any)?.toggleDrawer?.();
        } catch (e2) {}
      }
    }
  };

  switch (activeSystem) {
    case 'paper': {
      return (
        <Appbar.Header elevated style={{ backgroundColor: themeColors.surface }}>
          <Appbar.Action icon="menu" onPress={handleOpenDrawer} />
          {!isHome && (
            <Appbar.Action
              icon="arrow-left"
              onPress={handleBack}
            />
          )}
          {hideTitle ? <View style={{ flex: 1 }} /> : <Appbar.Content title={title} />}
          {isProjectDashboard && <AppBarProjectButtons color={themeColors.text} activeColor={themeColors.primary} />}
          {calendarButton}
          <TouchableOpacity onPress={visible ? closeMenu : openMenu} style={styles.actionBtn}>
            <IconApp testID="bf350689-8mk6-3no5-7xc9-012345678d40" name={visible ? 'close' : 'more_vert'} size={22} color={themeColors.text} />
          </TouchableOpacity>
          {renderRightMenuOverlay()}
        </Appbar.Header>
      );
    }

    case 'tamagui':
    case 'expo':
    case 'ant':
    case 'native':
    default: {
      return (
        <View
          style={[
            styles.headerContainer,
            {
              backgroundColor: themeColors.surface,
              borderBottomColor: themeColors.border,
              borderBottomWidth: activeSystem === 'ant' ? 1 : 0.5,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div
              onClick={handleOpenDrawer}
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TouchableOpacity
                onPress={handleOpenDrawer}
                style={styles.actionBtn}
              >
                <IconApp testID="cg461790-9nl7-4op6-8yd0-123456789e41" name="menu" size={22} color={themeColors.text} onPress={handleOpenDrawer} />
              </TouchableOpacity>
            </div>

            {!isHome && (
              <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                <ArrowToLeftApp size={22} color={themeColors.text} />
              </TouchableOpacity>
            )}

            {!hideTitle && <Text
              numberOfLines={1}
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: themeColors.text,
                marginLeft: 8,
                flexShrink: 1,
              }}
            >
              {title}
            </Text>}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isProjectDashboard && <AppBarProjectButtons color={themeColors.text} activeColor={themeColors.primary} />}
            {calendarButton}
            <TouchableOpacity onPress={openMenu} style={styles.actionBtn}>
              <IconApp testID="dh5728a1-0om8-5pq7-9ze1-234567890f42" name={visible ? 'close' : 'more_vert'} size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {renderRightMenuOverlay()}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.06)',
  },
  actionBtn: {
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 12,
  },
  pmBtns: { flexDirection: 'row', alignItems: 'center', marginRight: 2 },
  pmBtn: { padding: 5, borderRadius: 16, marginHorizontal: 1 },
  dropdownMenu: {
    width: 230,
    paddingVertical: 8,
    borderWidth: 1,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.2)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});
