import '../kit8/lib/setup-console';
import '../kit8/lib/blurPressedButtonOnWeb'; // web: no "Blocked aria-hidden ... retained focus" warning on navigation
import React, {useEffect, useMemo} from 'react';
import {ColorValue, Platform} from 'react-native';

import {Drawer} from 'expo-router/drawer';
import {PMTooltipLayer} from '../kit8/pm/inner/tooltip/PMTooltip';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {PaperProvider} from 'react-native-paper';
import {useMaterial3Theme} from '@pchmn/expo-material3-theme';
import {useTranslation} from 'react-i18next';
import {useDispatch, useSelector, useStore} from 'react-redux';
import '../kit8/i18n/i18n';
import ApplicationBarApp from '../kit8/ui/components/common/ApplicationBarApp';
import CustomDrawerContent from '../kit8/ui/components/CustomDrawerContent';
import WithSQLiteNative from '../kit8/providers/WithSQLiteNative';
import WithSupabase, {useSupabase} from '../kit8/providers/WithSupabase';
import { useAuthRedirectHandler } from '../kit8/auth/session/useAuthRedirectHandler';
import {useUserWorkPlace, WithUserWorkPlace} from '../kit8/providers/WithUserWorkPlace';
import WithState from '../kit8/redux/WithState';
import BusyConflictsWindow from '../kit8/pm/view/task/plan/BusyConflictsWindow';
import {clearActiveUser, formatTo32CharGUID, selectIsLoggedIn, setActiveUser, UserOrganization} from '../kit8/redux/activeUserSlice';
import { dropSavedUserWhenSessionGone } from '../kit8/auth/session/sessionGuard';
import * as Crypto from 'expo-crypto';
import {saveUserData} from '../kit8/lib/localSecureStorage';
import { loginUserTable, readDatabaseUserGUID } from '../kit8/auth/user/userTableLogin';
import { DEFAULT_COUNTRIES } from '../kit8/catalog/country/countryModel';

import {CustomDarkTheme, CustomLightTheme} from '../kit8/ui/theme/palettes';
import {FABProvider} from '../kit8/providers/FABProvider';
import {FABAppComponent} from '../kit8/ui/components/fab';
import {SystemMetaData} from '../kit8/redux/SystemMetaData';
import {applyThemeFromSupabase} from '../kit8/redux/userThemeSlice';
import WithDesignSystem from '../kit8/providers/WithDesignSystem';
import { WithAppleMacUI } from '../kit8/ui/applemacui/WithAppleMacUI';
import { appleMacUITheme } from '../kit8/ui/applemacui/appleMacUITheme';
import IconApp from '../kit8/ui/components/common/IconApp';
import SnackbarApp from '../kit8/ui/components/common/SnackbarApp';
import { ErrorModalWindow, showErrorModal } from '../kit8/ui/components/common';
import UserCalendarNotifier from '../kit8/ui/calendar/UserCalendarNotifier';
import ReminderHost from '../kit8/ui/reminder/ReminderHost';
import CalculatorWindowHost from '../kit8/ui/components/calculator/CalculatorWindowHost';
import RouteVisitTracker from '../kit8/catalog/user/visit/RouteVisitTracker';
import NfcBackgroundHandler from '../kit8/ui/components/media/nfc/NfcBackgroundHandler';
import PM80FaviconByTheme from '../apps/appPM80/home/pm80Favicon';
import { AppCustomizationProvider } from '../kit8/providers/AppCustomizationProvider';
import UserSettingsHost from '../kit8/catalog/user/settings/UserSettingsHost';
import { selectThemeSettings } from '../kit8/redux/uxuiSlice';
import { applyFontsToPaperTheme } from '../kit8/ui/fonts/paperFonts';
import { useAppFonts } from '../kit8/ui/fonts/useAppFonts';
import { getAppCustomization } from '../apps/appCustomization';
import OrganizationTextsHost from '../kit8/catalog/organization/texts/OrganizationTextsHost';
import CatalogTranslationsHost from '../kit8/catalog/translation/CatalogTranslationsHost';
import WithIntent from '../kit8/providers/WithIntent';
import IntentAddModalWindow from '../kit8/ui/components/intent/IntentAddModalWindow';

