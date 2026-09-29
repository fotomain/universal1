// Supabase email one-time-code sign-in: pure logic (kit8/auth/emailOtp.ts).
import {
  activeUserFromSupabaseUser,
  isValidEmail,
  isValidOtpCode,
  mapEmailOtpError,
  normalizeEmail,
  normalizeOtpCode,
  secondsUntil,
  sendEmailOtp,
  verifyEmailOtp,
} from '../../kit8/auth/emailOtp';

const fakeSupabase = (overrides: { signInWithOtp?: any; verifyOtp?: any } = {}) => ({
  auth: {
    signInWithOtp: jest.fn(overrides.signInWithOtp || (async () => ({ data: {}, error: null }))),
    verifyOtp: jest.fn(overrides.verifyOtp || (async () => ({
      data: { user: { id: 'u-1', email: 'a@b.com', user_metadata: {} }, session: { access_token: 'x' } },
      error: null,
    }))),
  },
}) as any;

describe('email + code validation', () => {
  it('normalizes and validates emails', () => {
    expect(normalizeEmail('  Jurij@Example.COM ')).toBe('jurij@example.com');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('no at.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('keeps digits only and accepts 6-10 digit codes', () => {
    expect(normalizeOtpCode('123 456')).toBe('123456');
    expect(normalizeOtpCode('12-34-56-78-90-12')).toBe('1234567890');
    expect(isValidOtpCode('12345')).toBe(false);
    expect(isValidOtpCode('123456')).toBe(true);
    expect(isValidOtpCode('12345678')).toBe(true);
  });

  it('counts the resend cooldown down', () => {
    expect(secondsUntil(null)).toBe(0);
    expect(secondsUntil(10_000, 0)).toBe(10);
    expect(secondsUntil(10_000, 9_001)).toBe(1);
    expect(secondsUntil(10_000, 20_000)).toBe(0);
  });
});

describe('mapEmailOtpError', () => {
  it.each([
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'otpErrorEmailQuota'],
    [{ message: 'Email rate limit exceeded' }, 'otpErrorEmailQuota'],
    [{ status: 429, message: 'x' }, 'otpErrorRateLimit'],
    [{ message: 'For security purposes, you can only request this after 42 seconds.' }, 'otpErrorRateLimit'],
    [{ code: 'otp_expired', message: 'Token has expired or is invalid' }, 'otpErrorExpired'],
    [{ message: 'Token has expired or is invalid' }, 'otpErrorExpired'],
    [{ code: 'signup_disabled', message: 'Signups not allowed for otp' }, 'otpErrorSignupDisabled'],
    [{ code: 'email_address_invalid', message: 'bad' }, 'otpInvalidEmail'],
  ])('%j -> %s', (err, key) => {
    expect(mapEmailOtpError(err).key).toBe(key);
  });

  it('reads the wait time Supabase asks for', () => {
    expect(mapEmailOtpError({ code: 'over_email_send_rate_limit', status: 429, message: 'For security purposes, you can only request this after 42 seconds.' }))
      .toMatchObject({ key: 'otpErrorRateLimit', retryAfterSeconds: 42 });
  });

  it('keeps unknown errors as raw messages', () => {
    expect(mapEmailOtpError({ message: 'Database down' })).toEqual({ message: 'Database down' });
  });
});

