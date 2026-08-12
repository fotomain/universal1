import '../kit8/lib/setup-console';
import React, {useEffect} from 'react';
import {Platform} from 'react-native';

import {Drawer} from 'expo-router/drawer';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {PaperProvider} from 'react-native-paper';
import {useMaterial3Theme} from '@pchmn/expo-material3-theme';
import {useTranslation} from 'react-i18next';
import {useDispatch, useSelector} from 'react-redux';
import '../kit8/i18n/i18n';
import AppBar from '../kit8/ui/AppBar';
import CustomDrawerContent from '../kit8/components/CustomDrawerContent';
import {MD3Provider, useMD3Ready} from '../kit8/providers/MD3Provider';
import SQLiteNativeProvider from '../kit8/providers/SQLiteNativeProvider';
import WithSupabase, {useSupabase} from '../kit8/providers/WithSupabase';
import {useWorkPlace, WithWorkPlace} from '../kit8/providers/WithWorkPlace';
import WithState from '../kit8/redux/WithState';
import {formatTo32CharGUID, setActiveUser} from '../kit8/redux/activeUserSlice';
import {saveUserData} from '../kit8/lib/localSecureStorage';

import {CustomDarkTheme, CustomLightTheme} from '../kit8/theme/palettes';
import {FABProvider} from '../kit8/providers/FABProvider';
import {FABAppComponent} from '../kit8/components/fab';
import {SystemMetaData} from '../kit8/redux/SystemMetaData';
import {applyThemeFromSupabase} from '../kit8/redux/userThemeSlice';
import {DesignSystemProvider} from '../kit8/providers/DesignSystemContext';
import IconApp from '../components/common/IconApp';
import SnackbarApp from '../components/common/SnackbarApp';

const blockError=true