const blockError=true

// themeStore-ticket-step4: Theme store sync manager component
function ThemeStoreSyncManager() {

  if(blockError) {
    return  //TODO
  }

  const dispatch = useDispatch();
  const { supabase } = useSupabase();
  const { userWorkPlaceGUID } = useUserWorkPlace();
  const activeUserState = useSelector((state: any) => state.activeUserState);
  const userTheme = useSelector((state: any) => state.userTheme);
  const userGUID = activeUserState?.activeUserGUID;
  const isInitialMount = React.useRef(true);
  const lastSyncedThemeRef = React.useRef<string | null>(null);

  // themeStore-ticket-step4: on user sign in - themeStore readOne-must be called to read to store theme in supabase
  useEffect(() => {
    if (!userGUID || !userWorkPlaceGUID) return;

    const syncThemeOnLogin = async () => {
      try {
        console.log("themeStore-ticket-step4: Calling themeStore readOne for user:", userGUID, "user workplace:", userWorkPlaceGUID);

        if (SystemMetaData?.themeStore?.actions?.readOne) {
          dispatch(SystemMetaData.themeStore.actions.readOne({
            rowOwnerGUID: userGUID,
            rowGUID: userWorkPlaceGUID,
          }));
        }

        const tableName = SystemMetaData?.themeStore?.tableName || "themeStoreTable";
        const { data } = await supabase
          .from(tableName)
          .select("*")
          .eq("rowOwnerGUID", userGUID)
          .eq("rowGUID", userWorkPlaceGUID)
          .maybeSingle();

        if (data && data.rowJSON) {
          const incomingSnapshot = JSON.stringify(data.rowJSON);
          lastSyncedThemeRef.current = incomingSnapshot;
          console.log("themeStore-ticket-step4: Stored theme found in Supabase via readOne, setting into themeState:", data.rowJSON);
          dispatch(applyThemeFromSupabase(data.rowJSON));
        } else if (!data) {
          const initialSnapshot = JSON.stringify(userTheme);
          lastSyncedThemeRef.current = initialSnapshot;
          console.log("themeStore-ticket-step4: themeStore createOne-must be called after user is registered / signed in");
          if (SystemMetaData?.themeStore?.actions?.createOne) {
            dispatch(SystemMetaData.themeStore.actions.createOne({
              rowOwnerGUID: userGUID,
              rowGUID: userWorkPlaceGUID,
              orderInList: Date.now(),
              rowJSON: userTheme,
            }));
          }
        }
      } catch (e) {
        console.error("themeStore-ticket-step4: Error during themeStore readOne sync:", e);
      }
    };

    syncThemeOnLogin();
  }, [userGUID, userWorkPlaceGUID, supabase, dispatch]);

  // themeStore-ticket-step3: If themeState changed: themeStore record must be updated
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!userGUID || !userWorkPlaceGUID) return;

    const snapshot = JSON.stringify(userTheme);
    if (snapshot === lastSyncedThemeRef.current) {
      return;
    }

    console.log("themeStore-ticket-step3: themeState changed, updating themeStore record in Supabase...");
    if (SystemMetaData?.themeStore?.actions?.upsertOne) {
      lastSyncedThemeRef.current = snapshot;
      dispatch(SystemMetaData.themeStore.actions.upsertOne({
        rowOwnerGUID: userGUID,
        rowGUID: userWorkPlaceGUID,
        orderInList: Date.now(),
        rowJSON: userTheme,
      }));
    }
  }, [userTheme, userGUID, userWorkPlaceGUID, dispatch]);

  // themeStore-ticket-step2: Listen for realtime updates from supabaseOnUpdateTrigger.
  // Ignore echo updates whose payload already matches the current local state to avoid a nonstop loop
  // when the app writes the same theme back to Supabase.
  useEffect(() => {
    const handleRealtimeUpdate = (event: any) => {
      const payload = event?.detail;
      const updatedRow = payload?.new;

      if (!updatedRow || updatedRow.rowOwnerGUID !== userGUID || !updatedRow.rowJSON) {
        return;
      }

      const currentThemeSnapshot = JSON.stringify({
        isDark: userTheme?.isDark,
        theme: userTheme?.theme,
        fabColor: userTheme?.fabColor,
      });
      const incomingThemeSnapshot = JSON.stringify(updatedRow.rowJSON);

      if (incomingThemeSnapshot === currentThemeSnapshot || incomingThemeSnapshot === lastSyncedThemeRef.current) {
        console.log("themeStore-ticket-step2-111: Skipping same-theme echo update from local write:", updatedRow.rowGUID);
        return;
      }

      lastSyncedThemeRef.current = incomingThemeSnapshot;
      console.log("themeStore-ticket-step2-222: Realtime theme update received from user workplace:", updatedRow);
      dispatch(applyThemeFromSupabase(updatedRow.rowJSON));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('supabaseThemeStoreUpdate', handleRealtimeUpdate);
      return () => {
        window.removeEventListener('supabaseThemeStoreUpdate', handleRealtimeUpdate);
      };
    }
  }, [userGUID, userTheme, dispatch]);

  return null;
}

