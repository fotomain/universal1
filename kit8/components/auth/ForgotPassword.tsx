// "Forgot password" form - Supabase resetPasswordForEmail, confirmed by the code in the email (+ new
// password) or by opening the reset link (that tab/app then shows only the new-password fields).
// State machine: kit8/hooks/usePasswordReset.ts. Used by app/forgotpassword/index.tsx.
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useTheme, Text } from 'react-native-paper';
import type { User } from '@supabase/supabase-js';
import { ButtonPrimaryApp, ButtonTextApp } from '../common';
import TextInputApp from '../common/TextInputApp';
import IconApp from '../common/IconApp';
import { useSupabase } from '../../providers/WithSupabase';
import { usePasswordReset } from '../../hooks/usePasswordReset';
import { activeUserFromSupabaseUser, EmailOtpError, OTP_MAX_LENGTH } from '../../auth/emailOtp';
import { PASSWORD_MAX_LENGTH } from '../../auth/passwordReset';
import { subscribeAuthRedirectError, publishAuthRedirectError } from '../../hooks/useAuthRedirectHandler';
import { saveUserData } from '../../lib/localSecureStorage';
import { setActiveUser, formatTo32CharGUID } from '../../redux/activeUserSlice';

export interface ForgotPasswordProps {
  initialEmail?: string;
  /** new password saved, user signed in */
  onDone?: (user: User) => void;
  /** "Back to sign in" */
  onBack?: () => void;
  testIDPrefix?: string;
}

