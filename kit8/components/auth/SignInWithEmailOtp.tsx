// "Sign in with email" - Supabase signInWithOtp, confirmed by a one-time code (verifyOtp) or by the
// web link in the email (radio "Confirmation way"). Used on the Sign In screen and inline on the
// User Profile screen when signed out.
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { useDispatch } from 'react-redux';
import { useTheme, Text } from 'react-native-paper';
import type { User } from '@supabase/supabase-js';
import { ButtonPrimaryApp, ButtonTextApp } from '../common';
import ActivityIndicatorCircleApp from '../activityindicator/ActivityIndicatorCircleApp';
import TextInputApp from '../common/TextInputApp';
import IconApp from '../common/IconApp';
import { useSupabase } from '../../providers/WithSupabase';
import { useEmailOtpSignIn } from '../../hooks/useEmailOtpSignIn';
import { activeUserFromSupabaseUser, EmailConfirmationWay, EmailOtpError, OTP_MAX_LENGTH } from '../../auth/emailOtp';
import { subscribeAuthRedirectError, publishAuthRedirectError } from '../../hooks/useAuthRedirectHandler';
import EmailConfirmationWayRadio from './EmailConfirmationWayRadio';
import { saveUserData } from '../../lib/localSecureStorage';
import { setActiveUser, formatTo32CharGUID } from '../../redux/activeUserSlice';

export interface SignInWithEmailOtpProps {
  /** called after the session exists and the active user is stored (e.g. navigate back) */
  onSignedIn?: (user: User) => void;
  /** create an account for a new email (default true) */
  shouldCreateUser?: boolean;
  /** start with this confirmation way (otherwise the one remembered on this device) */
  confirmationWay?: EmailConfirmationWay;
  showTitle?: boolean;
  testIDPrefix?: string;
}

