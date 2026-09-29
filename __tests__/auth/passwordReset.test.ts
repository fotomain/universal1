// Supabase "forgot password": pure logic (kit8/auth/passwordReset.ts).
import {
  PASSWORD_MAX_LENGTH,
  isRecoveryRedirectUrl,
  mapPasswordResetError,
  sendPasswordResetEmail,
  updatePassword,
  validateNewPassword,
  verifyRecoveryCode,
} from '../../kit8/auth/passwordReset';

const user = { id: 'u-1', email: 'a@b.com', user_metadata: {} };
const fakeSupabase = (o: { reset?: any; verify?: any; update?: any } = {}) => ({
  auth: {
    resetPasswordForEmail: jest.fn(o.reset || (async () => ({ data: {}, error: null }))),
    verifyOtp: jest.fn(o.verify || (async () => ({ data: { user, session: { access_token: 'x' } }, error: null }))),
    updateUser: jest.fn(o.update || (async () => ({ data: { user }, error: null }))),
  },
}) as any;

describe('validateNewPassword', () => {
  it('checks length and confirmation', () => {
    expect(validateNewPassword('12345', '12345')).toBe('pwTooShort');
    expect(validateNewPassword('123456', '123456')).toBeNull();
    expect(validateNewPassword('123456', '123457')).toBe('pwMismatch');
    expect(validateNewPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1), 'x'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('pwTooLong');
    expect(validateNewPassword('1234567', '1234567', 8)).toBe('pwTooShort');
  });
});

describe('mapPasswordResetError', () => {
  it.each([
    [{ code: 'weak_password', message: 'Password should contain...' }, 'pwWeak'],
    [{ code: 'same_password', message: 'New password should be different from the old password.' }, 'pwSameAsOld'],
    [{ message: 'Auth session missing!' }, 'pwResetSessionMissing'],
    [{ code: 'otp_expired', message: 'Token has expired or is invalid' }, 'otpErrorExpired'],
    [{ message: 'For security purposes, you can only request this after 12 seconds.' }, 'otpErrorRateLimit'],
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'otpErrorEmailQuota'],
  ])('%j -> %s', (err, key) => {
    expect(mapPasswordResetError(err).key).toBe(key);
  });
});

it('recognises the reset-link redirect', () => {
  expect(isRecoveryRedirectUrl('https://app.test/forgotpassword#access_token=a&refresh_token=b&type=recovery')).toBe(true);
  expect(isRecoveryRedirectUrl('myapp://forgotpassword?type=recovery&x=1')).toBe(true);
  expect(isRecoveryRedirectUrl('https://app.test/signin#access_token=a&type=magiclink')).toBe(false);
  expect(isRecoveryRedirectUrl(null)).toBe(false);
});

describe('sendPasswordResetEmail', () => {
  it('normalizes the email and passes redirectTo', async () => {
    const sb = fakeSupabase();
    const res = await sendPasswordResetEmail(sb, ' A@B.com ', { redirectTo: 'https://app.test/forgotpassword' });
    expect(res.ok).toBe(true);
    expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: 'https://app.test/forgotpassword' });
  });
  it('rejects a bad email without calling Supabase', async () => {
    const sb = fakeSupabase();
    const res = await sendPasswordResetEmail(sb, 'nope');
    expect(res).toEqual({ ok: false, error: { key: 'otpInvalidEmail', message: 'Invalid email' } });
    expect(sb.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('maps Supabase errors and thrown errors', async () => {
    const r1 = await sendPasswordResetEmail(fakeSupabase({ reset: async () => ({ error: { status: 429, message: 'x' } }) }), 'a@b.com');
    expect(!r1.ok && r1.error.key).toBe('otpErrorRateLimit');
    const r2 = await sendPasswordResetEmail(fakeSupabase({ reset: async () => { throw new Error('network down'); } }), 'a@b.com');
    expect(!r2.ok && r2.error.message).toBe('network down');
  });
});

describe('verifyRecoveryCode + updatePassword', () => {
  it('verifies with type recovery', async () => {
    const sb = fakeSupabase();
    const res = await verifyRecoveryCode(sb, 'A@b.com', '123 456');
    expect(res).toEqual({ ok: true, data: user });
    expect(sb.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'recovery' });
  });
  it('rejects short codes locally', async () => {
    const sb = fakeSupabase();
    const res = await verifyRecoveryCode(sb, 'a@b.com', '123');
    expect(!res.ok && res.error.key).toBe('otpInvalidCode');
    expect(sb.auth.verifyOtp).not.toHaveBeenCalled();
  });
  it('updates the password and maps weak/same password errors', async () => {
    const sb = fakeSupabase();
    expect(await updatePassword(sb, 'secret123')).toEqual({ ok: true, data: user });
    expect(sb.auth.updateUser).toHaveBeenCalledWith({ password: 'secret123' });
    const weak = await updatePassword(fakeSupabase({ update: async () => ({ data: {}, error: { code: 'weak_password', message: 'weak' } }) }), 'aaaaaa');
    expect(!weak.ok && weak.error.key).toBe('pwWeak');
  });
});
