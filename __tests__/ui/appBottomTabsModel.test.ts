// ApplicationBottomTabsApp - the pure part: the route of a tab, the active tab, the look of every design system.
import { appBottomTabsLook, isTabActive, tabHref, withAlpha } from '../../kit8/ui/components/app_bottom_tabs/appBottomTabsModel';

describe('tabHref', () => {
  it('a leading slash is added once; the params become a query string; empty params are left out', () => {
    expect(tabHref({ tabIcon: 'x', tabTitle: 'X', tabRoute: 'posts/mediapostcrud' })).toBe('/posts/mediapostcrud');
    expect(tabHref({ tabIcon: 'x', tabTitle: 'X', tabRoute: '/posts/mediapostcrud/' })).toBe('/posts/mediapostcrud');
    expect(tabHref({ tabIcon: 'x', tabTitle: 'X', tabRoute: 'raci/racidashboard', params: { raciGUID: 'u 1', empty: '', nothing: undefined } })).toBe('/raci/racidashboard?raciGUID=u%201');
  });
  it('the extra params come first and the params of the tab win', () => {
    expect(tabHref({ tabIcon: 'x', tabTitle: 'X', tabRoute: 'a', params: { k: 'tab' } }, { k: 'extra', e: '1' })).toBe('/a?k=tab&e=1');
  });
});

describe('isTabActive', () => {
  it('the path IS the route, or lies inside it - not just a text that contains it', () => {
    expect(isTabActive('/posts/mediapostcrud', 'posts/mediapostcrud')).toBe(true);
    expect(isTabActive('/posts/mediapostcrud/', '/posts/mediapostcrud')).toBe(true);
    expect(isTabActive('/pm/project/dashboard', 'pm/project')).toBe(true);
    expect(isTabActive('/pm/projects', 'pm/project')).toBe(false);
    expect(isTabActive('/x/raci/racimember', 'raci/racimember')).toBe(false);
  });
  it('the root route is active only on the root; a missing path is active nowhere', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/home', '/')).toBe(false);
    expect(isTabActive(undefined, 'home')).toBe(false);
    expect(isTabActive(null, 'home')).toBe(false);
  });
});

describe('appBottomTabsLook', () => {
  it('every design system has a look; the MD3 family has the pill, Apple none and a translucent bar, Ant / Tamagui a top line', () => {
    for (const s of ['paper', 'googlemd3web', 'expo', 'native', 'ant', 'tamagui', 'applemacui']) {
      const l = appBottomTabsLook(s);
      expect(l.iconSize).toBeGreaterThan(0);
      expect(l.labelSize).toBeGreaterThan(0);
    }
    expect(appBottomTabsLook('paper').indicator).toBe('pill');
    expect(appBottomTabsLook('googlemd3web').indicator).toBe('pill');
    expect(appBottomTabsLook('applemacui')).toMatchObject({ indicator: 'none', background: 'translucent', elevation: 0 });
    expect(appBottomTabsLook('ant').indicator).toBe('topLine');
    expect(appBottomTabsLook('tamagui').indicator).toBe('topLine');
  });
  it('an unknown design system is the native look', () => {
    expect(appBottomTabsLook('something-new')).toEqual(appBottomTabsLook('native'));
  });
});

describe('withAlpha', () => {
  it('#rrggbb + alpha -> #rrggbbaa; other color formats are returned as they are', () => {
    expect(withAlpha('#6366f1', 1)).toBe('#6366f1ff');
    expect(withAlpha('#6366f1', 0.5)).toBe('#6366f180');
    expect(withAlpha('#6366f1', 0)).toBe('#6366f100');
    expect(withAlpha('#6366f1', 7)).toBe('#6366f1ff');
    expect(withAlpha('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)');
  });
});