// themeStore-ticket-step4: Theme store sync manager component
function ThemeStoreSyncManager() {
  const dispatch = useDispatch();
  const { supabase } = useSupabase();
  const { workPlaceGUID } = useWorkPlace();
  const activeUserState = useSelector((state: any) => state.activeUserState);
  const userTheme = useSelector((state: any) => state.userTheme);
  const userGUID = activeUserState?.activeUserGUID;
  const isInitialMount = React.useRef(true);
  const lastSyncedThemeRef = React.useRef<string | null>(null);

  // themeStore-ticket-step4: on user sign in - themeStore readOne-must be called to read to store theme in supabase
  useEffect(() => {
    if (blockError) return;
    if (!userGUID || !workPlaceGUID) return;

    const syncThemeOnLogin = async () => {
      try {
        console.log("themeStore-ticket-step4: Calling themeStore readOne for user:", userGUID, "workplace:", workPlaceGUID);

        if (SystemMetaData?.themeStore?.actions?.readOne) {
          dispatch(SystemMetaData.themeStore.actions.readOne({
            mediaPostOwnerGUID: userGUID,
            mediaPostGUID: workPlaceGUID,
          }));
        }

        const tableName = SystemMetaData?.themeStore?.tableName || "themeStoreTable";
        const { data } = await supabase
          .from(tableName)
          .select("*")
          .eq("mediaPostOwnerGUID", userGUID)
          .eq("mediaPostGUID", workPlaceGUID)
          .maybeSingle();

        if (data && data.mediaPostJSON) {
          const incomingSnapshot = JSON.stringify(data.mediaPostJSON);
          lastSyncedThemeRef.current = incomingSnapshot;
          console.log("themeStore-ticket-step4: Stored theme found in Supabase via readOne, setting into themeState:", data.mediaPostJSON);
          dispatch(applyThemeFromSupabase(data.mediaPostJSON));
        } else if (!data) {
          const initialSnapshot = JSON.stringify(userTheme);
          lastSyncedThemeRef.current = initialSnapshot;
          console.log("themeStore-ticket-step4: themeStore createOne-must be called after user is registered / signed in");
          if (SystemMetaData?.themeStore?.actions?.createOne) {
            dispatch(SystemMetaData.themeStore.actions.createOne({
              mediaPostOwnerGUID: userGUID,
              mediaPostGUID: workPlaceGUID,
              orderInList: Date.now(),
              mediaPostJSON: userTheme,
            }));
          }
        }
      } catch (e) {
        console.error("themeStore-ticket-step4: Error during themeStore readOne sync:", e);
      }
    };

    syncThemeOnLogin();
  }, [userGUID, workPlaceGUID, supabase, dispatch]);

  // themeStore-ticket-step3: If themeState changed: themeStore record must be updated
  useEffect(() => {
    if (blockError) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!userGUID || !workPlaceGUID) return;

    const snapshot = JSON.stringify(userTheme);
    if (snapshot === lastSyncedThemeRef.current) {
      return;
    }

    console.log("themeStore-ticket-step3: themeState changed, updating themeStore record in Supabase...");
    if (SystemMetaData?.themeStore?.actions?.upsertOne) {
      lastSyncedThemeRef.current = snapshot;
      dispatch(SystemMetaData.themeStore.actions.upsertOne({
        mediaPostOwnerGUID: userGUID,
        mediaPostGUID: workPlaceGUID,
        orderInList: Date.now(),
        mediaPostJSON: userTheme,
      }));
    }
  }, [userTheme, userGUID, workPlaceGUID, dispatch]);

  // themeStore-ticket-step2: Listen for realtime updates from supabaseOnUpdateTrigger.
  // Ignore echo updates whose payload already matches the current local state to avoid a nonstop loop
  // when the app writes the same theme back to Supabase.
  useEffect(() => {
    if (blockError) return;
    const handleRealtimeUpdate = (event: any) => {
      const payload = event?.detail;
      const updatedRow = payload?.new;

      if (!updatedRow || updatedRow.mediaPostOwnerGUID !== userGUID || !updatedRow.mediaPostJSON) {
        return;
      }

      const currentThemeSnapshot = JSON.stringify({
        isDark: userTheme?.isDark,
        theme: userTheme?.theme,
        fabColor: userTheme?.fabColor,
      });
      const incomingThemeSnapshot = JSON.stringify(updatedRow.mediaPostJSON);

      if (incomingThemeSnapshot === currentThemeSnapshot || incomingThemeSnapshot === lastSyncedThemeRef.current) {
        console.log("themeStore-ticket-step2-111: Skipping same-theme echo update from local write:", updatedRow.mediaPostGUID);
        return;
      }

      lastSyncedThemeRef.current = incomingThemeSnapshot;
      console.log("themeStore-ticket-step2-222: Realtime theme update received from workplace:", updatedRow);
      dispatch(applyThemeFromSupabase(updatedRow.mediaPostJSON));
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

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const supabaseUID = session.user.id;
        /* userGUID32 */
        const activeUserGUID = formatTo32CharGUID(supabaseUID); /* userGUID32 */
        const userEmail = session.user.email || '';
        const meta = session.user.user_metadata || {};
        const fullName = meta.full_name || meta.name || '';
        const userFirstName = meta.first_name || fullName.split(' ')[0] || userEmail.split('@')[0] || 'User';
        const userLastName = meta.last_name || fullName.split(' ').slice(1).join(' ') || '';

        saveUserData(activeUserGUID /* userGUID32 */, userEmail, userFirstName, userLastName);
        dispatch(setActiveUser({
          activeUserGUID, /* userGUID32 */
          activeUserEmail: userEmail,
          activeUserFirstName: userFirstName,
          activeUserLastName: userLastName,
        }));

        // themeStore-ticket-step4: log auth event for registered/logged in user
        console.log("themeStore-ticket-step4: Auth state changed event:", event, "user:", activeUserGUID);

        // RULE: If user logged in and not exist in raciMemberTable - app must create new
        const checkAndCreateRaciMember = async () => {
          try {
            const { data, error } = await supabase
              .from('raciMemberTable')
              .select('mediaPostGUID')
              .eq('mediaPostGUID', activeUserGUID);

            if (error) {
              console.error('Supabase select error:', error);
              return;
            }

            if (!data || data.length === 0) {
              const { error: insertError } = await supabase.from('raciMemberTable').insert({
                mediaPostGUID: activeUserGUID,
                mediaPostOwnerGUID: userEmail,
                orderInList: Date.now(),
                mediaPostJSON: {
                  raciGUID: activeUserGUID,
                  raciEmail: userEmail,
                  raciFirstName: userFirstName,
                  raciLastName: userLastName,
                },
              });
              
              if (insertError) {
                console.error('Supabase insert error:', insertError);
              } else {
                console.log('Successfully created user in raciMemberTable');
              }
            }
          } catch (e) {
            console.error('Error checking/creating raciMember:', e);
          }
        };
        
        checkAndCreateRaciMember();
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, dispatch]);

  return null;
}

