jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { authScheme: 'projectbudgetmanagement' } } } }));
import { authSchemeOf, AUTH_SCHEME, DEFAULT_AUTH_SCHEME } from '../../../kit8/auth/session/authScheme';

describe('authScheme', () => {
  it('reads extra.authScheme', () => {
    expect(AUTH_SCHEME).toBe('projectbudgetmanagement');
    expect(authSchemeOf({ authScheme: 'abc' })).toBe('abc');
  });
  it('falls back to myapp for a missing or bad value', () => {
    for (const v of [undefined, null, {}, { authScheme: '' }, { authScheme: 5 }, { authScheme: 'a b://' }]) {
      expect(authSchemeOf(v as any)).toBe(DEFAULT_AUTH_SCHEME);
    }
  });
});
describe('app.config.js authScheme', () => {
  const cfg = (name?: string) => {
    const saved = process.env.APP_NAME;
    if (name) process.env.APP_NAME = name; else delete process.env.APP_NAME;
    jest.resetModules();
    const c = require('../../../app.config.js').expo;
    if (saved === undefined) delete process.env.APP_NAME; else process.env.APP_NAME = saved;
    return c;
  };
  it('appPM80 returns to its own scheme', () => {
    const c = cfg('appPM80');
    expect(c.extra.authScheme).toBe('projectbudgetmanagement');
    expect(c.scheme).toEqual(['projectbudgetmanagement']);
  });
  it('the older apps keep myapp', () => {
    const c = cfg('appClothes1');
    expect(c.extra.authScheme).toBe('myapp');
    expect(c.scheme).toEqual(['myapp-clothes1', 'myapp']);
  });
});
