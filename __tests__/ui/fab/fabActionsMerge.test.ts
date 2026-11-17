// The items an app adds to the main FAB: which routes, in which place of the list (nearest the button, under the items the FAB has anyway).
import { fabExtrasForRoute, mergeFabActions, normalizeRoute, routeMatches } from '../../../kit8/ui/components/fab/fabActionsMerge';

const act = (id: string, routes: string[] | '*' = ['/home']) => ({ id, label: id.toUpperCase(), icon: 'plus', routes, run: () => undefined });
const item = (label: string) => ({ label });

describe('routes', () => {
  it('a route is compared without a query and a trailing slash', () => {
    expect(normalizeRoute('/home/?x=1')).toBe('/home');
    expect(normalizeRoute('')).toBe('/');
    expect(normalizeRoute(undefined)).toBe('/');
    expect(routeMatches(['/home'], '/home')).toBe(true);
    expect(routeMatches(['/home'], '/home/')).toBe(true);
    expect(routeMatches(['/home'], '/home?tab=1')).toBe(true);
    expect(routeMatches(['/home'], '/pm/business-order')).toBe(false);
    expect(routeMatches(['/home'], '/pm/project/dashboard')).toBe(false);
    expect(routeMatches('*', '/anything')).toBe(true);
    expect(routeMatches([], '/home')).toBe(false);
  });
  it('only the extras of this route are taken', () => {
    const list = [act('a'), act('b', ['/chat']), act('c', '*')];
    expect(fabExtrasForRoute(list, '/home').map((e) => e.id)).toEqual(['a', 'c']);
    expect(fabExtrasForRoute(list, '/chat').map((e) => e.id)).toEqual(['b', 'c']);
    expect(fabExtrasForRoute(undefined, '/home')).toEqual([]);
  });
});

describe('mergeFabActions', () => {
  const base = [item('Record Video'), item('Record Audio'), item('Scroll Top')];
  const extras = [item('New Project'), item('All Projects'), item('Add Calendar event')];

  it('default animation (first on top, last next to the button): the extras come AFTER the items the FAB has anyway', () => {
    expect(mergeFabActions(base, extras, false).map((x) => x.label)).toEqual([
      'Record Video', 'Record Audio', 'Scroll Top', 'New Project', 'All Projects', 'Add Calendar event',
    ]);
  });
  it('reanimated animation (first next to the button): the extras come FIRST, reversed, so the user sees the same order', () => {
    expect(mergeFabActions(base, extras, true).map((x) => x.label)).toEqual([
      'Add Calendar event', 'All Projects', 'New Project', 'Record Video', 'Record Audio', 'Scroll Top',
    ]);
  });
  it('no extras: the very same list', () => {
    expect(mergeFabActions(base, [], false)).toBe(base);
    expect(mergeFabActions(base, [], true)).toBe(base);
  });
  it('an extra that the list has already is not added twice', () => {
    const merged = mergeFabActions(base, [item('Scroll Top'), item('New Project')], false);
    expect(merged.map((x) => x.label)).toEqual(['Record Video', 'Record Audio', 'Scroll Top', 'New Project']);
  });
  it('the commands of a screen stay: only appended to', () => {
    const screen = [item('Add task'), item('Add stage')];
    expect(mergeFabActions(screen, extras, false).slice(0, 2)).toEqual(screen);
  });
});
