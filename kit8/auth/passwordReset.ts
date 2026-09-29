// "Forgot password" with Supabase (pure logic, no React - unit-tested in __tests__/auth/passwordReset.test.ts).
//
// Flow:  resetPasswordForEmail(email, { redirectTo })  ->  Supabase emails a code + a link
//        a) code: verifyOtp({ email, token, type: 'recovery' })  -> session  -> updateUser({ password })
//        b) link: opens <redirectTo>#access_token=...&type=recovery -> session (PASSWORD_RECOVERY) -> updateUser
// Docs:  https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
//
// Supabase dashboard setup (Authentication):
//   * Emails > "Reset Password": paste kit8/auth/email-templates/reset-password.html (it has {{ .Token }}
//     AND {{ .ConfirmationURL }}; the default template has only the link).
//   * URL Configuration > Redirect URLs: add http://localhost:8081/** , https://<your web domain>/** and
//     the native schemes (myapp-posts://**, myapp-cc1://**, ...). resetRedirectTo() asks for .../forgotpassword.
//   * Providers > Email > "Minimum password length": keep PASSWORD_MIN_LENGTH below in sync.
//   * Same email limits as the OTP sign-in (60 s per address, hourly project quota) - see emailOtp.ts.
// Supabase answers "ok" for unknown emails too (no account enumeration) - the UI says "if an account exists".

import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  EmailOtpError,
  EmailOtpErrorKey,
  EmailOtpResult,
  isValidEmail,
  isValidOtpCode,
  mapEmailOtpError,
  normalizeEmail,
  normalizeOtpCode,
} from './emailOtp';

/** Supabase default is 6; if you raise it in the dashboard, raise it here too. */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt limit used by Supabase Auth

export type PasswordResetErrorKey =
  | EmailOtpErrorKey
  | 'pwTooShort'
  | 'pwTooLong'
  | 'pwMismatch'
  | 'pwWeak'              // Supabase "weak_password" (dashboard password requirements)
  | 'pwSameAsOld'         // Supabase "same_password"
  | 'pwResetSessionMissing'; // no recovery session (link expired / opened in another browser)

export interface PasswordResetError extends Omit<EmailOtpError, 'key'> {
  key?: PasswordResetErrorKey;
}

export type PasswordResetResult<T = undefined> = { ok: true; data: T } | { ok: false; error: PasswordResetError };

/** null = OK; otherwise the i18n key (under `screens.`) to show. */
export function validateNewPassword(
  password: string,
  confirm: string,
  minLength: number = PASSWORD_MIN_LENGTH,
): 'pwTooShort' | 'pwTooLong' | 'pwMismatch' | null {
  const pw = password || '';
  if (pw.length < minLength) return 'pwTooShort';
  if (pw.length > PASSWORD_MAX_LENGTH) return 'pwTooLong';
  if (pw !== (confirm || '')) return 'pwMismatch';
  return null;
}

export function mapPasswordResetError(err: any): PasswordResetError {
  const message = String(err?.message || err || 'Unknown error');
  const code = String(err?.code || '');
  const lower = message.toLowerCase();
  // check "same" first: its message also starts with "New password should ..."
  if (code === 'same_password' || lower.includes('different from the old')) return { key: 'pwSameAsOld', message };
  if (code === 'weak_password' || lower.includes('weak password') || lower.includes('password should')) {
    return { key: 'pwWeak', message };
  }
  if (code === 'session_not_found' || code === 'session_expired' || lower.includes('auth session missing')) {
    return { key: 'pwResetSessionMissing', message };
  }
  return mapEmailOtpError(err);
}

/** true when the URL is Supabase's redirect after a password-reset link (#...&type=recovery). */
export function isRecoveryRedirectUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /[#?&]type=recovery(&|$)/.test(url);
}

/** Step 1: email the reset code + link. */
export async function sendPasswordResetEmail(
  supabase: Pick<SupabaseClient, 'auth'>,
  email: string,
  options: { redirectTo?: string; captchaToken?: string } = {},
): Promise<PasswordResetResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return { ok: false, error: { key: 'otpInvalidEmail', message: 'Invalid email' } };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(clean, {
      ...(options.redirectTo ? { redirectTo: options.redirectTo } : {}),
      ...(options.captchaToken ? { captchaToken: options.captchaToken } : {}),
    });
    if (error) return { ok: false, error: mapPasswordResetError(error) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapPasswordResetError(e) };
  }
}

/** Step 2a: exchange the emailed code for a (recovery) session. */
export async function verifyRecoveryCode(
  supabase: Pick<SupabaseClient, 'auth'>,
  email: string,
  code: string,
): Promise<PasswordResetResult<User>> {
  const token = normalizeOtpCode(code);
  if (!isValidOtpCode(token)) return { ok: false, error: { key: 'otpInvalidCode', message: 'Invalid code' } };
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token, type: 'recovery' });
    if (error) return { ok: false, error: mapPasswordResetError(error) };
    if (!data?.user || !data?.session) return { ok: false, error: { key: 'otpErrorExpired', message: 'No session returned' } };
    return { ok: true, data: data.user };
  } catch (e) {
    return { ok: false, error: mapPasswordResetError(e) };
  }
}

/** Step 3: set the new password (needs the session from step 2a or from the link). */
export async function updatePassword(
  supabase: Pick<SupabaseClient, 'auth'>,
  password: string,
): Promise<PasswordResetResult<User>> {
  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: mapPasswordResetError(error) };
    if (!data?.user) return { ok: false, error: { key: 'pwResetSessionMissing', message: 'No user returned' } };
    return { ok: true, data: data.user };
  } catch (e) {
    return { ok: false, error: mapPasswordResetError(e) };
  }
}