function RootLayoutContent() {
  const appIsReady = (Platform.OS === 'web') ? useMD3Ready() : true;
  const { theme } = useMaterial3Theme();
  const { t } = useTranslation();
  const darkMode = useSelector((state: any) => Boolean(state.uxuiState?.darkMode));
  const userTheme = useSelector((state: any) => state.userTheme);

  if (!appIsReady) {
    return null;
  }

  // Use userTheme if available, otherwise fallback to darkMode
  const paperTheme = userTheme?.theme || (darkMode ? CustomDarkTheme : CustomLightTheme);

  const renderHomeDrawerIcon = ({ size, color }: { size: number; color: string }) => (
    <IconApp testID="e2a87b1c-9d3f-4e56-8a90-123456789a01" name="home" size={size} color={color} />
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
      <DesignSystemProvider>
        <PaperProvider theme={paperTheme}>
          <FABProvider>
            <SupabaseAuthSync />
            {!blockError && <ThemeStoreSyncManager />}

            <Drawer
              drawerContent={(props) => <CustomDrawerContent {...props} />}
              screenOptions={{ 
                header: (props) => <AppBar {...props} />,
                sceneStyle: { backgroundColor: paperTheme.colors.background },
                drawerIcon: renderHomeDrawerIcon,
              }}
            >
              <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
              <Drawer.Screen name="stopscreen/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.accessStopped') }} />
              <Drawer.Screen
                name="home/index"
                options={{
                  title: t('menu.home'),
                  drawerLabel: t('menu.home'),
                }}
              />
              <Drawer.Screen name="kit8/designs/index" options={{ title: 'Kit8 Designs' }} />
              <Drawer.Screen name="settings/index" options={{ title: t('menu.settings') }} />
              <Drawer.Screen name="sqlite/demo/native/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.sqliteDemo') }} />
              <Drawer.Screen name="userprofile/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.userProfile') }} />
              <Drawer.Screen name="about/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.about') }} />
              <Drawer.Screen name="signup/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.signUp') }} />
              <Drawer.Screen name="signin/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.signIn') }} />
              <Drawer.Screen name="posts/mediapostcrud/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.posts') }} />
              <Drawer.Screen name="feedback/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.feedback') }} />
              <Drawer.Screen name="map/index" options={{ drawerItemStyle: { display: 'none' }, title: t('menu.map') }} />

              <Drawer.Screen name="raci/racimember/index" options={{ drawerItemStyle: { display: 'none' }, title: 'Users (RACI)' }} />
              <Drawer.Screen name="developer1/index" options={{ title: 'Developer 1' }} />
              <Drawer.Screen name="raci/racidashboard/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.raciDashboard') }} />
              <Drawer.Screen name="historyofactivity/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.historyOfActivity') }} />
              <Drawer.Screen name="record/recordvideoweb/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordVideoWeb') }} />
              <Drawer.Screen name="play/playvideoweb/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.playVideoWeb') }} />
              <Drawer.Screen name="record/recordvideonative/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordVideoNative') }} />
              <Drawer.Screen name="play/playvideonative/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.playVideoNative') }} />
              <Drawer.Screen name="record/recordaudioweb/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordAudioWeb') }} />
              <Drawer.Screen name="record/recordaudionative/index" options={{ drawerItemStyle: { display: 'none' }, title: t('screens.recordAudioNative') }} />
            </Drawer>
            <FABAppComponent />
            <SnackbarApp />
          </FABProvider>
        </PaperProvider>
      </DesignSystemProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const initialSupabaseConfig = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://czgrxgzdmodkkmbmraub.supabase.co',
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Z3J4Z3pkbW9ka2ttYm1yYXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTU3MzYsImV4cCI6MjA3NzE3MTczNn0.4aul_NOjMO_VEKOgxFE3-Z5plqH1g8aSN8xJEgHPYR8',
  };

  return (
    <MD3Provider>
      <WithWorkPlace>
        <WithSupabase initialConfig={initialSupabaseConfig}>
          <SQLiteNativeProvider>
            <WithState>
              <RootLayoutContent />
            </WithState>
          </SQLiteNativeProvider>
        </WithSupabase>
      </WithWorkPlace>
    </MD3Provider>
  );
}