describe('sendEmailOtp', () => {
  it('calls signInWithOtp with the cleaned email and creates users by default', async () => {
    const sb = fakeSupabase();
    const res = await sendEmailOtp(sb, ' A@B.com ', { emailRedirectTo: 'https://app.test/signin' });
    expect(res.ok).toBe(true);
    expect(sb.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      options: { shouldCreateUser: true, emailRedirectTo: 'https://app.test/signin' },
    });
  });

  it('passes shouldCreateUser=false, data and captchaToken through', async () => {
    const sb = fakeSupabase();
    await sendEmailOtp(sb, 'a@b.com', { shouldCreateUser: false, data: { plan: 'x' }, captchaToken: 'cap' });
    expect(sb.auth.signInWithOtp.mock.calls[0][0].options).toMatchObject({ shouldCreateUser: false, data: { plan: 'x' }, captchaToken: 'cap' });
  });

  it('does not call Supabase for an invalid email', async () => {
    const sb = fakeSupabase();
    const res = await sendEmailOtp(sb, 'nope');
    expect(res).toEqual({ ok: false, error: { key: 'otpInvalidEmail', message: 'Invalid email' } });
    expect(sb.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('maps Supabase errors and thrown errors', async () => {
    const rate = fakeSupabase({ signInWithOtp: async () => ({ data: {}, error: { status: 429, message: 'rate limit' } }) });
    expect(await sendEmailOtp(rate, 'a@b.com')).toMatchObject({ ok: false, error: { key: 'otpErrorRateLimit' } });
    const boom = fakeSupabase({ signInWithOtp: async () => { throw new Error('Network request failed'); } });
    expect(await sendEmailOtp(boom, 'a@b.com')).toEqual({ ok: false, error: { message: 'Network request failed' } });
  });
});

describe('verifyEmailOtp', () => {
  it('verifies with type "email" and returns the user', async () => {
    const sb = fakeSupabase();
    const res = await verifyEmailOtp(sb, 'A@b.com', '123 456');
    expect(sb.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'email' });
    expect(res).toMatchObject({ ok: true, data: { id: 'u-1' } });
  });

  it('rejects a short code without calling Supabase', async () => {
    const sb = fakeSupabase();
    expect(await verifyEmailOtp(sb, 'a@b.com', '123')).toMatchObject({ ok: false, error: { key: 'otpInvalidCode' } });
    expect(sb.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('maps an expired code and a missing session', async () => {
    const expired = fakeSupabase({ verifyOtp: async () => ({ data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } }) });
    expect(await verifyEmailOtp(expired, 'a@b.com', '123456')).toMatchObject({ ok: false, error: { key: 'otpErrorExpired' } });
    const noSession = fakeSupabase({ verifyOtp: async () => ({ data: { user: { id: 'u' }, session: null }, error: null }) });
    expect(await verifyEmailOtp(noSession, 'a@b.com', '123456')).toMatchObject({ ok: false });
  });
});

describe('activeUserFromSupabaseUser', () => {
  it('uses metadata names, else the email prefix', () => {
    expect(activeUserFromSupabaseUser({ id: '1', email: 'jurij@x.lv', user_metadata: {} } as any))
      .toEqual({ id: '1', email: 'jurij@x.lv', firstName: 'jurij', lastName: '' });
    expect(activeUserFromSupabaseUser({ id: '1', email: 'a@x.lv', user_metadata: { full_name: 'Ada Love Lace' } } as any))
      .toMatchObject({ firstName: 'Ada', lastName: 'Love Lace' });
  });
});

import { completeAuthRedirect, isEmailConfirmationWay, parseAuthRedirectUrl } from '../../kit8/auth/emailOtp';

describe('confirm via web link: redirect URL', () => {
  it('reads tokens from the hash (implicit flow)', () => {
    expect(parseAuthRedirectUrl('myapp-posts://signin#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=magiclink'))
      .toEqual({ kind: 'tokens', accessToken: 'AT', refreshToken: 'RT' });
  });

  it('reads a PKCE code from the query', () => {
    expect(parseAuthRedirectUrl('https://app.test/signin?code=abc-123')).toEqual({ kind: 'code', code: 'abc-123' });
  });

  it('maps an expired link error', () => {
    const r = parseAuthRedirectUrl('https://app.test/signin#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(r).toMatchObject({ kind: 'error', error: { key: 'otpErrorExpired', message: 'Email link is invalid or has expired' } });
  });

  it('ignores ordinary URLs', () => {
    expect(parseAuthRedirectUrl('https://app.test/signin')).toBeNull();
    expect(parseAuthRedirectUrl('https://app.test/pm/project/task?taskGUID=1')).toBeNull();
    expect(parseAuthRedirectUrl(null)).toBeNull();
  });

  it('completes the session with setSession / exchangeCodeForSession', async () => {
    const auth = {
      setSession: jest.fn(async () => ({ data: { user: { id: 'u1' }, session: {} }, error: null })),
      exchangeCodeForSession: jest.fn(async () => ({ data: { user: { id: 'u2' }, session: {} }, error: null })),
    };
    expect(await completeAuthRedirect({ auth } as any, 'x://signin#access_token=A&refresh_token=R')).toEqual({ ok: true, data: { id: 'u1' } });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'A', refresh_token: 'R' });
    expect(await completeAuthRedirect({ auth } as any, 'x://signin?code=C')).toEqual({ ok: true, data: { id: 'u2' } });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('C');
    expect(await completeAuthRedirect({ auth } as any, 'x://home')).toEqual({ ok: true, data: null });
  });

  it('validates stored confirmation ways', () => {
    expect(isEmailConfirmationWay('otpCode')).toBe(true);
    expect(isEmailConfirmationWay('webLink')).toBe(true);
    expect(isEmailConfirmationWay('sms')).toBe(false);
  });
});
