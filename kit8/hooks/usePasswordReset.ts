// State machine for "Forgot password" (Supabase). Pure Supabase calls: kit8/auth/passwordReset.ts.
//   'email'       -> send reset email
//   'code'        -> code from the email + new password (verifyOtp type 'recovery', then updateUser)
//                    (or the user opens the link in the email -> that tab lands on 'newPassword')
//   'newPassword' -> already have a recovery session (reset link opened / code verified) -> updateUser
//   'done'        -> password changed, user is signed in
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { resetPasswordRedirectTo, subscribeRecoveryRedirect, publishRecoveryRedirect } from './useAuthRedirectHandler';
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  isValidEmail,
  isValidOtpCode,
  normalizeEmail,
  normalizeOtpCode,
  secondsUntil,
} from '../auth/emailOtp';
import {
  PASSWORD_MIN_LENGTH,
  PasswordResetError,
  sendPasswordResetEmail,
  updatePassword,
  validateNewPassword,
  verifyRecoveryCode,
} from '../auth/passwordReset';

export type PasswordResetStep = 'email' | 'code' | 'newPassword' | 'done';

export interface UsePasswordResetOptions {
  initialEmail?: string;
  /** called once the new password is saved (the user is signed in) */
  onPasswordChanged?: (user: User) => void | Promise<void>;
  redirectTo?: string;
  minPasswordLength?: number;
}

export function usePasswordReset(supabase: Pick<SupabaseClient, 'auth'>, options: UsePasswordResetOptions = {}) {
  const minLength = options.minPasswordLength ?? PASSWORD_MIN_LENGTH;
  const [step, setStep] = useState<PasswordResetStep>('email');
  const [email, setEmailRaw] = useState(normalizeEmail(options.initialEmail || ''));
  const [code, setCodeRaw] = useState('');
  const [password, setPasswordRaw] = useState('');
  const [confirm, setConfirmRaw] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<PasswordResetError | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [lastSentEmail, setLastSentEmail] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Reset link opened (this tab / deep link) -> Supabase already made a recovery session: ask for the password.
  const toNewPassword = useCallback((user?: User | null) => {
    if (!mounted.current) return;
    if (user?.email) setEmailRaw(user.email);
    setError(null);
    setStep((s) => (s === 'done' ? s : 'newPassword'));
  }, []);
  useEffect(() => subscribeRecoveryRedirect((active) => {
    if (!active) return;
    supabase.auth.getSession().then(({ data }) => toNewPassword(data?.session?.user)).catch(() => toNewPassword());
  }), [supabase, toNewPassword]);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') toNewPassword(session?.user);
    });
    return () => { sub?.subscription?.unsubscribe(); };
  }, [supabase, toNewPassword]);

  // resend countdown
  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntil(resendAt));
    tick();
    if (!resendAt) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const setEmail = useCallback((v: string) => { setEmailRaw(v); setError(null); }, []);
  const setCode = useCallback((v: string) => { setCodeRaw(normalizeOtpCode(v)); setError(null); }, []);
  const setPassword = useCallback((v: string) => { setPasswordRaw(v); setError(null); }, []);
  const setConfirm = useCallback((v: string) => { setConfirmRaw(v); setError(null); }, []);
  const cooldownFor = (seconds: number) => setResendAt(Date.now() + seconds * 1000);

  const sendResetEmail = useCallback(async (force = false) => {
    if (sending) return false;
    const clean = normalizeEmail(email);
    if (clean === lastSentEmail && secondsUntil(resendAt) > 0) {
      if (!force) { setEmailRaw(clean); setStep('code'); setError(null); }
      return false;
    }
    setSending(true);
    setError(null);
    const res = await sendPasswordResetEmail(supabase, clean, {
      redirectTo: optionsRef.current.redirectTo ?? resetPasswordRedirectTo(),
    });
    if (!mounted.current) return res.ok;
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      if (res.error.key === 'otpErrorRateLimit') {
        cooldownFor(res.error.retryAfterSeconds ?? OTP_RESEND_COOLDOWN_SECONDS);
        setLastSentEmail(clean);
      }
      return false;
    }
    setEmailRaw(clean);
    setLastSentEmail(clean);
    setCodeRaw('');
    setEmailSent(true);
    setStep('code');
    cooldownFor(OTP_RESEND_COOLDOWN_SECONDS);
    return true;
  }, [supabase, email, sending, lastSentEmail, resendAt]);

  const resendResetEmail = useCallback(async () => {
    if (secondsUntil(resendAt) > 0) return false;
    return sendResetEmail(true);
  }, [resendAt, sendResetEmail]);

  /** "I already have a code": skip sending. */
  const enterCode = useCallback(() => {
    if (!isValidEmail(email)) return false;
    setEmailRaw(normalizeEmail(email));
    setCodeRaw('');
    setEmailSent(false);
    setError(null);
    setStep('code');
    return true;
  }, [email]);

  const finish = useCallback(async (user: User) => {
    publishRecoveryRedirect(false);
    setPasswordRaw('');
    setConfirmRaw('');
    setStep('done');
    await optionsRef.current.onPasswordChanged?.(user);
  }, []);

  /** 'code' step: verify the code, then save the password. 'newPassword' step: save the password. */
  const submit = useCallback(async () => {
    if (saving) return false;
    const invalid = validateNewPassword(password, confirm, minLength);
    if (invalid) { setError({ key: invalid, message: invalid }); return false; }
    setSaving(true);
    setError(null);
    if (step === 'code') {
      const verified = await verifyRecoveryCode(supabase, email, code);
      if (!mounted.current) return verified.ok;
      if (!verified.ok) { setSaving(false); setError(verified.error); return false; }
      // the code is used up now; if saving fails, the user retries on the password-only step
      setStep('newPassword');
    }
    const res = await updatePassword(supabase, password);
    if (!mounted.current) return res.ok;
    setSaving(false);
    if (!res.ok) { setError(res.error); return false; }
    await finish(res.data);
    return true;
  }, [supabase, step, email, code, password, confirm, minLength, saving, finish]);

  const changeEmail = useCallback(() => {
    setStep('email');
    setCodeRaw('');
    setEmailSent(false);
    setError(null);
  }, []);

  const passwordError = password.length > 0 || confirm.length > 0 ? validateNewPassword(password, confirm, minLength) : null;

  return {
    step,
    email,
    code,
    password,
    confirm,
    setEmail,
    setCode,
    setPassword,
    setConfirm,
    sending,
    saving,
    busy: sending || saving,
    error,
    emailSent,
    secondsLeft,
    minPasswordLength: minLength,
    /** live hint while typing ('pwMismatch' only once the confirm field has something) */
    passwordHint: passwordError === 'pwMismatch' && confirm.length === 0 ? null : passwordError,
    canSend: isValidEmail(email) && !sending,
    canResend: secondsLeft === 0 && !sending,
    canSubmit: !saving && !validateNewPassword(password, confirm, minLength) && (step !== 'code' || isValidOtpCode(code)),
    sendResetEmail,
    resendResetEmail,
    enterCode,
    submit,
    changeEmail,
  };
}

export default usePasswordReset;
