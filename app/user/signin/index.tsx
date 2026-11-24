import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useTheme, Surface, Text } from 'react-native-paper';
import { ButtonPrimaryApp, ButtonTextApp } from '../../../kit8/ui/components/common';
import ActivityIndicatorCircleApp from '../../../kit8/ui/components/activityindicator/ActivityIndicatorCircleApp';
import SignInWithGoogleButton from '../../../kit8/auth/google/SignInWithGoogleButton';
import SignInWithMicrosoftButton from '../../../kit8/auth/microsoft/SignInWithMicrosoftButton';
import { useAuthWithMicrosoft } from '../../../kit8/auth/microsoft/useAuthWithMicrosoft';
import SignInWithEmailOtp from '../../../kit8/auth/otp/SignInWithEmailOtp';
import { useAuthWithGoogle } from '../../../kit8/auth/google/useAuth';
import { checkSupabaseAvailable } from '../../../kit8/auth/session/supabaseAvailability';
import { clearPendingReturnTo, peekPendingReturnTo, setPendingReturnTo } from '../../../kit8/auth/session/pendingReturnTo';
import { useSupabase } from '../../../kit8/providers/WithSupabase';
import { saveUserData, getUserData } from '../../../kit8/lib/localSecureStorage';
import { setActiveUser, formatTo32CharGUID } from '../../../kit8/redux/activeUserSlice';
import TextInputApp from '../../../kit8/ui/components/common/TextInputApp';