export default function SignInWithEmailOtp({
  onSignedIn,
  shouldCreateUser = true,
  confirmationWay,
  showTitle = true,
  testIDPrefix = 'email-otp',
}: SignInWithEmailOtpProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { supabase } = useSupabase();

  const handleSignedIn = useCallback(async (user: User) => {
    // SupabaseAuthSync (app/_layout.tsx) does the same on SIGNED_IN; doing it here too makes the
    // profile update immediately, before the auth event arrives.
    const u = activeUserFromSupabaseUser(user);
    const activeUserGUID = formatTo32CharGUID(u.id);
    await saveUserData(activeUserGUID, u.email, u.firstName, u.lastName);
    dispatch(setActiveUser({
      activeUserGUID,
      activeUserEmail: u.email,
      activeUserFirstName: u.firstName,
      activeUserLastName: u.lastName,
    }));
    onSignedIn?.(user);
  }, [dispatch, onSignedIn]);

  const otp = useEmailOtpSignIn(supabase, { onSignedIn: handleSignedIn, shouldCreateUser, confirmationWay });

  // Every time the screen appears (drawer screens stay mounted), the radio starts on "One-time PIN code".
  const initialWay = confirmationWay ?? 'otpCode';
  const otpRef = React.useRef(otp);
  otpRef.current = otp;
  useFocusEffect(useCallback(() => {
    const o = otpRef.current;
    if (o.step === 'email' && o.confirmationWay !== initialWay) o.setConfirmationWay(initialWay);
  }, [initialWay]));

  // errors from an opened email link (expired / already used), see useAuthRedirectHandler
  const [linkError, setLinkError] = useState<EmailOtpError | null>(null);
  useEffect(() => subscribeAuthRedirectError(setLinkError), []);
  const shownError = otp.error ?? linkError;
  const clearLinkError = () => { if (linkError) publishAuthRedirectError(null); };

  const errorText = !shownError
    ? ''
    : shownError.key === 'otpErrorRateLimit' && otp.secondsLeft > 0
      ? t('screens.otpErrorRateLimitIn', { seconds: otp.secondsLeft })
      : shownError.key
        ? t(`screens.${shownError.key}`)
        : shownError.message;
  const id = (s: string) => `${testIDPrefix}-${s}`;

  return (
    <View style={styles.container} testID={id('root')}>
      {showTitle && (
        <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('screens.signInWithEmail')}
        </Text>
      )}

      {otp.step === 'email' ? (
        <>
          <TextInputApp
            testID={id('email')}
            label={t('screens.email')}
            value={otp.email}
            onChangeText={otp.setEmail}
            placeholder="your@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => { if (otp.canSend) otp.sendCode(); }}
            editable={!otp.sending}
            inputMode="nativePaper"
          />
          <EmailConfirmationWayRadio
            testID={id('way')}
            value={otp.confirmationWay}
            onChange={(w) => { clearLinkError(); otp.setConfirmationWay(w); }}
            disabled={otp.sending}
          />
          <ButtonPrimaryApp
            testID={id('send')}
            onPress={() => { clearLinkError(); otp.sendCode(); }}
            disabled={!otp.canSend}
            loading={otp.sending}
            color={theme.colors.primary}
            style={styles.button}
          >
            {otp.confirmationWay === 'webLink' ? t('screens.sendLink') : t('screens.sendCode')}
          </ButtonPrimaryApp>
          {otp.confirmationWay === 'otpCode' && (
          <ButtonTextApp
            testID={id('have-code')}
            onPress={otp.enterCode}
            disabled={!otp.canSend}
            style={styles.button}
          >
            {t('screens.haveCode')}
          </ButtonTextApp>
          )}
        </>
      ) : otp.step === 'link' ? (
        <View testID={id('link-step')}>
          <View style={[styles.linkCard, { borderColor: theme.colors.outlineVariant }]}>
            <IconApp name="mark_email_unread" size={36} color={theme.colors.primary} />
            <Text variant="titleSmall" style={[styles.linkTitle, { color: theme.colors.onSurface }]} testID={id('link-sent-to')}>
              {t('screens.linkSentTo', { email: otp.email })}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              {t('screens.linkOpenHint')}
            </Text>
            <View style={styles.waitingRow}>
              <ActivityIndicatorCircleApp size="small" />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                {t('screens.waitingForLink')}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <ButtonTextApp
              testID={id('resend-link')}
              onPress={otp.resendCode}
              disabled={!otp.canResend}
              loading={otp.sending}
            >
              {otp.secondsLeft > 0 ? t('screens.resendLinkIn', { seconds: otp.secondsLeft }) : t('screens.resendLink')}
            </ButtonTextApp>
            <ButtonTextApp testID={id('change-email')} onPress={otp.changeEmail} disabled={otp.busy}>
              {t('screens.changeEmail')}
            </ButtonTextApp>
          </View>
          <ButtonTextApp testID={id('link-enter-code')} onPress={otp.enterCode} style={styles.button}>
            {t('screens.enterCodeInstead')}
          </ButtonTextApp>
        </View>
      ) : (
        <>
          <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]} testID={id('sent-to')}>
            {t('screens.codeSentTo', { email: otp.email })}
          </Text>
          <TextInputApp
            testID={id('code')}
            label={t('screens.otpCode')}
            value={otp.code}
            onChangeText={otp.setCode}
            placeholder="123456"
            keyboardType="numeric"
            maxLength={OTP_MAX_LENGTH}
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            textContentType="oneTimeCode"
            returnKeyType="done"
            autoFocus
            onSubmitEditing={() => { if (otp.canVerify) otp.verifyCode(); }}
            editable={!otp.verifying}
            inputMode="nativePaper"
          />
          <ButtonPrimaryApp
            testID={id('verify')}
            onPress={() => otp.verifyCode()}
            disabled={!otp.canVerify}
            loading={otp.verifying}
            color={theme.colors.primary}
            style={styles.button}
          >
            {t('screens.verifyCode')}
          </ButtonPrimaryApp>
          <View style={styles.row}>
            <ButtonTextApp
              testID={id('resend')}
              onPress={otp.resendCode}
              disabled={!otp.canResend}
              loading={otp.sending}
            >
              {otp.secondsLeft > 0 ? t('screens.resendCodeIn', { seconds: otp.secondsLeft }) : t('screens.resendCode')}
            </ButtonTextApp>
            <ButtonTextApp testID={id('change-email')} onPress={otp.changeEmail} disabled={otp.busy}>
              {t('screens.changeEmail')}
            </ButtonTextApp>
          </View>
        </>
      )}

      {!!errorText && (
        <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.error }]} testID={id('error')} accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      )}
      {!errorText && otp.step === 'code' && otp.codeSent && (
        <Text variant="bodySmall" style={[styles.message, { color: theme.colors.onSurfaceVariant }]} testID={id('info')}>
          {t('screens.otpCodeSent')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  title: { marginBottom: 8, fontWeight: '600' },
  hint: { marginBottom: 12 },
  button: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 8 },
  message: { marginTop: 12, textAlign: 'center' },
  linkCard: { alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 4 },
  linkTitle: { marginTop: 8, marginBottom: 6, textAlign: 'center', fontWeight: '600' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
