// Email one-time-code sign-in with Supabase (pure logic, no React - unit-tested in __tests__/auth).
//
// Flow:  signInWithOtp({ email })  ->  Supabase emails a code  ->  verifyOtp({ email, token, type: 'email' })
// Docs:  https://supabase.com/docs/reference/javascript/auth-signinwithotp
//
// Supabase dashboard setup (Authentication) - REQUIRED, otherwise the email has only a link:
//   * Emails > "Confirm signup" (new users) AND "Magic Link" (existing users): paste
//     kit8/auth/email-templates/confirm-signup.html / magic-link.html - they contain {{ .Token }} (the code).
//     verifyOtp({ type: 'email' }) accepts both the signup code and the sign-in code.
//   * URL Configuration > Site URL: the real web address of the app (e.g. https://your-app.com, or
//     http://localhost:8081 while developing). A wrong value sends the email link to a broken
//     address such as http://0.0.62.61/.
//   * URL Configuration > Redirect URLs: add http://localhost:8081/** and https://<your web domain>/**
//     (emailOtpRedirectTo() asks for <origin>/signin; URLs not in this list fall back to the Site URL).
//   * Providers > Email: enabled; code length (6-10 digits) + expiry are set there; the UI accepts 6-10.
//   * Supabase allows one email per address every 60 s -> OTP_RESEND_COOLDOWN_SECONDS.
//   * "email rate limit exceeded" (otpErrorEmailQuota): the BUILT-IN Supabase mailer sends only a few
//     emails per hour for the whole project. Fix: Authentication > Emails > SMTP Settings = your own SMTP
//     (Resend, Brevo, SendGrid, AWS SES...), then raise Authentication > Rate Limits > "emails per hour".

import type { SupabaseClient, User } from '@supabase/supabase-js';

export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 10;

/** i18n keys (under `screens.`) for the errors the UI shows translated; anything else shows the raw message. */
export type EmailOtpErrorKey =
  | 'otpInvalidEmail'
  | 'otpInvalidCode'
  | 'otpErrorRateLimit'      // this address asked again too soon (Supabase: 60 s per address)
  | 'otpErrorEmailQuota'     // the project's hourly email limit is used up (built-in Supabase email = very low)
  | 'otpErrorExpired'
  | 'otpErrorSignupDisabled';

export interface EmailOtpError {
  key?: EmailOtpErrorKey;
  message: string;
  /** seconds Supabase asks to wait ("...you can only request this after 42 seconds") */
  retryAfterSeconds?: number;
}

export type EmailOtpResult<T = undefined> = { ok: true; data: T } | { ok: false; error: EmailOtpError };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string): string => (email || '').trim().toLowerCase();

export const isValidEmail = (email: string): boolean => EMAIL_RE.test(normalizeEmail(email));

/** Keeps digits only (pasted "123 456" / "123-456" -> "123456"), capped at OTP_MAX_LENGTH. */
export const normalizeOtpCode = (code: string): string => (code || '').replace(/\D/g, '').slice(0, OTP_MAX_LENGTH);

export const isValidOtpCode = (code: string): boolean => {
  const c = normalizeOtpCode(code);
  return c.length >= OTP_MIN_LENGTH && c.length <= OTP_MAX_LENGTH;
};

/** Seconds until "Resend code" is allowed again (0 = now). */
export const secondsUntil = (timestampMs: number | null, nowMs: number = Date.now()): number =>
  timestampMs ? Math.max(0, Math.ceil((timestampMs - nowMs) / 1000)) : 0;

/** Maps a Supabase AuthError (code / status / message) to a translatable key. */
export function mapEmailOtpError(err: any): EmailOtpError {
  const message = String(err?.message || err || 'Unknown error');
  const code = String(err?.code || '');
  const lower = message.toLowerCase();
  // "For security purposes, you can only request this after 42 seconds." -> per-address cooldown
  const after = /after\s+(\d+)\s*second/i.exec(message);
  if (after) return { key: 'otpErrorRateLimit', message, retryAfterSeconds: Number(after[1]) };
  // "email rate limit exceeded" -> the whole project hit its hourly email quota (not this user's fault)
  if (code === 'over_email_send_rate_limit' || lower.includes('email rate limit')) {
    return { key: 'otpErrorEmailQuota', message };
  }
  if (code === 'over_request_rate_limit' || err?.status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return { key: 'otpErrorRateLimit', message };
  }
  if (code === 'otp_expired' || lower.includes('expired') || (lower.includes('invalid') && lower.includes('token'))) {
    return { key: 'otpErrorExpired', message };
  }
  if (code === 'signup_disabled' || code === 'otp_disabled' || lower.includes('signups not allowed')) {
    return { key: 'otpErrorSignupDisabled', message };
  }
  if (code === 'email_address_invalid' || (code === 'validation_failed' && lower.includes('email'))) {
    return { key: 'otpInvalidEmail', message };
  }
  return { message };
}

/** Web: magic links (if the template sends one) come back to /signin, where the session is picked up from the URL. */
export function emailOtpRedirectTo(): string | undefined {
  if (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin || '')) {
    return `${window.location.origin}/signin`;
  }
  return undefined;
}