export default function SignInScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { supabase } = useSupabase();
  const theme = useTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo || '/user/userprofile';
  const navigation = useNavigation();
  // The screen the user wanted before he was sent here (Identification, Record audio / video ...): the route of this screen's own `returnTo`, else the one the gate
  // remembered (a sign in that left the page - Google / Microsoft on the web, the e-mail link - or that started at the menu's "Sign In" has no `returnTo`).
  const goBackAfterSignIn = async () => {
    const target = params.returnTo || (await peekPendingReturnTo()) || '/user/userprofile';
    clearPendingReturnTo();
    router.replace(target as any);
  };
  // keep the wish across the page reload of an OAuth sign in
  useEffect(() => { if (params.returnTo) setPendingReturnTo(params.returnTo); }, [params.returnTo]);
  // Drawer screens stay mounted after the first visit: a Sign in screen opened earlier lives on behind the project dashboard, and every SIGNED_IN that supabase-js re-sends
  // (token refresh, the tab coming back to the front) reached the redirects below and threw the user from the dashboard to /user/userprofile. Redirect only while this screen is the one shown.
  const leaveToReturnTo = () => { if (navigation.isFocused()) void goBackAfterSignIn(); };

  const { user: googleUser, loading: googleLoading, signIn: signInWithGoogleRaw } = useAuthWithGoogle();
  // Microsoft keeps no user here: the session raises SIGNED_IN, which the Google hook above also hears (it reacts to any provider)
  const { loading: microsoftLoading, error: microsoftError, signIn: signInWithMicrosoftRaw } = useAuthWithMicrosoft(supabase);

  // Google / Microsoft send the whole page to Supabase: ask it FIRST, so a restarting / hanging project gives a message here instead of a bare Cloudflare 522 page
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const afterAvailabilityCheck = async (start: () => unknown) => {
    setChecking(true);
    setAvailabilityMessage(null);
    const answer = await checkSupabaseAvailable({ url: (supabase as any)?.supabaseUrl ?? '', key: (supabase as any)?.supabaseKey ?? '' });
    setChecking(false);
    if (!answer.ok) {
      setAvailabilityMessage(answer.message);
      return;
    }
    start();
  };
  const signInWithGoogle = () => afterAvailabilityCheck(signInWithGoogleRaw);
  const signInWithMicrosoft = () => afterAvailabilityCheck(signInWithMicrosoftRaw);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // ONE sign-in at a time: while any way of signing in works (Google, Microsoft, the email code being sent / verified, the password), every other button and input is disabled
  const [otpBusy, setOtpBusy] = useState(false);
  const busy = googleLoading || microsoftLoading || loading || otpBusy || checking;
  // Email sign-in: one-time code (Supabase OTP, default) or the old email + password
  const [emailMode, setEmailMode] = useState<'otp' | 'password'>('otp');

  useEffect(() => {
    if (googleUser) {
      const displayName = (googleUser as any)?.displayName || (googleUser as any)?.user_metadata?.full_name || '';
      const rawId = (googleUser as any).uid || (googleUser as any).id || 'google-user-guid';
      const activeUserGUID = formatTo32CharGUID(rawId);
      const userFirstName = displayName.split(' ')[0] || 'GoogleUser';
      const userLastName = displayName.split(' ')[1] || '';
      const userEmail = googleUser.email || '';

      saveUserData(activeUserGUID, userEmail, userFirstName, userLastName);
      dispatch(setActiveUser({
        activeUserGUID,
        activeUserEmail: userEmail,
        activeUserFirstName: userFirstName,
        activeUserLastName: userLastName,
      }));
      leaveToReturnTo();
      return;
    }
    getUserData().then((storedState) => {
      if (storedState.activeUserGUID && storedState.activeUserEmail) {
        dispatch(setActiveUser({
          activeUserGUID: formatTo32CharGUID(storedState.activeUserGUID),
          activeUserEmail: storedState.activeUserEmail,
          activeUserFirstName: storedState.activeUserFirstName,
          activeUserLastName: storedState.activeUserLastName,
        }));
        leaveToReturnTo();
      }
    });
  }, [googleUser, returnTo, dispatch]);

  const handleEmailSignIn = async () => {
    if (busy) return;
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        Alert.alert('Sign In Error', signUpError.message);
        setLoading(false);
        return;
      }

      if (signUpData.user) {
        const activeUserGUID = formatTo32CharGUID(signUpData.user.id);
        const userEmail = signUpData.user.email || email;
        const userFirstName = userEmail.split('@')[0] || 'User';
        const userLastName = '';

        await saveUserData(activeUserGUID, userEmail, userFirstName, userLastName);
        dispatch(setActiveUser({
          activeUserGUID,
          activeUserEmail: userEmail,
          activeUserFirstName: userFirstName,
          activeUserLastName: userLastName,
        }));
        Alert.alert('Success', 'Account created and signed in successfully!');
        await goBackAfterSignIn();
      } else {
        Alert.alert('Notice', 'Please check your email for a confirmation link.');
      }
    } else if (signInData.user) {
      const activeUserGUID = formatTo32CharGUID(signInData.user.id);
      const userEmail = signInData.user.email || email;
      const userFirstName = userEmail.split('@')[0] || 'User';
      const userLastName = '';

      await saveUserData(activeUserGUID, userEmail, userFirstName, userLastName);
      dispatch(setActiveUser({
        activeUserGUID,
        activeUserEmail: userEmail,
        activeUserFirstName: userFirstName,
        activeUserLastName: userLastName,
      }));
      await goBackAfterSignIn();
    }

    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.surfaceCard} elevation={2}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginBottom: 24, textAlign: 'center', fontWeight: 'bold' }}>
          {t('menu.signIn')}
        </Text>

        {availabilityMessage ? (
          <Text testID="signin-supabase-unavailable" style={{ color: theme.colors.error, marginBottom: 12, textAlign: 'center' }}>
            {availabilityMessage}
          </Text>
        ) : null}

        <View style={styles.buttonWrapper}>
          {googleLoading ? (
            <ActivityIndicatorCircleApp />
          ) : (
            <SignInWithGoogleButton onPress={signInWithGoogle} disabled={busy}>
              {t('screens.signInWithGoogle')}
            </SignInWithGoogleButton>
          )}
        </View>

        <View style={styles.buttonWrapper}>
          {microsoftLoading ? (
            <ActivityIndicatorCircleApp />
          ) : (
            <SignInWithMicrosoftButton onPress={signInWithMicrosoft} disabled={busy}>
              {t('screens.signInWithMicrosoft')}
            </SignInWithMicrosoftButton>
          )}
          {microsoftError ? (
            <Text testID="signin-microsoft-error" style={{ color: theme.colors.error, marginTop: 8, textAlign: 'center' }}>
              {microsoftError}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.orText, { color: theme.colors.onSurfaceVariant }]}>{t('screens.or')}</Text>

        {emailMode === 'otp' ? (
          <SignInWithEmailOtp onSignedIn={leaveToReturnTo} disabled={googleLoading || microsoftLoading || loading} onBusyChange={setOtpBusy} />
        ) : (
          <>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('screens.signInWithEmail')}
            </Text>

            <TextInputApp
              label={t('screens.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              inputMode="nativePaper"
              disabled={busy}
            />

            <TextInputApp
              label={t('screens.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              inputMode="nativePaper"
              disabled={busy}
            />

            <View style={styles.buttonWrapper}>
              {loading ? (
                <ActivityIndicatorCircleApp />
              ) : (
                <ButtonPrimaryApp 
                  onPress={handleEmailSignIn} 
                  disabled={busy}
                  color={theme.colors.primary}
                  style={{ marginTop: 8 }}
                >
                  {t('menu.signIn')}
                </ButtonPrimaryApp>
              )}
            </View>

            <ButtonTextApp
              testID="signin-forgot-password"
              disabled={busy}
              onPress={() => router.push({ pathname: '/user/forgotpassword', params: { email, returnTo } } as any)}
            >
              {t('screens.forgotPassword')}
            </ButtonTextApp>
          </>
        )}

        <ButtonTextApp
          testID="signin-toggle-email-mode"
          disabled={busy}
          onPress={() => setEmailMode(emailMode === 'otp' ? 'password' : 'otp')}
          style={{ marginTop: 8 }}
        >
          {emailMode === 'otp' ? t('screens.usePasswordInstead') : t('screens.useEmailCodeInstead')}
        </ButtonTextApp>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surfaceCard: {
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
  },
  buttonWrapper: {
    marginVertical: 12,
  },
  orText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
});