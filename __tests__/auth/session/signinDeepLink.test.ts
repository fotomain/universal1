// A sign-in comes back to "<scheme>://signin": the app must open /user/signin, not the 404 page
import { signinDeepLinkPath } from '../../../kit8/auth/session/signinDeepLink';

it('the return link of a sign-in goes to the sign-in screen and keeps its query / hash', () => {
  expect(signinDeepLinkPath('myapp://signin?code=abc&state=s1&auth_flow=google')).toBe('/user/signin?code=abc&state=s1&auth_flow=google');
  expect(signinDeepLinkPath('/signin?code=abc')).toBe('/user/signin?code=abc');
  expect(signinDeepLinkPath('myapp://signin#access_token=t&refresh_token=r')).toBe('/user/signin#access_token=t&refresh_token=r');
  expect(signinDeepLinkPath('myapp-clothes1://signin')).toBe('/user/signin');
  expect(signinDeepLinkPath('signin/')).toBe('/user/signin');
});

it('every other link is left alone', () => {
  expect(signinDeepLinkPath('/user/signin?code=abc')).toBeNull();
  expect(signinDeepLinkPath('myapp://media/record/video')).toBeNull();
  expect(signinDeepLinkPath('/signing')).toBeNull();
  expect(signinDeepLinkPath('/signin/extra')).toBeNull();
  expect(signinDeepLinkPath('/')).toBeNull();
  expect(signinDeepLinkPath(undefined)).toBeNull();
});
