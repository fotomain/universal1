import { readOAuthParams, sessionFromOAuthRedirect } from '../../../kit8/auth/session/oauthRedirect';

const makeSupabase = (over: any = {}) => ({
  auth: {
    exchangeCodeForSession: jest.fn(async () => ({ error: null })),
    setSession: jest.fn(async () => ({ error: null })),
    ...over,
  },
}) as any;

describe('readOAuthParams', () => {
  it('reads the query and the hash part', () => {
    expect(readOAuthParams('myapp://signin?code=abc&state=x%20y')).toEqual({ code: 'abc', state: 'x y' });
    expect(readOAuthParams('myapp://signin#access_token=a.b&refresh_token=r&expires_in=3600')).toEqual({
      access_token: 'a.b', refresh_token: 'r', expires_in: '3600',
    });
  });
  it('turns + into a space in error texts and skips malformed pairs', () => {
    expect(readOAuthParams('myapp://signin#error_description=Access+denied&bad=%E0%A4%A&ok=1')).toEqual({ error_description: 'Access denied', ok: '1' });
  });
  it('gives {} for no parameters', () => {
    expect(readOAuthParams('myapp://signin')).toEqual({});
    expect(readOAuthParams('')).toEqual({});
  });
});

describe('sessionFromOAuthRedirect', () => {
  it('exchanges a PKCE code', async () => {
    const sb = makeSupabase();
    await sessionFromOAuthRedirect(sb, 'myapp://signin?code=abc');
    expect(sb.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(sb.auth.setSession).not.toHaveBeenCalled();
  });
  it('sets the session from the implicit tokens', async () => {
    const sb = makeSupabase();
    await sessionFromOAuthRedirect(sb, 'myapp://signin#access_token=a&refresh_token=r');
    expect(sb.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });
  it('throws the words of the provider when it sent an error', async () => {
    await expect(sessionFromOAuthRedirect(makeSupabase(), 'myapp://signin#error=access_denied&error_description=User+cancelled'))
      .rejects.toThrow('User cancelled');
  });
  it('throws when the url carries no session, naming where it returned to (no secrets)', async () => {
    await expect(sessionFromOAuthRedirect(makeSupabase(), 'myapp://signin?foo=1')).rejects.toThrow('returned to: myapp://signin)');
  });
  it('passes on the error of the exchange', async () => {
    const sb = makeSupabase({ exchangeCodeForSession: jest.fn(async () => ({ error: new Error('bad code') })) });
    await expect(sessionFromOAuthRedirect(sb, 'myapp://signin?code=abc')).rejects.toThrow('bad code');
  });
});