function SupabaseAuthSync() {
  const { supabase } = useSupabase();
  const dispatch = useDispatch();
  const store = useStore();
  // email "confirm via web link": deep link -> session (native), link errors (web)
  useAuthRedirectHandler(supabase);

  useEffect(() => {
    let cancelled = false;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        // the saved user (profile page, menu) must not claim "signed in" when Supabase has no session any more
        setTimeout(() => {
          dropSavedUserWhenSessionGone(
            supabase,
            event,
            session,
            () => selectIsLoggedIn(store.getState()),
            () => dispatch(clearActiveUser()),
          );
        }, 0);
      }
      if (session?.user) {
        const sessionUser = session.user;
        // Run after the auth event (Supabase must not be called from inside its own auth callback).
        setTimeout(async () => {
        const supabaseUID = sessionUser.id;
        const userEmail = sessionUser.email || '';
        const meta = sessionUser.user_metadata || {};
        const fullName = meta.full_name || meta.name || '';
        const userFirstName = meta.first_name || fullName.split(' ')[0] || userEmail.split('@')[0] || 'User';
        const userLastName = meta.last_name || fullName.split(' ').slice(1).join(' ') || '';

        // RULE: login -> userTable row of this email -> userTable.rowGUID is the user's GUID everywhere.
        // The same SQL step makes the organization of the user (userState.userOrganization): a user without one cannot exist.
        let userGUID = supabaseUID;
        let userOrganization: UserOrganization | undefined;
        try {
          const login = await loginUserTable(supabase, { email: userEmail, authUID: supabaseUID, firstName: userFirstName, lastName: userLastName });
          userGUID = login.userGUID;
          userOrganization = login.organization;
        } catch (e: any) {
          console.error('userTable login step failed, using the Supabase user id:', e?.message || e);
        }
        // the GUID the database itself takes this session for (the row policies of the media posts compare with it)
        const databaseUserGUID = await readDatabaseUserGUID(supabase);
        if (cancelled) return;
        /* userGUID32 */
        const activeUserGUID = formatTo32CharGUID(userGUID); /* userGUID32 */

        saveUserData(activeUserGUID /* userGUID32 */, userEmail, userFirstName, userLastName);
        dispatch(setActiveUser({
          activeUserGUID, /* userGUID32 */
          userGUID,
          databaseUserGUID,
          userOrganization,
          activeUserEmail: userEmail,
          activeUserFirstName: userFirstName,
          activeUserLastName: userLastName,
        }));

        // themeStore-ticket-step4: log auth event for registered/logged in user
        console.log("themeStore-ticket-step4: Auth state changed event:", event, "user:", activeUserGUID);


        // RULE: Automatically created if the first user login (default countries)
        const checkAndSeedDefaultCountries = async () => {
          try {
            const { data, count, error } = await supabase
              .from('countryTable')
              .select('rowGUID', { count: 'exact' })
              .limit(1);

            if (error) {
              console.error('Supabase country select error:', error);
              showErrorModal(error);
              return;
            }

            if (!data || data.length === 0 || count === 0) {
              const rowsToInsert = DEFAULT_COUNTRIES.map((c, idx) => ({
                rowGUID: Crypto.randomUUID ? Crypto.randomUUID() : formatTo32CharGUID(`country_${c.countryCode}_${Date.now()}`),
                rowOwnerGUID: 'countryCatalog',
                rowParentGUID: 'empty',
                orderInList: (idx + 1) * 1000,
                rowJSON: {
                  ...c,
                  isActive: true,
                },
              }));

              const { error: insertError } = await supabase.from('countryTable').insert(rowsToInsert);
              if (insertError) {
                console.error('Supabase countryTable seed error:', insertError);
              } else {
                console.log('Successfully seeded default countries in countryTable');
              }
            }
          } catch (e) {
            console.error('Error checking/seeding countries:', e);
          }
        };

        checkAndSeedDefaultCountries();
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, dispatch]);

  return null;
}

/** Tips of the app bar buttons (hover on web, long-press on touch): one layer over the whole window. */
function AppTooltipLayer() {
  return <PMTooltipLayer scope="app" />;
}

function RootLayoutContent() {
  const { theme } = useMaterial3Theme();
  const { t } = useTranslation();
  const darkMode = useSelector((state: any) => Boolean(state.uxuiState?.darkMode));
  const userTheme = useSelector((state: any) => state.userTheme);

  // Use userTheme if available, otherwise fallback to darkMode
  const basePaperTheme = userTheme?.theme || (darkMode ? CustomDarkTheme : CustomLightTheme);
  // the font the user chose (userSettingsTable): drawn once its files are loaded, until then the system font
  const themeSettings = useSelector(selectThemeSettings);
  const fontReady = useAppFonts(themeSettings.fontName);
  const paperTheme = useMemo(
    () => applyFontsToPaperTheme(basePaperTheme, fontReady ? themeSettings.fontName : 'system', themeSettings.fontSize, Platform.OS === 'web'),
    [basePaperTheme, fontReady, themeSettings.fontName, themeSettings.fontSize],
  );

  // the drawer passes { color: ColorValue, size, focused }; IconApp takes a string color
  const renderHomeDrawerIcon = ({ size, color }: { size: number; color: ColorValue; focused?: boolean }) => (
    <IconApp testID="e2a87b1c-9d3f-4e56-8a90-123456789a01" name="home" size={size} color={typeof color === 'string' ? color : undefined} />
  );

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = paperTheme.colors.background;
    }
  }, [paperTheme.colors.background]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: paperTheme.colors.background }}>
      {Platform.OS === 'web' && (
        <style>{`
          ::-webkit-scrollbar-button {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          ::-webkit-scrollbar {
            width: 14px;
            height: 14px;
          }
          ::-webkit-scrollbar-track {
            background: ${darkMode ? "#2b2930" : "#e7e0ec"};
            border-radius: 9999px;
            border: 3px solid transparent;
            background-clip: padding-box;
          }
          ::-webkit-scrollbar-thumb {
            background: ${paperTheme.colors.primary || "#6750A4"};
            border-radius: 9999px;
            border: 3px solid transparent;
            background-clip: padding-box;
            min-height: 48px;
            box-shadow: ${darkMode ? "0 2px 6px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.15)"};
            cursor: pointer;
            transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          ::-webkit-scrollbar-thumb:hover {
            background: ${darkMode ? "#d0bcff" : "#4f378b"};
            box-shadow: ${darkMode ? "0 4px 10px rgba(0,0,0,0.6)" : "0 4px 10px rgba(0,0,0,0.25)"};
          }
          ::-webkit-scrollbar-thumb:active {
            background: ${darkMode ? "#e8def8" : "#381e72"};
            box-shadow: ${darkMode ? "0 6px 14px rgba(0,0,0,0.7)" : "0 6px 14px rgba(0,0,0,0.35)"};
            cursor: grabbing;
          }
        `}</style>
      )}
      <WithDesignSystem>
        <PaperProvider theme={paperTheme}>
          <WithAppleMacUI theme={appleMacUITheme}>
          <FABProvider>
            <SupabaseAuthSync />
            <UserSettingsHost />
            <ThemeStoreSyncManager />

            <Drawer
              drawerContent={(props) => <CustomDrawerContent {...props} />}
              screenOptions={{ 
                header: (props) => <ApplicationBarApp {...props} />,
                sceneStyle: { backgroundColor: paperTheme.colors.background },
                drawerIcon: renderHomeDrawerIcon,
              }}
            >
              <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="+not-found" options={{ drawerItemStyle: { display: 'none' }, title: '404' }} />
              <Drawer.Screen name="files/view/index" options={{ drawerItemStyle: { display: 'none' }, title: 'File' }} />
              <Drawer.Screen name="user/files/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Google Drive' }} />
              <Drawer.Screen name="chat/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.chat') }} />
              <Drawer.Screen name="chat/theme/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.chat') }} />
              <Drawer.Screen name="stopscreen/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.accessStopped') }} />
              <Drawer.Screen
                name="home/index"
                options={{
                  title: t('menu.home'),
                  drawerLabel: t('menu.home'),
                }}
              />
              {/* appPM80: the setup of the Business order of the home (opened by the layers button of the home; Back = Home) */}
              <Drawer.Screen name="pm/business-order/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Business order' }} />
              <Drawer.Screen name="kit8/designs/index" options={{ title: 'Kit8 Designs' }} />
              <Drawer.Screen name="settings/index" options={{ title: t('menu.settings') }} />
              <Drawer.Screen name="sqlite/demo/native/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.sqliteDemo') }} />
              <Drawer.Screen name="user/userprofile/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.userProfile') }} />
              <Drawer.Screen name="about/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.about') }} />
              <Drawer.Screen name="user/signup/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.signUp') }} />
              <Drawer.Screen name="user/signin/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.signIn') }} />
              <Drawer.Screen name="user/forgotpassword/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.resetPasswordTitle') }} />
              <Drawer.Screen name="posts/mediapostcrud/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.posts') }} />
              <Drawer.Screen name="feedback/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.feedback') }} />
              <Drawer.Screen name="map/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.map') }} />

              <Drawer.Screen name="developer1/index" options={{ title: t('drawer.developer1') }} />
              <Drawer.Screen name="demo/foldertree/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Folder tree 200k' }} />
              <Drawer.Screen name="demo/list/reusable/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Reusable list demo' }} />
              <Drawer.Screen name="demo/carousel/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Carousel Vendors' }} />
              <Drawer.Screen name="demo/carousel/CarouselVendorsPaper" options={{ drawerItemStyle: { display: 'none' }, title: 'Carousel Vendors (Paper)' }} />
              <Drawer.Screen name="pm/project/dashboard/index" options={{ title: t('drawer.projects'), drawerLabel: t('drawer.projects') }} />
              <Drawer.Screen name="pm/project/estimation/dashboard/index" options={{ title: t('drawer.estimationDashboard'), drawerLabel: t('drawer.estimationDashboard') }} />
              <Drawer.Screen name="catalog/product/dashboard/index" options={{ title: t('drawer.products'), drawerLabel: t('drawer.products') }} />
              <Drawer.Screen name="catalog/resourcerole/dashboard/index" options={{ title: t('drawer.resourceRoles'), drawerLabel: t('drawer.resourceRoles') }} />
              <Drawer.Screen name="catalog/management/genus/list/index" options={{ title: t('drawer.managementGenus'), drawerLabel: t('drawer.managementGenus') }} />
              <Drawer.Screen name="catalog/management/activity_genus/list/index" options={{ title: t('drawer.activityGenus'), drawerLabel: t('drawer.activityGenus') }} />
              <Drawer.Screen name="catalog/distribution/list/index" options={{ title: t('drawer.distribution'), drawerLabel: t('drawer.distribution') }} />
              <Drawer.Screen name="catalog/management/calendar/list/index" options={{ title: t('drawer.managementCalendars'), drawerLabel: t('drawer.managementCalendars') }} />
              <Drawer.Screen name="catalog/budget/item/list/index" options={{ title: t('drawer.budgetItems'), drawerLabel: t('drawer.budgetItems') }} />
              <Drawer.Screen name="catalog/budget/scenario/list/index" options={{ title: t('drawer.budgetScenarios'), drawerLabel: t('drawer.budgetScenarios') }} />
              <Drawer.Screen name="catalog/legal/entity/index" options={{ title: t('drawer.legalEntities'), drawerLabel: t('drawer.legalEntities') }} />
              <Drawer.Screen name="user/visits/index" options={{ title: t('drawer.routesVisits'), drawerLabel: t('drawer.routesVisits') }} />
              <Drawer.Screen name="user/permissions/index" options={{ title: t('drawer.permissions'), drawerLabel: t('drawer.permissions') }} />
              <Drawer.Screen name="catalog/organization/texts/index" options={{ title: t('drawer.applicationTexts'), drawerLabel: t('drawer.applicationTexts') }} />
              <Drawer.Screen name="system/costcalculator" options={{ title: t('drawer.costCalculator'), drawerLabel: t('drawer.costCalculator') }} />
              <Drawer.Screen name="catalog/organization/members/index" options={{ title: t('drawer.organizationMembers'), drawerLabel: t('drawer.organizationMembers') }} />
              {/* a route file that is NOT declared here opens Home instead of its screen (seen 2026-11-25 on the SDK 58 tree): every screen the menu or a button opens is declared */}
              <Drawer.Screen name="catalog/project/index" options={{ title: t('drawer.projects'), drawerLabel: t('drawer.projects') }} />
              <Drawer.Screen name="catalog/organization/index" options={{ title: t('drawer.organizations'), drawerLabel: t('drawer.organizations') }} />
              <Drawer.Screen name="catalog/organization/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.organizations') }} />
              <Drawer.Screen name="catalog/partner/list/index" options={{ title: t('drawer.partners'), drawerLabel: t('drawer.partners') }} />
              <Drawer.Screen name="catalog/partner/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.partners') }} />
              <Drawer.Screen name="catalog/person/list/index" options={{ title: t('drawer.persons'), drawerLabel: t('drawer.persons') }} />
              <Drawer.Screen name="catalog/person/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.persons') }} />
              <Drawer.Screen name="catalog/country/index" options={{ title: t('drawer.countries'), drawerLabel: t('drawer.countries') }} />
              <Drawer.Screen name="catalog/country/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.countries') }} />
              <Drawer.Screen name="catalog/country/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.countries') }} />
              <Drawer.Screen name="catalog/money/account/index" options={{ title: t('drawer.moneyAccounts'), drawerLabel: t('drawer.moneyAccounts') }} />
              <Drawer.Screen name="catalog/work/center/index" options={{ title: t('drawer.workCenters'), drawerLabel: t('drawer.workCenters') }} />
              <Drawer.Screen name="catalog/management/templateresourcecontract/list/index" options={{ title: t('drawer.resourceContractTemplates'), drawerLabel: t('drawer.resourceContractTemplates') }} />
              <Drawer.Screen name="catalog/person/dashboard/index" options={{ title: t('drawer.personsProps'), drawerLabel: t('drawer.personsProps') }} />
              <Drawer.Screen name="catalog/equipment/dashboard/index" options={{ title: t('drawer.equipmentProps'), drawerLabel: t('drawer.equipmentProps') }} />
              <Drawer.Screen name="catalog/business/unit/index" options={{ title: t('drawer.businessUnits'), drawerLabel: t('drawer.businessUnits') }} />
              <Drawer.Screen name="catalog/currency/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.currencies') }} />
              <Drawer.Screen name="catalog/currency/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Currency' }} />
              <Drawer.Screen name="catalog/currency/exchange/list/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Exchange rates' }} />
              <Drawer.Screen name="catalog/currency/exchange/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Exchange rate' }} />
              <Drawer.Screen name="pm/kanbanstage/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.kanbanStages') }} />
              <Drawer.Screen name="pm/kanbanstage/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Kanban stage' }} />
              <Drawer.Screen name="catalog/organization/assistant/index" options={{ drawerItemStyle: { display: 'none' }, title: 'New organization assistant' }} />
              <Drawer.Screen name="pm/project/assistant/index" options={{ drawerItemStyle: { display: 'none' }, title: 'New project assistant' }} />
              <Drawer.Screen name="pm/project/assistant/import/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Import project' }} />
              <Drawer.Screen name="pm/bim/import/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Import BIM (IFC)' }} />
              <Drawer.Screen name="pm/bim/example/index" options={{ drawerItemStyle: { display: 'none' }, title: 'BIM examples' }} />
              <Drawer.Screen name="pm/bim/component/index" options={{ drawerItemStyle: { display: 'none' }, title: 'BIM component' }} />
              <Drawer.Screen name="pm/project/task/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Task' }} />
              <Drawer.Screen name="pm/project/task/edit/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Task' }} />
              <Drawer.Screen name="pm/project/task/new/index" options={{ drawerItemStyle: { display: 'none' }, title: 'New task' }} />
              <Drawer.Screen name="pm/project/task/plan/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Task plan' }} />
              <Drawer.Screen name="pm/project/task/fact/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Facts input' }} />
              <Drawer.Screen name="pm/fact/list/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Actuals' }} />
              <Drawer.Screen name="pm/project/task/vendor-invoice/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Vendor invoice' }} />
              <Drawer.Screen name="pm/project/task/vendor-invoice/new/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Vendor Invoice' }} />
              <Drawer.Screen name="pm/vendor-invoice/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.vendorInvoices') }} />
              <Drawer.Screen name="pm/project/task/customer-invoice/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Customer invoice' }} />
              <Drawer.Screen name="pm/project/task/customer-invoice/new/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Customer Invoice' }} />
              <Drawer.Screen name="pm/customer-invoice/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.customerInvoices') }} />
              <Drawer.Screen name="pm/project/task/payment-fact/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Payment fact' }} />
              <Drawer.Screen name="pm/payment-fact/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.paymentFacts') }} />
              <Drawer.Screen name="pm/project/task/purchase-order/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Purchase order' }} />
              <Drawer.Screen name="pm/project/task/purchase-order/new/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Purchase Order' }} />
              <Drawer.Screen name="pm/purchase-order/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.purchaseOrders') }} />
              <Drawer.Screen name="pm/project/task/product-receipt/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Product receipt' }} />
              <Drawer.Screen name="pm/product-receipt/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.productReceipts') }} />
              <Drawer.Screen name="pm/timesheet/form/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Time sheet' }} />
              <Drawer.Screen name="pm/timesheet/list/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.timeSheets') }} />
              <Drawer.Screen name="pm/reports/monitor01/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.monitor01') }} />
              <Drawer.Screen name="pm/reports/monitor02/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Monitor02' }} />
              <Drawer.Screen name="pm/reports/monitor03/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Monitor03' }} />
              <Drawer.Screen name="pm/reports/monitor08/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.monitor08') }} />
              <Drawer.Screen name="pm/reports/monitor07/customer/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.monitor07Customer') }} />
              <Drawer.Screen name="pm/reports/monitor07/vendor/index" options={{ drawerItemStyle: { display: 'none' }, title: t('drawer.monitor07Vendor') }} />
              <Drawer.Screen name="user/calendar/index" options={{ title: 'Calendar', drawerLabel: 'Calendar' }} />
              <Drawer.Screen name="user/historyofactivity/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.historyOfActivity') }} />
              <Drawer.Screen name="media/record/audio/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordAudio') }} />
              <Drawer.Screen name="media/record/video/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordVideo') }} />
              <Drawer.Screen name="media/record/photo/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordPhoto') }} />
              <Drawer.Screen name="media/scan/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.scanCodes') }} />
              <Drawer.Screen name="media/nfc/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.scanNfc') }} />
              <Drawer.Screen name="media/nfc/iddocread" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.scanId') }} />
              <Drawer.Screen name="media/nfc/identification" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.identification') }} />
              <Drawer.Screen name="media/play/audio/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.playAudio') }} />
              <Drawer.Screen name="media/play/video/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.playVideo') }} />
            </Drawer>
            <AppTooltipLayer />
            <FABAppComponent />
            {/* calendar: reminders (open the entry as a modal window) + the entry windows, on every screen */}
            <UserCalendarNotifier />
            {/* reminders with the app closed: OS scheduled notifications (phones), tap opens the entry */}
            <ReminderHost />
            {/* the standalone calculator (app bar three dots menu -> Calculator): a draggable window over the screen, kit8/ui/components/calculator */}
            <CalculatorWindowHost />
            {/* counts the screens the user opens (app_route_visits_turnover) while the Organization switch numberOfVisitsFunctionalityEnabled is on */}
            <RouteVisitTracker />
            {/* a tag that starts the app / touches the phone in the background goes into the NFC inbox (kit8/ui/components/media/nfc) */}
            <NfcBackgroundHandler />
            {/* appPM80 on web: the tab icon on a transparent background while the theme is not dark */}
            <PM80FaviconByTheme />
            {/* the texts the administrator replaced for the organization (organizationTextTable): read once after the sign in, used by pmT / t() / the column headers */}
            <OrganizationTextsHost />
            {/* the translated titles of catalog items for the interface language (catalogTranslationTable, SQL PART 56): read after the sign in and on a language change */}
            <CatalogTranslationsHost />
            {/* share intent (uxui.intentInfo): RadioSetApp asks what to add */}
            <IntentAddModalWindow />
            <SnackbarApp />
            <ErrorModalWindow />
            <BusyConflictsWindow />
          </FABProvider>
          </WithAppleMacUI>
        </PaperProvider>
      </WithDesignSystem>
    </GestureHandlerRootView>
  );
}

const pmGanttQueryClient = new QueryClient();

export default function RootLayout() {
  const initialSupabaseConfig = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://czgrxgzdmodkkmbmraub.supabase.co',
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Z3J4Z3pkbW9ka2ttYm1yYXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTU3MzYsImV4cCI6MjA3NzE3MTczNn0.4aul_NOjMO_VEKOgxFE3-Z5plqH1g8aSN8xJEgHPYR8',
  };

  return (
    <AppCustomizationProvider value={getAppCustomization()}>
    <WithUserWorkPlace>
      <WithSupabase initialConfig={initialSupabaseConfig}>
        <WithSQLiteNative>
          <WithState>
            <QueryClientProvider client={pmGanttQueryClient}>
              {/* mobile: content shared from other apps -> uxui.intentInfo -> "what to add?" */}
              <WithIntent>
                <RootLayoutContent />
              </WithIntent>
            </QueryClientProvider>
          </WithState>
        </WithSQLiteNative>
      </WithSupabase>
    </WithUserWorkPlace>
    </AppCustomizationProvider>
  );
}