/** Step 1: email the one-time code. New addresses get an account (shouldCreateUser), like the old password sign-up. */
export async function sendEmailOtp(
  supabase: Pick<SupabaseClient, 'auth'>,
  email: string,
  options: { shouldCreateUser?: boolean; emailRedirectTo?: string; data?: object; captchaToken?: string } = {},
): Promise<EmailOtpResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return { ok: false, error: { key: 'otpInvalidEmail', message: 'Invalid email' } };
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: options.shouldCreateUser ?? true,
        emailRedirectTo: options.emailRedirectTo ?? emailOtpRedirectTo(),
        ...(options.data ? { data: options.data } : {}),
        ...(options.captchaToken ? { captchaToken: options.captchaToken } : {}),
      },
    });
    if (error) return { ok: false, error: mapEmailOtpError(error) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapEmailOtpError(e) };
  }
}

/** Step 2: exchange the code for a session. */
export async function verifyEmailOtp(
  supabase: Pick<SupabaseClient, 'auth'>,
  email: string,
  code: string,
): Promise<EmailOtpResult<User>> {
  const token = normalizeOtpCode(code);
  if (!isValidOtpCode(token)) return { ok: false, error: { key: 'otpInvalidCode', message: 'Invalid code' } };
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token, type: 'email' });
    if (error) return { ok: false, error: mapEmailOtpError(error) };
    if (!data?.user || !data?.session) return { ok: false, error: { key: 'otpErrorExpired', message: 'No session returned' } };
    return { ok: true, data: data.user };
  } catch (e) {
    return { ok: false, error: mapEmailOtpError(e) };
  }
}

/** Same name rules as SupabaseAuthSync in app/_layout.tsx. */
export function activeUserFromSupabaseUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>) {
  const email = user.email || '';
  const meta: any = user.user_metadata || {};
  const fullName = meta.full_name || meta.name || '';
  return {
    id: user.id,
    email,
    firstName: meta.first_name || fullName.split(' ')[0] || email.split('@')[0] || 'User',
    lastName: meta.last_name || fullName.split(' ').slice(1).join(' ') || '',
  };
}

// ---------------------------------------------------------------------------------------------
// Confirmation way: the same signInWithOtp() call; the email (templates in kit8/auth/email-templates)
// carries BOTH the code {{ .Token }} and the link {{ .ConfirmationURL }}. The user picks which one
// the app waits for:
//   'otpCode' - type the code  -> verifyOtp()
//   'webLink' - click the link -> Supabase /verify redirects to emailRedirectTo with the session
//               (#access_token=...&auto_refresh_token=...  or  ?code=... with PKCE, or #error=...)
// ---------------------------------------------------------------------------------------------

export type EmailConfirmationWay = 'otpCode' | 'webLink';
export const EMAIL_CONFIRMATION_WAYS: EmailConfirmationWay[] = ['otpCode', 'webLink'];
export const DEFAULT_EMAIL_CONFIRMATION_WAY: EmailConfirmationWay = 'otpCode';
export const EMAIL_CONFIRMATION_WAY_STORAGE_KEY = 'auth.emailConfirmationWay.v1';

export const isEmailConfirmationWay = (v: unknown): v is EmailConfirmationWay =>
  v === 'otpCode' || v === 'webLink';

export type AuthRedirectParams =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; error: EmailOtpError };

/** Reads the Supabase auth result from a redirect / deep-link URL (hash or query). null = not an auth URL. */
export function parseAuthRedirectUrl(url: string | null | undefined): AuthRedirectParams | null {
  if (!url) return null;
  const params = new Map<string, string>();
  const add = (part: string) => {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const i = pair.indexOf('=');
      const k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
      const v = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      if (k && !params.has(k)) params.set(k, v);
    }
  };
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  if (hashAt >= 0) add(url.slice(hashAt + 1));
  if (queryAt >= 0) add(url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined));

  const errorCode = params.get('error_code');
  const error = params.get('error');
  if (error || errorCode) {
    const description = params.get('error_description') || error || errorCode || 'Sign-in link error';
    const mapped = mapEmailOtpError({ code: errorCode, message: description });
    return { kind: 'error', error: mapped.key ? mapped : { key: 'otpErrorExpired', message: description } };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return null;
}

/** Turns a redirect URL into a session. ok+null = the URL carried nothing auth-related. */
export async function completeAuthRedirect(
  supabase: Pick<SupabaseClient, 'auth'>,
  url: string | null | undefined,
): Promise<EmailOtpResult<User | null>> {
  const parsed = parseAuthRedirectUrl(url);
  if (!parsed) return { ok: true, data: null };
  if (parsed.kind === 'error') return { ok: false, error: parsed.error };
  try {
    const { data, error } = parsed.kind === 'tokens'
      ? await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken })
      : await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) return { ok: false, error: mapEmailOtpError(error) };
    return { ok: true, data: data?.user ?? null };
  } catch (e) {
    return { ok: false, error: mapEmailOtpError(e) };
  }
}
