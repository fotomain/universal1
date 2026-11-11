import { MICROSOFT_PROVIDER, MICROSOFT_SCOPES, microsoftSignInArgs, microsoftWebRedirectTo } from '../../../kit8/auth/microsoft/microsoftOAuth';

it('uses the Supabase provider azure with the email scope', () => {
  expect(MICROSOFT_PROVIDER).toBe('azure');
  expect(MICROSOFT_SCOPES).toBe('email');
  expect(microsoftSignInArgs('https://app.test/user/signin')).toEqual({
    provider: 'azure',
    options: { redirectTo: 'https://app.test/user/signin', scopes: 'email' },
  });
});

it('asks Supabase not to open the browser itself on native', () => {
  expect(microsoftSignInArgs('myapp://signin', true).options).toEqual({ redirectTo: 'myapp://signin', scopes: 'email', skipBrowserRedirect: true });
});

it('web redirect = <origin>/user/signin, only for a real http(s) origin', () => {
  expect(microsoftWebRedirectTo('http://localhost:8088')).toBe('http://localhost:8088/user/signin');
  expect(microsoftWebRedirectTo('https://my-clothes1-app.expo.app')).toBe('https://my-clothes1-app.expo.app/user/signin');
  expect(microsoftWebRedirectTo('null')).toBeUndefined();
  expect(microsoftWebRedirectTo(undefined)).toBeUndefined();
});
