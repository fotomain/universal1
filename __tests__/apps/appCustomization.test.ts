// The registry apps/appCustomization.ts: what each app (APP_NAME) adds; the PM80 items of the home FAB.
import fs from 'fs';
import path from 'path';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { configurationName: 'appPM80' } } } }));
const mockOpenProjectSettings = jest.fn();
jest.mock('../../kit8/pm/store/store_pm', () => ({ usePMStore: { getState: () => ({ openProjectSettings: mockOpenProjectSettings }) } }));
// the homes are big screens: the registry only needs them as values
['appPosts/HomeAppPostsPage', 'appCC1/HomeAppCC1', 'appOnTrend/HomeAppOnTrend', 'appClothes1/HomeAppClothes1', 'appPM80/home/HomeAppPM80'].forEach((m) =>
  jest.doMock(`../../apps/${m}`, () => ({ __esModule: true, default: function FakeHome() { return null; } })),
);

const { APP_CUSTOMIZATIONS, getAppCustomization, getAppName, DEFAULT_APP_NAME } = require('../../apps/appCustomization');
const { PM80_FAB_ROUTES } = require('../../apps/appPM80/customization');

describe('app customization registry', () => {
  it('the app is named by expoConfig.extra.configurationName', () => {
    expect(getAppName()).toBe('appPM80');
    expect(DEFAULT_APP_NAME).toBe('appClothes1');
  });

  it('every app has a home; only appPM80 adds items to the FAB; an unknown name adds nothing', () => {
    ['appPosts', 'appCC1', 'appOnTrend', 'appClothes1', 'appPM80'].forEach((n) => expect(typeof APP_CUSTOMIZATIONS[n].homeComponent).toBe('function'));
    ['appPosts', 'appCC1', 'appOnTrend', 'appClothes1'].forEach((n) => expect(APP_CUSTOMIZATIONS[n].fabExtraActions).toBeUndefined());
    expect(getAppCustomization('appNobodyKnows')).toEqual({});
    expect(getAppCustomization().fabExtraActions).toHaveLength(3);
  });

  it('appPM80: New Project, All Projects, Add Calendar event - on the home only', () => {
    const extras = getAppCustomization('appPM80').fabExtraActions;
    expect(extras.map((e: any) => e.label)).toEqual(['New Project', 'All Projects', 'Add Calendar event']);
    extras.forEach((e: any) => expect(e.routes).toEqual(PM80_FAB_ROUTES));
    expect(PM80_FAB_ROUTES).toEqual(['/home']);
    // the icons exist in the icon set of the FAB
    const glyphs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'), 'utf8'));
    extras.forEach((e: any) => expect(glyphs[e.icon]).toBeDefined());
  });

  it('All Projects and Add Calendar event go to real routes (the calendar opens a new event)', () => {
    const [, all, cal] = getAppCustomization('appPM80').fabExtraActions;
    const router = { push: jest.fn() };
    all.run({ router, signedIn: true });
    expect(router.push).toHaveBeenCalledWith('/catalog/project');
    cal.run({ router, signedIn: false });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/user/calendar', params: { new: 'event' } });
    const appDir = path.resolve(__dirname, '../../app');
    ['catalog/project', 'user/calendar', 'pm/project/dashboard', 'user/signin'].forEach((r) => {
      expect(fs.existsSync(path.join(appDir, r, 'index.tsx')) || fs.existsSync(path.join(appDir, `${r}.tsx`))).toBe(true);
    });
  });

  it('New Project: signed in = the Create New Project Assistant (first screen); a guest signs in first', () => {
    const [newProject] = getAppCustomization('appPM80').fabExtraActions;
    const router = { push: jest.fn() };
    newProject.run({ router, signedIn: true });
    expect(mockOpenProjectSettings).not.toHaveBeenCalled(); // the assistant's "Manual input" asks for the window, not the FAB
    expect(router.push).toHaveBeenCalledWith('/pm/project/assistant');

    mockOpenProjectSettings.mockClear();
    const guestRouter = { push: jest.fn() };
    newProject.run({ router: guestRouter, signedIn: false });
    expect(mockOpenProjectSettings).not.toHaveBeenCalled(); // no request is left behind for the next sign in
    expect(guestRouter.push).toHaveBeenCalledWith({ pathname: '/user/signin', params: { returnTo: '/home' } });
  });
});
