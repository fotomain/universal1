// State machine for "Sign in with email" (Supabase OTP):
//   step 'email' -> 'code' (type the one-time code)  -> signed in
//               -> 'link' (click the link in the email; this screen waits for the session) -> signed in
// The confirmation way (radio button) starts on 'otpCode' (One-time PIN code); remembering it per device is opt-in. Pure Supabase calls: kit8/auth/emailOtp.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { emailLinkRedirectTo } from './useAuthRedirectHandler';
import {
  DEFAULT_EMAIL_CONFIRMATION_WAY,
  EMAIL_CONFIRMATION_WAY_STORAGE_KEY,
  EmailConfirmationWay,
  EmailOtpError,
  isEmailConfirmationWay,
  OTP_RESEND_COOLDOWN_SECONDS,
  isValidEmail,
  isValidOtpCode,
  normalizeEmail,
  normalizeOtpCode,
  secondsUntil,
  sendEmailOtp,
  verifyEmailOtp,
} from '../auth/emailOtp';

export type EmailOtpStep = 'email' | 'code' | 'link';

export interface UseEmailOtpSignInOptions {
  onSignedIn?: (user: User) => void | Promise<void>;
  shouldCreateUser?: boolean;
  emailRedirectTo?: string;
  /** initial confirmation way (default 'otpCode'); with rememberConfirmationWay, the remembered one wins */
  confirmationWay?: EmailConfirmationWay;
  /** remember the radio choice in AsyncStorage (default false: every screen opens on One-time PIN code) */
  rememberConfirmationWay?: boolean;
}

export function useEmailOtpSignIn(supabase: Pick<SupabaseClient, 'auth'>, options: UseEmailOtpSignInOptions = {}) {
  const [step, setStep] = useState<EmailOtpStep>('email');
  const [confirmationWay, setWayState] = useState<EmailConfirmationWay>(options.confirmationWay ?? DEFAULT_EMAIL_CONFIRMATION_WAY);
  const [email, setEmailRaw] = useState('');
  const [code, setCodeRaw] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<EmailOtpError | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [lastSentEmail, setLastSentEmail] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const remember = options.rememberConfirmationWay === true;

  // remembered radio choice
  useEffect(() => {
    if (options.confirmationWay || !remember) return;
    AsyncStorage.getItem(EMAIL_CONFIRMATION_WAY_STORAGE_KEY)
      .then((v) => { if (mounted.current && isEmailConfirmationWay(v)) setWayState(v); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setConfirmationWay = useCallback((way: EmailConfirmationWay) => {
    setWayState(way);
    setError(null);
    if (remember) AsyncStorage.setItem(EMAIL_CONFIRMATION_WAY_STORAGE_KEY, way).catch(() => {});
  }, [remember]);

  // 'link' step: the session arrives when the user opens the link (another tab on web -> synced by
  // supabase-js; deep link on iOS / Android -> useAuthRedirectHandler). Also re-check when the app /
  // tab comes back to the front.
  const signedInRef = useRef(false);
  useEffect(() => {
    if (step !== 'link') return;
    signedInRef.current = false;
    const done = (user: User | null | undefined) => {
      if (!user || signedInRef.current || !mounted.current) return;
      signedInRef.current = true;
      optionsRef.current.onSignedIn?.(user);
    };
    const check = () => { supabase.auth.getSession().then(({ data }) => done(data?.session?.user)).catch(() => {}); };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') done(session?.user);
    });
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    const onFocus = () => check();
    const web = Platform.OS === 'web' && typeof window !== 'undefined';
    if (web) {
      window.addEventListener('focus', onFocus);
      window.addEventListener('storage', onFocus); // another tab stored the session
    }
    return () => {
      sub?.subscription?.unsubscribe();
      appSub.remove();
      if (web) {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('storage', onFocus);
      }
    };
  }, [step, supabase]);

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

  const cooldownFor = (seconds: number) => setResendAt(Date.now() + seconds * 1000);

  /** Email the code. force = "Resend" (still blocked while the cooldown runs). */
  const sendCode = useCallback(async (force = false) => {
    if (sending) return false;
    const clean = normalizeEmail(email);
    // Same address, code already on its way and the cooldown still runs -> no new request (Supabase
    // would refuse it anyway); just show the code field again.
    if (clean === lastSentEmail && secondsUntil(resendAt) > 0) {
      if (!force) { setEmailRaw(clean); setStep(confirmationWay === 'webLink' ? 'link' : 'code'); setError(null); }
      return false;
    }
    setSending(true);
    setError(null);
    const res = await sendEmailOtp(supabase, clean, {
      shouldCreateUser: optionsRef.current.shouldCreateUser,
      emailRedirectTo: optionsRef.current.emailRedirectTo ?? emailLinkRedirectTo(),
    });
    if (!mounted.current) return res.ok;
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      if (res.error.key === 'otpErrorRateLimit') {
        // Supabase refused because this address asked too soon: wait exactly as long as it says
        cooldownFor(res.error.retryAfterSeconds ?? OTP_RESEND_COOLDOWN_SECONDS);
        setLastSentEmail(clean);
      }
      return false;
    }
    setEmailRaw(clean);
    setLastSentEmail(clean);
    setCodeRaw('');
    setCodeSent(true);
    setStep(confirmationWay === 'webLink' ? 'link' : 'code');
    cooldownFor(OTP_RESEND_COOLDOWN_SECONDS);
    return true;
  }, [supabase, email, sending, lastSentEmail, resendAt, confirmationWay]);

  /** "I already have a code": go to the code field without sending another email. */
  const enterCode = useCallback(() => {
    if (!isValidEmail(email)) return false;
    setEmailRaw(normalizeEmail(email));
    setCodeRaw('');
    setCodeSent(false);
    setError(null);
    setStep('code');
    return true;
  }, [email]);

  const resendCode = useCallback(async () => {
    if (secondsUntil(resendAt) > 0) return false;
    return sendCode(true);
  }, [resendAt, sendCode]);

  const verifyCode = useCallback(async (override?: string) => {
    if (verifying) return false;
    const token = normalizeOtpCode(override ?? code);
    setVerifying(true);
    setError(null);
    const res = await verifyEmailOtp(supabase, email, token);
    if (!mounted.current) return res.ok;
    setVerifying(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    await optionsRef.current.onSignedIn?.(res.data);
    return true;
  }, [supabase, email, code, verifying]);

  const changeEmail = useCallback(() => {
    setStep('email');
    setCodeRaw('');
    setCodeSent(false);
    setError(null);
  }, []);

  return {
    step,
    confirmationWay,
    setConfirmationWay,
    email,
    code,
    setEmail,
    setCode,
    sending,
    verifying,
    busy: sending || verifying,
    error,
    codeSent,
    secondsLeft,
    canSend: isValidEmail(email) && !sending,
    /** the cooldown applies to the email in the field (Supabase: 60 s per address) */
    cooldownActive: secondsLeft > 0 && normalizeEmail(email) === lastSentEmail,
    canVerify: isValidOtpCode(code) && !verifying,
    canResend: secondsLeft === 0 && !sending,
    sendCode,
    resendCode,
    enterCode,
    verifyCode,
    changeEmail,
  };
}

export default useEmailOtpSignIn;