export default function ForgotPassword({ initialEmail, onDone, onBack, testIDPrefix = 'forgot-pw' }: ForgotPasswordProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { supabase } = useSupabase();

  const handleChanged = useCallback(async (user: User) => {
    const u = activeUserFromSupabaseUser(user);
    const activeUserGUID = formatTo32CharGUID(u.id);
    await saveUserData(activeUserGUID, u.email, u.firstName, u.lastName);
    dispatch(setActiveUser({
      activeUserGUID,
      activeUserEmail: u.email,
      activeUserFirstName: u.firstName,
      activeUserLastName: u.lastName,
    }));
  }, [dispatch]);

  const pr = usePasswordReset(supabase, { initialEmail, onPasswordChanged: handleChanged });

  // expired / used reset link (#error_code=otp_expired), see useAuthRedirectHandler
  const [linkError, setLinkError] = useState<EmailOtpError | null>(null);
  useEffect(() => subscribeAuthRedirectError(setLinkError), []);
  const clearLinkError = () => { if (linkError) publishAuthRedirectError(null); };
  const shownError = pr.error ?? (pr.step === 'email' || pr.step === 'code' ? linkError : null);

  const errorText = !shownError
    ? ''
    : shownError.key === 'otpErrorRateLimit' && pr.secondsLeft > 0
      ? t('screens.otpErrorRateLimitIn', { seconds: pr.secondsLeft })
      : shownError.key
        ? t(`screens.${shownError.key}`, { min: pr.minPasswordLength, max: PASSWORD_MAX_LENGTH })
        : shownError.message;
  const hintText = !pr.error && pr.passwordHint
    ? t(`screens.${pr.passwordHint}`, { min: pr.minPasswordLength, max: PASSWORD_MAX_LENGTH })
    : '';
  const id = (s: string) => `${testIDPrefix}-${s}`;

  const passwordFields = (
    <>
      <TextInputApp
        testID={id('password')}
        label={t('screens.newPassword')}
        value={pr.password}
        onChangeText={pr.setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={PASSWORD_MAX_LENGTH}
        editable={!pr.saving}
        inputMode="nativePaper"
      />
      <TextInputApp
        testID={id('confirm')}
        label={t('screens.confirmNewPassword')}
        value={pr.confirm}
        onChangeText={pr.setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={PASSWORD_MAX_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => { if (pr.canSubmit) pr.submit(); }}
        editable={!pr.saving}
        inputMode="nativePaper"
      />
      {!!hintText && (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID={id('pw-hint')}>
          {hintText}
        </Text>
      )}
      <ButtonPrimaryApp
        testID={id('submit')}
        onPress={() => pr.submit()}
        disabled={!pr.canSubmit}
        loading={pr.saving}
        color={theme.colors.primary}
        style={styles.button}
      >
        {t('screens.setNewPassword')}
      </ButtonPrimaryApp>
    </>
  );

  return (
    <View style={styles.container} testID={id('root')}>
      {pr.step === 'email' && (
        <>
          <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            {t('screens.resetPasswordHint')}
          </Text>
          <TextInputApp
            testID={id('email')}
            label={t('screens.email')}
            value={pr.email}
            onChangeText={pr.setEmail}
            placeholder="your@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => { if (pr.canSend) { clearLinkError(); pr.sendResetEmail(); } }}
            editable={!pr.sending}
            inputMode="nativePaper"
          />
          <ButtonPrimaryApp
            testID={id('send')}
            onPress={() => { clearLinkError(); pr.sendResetEmail(); }}
            disabled={!pr.canSend}
            loading={pr.sending}
            color={theme.colors.primary}
            style={styles.button}
          >
            {t('screens.sendResetEmail')}
          </ButtonPrimaryApp>
          <ButtonTextApp testID={id('have-code')} onPress={pr.enterCode} disabled={!pr.canSend} style={styles.button}>
            {t('screens.haveCode')}
          </ButtonTextApp>
        </>
      )}

      {pr.step === 'code' && (
        <>
          <View style={[styles.card, { borderColor: theme.colors.outlineVariant }]}>
            <IconApp name="mark_email_unread" size={32} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.cardText, { color: theme.colors.onSurface }]} testID={id('sent-to')}>
              {pr.emailSent ? t('screens.resetEmailSentTo', { email: pr.email }) : pr.email}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              {t('screens.resetCodeHint')}
            </Text>
          </View>
          <TextInputApp
            testID={id('code')}
            label={t('screens.otpCode')}
            value={pr.code}
            onChangeText={pr.setCode}
            placeholder="123456"
            keyboardType="numeric"
            maxLength={OTP_MAX_LENGTH}
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            textContentType="oneTimeCode"
            autoFocus
            editable={!pr.saving}
            inputMode="nativePaper"
          />
          {passwordFields}
          <View style={styles.row}>
            <ButtonTextApp testID={id('resend')} onPress={pr.resendResetEmail} disabled={!pr.canResend} loading={pr.sending}>
              {pr.secondsLeft > 0 ? t('screens.resendCodeIn', { seconds: pr.secondsLeft }) : t('screens.resendCode')}
            </ButtonTextApp>
            <ButtonTextApp testID={id('change-email')} onPress={pr.changeEmail} disabled={pr.busy}>
              {t('screens.changeEmail')}
            </ButtonTextApp>
          </View>
        </>
      )}

      {pr.step === 'newPassword' && (
        <>
          <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]} testID={id('new-for')}>
            {t('screens.setNewPasswordHint', { email: pr.email })}
          </Text>
          {passwordFields}
        </>
      )}

      {pr.step === 'done' && (
        <View style={[styles.card, { borderColor: theme.colors.outlineVariant }]} testID={id('done')}>
          <IconApp name="check_circle" size={36} color={theme.colors.primary} />
          <Text variant="titleSmall" style={[styles.cardText, { color: theme.colors.onSurface }]}>
            {t('screens.passwordUpdated')}
          </Text>
          <ButtonPrimaryApp
            testID={id('continue')}
            onPress={() => { supabase.auth.getUser().then(({ data }) => data?.user && onDone?.(data.user)).catch(() => {}); }}
            color={theme.colors.primary}
            style={styles.button}
          >
            {t('screens.continue')}
          </ButtonPrimaryApp>
        </View>
      )}

      {!!errorText && (
        <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.error }]} testID={id('error')} accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      )}

      {pr.step !== 'done' && onBack && (
        <ButtonTextApp testID={id('back')} onPress={onBack} disabled={pr.busy} style={styles.button}>
          {t('screens.backToSignIn')}
        </ButtonTextApp>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  hint: { marginBottom: 12 },
  button: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 8 },
  message: { marginTop: 12, textAlign: 'center' },
  card: { alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardText: { marginTop: 8, marginBottom: 6, textAlign: 'center', fontWeight: '600' },
});
